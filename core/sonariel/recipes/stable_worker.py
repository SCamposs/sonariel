"""Offline LiteRT worker; ML code never enters the orchestration process."""
import gc
import hashlib
import importlib.metadata
import json
import os
import sys
import time
from pathlib import Path


FAMILIES = {"stable-audio-3-small-music": "sa3-sm-music", "stable-audio-3-medium": "sa3-m"}
VERSIONS = {"ai-edge-litert": "2.2.0", "numpy": "1.26.4", "sentencepiece": "0.2.1", "soundfile": "0.14.0"}


def sha(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def write_progress(request_path, label):
    # Windows readers/AV may briefly deny replacement without DELETE sharing.
    # Progress is advisory: never fail an expensive render on a telemetry race.
    temporary = request_path.with_name("progress.tmp")
    for attempt in range(6):
        try:
            temporary.write_text(json.dumps({"stage": label}), encoding="utf-8")
            temporary.replace(request_path.with_name("progress.json"))
            return
        except PermissionError:
            time.sleep(min(.01 * 2**attempt, .16))
    print("Progress file temporarily unavailable; stage: " + label, flush=True)


def source_audio(params, target_samples, resampler):
    """Read the full source, resample only for the codec, and pad its latent grid."""
    import numpy as np
    import soundfile as sf
    path = Path(params["source_path"])
    if sha(path) != params["source_sha256"]:
        raise ValueError("Source audio changed after enqueue")
    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if audio.shape[1] not in (1, 2) or not np.isfinite(audio).all():
        raise ValueError("Source must contain finite mono/stereo audio")
    if abs(len(audio)/rate - params["duration"]) > 1/rate:
        raise ValueError("Source duration changed")
    if audio.shape[1] == 1:
        audio = np.repeat(audio, 2, axis=1)
    if rate != 44100:
        audio = resampler.resample(audio, rate, 44100, quality="HQ")
    audio = audio.T
    if audio.shape[-1] > target_samples:
        raise ValueError("Codec grid would trim source content")
    audio = np.pad(audio, ((0, 0), (0, target_samples-audio.shape[-1])))
    return audio[None], dict(input_sample_rate=rate, codec_sample_rate=44100,
                            resampling="soxr HQ" if rate != 44100 else "none", full_source=True)


def mix_source_noise(initial, noise, sigma):
    import numpy as np
    if not .01 <= sigma < 1 or initial.shape != noise.shape or not np.isfinite(initial).all():
        raise ValueError("Invalid audio2audio latent initialization")
    return initial.astype(np.float32)*(1-sigma) + noise*sigma


def main():
    request_path = Path(sys.argv[1])
    request = json.loads(request_path.read_text(encoding="utf-8"))
    params, config = request["params"], request["config"]
    output = Path(request["output"])
    if output.exists() or output.with_suffix(".json").exists():
        raise ValueError("Output already exists")
    if not config.get("accepted_licenses"):
        raise ValueError("Explicit Stability Community and Gemma acceptance required")
    versions = {key: importlib.metadata.version(key) for key in VERSIONS}
    if versions != VERSIONS:
        raise ValueError("Pinned LiteRT runtime changed")
    manifest = json.loads(Path(__file__).with_name("stable-models.json").read_text(encoding="utf-8"))
    source, models = Path(config["source"]), Path(config["models"])
    family = FAMILIES[params["_engine"]]
    quality = params.get('quality_profile', 'compact')
    if quality not in {'compact', 'fidelity'} or quality=='fidelity' and (family!='sa3-m' or params.get('mode','text2audio')!='text2audio'):
        raise ValueError('FP32/SAME-L requires Medium text2audio')
    dit_path = f'tflite/{family}/dit_fp32.tflite' if quality=='fidelity' else f'tflite/{family}/dit_w8a8.tflite'
    decoder_path = 'tflite/same-l/dec_fp32.tflite' if quality=='fidelity' else 'tflite/same-s/dec_w8a8.tflite'
    audio_input = params.get("mode", "text2audio") == "audio2audio"
    if params.get("mode", "text2audio") not in {"text2audio", "audio2audio"}:
        raise ValueError("Unsupported Stable Audio mode")
    checkpoint_paths = {dit_path, 'tflite/t5gemma/encoder_fp16.tflite', decoder_path}
    if audio_input:
        checkpoint_paths.add("tflite/same-s/enc_w8a8.tflite")
        if importlib.metadata.version("soxr") != "1.0.0":
            raise ValueError("Pinned source-audio resampler is missing or changed")
    for file in manifest["source_files"]:
        path = source / file["path"]
        digest = hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest() if path.suffix==".py" else sha(path)
        if digest != file["sha256"]:
            raise ValueError("Pinned source changed: " + file["path"])
    checkpoints = [file for file in manifest["files"] if file["path"] in checkpoint_paths]
    for file in checkpoints:
        if sha(models / file["path"]) != file["sha256"]:
            raise ValueError("Checkpoint changed: " + file["path"])
    os.environ["HF_HUB_OFFLINE"] = "1"
    repo = source / "optimized/tflite"
    sys.path[:0] = [str(repo), str(repo / "scripts")]
    times = {}
    def stage(label):
        write_progress(request_path, label)
    def timed(key, label, action):
        stage(label)
        start = time.perf_counter()
        result = action()
        times[key] = time.perf_counter() - start
        return result
    started = time.perf_counter()
    import numpy as np
    import soundfile as sf
    from models.defs import tflite_pipeline as pipeline
    from sa3_tflite import make_dit_backend, valid_T_lat
    from rung_decoder import RungDecoder
    if "torch" in sys.modules:
        raise ValueError("Unexpected PyTorch import in LiteRT worker")
    imports = time.perf_counter() - started
    seconds, steps, seed = params["duration"], params["steps"], params["seed"]
    ids, mask = timed("tokenize", "LiteRT CPU: tokenizar prompt", lambda: pipeline.Tokenizer()(params["prompt"]))
    text_model = timed("text_load", "LiteRT CPU: carregar T5Gemma", lambda: pipeline.T5GemmaTFLite(models / "tflite/t5gemma/encoder_fp16.tflite", 6))
    hidden = timed("text_infer", "LiteRT CPU: codificar texto", lambda: text_model(ids, mask))
    del text_model
    gc.collect()
    length = valid_T_lat(seconds)
    x0, noises = pipeline.make_noise(length, steps, seed)
    source_info = None
    sigma = 1.
    if audio_input:
        import soxr
        from rung_encoder import RungEncoder
        enc_length = length + 1 if length % 2 else length
        source, source_info = timed("source_read", "LiteRT CPU: ler fonte completa", lambda: source_audio(params, enc_length*4096, soxr))
        encoder = timed("audio_encoder_load", "LiteRT CPU: carregar encoder de áudio", lambda: RungEncoder(models / "tflite/same-s/enc_w8a8.tflite", threads=6, trim=16, max_rung=128))
        initial = timed("audio_encode", "LiteRT CPU: codificar fonte em latentes", lambda: encoder.encode(source)[:, :, :length])
        sigma = params["init_noise_level"]
        x0 = mix_source_noise(initial, x0, sigma)
        del encoder, source, initial
        gc.collect()
    backend = timed("dit_load", "LiteRT CPU: carregar DiT", lambda: make_dit_backend(
        models / dit_path, length, hidden, mask.astype(np.float32), seconds, 6,
        cfg=1., apg=1., null_hidden=None, null_mask=None, local_add_cond=None, batched=False))
    actual_steps = []
    def progress(i, total):
        actual_steps.append([i, total])
        stage(f"LiteRT CPU: passo {i}/{total}")
    latents = timed("dit_infer", "LiteRT CPU: amostrar áudio", lambda: pipeline.sample(
        backend, x0, noises, pipeline.build_pingpong_schedule(steps, sigma), None, None, on_step=progress))
    del backend
    gc.collect()
    decoder = timed("decoder_load", "LiteRT CPU: carregar decoder", lambda: RungDecoder(models / decoder_path, threads=6, trim=12 if quality=='fidelity' else 16, max_rung=128 if quality=='fidelity' else None))
    decode_latents = np.concatenate([latents, latents[:, :, -1:]], axis=2) if quality=='compact' and length % 2 else latents
    audio = timed("decode", "LiteRT CPU: decodificar WAV", lambda: decoder.decode(decode_latents))[0, :, :round(seconds * 44100)].T
    if audio.shape != (round(seconds * 44100), 2) or not np.isfinite(audio).all() or np.max(np.abs(audio)) <= 1e-5:
        raise ValueError("Invalid model output")
    if audio_input and sha(Path(params["source_path"])) != params["source_sha256"]:
        raise ValueError("Source audio changed during generation")
    # Preserve original model samples, including over-full-scale values if any.
    sf.write(output, audio, 44100, subtype="FLOAT")
    receipt = dict(engine=params["_engine"], parameters=params, source_commit=manifest["code_commit"],
        model_revision=manifest["revision"], checkpoints=checkpoints, runtime_versions=versions,
        imports_seconds=imports, timings=times,
        load_seconds=sum(times.get(key, 0) for key in ("text_load", "audio_encoder_load", "dit_load", "decoder_load")),
        inference_seconds=sum(times.get(key, 0) for key in ("text_infer", "audio_encode", "dit_infer", "decode")),
        mode=params.get("mode", "text2audio"), source_info=source_info,
        actual_sampling_steps=actual_steps, sha256=sha(output), sample_rate=44100, channels=2,
        duration_seconds=len(audio)/44100, raw_peak=float(np.max(np.abs(audio))),
        samples_over_full_scale=int(np.sum(np.abs(audio) >= 1)), backend="LiteRT CPU", threads=6,
        quality_profile=quality, precision='DiT fp32 / SAME-L fp32 / T5Gemma fp16' if quality=='fidelity' else 'DiT w8a8 / SAME-S w8a8 / T5Gemma fp16', cfg=1., apg=1.,
        export="Original float32 waveform; no limiter, normalization or deliberate watermark removal",
        attribution="Powered by Stability AI", license="Stability Community + Gemma terms")
    output.with_suffix(".json").write_text(json.dumps(receipt, indent=2, allow_nan=False), encoding="utf-8")


if __name__ == "__main__":
    main()
