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
    checkpoint_paths = {f"tflite/{family}/dit_w8a8.tflite", "tflite/t5gemma/encoder_fp16.tflite", "tflite/same-s/dec_w8a8.tflite"}
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
        # Atomic replacement prevents the parent observing partially written JSON.
        temporary = request_path.with_name("progress.tmp")
        temporary.write_text(json.dumps({"stage": label}), encoding="utf-8")
        temporary.replace(request_path.with_name("progress.json"))
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
    backend = timed("dit_load", "LiteRT CPU: carregar DiT", lambda: make_dit_backend(
        models / f"tflite/{family}/dit_w8a8.tflite", length, hidden, mask.astype(np.float32), seconds, 6,
        cfg=1., apg=1., null_hidden=None, null_mask=None, local_add_cond=None, batched=False))
    actual_steps = []
    def progress(i, total):
        actual_steps.append([i, total])
        stage(f"LiteRT CPU: passo {i}/{total}")
    latents = timed("dit_infer", "LiteRT CPU: amostrar áudio", lambda: pipeline.sample(
        backend, x0, noises, pipeline.build_pingpong_schedule(steps), None, None, on_step=progress))
    del backend
    gc.collect()
    decoder = timed("decoder_load", "LiteRT CPU: carregar decoder", lambda: RungDecoder(models / "tflite/same-s/dec_w8a8.tflite", threads=6, trim=16))
    decode_latents = np.concatenate([latents, latents[:, :, -1:]], axis=2) if length % 2 else latents
    audio = timed("decode", "LiteRT CPU: decodificar WAV", lambda: decoder.decode(decode_latents))[0, :, :round(seconds * 44100)].T
    if audio.shape != (round(seconds * 44100), 2) or not np.isfinite(audio).all() or np.max(np.abs(audio)) <= 1e-5:
        raise ValueError("Invalid model output")
    # Preserve original model samples, including over-full-scale values if any.
    sf.write(output, audio, 44100, subtype="FLOAT")
    receipt = dict(engine=params["_engine"], parameters=params, source_commit=manifest["code_commit"],
        model_revision=manifest["revision"], checkpoints=checkpoints, runtime_versions=versions,
        imports_seconds=imports, timings=times,
        load_seconds=sum(times[key] for key in ("text_load", "dit_load", "decoder_load")),
        inference_seconds=sum(times[key] for key in ("text_infer", "dit_infer", "decode")),
        actual_sampling_steps=actual_steps, sha256=sha(output), sample_rate=44100, channels=2,
        duration_seconds=len(audio)/44100, raw_peak=float(np.max(np.abs(audio))),
        samples_over_full_scale=int(np.sum(np.abs(audio) >= 1)), backend="LiteRT CPU", threads=6,
        precision="DiT w8a8 / SAME-S w8a8 / T5Gemma fp16", cfg=1., apg=1.,
        export="Original float32 waveform; no limiter, normalization or deliberate watermark removal",
        attribution="Powered by Stability AI", license="Stability Community + Gemma terms")
    output.with_suffix(".json").write_text(json.dumps(receipt, indent=2, allow_nan=False), encoding="utf-8")


if __name__ == "__main__":
    main()
