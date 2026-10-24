from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from pathlib import Path

import psutil

from .engine import inspect_wav
from .store import Store, identifier

PIPE_LOCK = threading.Lock()


def quote(path: Path) -> str:
    return str(path.resolve()).replace("\\", "\\\\").replace('"', '\\"')


def read_response(reader, timeout: float = 20) -> str:
    import ctypes
    import msvcrt
    kernel = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel.PeekNamedPipe.argtypes = [ctypes.c_void_p, ctypes.c_void_p, ctypes.c_ulong, ctypes.c_void_p, ctypes.POINTER(ctypes.c_ulong), ctypes.c_void_p]
    kernel.PeekNamedPipe.restype = ctypes.c_int
    handle = msvcrt.get_osfhandle(reader.fileno())
    deadline = time.monotonic() + timeout
    response = bytearray()
    while time.monotonic() < deadline:
        available = ctypes.c_ulong()
        if not kernel.PeekNamedPipe(handle, None, 0, None, ctypes.byref(available), None):
            raise RuntimeError("Audacity desconectou o pipe durante a resposta")
        if available.value:
            response.extend(os.read(reader.fileno(), min(available.value, 65536)))
            if len(response) > 4 * 1024 * 1024:
                raise RuntimeError("Resposta do Audacity excedeu o limite seguro")
            if b"BatchCommand finished:" in response and response.endswith(b"\n"):
                return response.decode("utf-8").strip()
        else:
            time.sleep(0.02)
    raise TimeoutError("Audacity não respondeu em 20 segundos. Verifique diálogos abertos antes de repetir a operação.")


def command(value: str) -> str:
    # Private allowlisted callers only. No command executor is exposed in RPC/MCP.
    deadline = time.monotonic() + 10
    while True:
        try:
            writer = open(r"\\.\pipe\ToSrvPipe", "wb", buffering=0)
            try:
                reader = open(r"\\.\pipe\FromSrvPipe", "rb", buffering=0)
            except Exception:
                writer.close()
                raise
            break
        except OSError as error:
            if not isinstance(error, FileNotFoundError) and error.errno != 22:
                raise
            if time.monotonic() > deadline:
                raise RuntimeError("mod-script-pipe ausente ou ocupado por outro cliente. Preserve os projetos abertos; libere o cliente do pipe antes de testar novamente.") from error
            time.sleep(0.2)
    with writer, reader:
        writer.write((value + "\n").encode("utf-8"))
        result = read_response(reader)
    if "BatchCommand finished: OK" not in result:
        raise RuntimeError(f"Audacity recusou {value.split(':')[0]}: {result}")
    return result.split("BatchCommand finished:")[0].strip()


def tracks() -> list[dict]:
    return json.loads(command("GetInfo: Type=Tracks Format=JSON"))


def status() -> dict:
    pipe_available = False
    pipe_state = "missing"
    if os.name == "nt":
        import ctypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.WaitNamedPipeW.argtypes = [ctypes.c_wchar_p, ctypes.c_ulong]
        kernel.WaitNamedPipeW.restype = ctypes.c_int
        pipe_available = bool(kernel.WaitNamedPipeW(r"\\.\pipe\ToSrvPipe", 1))
        pipe_state = "available" if pipe_available else "busy" if ctypes.get_last_error() in {121, 231} else "missing"
    return {"running": any(p.info["name"].lower() == "audacity.exe" for p in psutil.process_iter(["name"]) if p.info["name"]), "pipe_available": pipe_available, "pipe_state": pipe_state, "tested": False}


def probe() -> dict:
    with PIPE_LOCK:
        return {**status(), "tested": True, "tracks_in_current_project": tracks()}


class Audacity:
    def __init__(self, store: Store):
        self.store = store

    def import_result(self, asset_id: str) -> dict:
        asset = self.store.asset(asset_id)
        if asset["kind"] == "reference":
            raise ValueError("Selecione um resultado para edição")
        source = Path(asset["path"]).resolve(strict=True)
        edit_id = identifier()
        destination = self.store.home / "output" / ("edit-" + edit_id + ".aup3")
        title = "sonariel-" + edit_id
        config = self.store.setting("environment", {})
        if not status()["running"]:
            executable = Path(self.store.setting("audacity_executable") or config.get("audacity", ""))
            if not executable.is_file() or executable.name.lower() != "audacity.exe":
                raise ValueError("Configure o executável do Audacity")
            subprocess.Popen([str(executable)])
            time.sleep(5)
        with PIPE_LOCK:
            command("New:")
            if tracks():
                raise RuntimeError("Projeto novo não está vazio; importação interrompida")
            command(f'Import2: Filename="{quote(source)}"')
            imported = tracks()
            if not imported or any(track.get("name") != source.stem for track in imported):
                raise RuntimeError("Não foi possível confirmar a faixa importada")
            command("SelectAll:")
            command(f'SetTrackStatus: Name="{title}"')
            self.verify(title)
            command("SetProject: Rate=48000")
            command(f'SaveProject2: Filename="{quote(destination)}" AddToHistory=0 Compress=0')
        self.store.execute("INSERT INTO edits VALUES(?,?,?,?)", (edit_id, asset_id, str(destination), time.time()))
        self.store.event("audacity", "Resultado importado em projeto isolado " + edit_id)
        return {"edit_id": edit_id, "project_path": str(destination), "track_name": title}

    @staticmethod
    def verify(title: str) -> None:
        current = tracks()
        if not current or any(track.get("name") != title for track in current):
            raise RuntimeError("O projeto ativo não corresponde à edição Sonariel. Foco alterado; nenhuma edição aplicada.")

    def export(self, edit_id: str, fade_in: float = 0, fade_out: float = 0) -> dict:
        rows = self.store.rows("SELECT * FROM edits WHERE id=?", (edit_id,))
        if not rows:
            raise ValueError("Edição não registrada")
        edit = rows[0]
        original = self.store.asset(edit["asset_id"])
        duration = original["metadata"]["duration"]
        if not 0 <= fade_in <= min(10, duration / 2) or not 0 <= fade_out <= min(10, duration / 2):
            raise ValueError("Fades devem caber na faixa e ter no máximo 10 segundos")
        output = self.store.home / "output" / ("export-" + identifier() + ".wav")
        with PIPE_LOCK:
            title = "sonariel-" + edit_id
            self.verify(title)
            if fade_in:
                command(f"SelectTime: Start=0 End={fade_in}")
                self.verify(title)
                command("FadeIn:")
            if fade_out:
                command(f"SelectTime: Start={duration - fade_out} End={duration}")
                self.verify(title)
                command("FadeOut:")
            self.verify(title)
            command("SelectAll:")
            command(f'Export2: Filename="{quote(output)}" NumChannels=2')
            command("Save:")
        metadata = inspect_wav(output)
        metadata.update({"fade_in": fade_in, "fade_out": fade_out, "edit_id": edit_id})
        asset_id = identifier()
        self.store.execute("INSERT INTO assets(id,project_id,session_id,job_id,path,name,kind,metadata,parent_id,created) VALUES(?,?,?,?,?,?,?,?,?,?)", (asset_id, original["project_id"], original["session_id"], original["job_id"], str(output), original["name"] + " · edição", "export", json.dumps(metadata), original["id"], time.time()))
        return self.store.asset(asset_id)
