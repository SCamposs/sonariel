"""Pinned voice worker. This is the only component importing the TTS runtime."""
import hashlib
import json
import importlib.metadata
import random
import sys
import time
from pathlib import Path


def main():
    request = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    params = request["params"]
    output = Path(request["output"])
    if output.exists() or output.with_suffix(".json").exists():
        raise ValueError("Output already exists")
    versions={name:importlib.metadata.version(name) for name in ("torch","torchaudio","chatterbox-tts","resemble-perth")}
    assert versions=={"torch":"2.6.0+cpu","torchaudio":"2.6.0+cpu","chatterbox-tts":"0.1.7","resemble-perth":"1.1.0"}, "Pinned runtime changed"
    manifest=json.loads(Path(__file__).with_name("voice-models.json").read_text(encoding="utf-8"))
    for file in manifest["files"]:
        path=Path(request["models"])/file["file"]
        with path.open("rb") as stream:
            assert hashlib.file_digest(stream,"sha256").hexdigest()==file["sha256"], "Checkpoint changed"
    started = time.perf_counter()
    import numpy as np
    import soundfile as sf
    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS
    imports = time.perf_counter() - started
    assert torch.version.cuda is None, "CPU-only runtime required"
    torch.set_num_threads(6)
    torch.set_num_interop_threads(2)
    seed = params["seed"]
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    started = time.perf_counter()
    model = ChatterboxMultilingualTTS.from_local(Path(request["models"]), "cpu", t3_model="v3")
    load = time.perf_counter() - started
    assert model.watermarker is not None
    started = time.perf_counter()
    # Exact requested string; no autocorrection, additions, or language-specific rules.
    wav = model.generate(params["text"], language_id=params["language"],
        audio_prompt_path=params.get("reference_path"), **params["expressivity"])
    generation = time.perf_counter() - started
    data = wav.squeeze(0).numpy()
    assert data.ndim == 1 and np.isfinite(data).all() and np.max(np.abs(data)) > 1e-5
    # Float WAV preserves the complete unmodified official generator output,
    # including any over-full-scale samples (reported, never silently flattened).
    sf.write(output, data, model.sr, subtype="FLOAT")
    with output.open("rb") as f:
        digest = hashlib.file_digest(f,"sha256").hexdigest()
    receipt = dict(engine="chatterbox-v3", model="t3_mtl23ls_v3.safetensors", seed=seed,
        runtime_versions=versions, checkpoint_revision=manifest["revision"],
        checkpoint_sha256=next(f["sha256"] for f in manifest["files"] if f["file"]=="t3_mtl23ls_v3.safetensors"),
        source_commit="5de7a54aa4e5e2baadb0182dde554908b48b85c2",
        parameters=params, imports_seconds=imports, load_seconds=load,
        inference_seconds=generation, sample_rate=model.sr, channels=1,
        duration_seconds=len(data)/model.sr, raw_peak=float(np.max(np.abs(data))),
        samples_over_full_scale=int(np.sum(np.abs(data)>=1)), sha256=digest,
        watermark="Official PerTh applied by unchanged generate; not disabled",
        pronunciation_verified=False, voice_identity_verified=False)
    output.with_suffix(".json").write_text(json.dumps(receipt, ensure_ascii=False, indent=2),encoding="utf-8")


if __name__ == "__main__":
    main()
