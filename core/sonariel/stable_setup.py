"""Explicitly licensed, isolated LiteRT CPU setup; no upstream install scripts."""
import json
import hashlib
import os
import shutil
import time
from pathlib import Path

from .environment import recipe, run, sha256
from .setup import Setup, download, extract, resource

VERSIONS = {"ai-edge-litert":"2.2.0", "numpy":"1.26.4", "sentencepiece":"0.2.1", "soundfile":"0.14.0"}
FAMILIES = {"sm-music":"sa3-sm-music", "medium":"sa3-m"}
TERMS = {"LICENSE.md":"d6f6b1a4dce5c852bd6d7d9482d002baf0ccdb71e662250b73be9eec8764ee8d",
         "LICENSE_GEMMA.md":"e77acc0d3163bb7534675045c584b4d04b387b529239fc4b3647da0a01ba4745",
         "NOTICE":"66f856d7da72797f528fca46b7c80634ab481f917bfe020960e123d84b19f75f"}


def selected_files(manifest, families):
    selected = {"tflite/t5gemma/encoder_fp16.tflite", "tflite/same-s/dec_w8a8.tflite"}
    selected.update(f"tflite/{FAMILIES[family]}/dit_w8a8.tflite" for family in families)
    return [file for file in manifest["files"] if file["path"] in selected]


def verify_source(source, manifest):
    for item in manifest["source_files"]:
        path = source / item["path"]
        # Git on Windows may check out CRLF; archive sources use LF. Only
        # normalize Python line endings, never model/tokenizer bytes.
        digest = hashlib.sha256(path.read_bytes().replace(b"\r\n", b"\n")).hexdigest() if path.is_file() and path.suffix==".py" else sha256(path) if path.is_file() else None
        if digest != item["sha256"]:
            raise ValueError("Fonte LiteRT ausente ou diferente: " + item["path"])


class StableSetup:
    def __init__(self, store):
        self.store = store

    def plan(self, destination, family):
        if family not in FAMILIES:
            raise ValueError("Família LiteRT inválida")
        base = Setup(self.store).plan(destination)
        return dict(destination=base["destination"], supported=base["supported"], family=family,
            disk_required_gib=8, requires_authorization=True, requires_license_acceptance=True,
            components=["uv isolado", "Python 3.11.15", "LiteRT 2.2.0 CPU, dependências com hashes", "DiT w8a8, SAME-S w8a8, T5Gemma fp16"],
            licenses=["https://huggingface.co/stabilityai/stable-audio-3-optimized/blob/08b17423649b5714b22eab20f96bf00751f2358a/LICENSE.md",
                      "https://huggingface.co/stabilityai/stable-audio-3-optimized/blob/08b17423649b5714b22eab20f96bf00751f2358a/LICENSE_GEMMA.md"],
            notice="Powered by Stability AI. Licenças próprias; aceite local não equivale a registro/autorização comercial.",
            versions=VERSIONS, modes=["text2audio"])

    def install(self, destination, family, authorized, accepted_licenses, model_cache=""):
        if not authorized or not accepted_licenses:
            raise ValueError("Autorize a instalação e aceite explicitamente Stability Community e Gemma antes de baixar")
        plan = self.plan(destination, family)
        if not plan["supported"]:
            raise ValueError("Receita validada para Windows x64 com pelo menos 24 GB de RAM")
        root = Path(plan["destination"])
        marker = root / "sonariel-stable-install.json"
        if root.exists() and any(root.iterdir()) and not marker.exists():
            raise ValueError("Pasta não vazia sem instalação LiteRT Sonariel; preservada")
        state = json.loads(marker.read_text()) if marker.exists() else dict(recipe="stable-litert-cpu-v1", families=[])
        if state["recipe"] != "stable-litert-cpu-v1":
            raise ValueError("Receita existente diferente; não será substituída")
        probe = root
        while not probe.exists():
            probe = probe.parent
        if shutil.disk_usage(probe).free < 8*2**30 and not marker.exists():
            raise ValueError("Espaço insuficiente para LiteRT isolado")
        root.mkdir(parents=True, exist_ok=True)
        marker.write_text(json.dumps(state), encoding="utf-8")
        cache = self.store.home / "cache/stable-setup"
        cache.mkdir(parents=True, exist_ok=True)
        def stage(name):
            self.store.set("setup_status", dict(state="running", engine="stable-litert", stage=name, destination=str(root)))
            self.store.event("setup", name)
        uv_spec = recipe()["uv"]
        stage("Verificar instalador isolado LiteRT")
        extract(download(uv_spec["url"], cache / "uv.zip", uv_spec["sha256"], self.store.event), root / "tools")
        uv = next((root / "tools").rglob("uv.exe"))
        env = os.environ.copy()
        env.update(UV_PYTHON_INSTALL_DIR=str(root / "python"), UV_CACHE_DIR=str(cache / "uv"))
        def command(args):
            run([str(a) for a in args], env=env, timeout=3600)
        stage("Preparar Python e LiteRT CPU fixados")
        command([uv, "python", "install", "--no-bin", "--no-registry", "3.11.15"])
        python = root / ".venv/Scripts/python.exe"
        if not python.exists():
            command([uv, "venv", "--python", "3.11.15", root / ".venv"])
        command([uv, "pip", "install", "--python", python, "--require-hashes", "-r", resource("stable-requirements.txt")])
        spec = json.loads(resource("stable-models.json").read_text(encoding="utf-8"))
        stage("Verificar código oficial fixado, sem executar instalador upstream")
        archive = download(spec["source_archive"]["url"], cache / "source.zip", spec["source_archive"]["sha256"], self.store.event)
        source = root / "source"
        if not source.exists():
            staging = root / "extract-source"
            extract(archive, staging)
            shutil.move(str(next(p for p in staging.iterdir() if p.is_dir())), source)
        verify_source(source, spec)
        models = root / "models"
        models.mkdir(exist_ok=True)
        families = sorted(set(state["families"]) | {family})
        for file in selected_files(spec, families):
            target = models / file["path"]
            target.parent.mkdir(parents=True, exist_ok=True)
            stage("Verificar modelo: " + file["path"])
            if target.is_file() and sha256(target) == file["sha256"]:
                continue
            cached = Path(model_cache) / file["path"] if model_cache else None
            if cached and cached.is_file() and sha256(cached) == file["sha256"]:
                shutil.copyfile(cached, target)
            else:
                url = f"https://huggingface.co/{spec['repo']}/resolve/{spec['revision']}/{file['path']}"
                shutil.copyfile(download(url, cache / file["path"], file["sha256"], self.store.event), target)
        licenses = root / "licenses"
        licenses.mkdir(exist_ok=True)
        for name, digest in TERMS.items():
            download(f"https://huggingface.co/{spec['repo']}/resolve/{spec['revision']}/{name}", licenses / name, digest, self.store.event)
        state.update(families=families, complete=True, accepted_licenses=True, acceptance_time=time.time(), revision=spec["revision"])
        marker.write_text(json.dumps(state, indent=2), encoding="utf-8")
        return dict(python_path=str(python), source=str(source), models=str(models), families=families, accepted_licenses=True)
