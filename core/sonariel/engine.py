from __future__ import annotations

import json
import os
import re
import subprocess
import time
from pathlib import Path
from urllib.parse import urlparse

import numpy as np
import psutil
import requests
import soundfile as sf

from .environment import HIDDEN
from .store import Store

API = "http://127.0.0.1:8001"


def inspect_wav(path: Path) -> dict:
    audio, rate = sf.read(path, dtype="float32", always_2d=True)
    if not audio.size or not np.all(np.isfinite(audio)):
        raise ValueError("Áudio vazio ou com amostras inválidas")
    peak = float(np.max(np.abs(audio)))
    rms = float(np.sqrt(np.mean(audio.astype(np.float64) ** 2)))
    if peak < 1e-5 or rms < 1e-6:
        raise ValueError("Áudio silencioso")
    blocks = np.array_split(audio, min(160, len(audio)))
    peaks = [round(float(np.max(np.abs(block))), 5) for block in blocks]
    info = sf.info(path)
    return {"duration": len(audio) / rate, "sample_rate": rate, "channels": audio.shape[1], "peak": peak, "rms": rms, "subtype": info.subtype, "waveform": peaks}


class Engine:
    def __init__(self, store: Store):
        self.store = store
        self.process: subprocess.Popen | None = None
        self.status = "stopped"
        self.last_load_seconds: float | None = None
        self.last_used = time.monotonic()
        self.log_path = store.home / "logs" / "engine.log"

    def health(self) -> dict | None:
        try:
            response = requests.get(API + "/health", timeout=2)
            response.raise_for_status()
            data = response.json()["data"]
            return data
        except (requests.RequestException, KeyError, ValueError):
            return None

    def owned_process(self) -> psutil.Process | None:
        record = self.store.setting("engine_process")
        if not record:
            return None
        try:
            process = psutil.Process(record["pid"])
            if abs(process.create_time() - record["created"]) > 0.1:
                return None
            return process
        except psutil.Error:
            return None

    def rss(self) -> float:
        process = self.owned_process()
        if not process:
            return 0
        try:
            return sum(p.memory_info().rss for p in [process, *process.children(recursive=True)] if p.is_running()) / 2**30
        except psutil.Error:
            return 0

    def start(self, sample=None) -> float:
        health = self.health()
        if health:
            if not self.owned_process():
                raise RuntimeError("Porta 8001 ocupada por motor externo. Pare-o com seu comando original antes de gerenciar pelo Sonariel.")
            if health.get("llm_initialized") or health.get("loaded_model") != "acestep-v15-turbo":
                raise RuntimeError("Motor ativo fora do perfil CPU validado")
            self.status = "ready"
            return 0
        config = self.store.setting("environment")
        if not config or not config.get("compatible"):
            raise RuntimeError("Vincule um ambiente compatível antes de gerar")
        env = os.environ.copy()
        flags = {"API_HOST": "127.0.0.1", "API_PORT": "8001", "API_WORKERS": "1", "QUEUE_WORKERS": "1", "CONFIG_PATH": "acestep-v15-turbo", "DEVICE": "cpu", "INIT_LLM": "false", "USE_FLASH_ATTENTION": "false", "COMPILE_MODEL": "false", "OFFLOAD_TO_CPU": "false", "OFFLOAD_DIT_TO_CPU": "false", "NO_INIT": "false", "DOWNLOAD_SOURCE": "huggingface"}
        env.update({"ACESTEP_" + key: value for key, value in flags.items()})
        # Engine caches are application-owned; never overwrite baseline logs/config.
        for key, sub in (("HF_HOME", "cache/huggingface"), ("HF_HUB_CACHE", "cache/huggingface/hub"), ("TEMP", "run/tmp"), ("TMP", "run/tmp")):
            path = self.store.home / sub
            path.mkdir(parents=True, exist_ok=True)
            env[key] = str(path)
        self.status = "loading"
        start = time.monotonic()
        with self.log_path.open("ab") as log:
            self.process = subprocess.Popen([config["python_path"], "-m", "acestep.api_server", "--host", "127.0.0.1", "--port", "8001", "--download-source", "huggingface"], cwd=config["repo"], env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log, **HIDDEN)
        process = psutil.Process(self.process.pid)
        self.store.set("engine_process", {"pid": process.pid, "created": process.create_time()})
        while time.monotonic() - start < 900:
            if sample:
                sample()
            if self.process.poll() is not None:
                self.status = "error"
                raise RuntimeError("Motor encerrou ao carregar. Consulte o log do motor no diagnóstico.")
            health = self.health()
            if health and health.get("models_initialized"):
                if health.get("llm_initialized"):
                    self.stop()
                    raise RuntimeError("LM ativo inesperadamente")
                self.status = "ready"
                self.last_load_seconds = round(time.monotonic() - start, 3)
                return self.last_load_seconds
            time.sleep(1)
        raise TimeoutError("Tempo limite ao carregar motor")

    def stop(self) -> dict:
        process = self.owned_process()
        if process:
            children = process.children(recursive=True)
            for child in reversed(children):
                try:
                    child.terminate()
                except psutil.Error:
                    pass
            process.terminate()
            psutil.wait_procs([process, *children], timeout=10)
        self.store.set("engine_process", None)
        self.status = "stopped"
        return {"state": "stopped", "owned_process_stopped": bool(process)}

    @staticmethod
    def api(path: str, payload: dict | None = None, files=None):
        if files:
            response = requests.post(API + path, data={k: str(v).lower() if isinstance(v, bool) else str(v) for k, v in payload.items()}, files=files, timeout=120)
        else:
            response = requests.post(API + path, json=payload, timeout=30)
        response.raise_for_status()
        body = response.json()
        if body.get("code") != 200 or body.get("error"):
            raise RuntimeError(str(body))
        return body["data"]

    def submit(self, params: dict) -> str:
        from contextlib import ExitStack
        payload = {**params}
        with ExitStack() as stack:
            files = {}
            for key, field in (("reference_audio_path", "reference_audio"), ("src_audio_path", "src_audio")):
                value = payload.pop(key, None)
                if value:
                    path = Path(value)
                    files[field] = (path.name, stack.enter_context(path.open("rb")), "audio/wav")
            return self.api("/release_task", payload, files or None)["task_id"]

    def result(self, task_id: str) -> dict | None:
        row = self.api("/query_result", {"task_id_list": [task_id]})[0]
        if row["status"] == 2:
            raise RuntimeError(str(row))
        if row["status"] == 1:
            return json.loads(row["result"])[0]
        return None

    def download(self, result: dict, path: Path) -> dict:
        source = result["file"]
        if not source.startswith("/v1/audio?") or urlparse(source).netloc:
            raise RuntimeError("URL de resultado não reconhecida")
        with requests.get(API + source, stream=True, timeout=120) as response:
            response.raise_for_status()
            with path.open("xb") as stream:
                for chunk in response.iter_content(1024 * 1024):
                    stream.write(chunk)
        return inspect_wav(path)

    def inference_seconds(self, result: dict) -> float | None:
        match = re.search(r"DiT phase.*?:\s*([\d.]+)s", result.get("generation_info", ""))
        return float(match[1]) if match else None
