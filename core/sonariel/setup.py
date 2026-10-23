from __future__ import annotations

import importlib.resources
import json
import os
import platform
import shutil
import time
import zipfile
from pathlib import Path

import psutil
import requests

from .environment import inspect_environment, recipe, run, sha256, telemetry
from .store import Store


def resource(name: str) -> Path:
    return Path(str(importlib.resources.files("sonariel").joinpath("recipes", name)))


def download(url: str, destination: Path, expected: str, event=lambda *_: None) -> Path:
    if destination.is_file() and sha256(destination) == expected:
        event("cache", destination.name + " verificado")
        return destination
    destination.parent.mkdir(parents=True, exist_ok=True)
    partial = destination.with_suffix(destination.suffix + ".part")
    offset = partial.stat().st_size if partial.exists() else 0
    headers = {"Range": f"bytes={offset}-"} if offset else {}
    with requests.get(url, stream=True, headers=headers, timeout=(30, 90)) as response:
        if response.status_code == 416:
            if sha256(partial) == expected:
                partial.replace(destination)
                return destination
            partial.unlink()
            return download(url, destination, expected, event)
        response.raise_for_status()
        mode = "ab" if offset and response.status_code == 206 else "wb"
        with partial.open(mode) as stream:
            for chunk in response.iter_content(4 * 1024 * 1024):
                stream.write(chunk)
    if sha256(partial) != expected:
        raise RuntimeError("Integridade SHA-256 inválida: " + destination.name)
    partial.replace(destination)
    event("download", destination.name + " íntegro")
    return destination


def extract(archive: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    root = destination.resolve()
    with zipfile.ZipFile(archive) as zip_file:
        for entry in zip_file.infolist():
            target = (root / entry.filename).resolve()
            if not target.is_relative_to(root):
                raise ValueError("Arquivo ZIP contém caminho externo")
        zip_file.extractall(root)


def prepare_audacity(executable: Path) -> dict:
    if any(p.info["name"] and p.info["name"].lower() == "audacity.exe" for p in psutil.process_iter(["name"])):
        return {"configured": False, "manual_action": "Audacity está aberto. Feche-o após salvar seus projetos para preparar mod-script-pipe com segurança."}
    config = executable.parent / "Portable Settings" / "audacity.cfg"
    config.parent.mkdir(exist_ok=True)
    if config.exists():
        shutil.copy2(config, config.with_suffix(f".backup-{int(time.time())}"))
        text = config.read_text(encoding="utf-8")
    else:
        text = ""
    import re
    if "[Module]" in text:
        if re.search(r"(?m)^mod-script-pipe=", text):
            text = re.sub(r"(?m)^mod-script-pipe=.*$", "mod-script-pipe=1", text)
        else:
            text = text.replace("[Module]", "[Module]\nmod-script-pipe=1", 1)
    else:
        text += "\n[Module]\nmod-script-pipe=1\n"
    config.write_text(text, encoding="utf-8")
    return {"configured": True, "tested": False, "config": str(config)}


def completion_stage(audacity_setup: dict | None) -> str:
    action = (audacity_setup or {}).get("manual_action")
    return "Motor instalado e verificado. " + action if action else "Ambiente instalado e verificado"


class Setup:
    def __init__(self, store: Store):
        self.store = store

    def plan(self, destination: str) -> dict:
        root = Path(destination).expanduser().resolve()
        if root == Path(root.anchor) or root == Path.home() or (root / ".git").exists():
            raise ValueError("Escolha uma subpasta dedicada fora de um repositório")
        for parent in [root, *root.parents]:
            if (parent / ".git").exists():
                raise ValueError("O motor deve ficar fora do Git")
        host = telemetry()
        return {"destination": str(root), "recipe": recipe(), "hardware": host, "supported": os.name == "nt" and platform.machine().lower() in {"amd64", "x86_64"} and host["total_gib"] >= recipe()["minimum_total_ram_gib"], "components": ["uv gerenciado", "Python 3.12.10", "PyTorch CPU", "ACE-Step no commit validado", "DiT Turbo + VAE + text encoder", "Audacity 3.7.9 portátil"], "estimated_download_gib": 7, "disk_required_gib": 16, "requires_authorization": True}

    def install(self, destination: str, authorized: bool, model_cache: str = "", audacity: str = "") -> dict:
        if not authorized:
            raise ValueError("Autorize explicitamente a receita e o destino antes de instalar")
        plan = self.plan(destination)
        if not plan["supported"]:
            raise ValueError("Perfil implementado: Windows x64 com pelo menos 24 GB de RAM")
        root = Path(plan["destination"])
        existing = list(root.iterdir()) if root.exists() else []
        marker = root / "sonariel-install.json"
        if existing and not marker.exists():
            raise ValueError("Pasta não vazia sem instalação Sonariel. Vincule-a ou escolha outro destino.")
        probe = root
        while not probe.exists():
            probe = probe.parent
        if shutil.disk_usage(probe).free < 16 * 2**30 and not marker.exists():
            raise ValueError("Espaço insuficiente para instalação isolada")
        root.mkdir(parents=True, exist_ok=True)
        state = json.loads(marker.read_text()) if marker.exists() else {"recipe": recipe()["id"], "steps": []}
        if state["recipe"] != recipe()["id"]:
            raise ValueError("Receita existente diferente; atualização não é automática")
        marker.write_text(json.dumps(state), encoding="utf-8")
        cache = self.store.home / "cache"
        commands = []

        def step(name, action):
            self.store.set("setup_status", {"state": "running", "stage": name, "destination": str(root)})
            self.store.event("setup", name)
            result = action()
            if name not in state["steps"]:
                state["steps"].append(name)
            state["commands"] = commands
            marker.write_text(json.dumps(state, indent=2), encoding="utf-8")
            return result

        def execute(args):
            commands.append(args)
            return run(args, timeout=3600)

        try:
            uv_spec = recipe()["uv"]
            uv_zip = step("Verificar runtime de instalação", lambda: download(uv_spec["url"], cache / "uv.zip", uv_spec["sha256"], self.store.event))
            extract(uv_zip, root / "tools")
            uv = next((root / "tools").rglob("uv.exe"))
            env = os.environ.copy()
            env["UV_PYTHON_INSTALL_DIR"] = str(root / "python")
            env["UV_CACHE_DIR"] = str(cache / "uv")
            commands.append([str(uv), "python", "install", recipe()["python"]])
            step("Preparar Python isolado", lambda: run([str(uv), "python", "install", recipe()["python"]], env=env, timeout=900))
            if not (root / ".venv/Scripts/python.exe").exists():
                run([str(uv), "venv", "--python", recipe()["python"], str(root / ".venv")], env=env)
            python = root / ".venv/Scripts/python.exe"
            step("Instalar dependências CPU fixadas", lambda: run([str(uv), "pip", "install", "--python", str(python), "--index-strategy", "unsafe-best-match", "-r", str(resource("cpu-requirements.txt"))], env=env, timeout=3600))
            repo = root / "ACE-Step-1.5"
            if not repo.exists():
                archive = step("Obter fonte ACE-Step validada", lambda: download(recipe()["ace_archive"], cache / "ace-source.zip", recipe()["ace_archive_sha256"], self.store.event))
                staging = root / "source-staging"
                extract(archive, staging)
                source = next(p for p in staging.iterdir() if p.is_dir())
                shutil.move(str(source), repo)
            step("Aplicar correção DiT-only", lambda: self.patch(repo))
            # Never install upstream dependency metadata: it requests CUDA on Windows.
            execute([str(uv), "pip", "install", "--python", str(python), "--no-deps", "-e", str(repo)])
            model_spec = json.loads(resource("models.json").read_text())
            checkpoint = repo / "checkpoints"
            checkpoint.mkdir(exist_ok=True)

            def models():
                for item in model_spec["files"]:
                    destination_file = checkpoint / item["path"]
                    if destination_file.is_file() and sha256(destination_file) == item["sha256"]:
                        continue
                    source_file = Path(model_cache) / item["path"] if model_cache else None
                    destination_file.parent.mkdir(parents=True, exist_ok=True)
                    if source_file and source_file.is_file() and sha256(source_file) == item["sha256"]:
                        # Copies preserve baseline immutability even if downstream code writes.
                        shutil.copyfile(source_file, destination_file)
                        self.store.event("cache", item["path"] + " reutilizado com SHA-256 verificado")
                    else:
                        url = f"https://huggingface.co/{model_spec['repo']}/resolve/{model_spec['revision']}/{item['path']}"
                        cached = download(url, cache / "models" / item["path"], item["sha256"], self.store.event)
                        shutil.copyfile(cached, destination_file)
            step("Verificar e preparar somente modelos DiT", models)
            if not audacity:
                spec = recipe()["audacity"]
                archive = step("Preparar Audacity portátil", lambda: download(spec["url"], cache / "audacity.zip", spec["sha256"], self.store.event))
                extract(archive, root / "audacity")
                audacity = str(next((root / "audacity").rglob("Audacity.exe")))
                state["audacity_setup"] = prepare_audacity(Path(audacity))
            (repo / "sonariel-recipe.json").write_text(json.dumps({"commit": recipe()["ace_commit"]}), encoding="utf-8")
            result = step("Diagnóstico final", lambda: inspect_environment(str(root), audacity))
            if not result["compatible"]:
                raise RuntimeError("Verificação final falhou: " + str(result["checks"]))
            state["complete"] = True
            state["environment"] = result
            marker.write_text(json.dumps(state, indent=2), encoding="utf-8")
            self.store.set("setup_status", {"state": "completed", "stage": completion_stage(state.get("audacity_setup")), "destination": str(root)})
            return result
        except Exception as error:
            self.store.set("setup_status", {"state": "error", "stage": str(error), "destination": str(root), "retryable": True})
            raise

    @staticmethod
    def patch(repo: Path) -> None:
        path = repo / "acestep/model_downloader.py"
        text = path.read_text(encoding="utf-8")
        line = '    "acestep-5Hz-lm-1.7B",     # Default LM model (1.7B)\n'
        if line in text:
            text = text.replace(line, "", 1)
            path.write_text(text, encoding="utf-8")
        section = text.split("MAIN_MODEL_COMPONENTS = [", 1)[1].split("]", 1)[0]
        if '"acestep-5Hz-lm-1.7B"' in section:
            raise RuntimeError("Patch DiT-only não corresponde à fonte fixada")
