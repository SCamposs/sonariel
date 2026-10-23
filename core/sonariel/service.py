from __future__ import annotations

import json
import os
import re
import shutil
import sys
import threading
import time
import tomllib
from pathlib import Path

import psutil

from . import audacity
from .engine import Engine, inspect_wav
from .environment import discover, graphics, inspect_environment, recipe, sha256, telemetry
from .setup import Setup
from .store import Store, identifier


def local_audio(value: str) -> Path:
    if not value or value.startswith(("http:", "https:", "\\\\")) or '"' in value or "\n" in value:
        raise ValueError("Use caminho local absoluto para áudio")
    path = Path(value).expanduser()
    if not path.is_absolute() or not path.is_file() or path.suffix.lower() not in {".wav", ".flac", ".mp3", ".ogg"}:
        raise ValueError("Arquivo de áudio local inválido")
    return path.resolve(strict=True)


class Service:
    def __init__(self, store: Store | None = None, start_worker: bool = True):
        self.store = store or Store()
        self.engine = Engine(self.store)
        self.audacity = audacity.Audacity(self.store)
        self.setup = Setup(self.store)
        self.active = False
        self.stopping = threading.Event()
        self.setup_thread: threading.Thread | None = None
        self.mutation_lock = threading.RLock()
        if start_worker:
            self.recover()
            self.worker = threading.Thread(target=self.work, daemon=True)
            self.worker.start()

    def recover(self):
        # Remote IDs are resumed by querying, never submitted a second time.
        self.store.execute("UPDATE jobs SET state='queued',stage='Retomar consulta ao motor' WHERE state IN ('generating','submitted') AND remote_id IS NOT NULL")
        self.store.execute("UPDATE jobs SET state='interrupted',stage='Interrompida antes de confirmar envio',finished=? WHERE state IN ('loading','submitted','generating') AND remote_id IS NULL", (time.time(),))

    def invoke(self, method: str, args: dict | None = None):
        if self.stopping.is_set():
            raise ValueError("Atualização em andamento. Aguarde o reinício do aplicativo.")
        args = args or {}
        if method not in METHODS:
            raise ValueError("Operação não suportada")
        import jsonschema
        jsonschema.validate(args, METHODS[method]["inputSchema"])
        fn = getattr(self, "rpc_" + method)
        if method in {"snapshot", "job_get", "projects_list", "references_list", "results_list", "queue_list", "environment_status", "setup_plan"}:
            return fn(**args)
        with self.mutation_lock:
            if self.stopping.is_set():
                raise ValueError("Atualização em andamento. Aguarde o reinício do aplicativo.")
            return fn(**args)

    def update_clients_running(self) -> bool:
        current = Path(sys.executable).resolve()
        for process in psutil.process_iter(["pid", "name", "exe", "cmdline"]):
            if process.pid == os.getpid():
                continue
            info = process.info
            if info.get("exe") and Path(info["exe"]).resolve() == current:
                command = info.get("cmdline") or []
                if "mcp" in command and (getattr(sys, "frozen", False) or "sonariel" in command):
                    return True
        return False

    def prepare_update(self):
        """Private desktop lifecycle operation, deliberately absent from MCP tools."""
        with self.mutation_lock:
            if self.active or self.store.rows("SELECT id FROM jobs WHERE state IN ('queued','loading','submitted','generating') OR (state='interrupted' AND remote_id IS NOT NULL)"):
                raise ValueError("Conclua a fila e resolva tarefas interrompidas antes de atualizar.")
            if self.setup_thread and self.setup_thread.is_alive():
                raise ValueError("Aguarde a instalação do ambiente antes de atualizar.")
            if self.update_clients_running():
                raise ValueError("Feche as conexões MCP do Sonariel (por exemplo, o cliente Codex) antes de atualizar.")
            if self.engine.owned_process():
                self.engine.stop()
            self.stopping.set()
            self.store.event("update", "Núcleo ocioso encerrando para atualização autorizada no desktop")
            return {"ready": True}

    def rpc_snapshot(self):
        projects = self.rpc_projects_list()
        return {"projects": projects, "sessions": self.store.rows("SELECT * FROM sessions ORDER BY created DESC"), "jobs": self.rpc_queue_list(), "assets": self.rpc_results_list(), "events": self.store.rows("SELECT * FROM events ORDER BY id DESC LIMIT 80"), "selected_project": self.store.setting("selected_project"), "environment": self.store.setting("environment"), "engine": {"state": self.engine.status, "managed": bool(self.engine.owned_process()), "rss_gib": round(self.engine.rss(), 3), "load_seconds": self.engine.last_load_seconds}, "telemetry": telemetry(), "audacity": audacity.status(), "setup": self.store.setting("setup_status"), "codex": self.store.setting("codex", {"configured": False, "tested": False}), "preferences": self.store.setting("preferences", {"idle_minutes": 5}), "data_home": str(self.store.home), "edits": self.store.rows("SELECT * FROM edits ORDER BY created DESC")}

    def rpc_environment_status(self):
        return {"environment": self.store.setting("environment"), "hardware": {**telemetry(), "graphics": graphics()}, "detected": discover(), "recipe": recipe(), "supported_modes": ["text2music", "cover"], "other_modes": "Not enabled by this adapter; never substituted", "active_inference_cancel_supported": False, "gpu_acceleration_supported": False}

    def rpc_environment_link(self, root: str, audacity_path: str):
        if self.active:
            raise ValueError("Aguarde a tarefa ativa para trocar ambiente")
        result = inspect_environment(root, audacity_path)
        if not result["compatible"]:
            return result
        executable = Path(audacity_path).resolve(strict=True)
        if executable.name.lower() != "audacity.exe":
            raise ValueError("Selecione Audacity.exe")
        if self.engine.owned_process():
            self.engine.stop()
        self.store.set("environment", result)
        self.store.event("environment", "Ambiente vinculado por inspeção, sem modificar seus arquivos")
        return result

    def rpc_projects_list(self):
        return self.store.rows("SELECT p.*,(SELECT count(*) FROM assets a WHERE a.project_id=p.id AND a.kind!='reference') AS result_count FROM projects p ORDER BY created DESC")

    def rpc_project_create(self, name: str, context: str = ""):
        key = identifier()
        self.store.execute("INSERT INTO projects VALUES(?,?,?,?)", (key, name, context, time.time()))
        self.store.set("selected_project", key)
        return {"project_id": key}

    def require_project(self, project_id: str):
        rows = self.store.rows("SELECT * FROM projects WHERE id=?", (project_id,))
        if not rows:
            raise ValueError("Projeto não encontrado")
        return rows[0]

    def rpc_project_update(self, project_id: str, name: str, context: str):
        self.require_project(project_id)
        self.store.execute("UPDATE projects SET name=?,context=? WHERE id=?", (name, context, project_id))
        return self.require_project(project_id)

    def rpc_project_select(self, project_id: str):
        project = self.require_project(project_id)
        self.store.set("selected_project", project_id)
        return project

    def rpc_session_create(self, project_id: str, name: str):
        self.require_project(project_id)
        key = identifier()
        self.store.execute("INSERT INTO sessions VALUES(?,?,?,?)", (key, project_id, name, time.time()))
        return {"session_id": key}

    def rpc_references_list(self, project_id: str | None = None):
        return self.store.rows("SELECT * FROM assets WHERE kind='reference'" + (" AND project_id=?" if project_id else "") + " ORDER BY created DESC", (project_id,) if project_id else ())

    def rpc_reference_register(self, project_id: str, path: str, name: str):
        self.require_project(project_id)
        source = local_audio(path)
        metadata = inspect_wav(source)
        metadata["sha256"] = sha256(source)
        key = identifier()
        self.store.execute("INSERT INTO assets(id,project_id,path,name,kind,metadata,created) VALUES(?,?,?,?,?,?,?)", (key, project_id, str(source), name, "reference", json.dumps(metadata), time.time()))
        return self.store.asset(key)

    def rpc_result_import(self, project_id: str, path: str, name: str, parameters: dict | None = None, parent_id: str | None = None):
        self.require_project(project_id)
        source = local_audio(path)
        metadata = inspect_wav(source)
        metadata.update({"sha256": sha256(source), "parameters": parameters or {}, "imported": True})
        if parent_id and self.store.asset(parent_id)["project_id"] != project_id:
            raise ValueError("Versão anterior pertence a outro projeto")
        key = identifier()
        self.store.execute("INSERT INTO assets(id,project_id,path,name,kind,metadata,parent_id,created) VALUES(?,?,?,?,?,?,?,?)", (key, project_id, str(source), name, "imported", json.dumps(metadata), parent_id, time.time()))
        return self.store.asset(key)

    def rpc_results_list(self, project_id: str | None = None):
        return self.store.rows("SELECT * FROM assets WHERE kind!='reference'" + (" AND project_id=?" if project_id else "") + " ORDER BY created DESC", (project_id,) if project_id else ())

    def rpc_result_feedback(self, asset_id: str, favorite: bool, selected: bool, notes: str):
        asset = self.store.asset(asset_id)
        with self.store.connect() as db:
            if selected:
                db.execute("UPDATE assets SET selected=0 WHERE project_id=?", (asset["project_id"],))
            db.execute("UPDATE assets SET favorite=?,selected=?,notes=? WHERE id=?", (int(favorite), int(selected), notes, asset_id))
        return self.store.asset(asset_id)

    def rpc_queue_list(self):
        return self.store.rows("SELECT * FROM jobs ORDER BY created DESC LIMIT 200")

    def rpc_job_get(self, job_id: str):
        return {**self.store.job(job_id), "results": self.store.rows("SELECT * FROM assets WHERE job_id=? ORDER BY created", (job_id,))}

    def rpc_generate(self, project_id: str, request_key: str, prompt: str, seed: int, duration: float, bpm: int, key_scale: str, time_signature: str, mode: str = "text2music", reference_id: str | None = None, source_id: str | None = None, cover_strength: float = 1, session_id: str | None = None, parent_id: str | None = None, batch_size: int = 1):
        self.require_project(project_id)
        if batch_size != 1:
            raise ValueError("O perfil CPU exige batch_size=1")
        if session_id:
            rows = self.store.rows("SELECT * FROM sessions WHERE id=? AND project_id=?", (session_id, project_id))
            if not rows:
                raise ValueError("Sessão não pertence ao projeto")
        params = {"prompt": prompt, "seed": seed, "audio_duration": duration, "bpm": bpm, "key_scale": key_scale, "time_signature": time_signature, "task_type": mode, "audio_cover_strength": cover_strength, "model": "acestep-v15-turbo", "lyrics": "[Instrumental]", "instrumental": True, "thinking": False, "sample_mode": False, "use_format": False, "use_cot_caption": False, "use_cot_language": False, "constrained_decoding": False, "allow_lm_batch": False, "audio_format": "wav", "inference_steps": 8, "guidance_scale": 7, "shift": 3, "infer_method": "ode", "batch_size": 1, "use_random_seed": False}
        for asset_id, key in ((reference_id, "reference_audio_path"), (source_id, "src_audio_path")):
            if asset_id:
                asset = self.store.asset(asset_id)
                if asset["project_id"] != project_id:
                    raise ValueError("Referência pertence a outro projeto")
                params[key] = str(local_audio(asset["path"]))
        if mode == "cover":
            if not source_id:
                raise ValueError("Cover exige source_id. reference_id é uma condição de estilo diferente.")
            actual_duration = self.store.asset(source_id)["metadata"]["duration"]
            if abs(actual_duration - duration) > 0.1:
                raise ValueError("No modo cover, a duração deve corresponder ao áudio-fonte")
        elif source_id:
            raise ValueError("text2music não usa source_id. Escolha cover explicitamente.")
        if mode == "text2music" and cover_strength != 1:
            raise ValueError("A revisão instalada neutraliza audio_cover_strength em text2music. Use 1 e reference_id para estilo.")
        if parent_id:
            if self.store.asset(parent_id)["project_id"] != project_id:
                raise ValueError("Versão anterior pertence a outro projeto")
            params["_parent_id"] = parent_id
        existing = self.store.rows("SELECT * FROM jobs WHERE request_key=?", (request_key,))
        if existing:
            previous = existing[0]
            if previous["project_id"] != project_id or previous["session_id"] != session_id or previous["params"] != params:
                raise ValueError("request_key já usada com parâmetros diferentes. Use outra chave para uma nova solicitação.")
            return {"job_id": previous["id"], "state": previous["state"], "already_submitted": True}
        key = identifier()
        self.store.execute("INSERT INTO jobs(id,request_key,project_id,session_id,state,stage,params,created) VALUES(?,?,?,?,?,?,?,?)", (key, request_key, project_id, session_id, "queued", "Aguardando motor", json.dumps(params), time.time()))
        self.store.event("queued", "Solicitação recebida", key)
        return {"job_id": key, "state": "queued"}

    def rpc_job_cancel(self, job_id: str):
        with self.store.connect() as db:
            result = db.execute("UPDATE jobs SET state='cancelled',stage='Cancelada na fila',finished=? WHERE id=? AND state='queued' AND remote_id IS NULL", (time.time(), job_id))
            if result.rowcount != 1:
                raise ValueError("Somente tarefas ainda não enviadas ao motor podem ser canceladas")
        return self.store.job(job_id)

    def rpc_engine_stop(self):
        if self.active or self.store.rows("SELECT id FROM jobs WHERE state IN ('loading','generating','submitted') OR (state='interrupted' AND remote_id IS NOT NULL)"):
            raise ValueError("Inferência ativa. Este perfil não oferece interrupção segura.")
        return self.engine.stop()

    def rpc_preferences_save(self, idle_minutes: int):
        value = {"idle_minutes": idle_minutes}
        self.store.set("preferences", value)
        return value

    def rpc_audacity_probe(self):
        result = audacity.probe()
        self.store.set("audacity_probe", {**result, "time": time.time()})
        return result

    def rpc_audacity_import(self, asset_id: str):
        return self.audacity.import_result(asset_id)

    def rpc_audacity_export(self, edit_id: str, fade_in: float = 0, fade_out: float = 0):
        return self.audacity.export(edit_id, fade_in, fade_out)

    def rpc_setup_plan(self, destination: str):
        return self.setup.plan(destination)

    def rpc_setup_install(self, destination: str, authorized: bool, model_cache: str = "", audacity_path: str = ""):
        if self.active or (self.setup_thread and self.setup_thread.is_alive()):
            raise ValueError("Outra operação pesada está ativa")
        if not authorized:
            raise ValueError("Instalação requer autorização")
        self.setup.plan(destination)
        self.store.set("setup_status", {"state": "running", "stage": "Preparar instalação"})
        def task():
            try:
                result = self.setup.install(destination, authorized, model_cache, audacity_path)
                # First-run setup must produce a usable app. Never silently
                # replace an existing linked production environment.
                if not self.store.setting("environment"):
                    self.store.set("environment", result)
                    self.store.event("environment", "Primeiro ambiente instalado e vinculado")
            except Exception as error:
                self.store.set("setup_status", {"state": "error", "stage": str(error), "destination": destination, "retryable": True})
                self.store.event("setup_error", str(error))
        self.setup_thread = threading.Thread(target=task, daemon=True)
        self.setup_thread.start()
        return {"state": "running", "destination": destination}

    def rpc_codex_register(self, executable: str = ""):
        command_path = Path(executable).resolve(strict=True) if executable else Path(sys.executable)
        if executable and command_path.name.lower() != "sonariel-core.exe":
            raise ValueError("A conexão aceita somente o executável sonariel-core.exe distribuído")
        from .setup import resource
        skill_folder = Path.home() / ".agents/skills/sonariel"
        skill_file = skill_folder / "SKILL.md"
        skill_text = resource("sonariel-skill.md").read_text(encoding="utf-8")
        if skill_file.exists() and skill_file.read_text(encoding="utf-8") != skill_text:
            raise ValueError("Já existe uma skill sonariel diferente. Arquivo preservado; revise antes de substituir.")
        args = ["mcp"] if executable or getattr(sys, "frozen", False) else ["-m", "sonariel", "mcp"]
        root = Path(os.environ.get("CODEX_HOME", str(Path.home() / ".codex")))
        config = root / "config.toml"
        root.mkdir(exist_ok=True)
        text = config.read_text(encoding="utf-8") if config.exists() else ""
        parsed = tomllib.loads(text)
        if "sonariel" in parsed.get("mcp_servers", {}):
            existing = parsed["mcp_servers"]["sonariel"]
            if existing.get("command") != str(command_path) or existing.get("args") != args:
                raise ValueError("Já existe um servidor sonariel com outro comando; configuração preservada")
        else:
            backup = self.store.home / "backups" / ("codex-config-" + str(time.time_ns()) + ".toml")
            if config.exists():
                shutil.copy2(config, backup)
            command = str(command_path)
            section = "\n[mcp_servers.sonariel]\ncommand = " + json.dumps(command) + "\nargs = " + json.dumps(args) + "\nstartup_timeout_sec = 30\n"
            if os.environ.get("SONARIEL_HOME"):
                section += "\n[mcp_servers.sonariel.env]\nSONARIEL_HOME = " + json.dumps(str(self.store.home)) + "\n"
            tomllib.loads(text + section)
            temp = config.with_suffix(".sonariel.tmp")
            temp.write_text(text + section, encoding="utf-8")
            temp.replace(config)
        skill_folder.mkdir(parents=True, exist_ok=True)
        skill_file.write_text(skill_text, encoding="utf-8")
        result = {"configured": True, "tested": False, "client_reload_required": True, "skill_installed": True}
        self.store.set("codex", result)
        return result

    def rpc_mcp_heartbeat(self, client: str, protocol: str):
        value = {**self.store.setting("codex", {}), "tested": True, "last_handshake": time.time(), "client": client, "protocol": protocol}
        self.store.set("codex", value)
        return value

    def work(self):
        while not self.stopping.wait(1):
            if self.setup_thread and self.setup_thread.is_alive():
                continue
            if self.store.rows("SELECT id FROM jobs WHERE state='interrupted' AND remote_id IS NOT NULL"):
                # An unreachable remote task may still be active. Never stop its
                # process or submit more work until an explicit recovery.
                continue
            jobs = self.store.rows("SELECT * FROM jobs WHERE state='queued' ORDER BY created LIMIT 1")
            if not jobs:
                preferences = self.store.setting("preferences", {"idle_minutes": 5})
                if self.engine.owned_process() and time.monotonic() - self.engine.last_used > preferences["idle_minutes"] * 60:
                    self.engine.stop()
                continue
            job = jobs[0]
            metrics = {"peak_rss_gib": 0, "minimum_available_gib": psutil.virtual_memory().available / 2**30}
            def sample():
                metrics["peak_rss_gib"] = max(metrics["peak_rss_gib"], self.engine.rss())
                metrics["minimum_available_gib"] = min(metrics["minimum_available_gib"], psutil.virtual_memory().available / 2**30)
                self.store.execute("UPDATE jobs SET metrics=? WHERE id=?", (json.dumps(metrics), job["id"]))
            with self.mutation_lock:
                if self.stopping.is_set():
                    continue
                current = self.store.job(job["id"])
                if current["state"] != "queued":
                    continue
                available = psutil.virtual_memory().available / 2**30
                threshold = 4.0 if self.engine.owned_process() else recipe()["minimum_available_ram_gib"]
                if available < threshold:
                    self.store.execute("UPDATE jobs SET stage=? WHERE id=?", (f"Aguardando memória: {available:.1f} / {threshold:.0f} GiB livres", job["id"]))
                    continue
                self.active = True
                self.store.execute("UPDATE jobs SET state='loading',stage='Carregando motor CPU',started=COALESCE(started,?) WHERE id=?", (time.time(), job["id"]))
            try:
                metrics["load_seconds"] = self.engine.start(sample)
                params = dict(job["params"])
                parent = params.pop("_parent_id", None)
                remote = job["remote_id"]
                if not remote:
                    self.store.execute("UPDATE jobs SET state='submitted',stage='Enviando ao motor' WHERE id=?", (job["id"],))
                    remote = self.engine.submit(params)
                    self.store.execute("UPDATE jobs SET remote_id=? WHERE id=?", (remote, job["id"]))
                self.store.execute("UPDATE jobs SET state='generating',stage='Inferência DiT em CPU' WHERE id=?", (job["id"],))
                self.engine.status = "generating"
                start = time.monotonic()
                while not self.stopping.is_set():
                    sample()
                    result = self.engine.result(remote)
                    if result:
                        break
                    time.sleep(2)
                else:
                    continue
                output = self.store.home / "output" / (job["id"] + ".wav")
                metadata = self.engine.download(result, output)
                metadata["sha256"] = sha256(output)
                metadata["parameters"] = params
                metrics["inference_seconds"] = self.engine.inference_seconds(result)
                metrics["processing_seconds"] = round(time.monotonic() - start, 3)
                key = identifier()
                with self.store.connect() as db:
                    db.execute("INSERT INTO assets(id,project_id,session_id,job_id,path,name,kind,metadata,parent_id,created) VALUES(?,?,?,?,?,?,?,?,?,?)", (key, job["project_id"], job["session_id"], job["id"], str(output), "Geração · " + str(params["seed"]), "generated", json.dumps(metadata), parent, time.time()))
                    db.execute("UPDATE jobs SET state='completed',stage='WAV validado',metrics=?,finished=? WHERE id=?", (json.dumps(metrics), time.time(), job["id"]))
                self.store.event("completed", "Áudio gerado e validado", job["id"])
            except Exception as error:
                self.store.execute("UPDATE jobs SET state='interrupted',stage='Verificação necessária',error=?,finished=? WHERE id=?", (str(error), time.time(), job["id"]))
                self.store.event("error", str(error), job["id"])
            finally:
                self.active = False
                self.engine.last_used = time.monotonic()
                self.engine.status = "ready" if self.engine.owned_process() else "stopped"


def schema(properties=None, required=None):
    return {"type": "object", "properties": properties or {}, "required": required or [], "additionalProperties": False}


S = {"type": "string", "minLength": 1, "maxLength": 16000}
ID = {"type": "string", "pattern": "^[a-f0-9]{32}$"}
B = {"type": "boolean"}
NUM = {"type": "number", "minimum": 0}


def tool(description, props=None, required=None):
    return {"description": description, "inputSchema": schema(props, required)}


METHODS = {
    "snapshot": tool("Estado compartilhado de projetos, fila, resultados, ambiente e telemetria."),
    "environment_status": tool("Capacidades reais e diagnóstico, sem carregar o motor."),
    "environment_link": tool("Inspecionar e vincular ambiente existente sem modificá-lo.", {"root": S, "audacity_path": S}, ["root", "audacity_path"]),
    "projects_list": tool("Listar projetos e seus contextos musicais salvos."),
    "project_create": tool("Criar projeto com contexto musical explicitamente fornecido.", {"name": S, "context": {"type": "string"}}, ["name"]),
    "project_update": tool("Atualizar nome e contexto musical salvo.", {"project_id": ID, "name": S, "context": {"type": "string"}}, ["project_id", "name", "context"]),
    "project_select": tool("Selecionar projeto compartilhado na interface.", {"project_id": ID}, ["project_id"]),
    "session_create": tool("Criar sessão dentro do projeto.", {"project_id": ID, "name": S}, ["project_id", "name"]),
    "references_list": tool("Listar referências locais registradas.", {"project_id": ID}),
    "reference_register": tool("Registrar referência local, sem envio externo ou alteração do arquivo.", {"project_id": ID, "path": S, "name": S}, ["project_id", "path", "name"]),
    "result_import": tool("Catalogar um resultado existente preservando seu arquivo.", {"project_id": ID, "path": S, "name": S, "parameters": {"type": "object"}, "parent_id": ID}, ["project_id", "path", "name"]),
    "results_list": tool("Consultar resultados, versões, seleção e observações.", {"project_id": ID}),
    "result_feedback": tool("Salvar favorita, seleção e observações consultáveis pelo Codex.", {"asset_id": ID, "favorite": B, "selected": B, "notes": {"type": "string"}}, ["asset_id", "favorite", "selected", "notes"]),
    "queue_list": tool("Consultar fila persistente. Etapas reais, sem percentual inventado."),
    "job_get": tool("Consultar tarefa, parâmetros, métricas e resultados.", {"job_id": ID}, ["job_id"]),
    "generate": tool("Enfileirar geração e retornar job_id imediatamente. request_key é chave idempotente. CPU, DiT-only e batch 1. Cover exige source_id e duração da fonte; reference_id orienta estilo.", {"project_id": ID, "request_key": S, "prompt": S, "seed": {"type": "integer", "minimum": 0, "maximum": 4294967295}, "duration": {"type": "number", "minimum": 10, "maximum": 120}, "bpm": {"type": "integer", "minimum": 30, "maximum": 300}, "key_scale": S, "time_signature": {"type": "string", "enum": ["2", "3", "4", "6"]}, "mode": {"type": "string", "enum": ["text2music", "cover"]}, "reference_id": ID, "source_id": ID, "cover_strength": {"type": "number", "minimum": 0, "maximum": 1}, "session_id": ID, "parent_id": ID, "batch_size": {"type": "integer", "const": 1}}, ["project_id", "request_key", "prompt", "seed", "duration", "bpm", "key_scale", "time_signature"]),
    "job_cancel": tool("Cancelar somente tarefa em espera, ainda não enviada. Inferência ativa não é cancelável neste perfil.", {"job_id": ID}, ["job_id"]),
    "engine_stop": tool("Descarregar apenas o motor gerenciado e ocioso."),
    "preferences_save": tool("Salvar tempo para descarregar motor ocioso.", {"idle_minutes": {"type": "integer", "minimum": 1, "maximum": 60}}, ["idle_minutes"]),
    "audacity_probe": tool("Testar leitura no mod-script-pipe sem alterar projeto."),
    "audacity_import": tool("Abrir resultado em projeto novo e identificado do Audacity.", {"asset_id": ID}, ["asset_id"]),
    "audacity_export": tool("Exportar edição registrada com fades opcionais de até 10 segundos, após verificar projeto ativo.", {"edit_id": ID, "fade_in": {**NUM, "maximum": 10}, "fade_out": {**NUM, "maximum": 10}}, ["edit_id"]),
    "setup_plan": tool("Mostrar receita, componentes e destino antes de instalação.", {"destination": S}, ["destination"]),
    "setup_install": tool("Instalar receita validada após autorização explícita; retorna rapidamente. Recuperável pelo mesmo destino.", {"destination": S, "authorized": B, "model_cache": {"type": "string"}, "audacity_path": {"type": "string"}}, ["destination", "authorized"]),
    "codex_register": tool("Registrar servidor stdio e skill com backup da configuração Codex, preservando outros servidores.", {"executable": {"type": "string"}}),
    "mcp_heartbeat": tool("Registrar handshake efetivamente concluído.", {"client": S, "protocol": S}, ["client", "protocol"]),
}
