from __future__ import annotations

import hashlib
import importlib.resources
import json
import os
import platform
from functools import lru_cache
import shutil
import subprocess
import time
from pathlib import Path

import psutil


HIDDEN = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}


def recipe() -> dict:
    return json.loads(importlib.resources.files("sonariel").joinpath("recipes/windows-cpu.json").read_text(encoding="utf-8"))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def run(args: list[str], **kwargs) -> subprocess.CompletedProcess:
    return subprocess.run(args, check=True, capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=kwargs.pop("timeout", 120), **HIDDEN, **kwargs)


def inspect_environment(root: str, audacity: str = "") -> dict:
    base = Path(root).expanduser().resolve(strict=True)
    python = base / ".venv" / "Scripts" / "python.exe"
    repo = base / "ACE-Step-1.5"
    if not python.is_file() or not (repo / "acestep/api_server.py").is_file():
        raise ValueError("Destino não contém .venv e ACE-Step-1.5 reconhecidos")
    code = "import sys,json,importlib.metadata as m; print(json.dumps({'python':'.'.join(map(str,sys.version_info[:3])),'packages':{d.metadata['Name'].lower():d.version for d in m.distributions()}}))"
    versions = json.loads(run([str(python), "-c", code]).stdout)
    commit = None
    if (repo / ".git").exists():
        commit = run(["git", "-C", str(repo), "rev-parse", "HEAD"]).stdout.strip()
    marker = repo / "sonariel-recipe.json"
    if marker.is_file():
        commit = json.loads(marker.read_text())["commit"]
    model_root = (repo / "checkpoints").resolve()
    required = ["acestep-v15-turbo/model.safetensors", "vae/diffusion_pytorch_model.safetensors", "Qwen3-Embedding-0.6B/model.safetensors"]
    models = [{"name": name, "present": (model_root / name).is_file(), "bytes": (model_root / name).stat().st_size if (model_root / name).is_file() else 0} for name in required]
    downloader = (repo / "acestep/model_downloader.py").read_text(encoding="utf-8")
    section = downloader.split("MAIN_MODEL_COMPONENTS = [", 1)[1].split("]", 1)[0]
    patched = '"acestep-5Hz-lm-1.7B"' not in section
    packages = versions["packages"]
    checks = {
        "python": versions["python"] == recipe()["python"],
        "torch_cpu": packages.get("torch") == "2.7.1+cpu" and packages.get("torchaudio") == "2.7.1+cpu",
        "commit": commit == recipe()["ace_commit"],
        "models": all(model["present"] for model in models),
        "lm_patch": patched,
        "no_flash_attention": "flash-attn" not in packages,
    }
    return {"root": str(base), "python_path": str(python), "repo": str(repo), "model_root": str(model_root), "audacity": audacity, "versions": versions, "commit": commit, "models": models, "checks": checks, "compatible": all(checks.values()), "verified_at": time.time()}


def discover() -> list[dict]:
    candidates = [p for p in Path.home().iterdir() if p.is_dir() and (p / "ACE-Step-1.5").is_dir()]
    candidates.append(Path(os.environ.get("LOCALAPPDATA", Path.home())) / "Sonariel" / "engine")
    return [{"root": str(p), "recognized": True} for p in candidates if (p / ".venv/Scripts/python.exe").is_file()]


def telemetry() -> dict:
    memory = psutil.virtual_memory()
    return {"total_gib": round(memory.total / 2**30, 3), "available_gib": round(memory.available / 2**30, 3), "used_percent": memory.percent, "cpu_percent": psutil.cpu_percent(interval=.1), "cpu": platform.processor(), "platform": platform.platform(), "logical_cores": psutil.cpu_count(), "free_disk_gib": round(shutil.disk_usage(Path.home()).free / 2**30, 2)}


@lru_cache(maxsize=1)
def graphics() -> list[dict]:
    if os.name != "nt":
        return []
    try:
        result = run(["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", "Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion | ConvertTo-Json"], timeout=20)
        value = json.loads(result.stdout)
        return value if isinstance(value, list) else [value]
    except (ValueError, subprocess.SubprocessError):
        return []
