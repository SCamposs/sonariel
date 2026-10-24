"""Owned, bounded subprocess execution; no ML imports in the orchestration core."""
from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from pathlib import Path

import psutil

from .environment import HIDDEN

LANGUAGES = dict(ar="Arabic", da="Danish", de="German", el="Greek", en="English",
    es="Spanish", fi="Finnish", fr="French", he="Hebrew", hi="Hindi", it="Italian",
    ja="Japanese", ko="Korean", ms="Malay", nl="Dutch", no="Norwegian", pl="Polish",
    pt="Portuguese", ru="Russian", sv="Swedish", sw="Swahili", tr="Turkish", zh="Chinese")
VOICE_ID = "chatterbox-v3"
FX_ID = "native-fx"


def fx_binary() -> Path:
    if getattr(sys, "frozen", False):
        return Path(sys._MEIPASS) / "sonariel/bin/sonariel-fx.exe"
    return Path(__file__).resolve().parents[2] / "native/fx/target/release/sonariel-fx.exe"


def catalog(store) -> list[dict]:
    def item(key, name, category, license, backend, modes, ready=False, **extra):
        return dict(id=key, name=name, category=category, license=license, backend=backend,
                    modes=modes, installed=ready, compatible=ready, experimental=True, **extra)
    voice = store.setting("voice_environment")
    return [
        item("acestep-v15-turbo", "ACE-Step 1.5 Turbo", "music", "MIT", "torch-cpu",
             ["text2music", "cover"], bool(store.setting("environment")), baseline=True),
        item("acestep-v15-sft", "ACE-Step 1.5 SFT", "music", "MIT", "torch-cpu",
             ["text2music", "cover"], blocked_reason="Isolated validation pending"),
        item("stable-audio-3-small-music", "Stable Audio 3 Small-Music", "music",
             "Stability Community + Gemma terms", "litert-cpu", ["text2audio", "audio2audio", "inpaint"],
             requires_license_acceptance=True, blocked_reason="License acceptance and isolated validation pending"),
        item("stable-audio-3-medium", "Stable Audio 3 Medium", "music",
             "Stability Community + Gemma terms", "litert-cpu", ["text2audio", "audio2audio", "inpaint"],
             requires_license_acceptance=True, blocked_reason="License acceptance and isolated validation pending"),
        item(VOICE_ID, "Chatterbox Multilingual V3", "voice", "MIT; dependency notices apply", "torch-cpu",
             ["text2speech", "authorized_voice_reference"], bool(voice), languages=LANGUAGES,
             language_paths_tested=["sw", "pt"], omitted_optional_preprocessors=["zh", "ja"],
             minimum_available_gib=7.5, continuation=False, voice_identity_verified=False),
        item(FX_ID, "Sonariel native DSP", "fx", "Sonariel + upstream MIT/Apache notices", "native-cpu",
             ["ordered_chain", "layers", "pitch", "formants", "render", "bypass"], fx_binary().is_file()),
    ]


class LocalRunner:
    def __init__(self, store):
        self.store = store

    def owned(self):
        record = self.store.setting("local_process")
        if not record:
            return None
        try:
            proc = psutil.Process(record["pid"])
            return proc if abs(proc.create_time() - record["created"]) < .1 and proc.is_running() else None
        except psutil.Error:
            return None

    def run(self, job, sample):
        if self.owned():
            raise RuntimeError("Processamento local anterior ainda ativo; não será duplicado")
        params = job["params"]
        folder = self.store.home / "run" / job["id"]
        folder.mkdir(exist_ok=False)
        output = self.store.home / "output" / (job["id"] + ".wav")
        if params["_engine"] == FX_ID:
            preset = folder / "preset.json"
            preset.write_text(json.dumps(params["recipe"], allow_nan=False), encoding="utf-8")
            source_path = params["source_path"]
            if params.get("preview"):
                import soundfile as sf
                with sf.SoundFile(source_path) as source:
                    excerpt = source.read(frames=source.samplerate*10, dtype="float32", always_2d=True)
                    preview = folder / "preview-source.wav"
                    sf.write(preview,excerpt,source.samplerate,subtype="FLOAT")
                source_path = str(preview)
            command = [str(fx_binary()), source_path, str(output), str(preset)]
            maximum_rss = 4
        elif params["_engine"] == VOICE_ID:
            config = self.store.setting("voice_environment")
            if not config:
                raise ValueError("Configure o ambiente Chatterbox V3 antes de gerar")
            request = folder / "request.json"
            request.write_text(json.dumps(dict(params=params, models=config["models"], output=str(output))), encoding="utf-8")
            command = [config["python"], str(Path(__file__).with_name("recipes") / "voice_worker.py"), str(request)]
            maximum_rss = 9
        else:
            raise ValueError("Adaptador local não reconhecido")
        env = os.environ.copy()
        env.update(HF_HUB_OFFLINE="1", HF_HOME=str(self.store.home / "cache/voice"),
                   OMP_NUM_THREADS="6", MKL_NUM_THREADS="6")
        log_path = self.store.home / "logs" / (job["id"] + ".log")
        started = time.monotonic()
        peak = 0.
        with log_path.open("xb") as log:
            process = subprocess.Popen(command, env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log, **HIDDEN)
        owned = psutil.Process(process.pid)
        self.store.set("local_process", dict(pid=process.pid, created=owned.create_time(), job_id=job["id"]))
        safety_error = None
        try:
            while process.poll() is None:
                try:
                    rss = sum(p.memory_info().rss for p in [owned, *owned.children(recursive=True)] if p.is_running()) / 2**30
                    peak = max(peak, rss)
                    sample(rss)
                    if psutil.virtual_memory().available < 2.5 * 2**30 or rss > maximum_rss:
                        safety_error = "Limite de segurança de memória atingido; somente o processo deste job foi interrompido"
                        break
                    if time.monotonic() - started > 1800:
                        safety_error = "Tempo limite de 30 minutos no adaptador local"
                        break
                except psutil.NoSuchProcess:
                    break
                time.sleep(.1)
            if safety_error:
                for p in reversed([owned, *owned.children(recursive=True)]):
                    try:
                        p.kill()
                    except psutil.NoSuchProcess:
                        pass
                process.wait(timeout=15)
                raise RuntimeError(safety_error)
            if process.wait() != 0:
                raise RuntimeError("Processamento falhou; consulte " + log_path.name)
            receipt = json.loads(output.with_suffix(".json").read_text(encoding="utf-8"))
            return output, receipt, dict(processing_seconds=round(time.monotonic()-started, 3),
                peak_rss_gib=peak, rss_measurement="process tree sampled every 100ms; short process peaks may be missed")
        finally:
            # Do not discard ownership on a still-live child after a Python error.
            if process.poll() is not None:
                self.store.set("local_process", None)
