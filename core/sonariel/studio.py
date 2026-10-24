"""Generic voice profiles, immutable FX versions, and shared-queue contracts."""
from __future__ import annotations

import json
import shutil
import subprocess
import threading
import time
from pathlib import Path

from .environment import HIDDEN, sha256
from .local_engine import FX_ID, VOICE_ID, LANGUAGES, catalog
from .setup import resource
from .store import identifier


def validate_fx(value):
    import jsonschema
    jsonschema.validate(value, FX_RECIPE)
    if len(json.dumps(value, allow_nan=False)) > 200000:
        raise ValueError("Preset excede limite de tamanho")
    return value


class Studio:
    def rpc_engines_list(self):
        return catalog(self.store)

    def rpc_voice_setup_plan(self, destination: str):
        from .voice_setup import VoiceSetup
        return VoiceSetup(self.store).plan(destination)

    def rpc_voice_setup_install(self, destination: str, authorized: bool, model_cache: str = ""):
        from .voice_setup import VoiceSetup
        if not authorized:
            raise ValueError("Instalação de voz exige autorização explícita")
        if self.active or self.local.owned() or (self.setup_thread and self.setup_thread.is_alive()):
            raise ValueError("Aguarde a operação ativa")
        if self.engine.owned_process() or self.external_heavy_process():
            raise ValueError("Descarregue os motores antes de instalar outro ambiente")
        setup = VoiceSetup(self.store)
        plan = setup.plan(destination)
        self.store.set("setup_status",dict(state="running",stage="Preparar ambiente de voz",engine="chatterbox-v3"))
        def install():
            try:
                linked=setup.install(destination,authorized,model_cache)
                self.rpc_voice_environment_link(**linked)
                self.store.set("setup_status",dict(state="completed",stage="V3 CPU instalado, verificado e vinculado",engine="chatterbox-v3",destination=plan["destination"]))
            except Exception as error:
                self.store.set("setup_status",dict(state="error",stage=str(error),engine="chatterbox-v3",destination=plan["destination"],retryable=True))
                self.store.event("setup_error",str(error))
        self.setup_thread=threading.Thread(target=install,daemon=True)
        self.setup_thread.start()
        return dict(state="running",destination=plan["destination"])

    def rpc_voice_environment_link(self, python_path: str, models: str):
        if self.active or self.local.owned():
            raise ValueError("Aguarde a fila antes de trocar ambiente de voz")
        python = Path(python_path).resolve(strict=True)
        root = Path(models).resolve(strict=True)
        if python.name.lower() != "python.exe" or not root.is_dir():
            raise ValueError("Selecione o Python do ambiente isolado e a pasta dos checkpoints")
        code = "import sys,json,importlib.metadata as m; print(json.dumps({'python':list(sys.version_info[:3]),'packages':{k:m.version(k) for k in ['torch','torchaudio','chatterbox-tts','resemble-perth']}}))"
        result = subprocess.run([str(python), "-c", code], capture_output=True, text=True, timeout=30, **HIDDEN)
        if result.returncode:
            raise ValueError("Ambiente de voz incompleto; use a receita de instalação")
        versions = json.loads(result.stdout)
        packages = versions["packages"]
        if versions["python"][:2] != [3,11] or packages != {"torch":"2.6.0+cpu", "torchaudio":"2.6.0+cpu", "chatterbox-tts":"0.1.7", "resemble-perth":"1.1.0"}:
            raise ValueError("Versões fora da receita V3 CPU validada")
        manifest = json.loads(resource("voice-models.json").read_text(encoding="utf-8"))
        for file in manifest["files"]:
            path = root / file["file"]
            if not path.is_file() or path.stat().st_size != file["bytes"] or sha256(path) != file["sha256"]:
                raise ValueError("Checkpoint ausente ou diferente: " + file["file"])
        config = dict(python=str(python), models=str(root), versions=versions,
                      checkpoint_revision=manifest["revision"], verified=time.time())
        self.store.set("voice_environment",config)
        self.store.event("environment", "Ambiente V3 CPU vinculado por inspeção; arquivos existentes preservados")
        return config

    def rpc_voice_profiles_list(self, project_id: str):
        self.require_project(project_id)
        return self.store.rows("SELECT * FROM voice_profiles WHERE project_id=? ORDER BY created",(project_id,))

    def rpc_voice_profile_save(self, project_id: str, name: str, language: str,
                               reference_id: str | None = None, authorized: bool = False):
        self.require_project(project_id)
        if language not in LANGUAGES:
            raise ValueError("Idioma não suportado pelo V3")
        if reference_id:
            asset = self.store.asset(reference_id)
            if asset["project_id"] != project_id or not authorized:
                raise ValueError("Referência vocal exige autorização explícita e mesmo projeto")
            self.verified_source(reference_id)
        key = identifier()
        self.store.execute("INSERT INTO voice_profiles VALUES(?,?,?,?,?,?,?)",
            (key,project_id,name,language,reference_id,int(authorized),time.time()))
        return self.store.rows("SELECT * FROM voice_profiles WHERE id=?",(key,))[0]

    def verified_source(self, asset_id):
        from .service import local_audio
        asset = self.store.asset(asset_id)
        source = local_audio(asset["path"])
        if sha256(source) != asset["metadata"]["sha256"]:
            raise ValueError("Arquivo original mudou desde o registro; registre uma nova versão")
        return asset

    def enqueue_local(self, project_id, request_key, params, session_id=None):
        self.require_project(project_id)
        if session_id and not self.store.rows("SELECT id FROM sessions WHERE id=? AND project_id=?",(session_id,project_id)):
            raise ValueError("Sessão não pertence ao projeto")
        existing = self.store.rows("SELECT * FROM jobs WHERE request_key=?",(request_key,))
        if existing:
            old = existing[0]
            if (old["project_id"],old["session_id"],old["params"]) != (project_id,session_id,params):
                raise ValueError("request_key já usada com parâmetros diferentes")
            return dict(job_id=old["id"],state=old["state"],already_submitted=True)
        key = identifier()
        self.store.execute("INSERT INTO jobs(id,request_key,project_id,session_id,state,stage,params,created) VALUES(?,?,?,?,?,?,?,?)",
            (key,request_key,project_id,session_id,"queued","Aguardando adaptador local",json.dumps(params,allow_nan=False),time.time()))
        self.store.event("queued","Solicitação local recebida",key)
        return dict(job_id=key,state="queued")

    def rpc_voice_generate(self, project_id: str, request_key: str, text: str, language: str, seed: int,
                           original_text: str = "", profile_id: str | None = None,
                           session_id: str | None = None, expressivity: dict | None = None):
        if language not in LANGUAGES:
            raise ValueError("Idioma não suportado")
        parameters = dict(exaggeration=.5,cfg_weight=.5,temperature=.8,repetition_penalty=1.2,min_p=.05,top_p=1.)
        parameters.update(expressivity or {})
        params = dict(_engine=VOICE_ID,text=text,original_text=original_text,language=language,
                      seed=seed,profile_id=profile_id,expressivity=parameters)
        if profile_id:
            profiles = self.rpc_voice_profiles_list(project_id)
            profile = next((p for p in profiles if p["id"]==profile_id),None)
            if not profile or profile["language"] != language:
                raise ValueError("Perfil não pertence ao projeto/idioma selecionado")
            if profile["reference_id"]:
                if not profile["consent"]:
                    raise ValueError("Referência sem autorização")
                source = self.verified_source(profile["reference_id"])
                params.update(reference_path=source["path"],reference_sha256=source["metadata"]["sha256"])
        return self.enqueue_local(project_id,request_key,params,session_id)

    def rpc_fx_presets_list(self, project_id: str | None = None):
        if project_id:
            self.require_project(project_id)
            return self.store.rows("SELECT * FROM fx_presets WHERE project_id=? OR project_id IS NULL ORDER BY created",(project_id,))
        return self.store.rows("SELECT * FROM fx_presets WHERE project_id IS NULL ORDER BY created")

    def rpc_fx_preset_save(self, name: str, recipe: dict, project_id: str | None = None):
        validate_fx(recipe)
        if project_id:
            self.require_project(project_id)
        key=identifier()
        self.store.execute("INSERT INTO fx_presets VALUES(?,?,?,?,?)",(key,project_id,name,json.dumps(recipe,allow_nan=False),time.time()))
        return self.store.rows("SELECT * FROM fx_presets WHERE id=?",(key,))[0]

    def rpc_fx_preset_import(self, path: str, project_id: str | None = None):
        source=Path(path).resolve(strict=True)
        if source.suffix.lower() != ".json" or source.stat().st_size > 200000:
            raise ValueError("Selecione um preset JSON de até 200 KB")
        recipe=json.loads(source.read_text(encoding="utf-8-sig"))
        return self.rpc_fx_preset_save(recipe["name"],recipe,project_id)

    def rpc_fx_preset_export(self, preset_id: str, destination: str):
        rows=self.store.rows("SELECT * FROM fx_presets WHERE id=?",(preset_id,))
        if not rows:
            raise ValueError("Preset não encontrado")
        output=self.export_destination(destination,".json")
        with output.open("x",encoding="utf-8") as stream:
            json.dump(rows[0]["recipe"],stream,ensure_ascii=False,indent=2,allow_nan=False)
        return dict(path=str(output))

    def rpc_fx_render(self, asset_id: str, request_key: str, recipe: dict, preview: bool = False):
        validate_fx(recipe)
        asset=self.verified_source(asset_id)
        if Path(asset["path"]).suffix.lower() != ".wav":
            raise ValueError("FX nativo aceita WAV; converta outros formatos explicitamente")
        params=dict(_engine=FX_ID,source_path=asset["path"],source_sha256=asset["metadata"]["sha256"],
                    _parent_id=asset_id,recipe=recipe,preview=preview)
        return self.enqueue_local(asset["project_id"],request_key,params,asset["session_id"])

    @staticmethod
    def export_destination(destination, suffix):
        output=Path(destination)
        if not output.is_absolute() or output.suffix.lower()!=suffix or not output.parent.is_dir() or output.exists():
            raise ValueError("Destino deve ser um arquivo novo em pasta local existente")
        if str(output).startswith("\\\\"):
            raise ValueError("Use destino local")
        return output

    def rpc_result_export(self, asset_id: str, destination: str):
        asset=self.verified_source(asset_id)
        if Path(asset["path"]).suffix.lower() != ".wav":
            raise ValueError("Exportação WAV exige fonte WAV")
        output=self.export_destination(destination,".wav")
        with Path(asset["path"]).open("rb") as source, output.open("xb") as target:
            shutil.copyfileobj(source,target)
        if sha256(output)!=asset["metadata"]["sha256"]:
            raise ValueError("Falha de integridade na exportação")
        return dict(path=str(output),sha256=asset["metadata"]["sha256"])


def number(lo, hi): return dict(type="number", minimum=lo, maximum=hi)
def obj(properties, required=None):
    return dict(type="object",properties=properties,required=list(properties) if required is None else required,additionalProperties=False)
EFFECTS = {
    "gain":dict(db=number(-60,18)), "fade":dict(in_ms=number(0,10000),out_ms=number(0,10000)),
    "highpass":dict(hz=number(10,86400),q=number(.1,10)),
    "lowpass":dict(hz=number(10,86400),q=number(.1,10)),
    "bell":dict(hz=number(10,86400),q=number(.1,10),db=number(-24,12)),
    "reverb":dict(room_m=number(1,50),rt60_s=number(.1,10),damping=number(0,1),predelay_ms=number(0,250)),
    "delay":dict(ms=number(1,2000),feedback=number(-.85,.85)),
    "chorus":dict(seed=dict(type="integer",minimum=0,maximum=4294967295),separation_ms=number(2,50),variation_ms=number(0,10),rate_hz=number(.01,2)),
}
STAGE=obj(dict(wet=number(0,1),effect=dict(oneOf=[obj(dict(type=dict(const=name),**fields)) for name,fields in EFFECTS.items()])))
NAME=dict(type="string",minLength=1,maxLength=200)
CHAIN=obj(dict(name=NAME,schema_version=dict(const=1),output_channels=dict(type="integer",enum=[1,2]),
               tail_seconds=number(0,10),bypass=dict(type="boolean"),chain=dict(type="array",maxItems=32,items=STAGE)))
LAYER=obj(dict(id=NAME,enabled=dict(type="boolean"),pitch_st=number(-12,12),formant_st=number(-6,6),time_ratio=number(.75,1.5),
    delay_ms=number(0,500),gain_db=number(-60,0),pan=number(-1,1),ring_hz=number(0,160),ring_depth_start=number(0,1),
    ring_depth_end=number(0,1),seed=dict(type="integer",minimum=0,maximum=4294967295),chain=CHAIN))
LAYERED_PROPS=dict(schema_version=dict(const=1),name=NAME,research_only=dict(type="boolean"),bypass=dict(type="boolean"),
    wet=number(0,1),dry_db=number(-60,0),lead_ms=number(0,1000),reverse_swell_ms=number(0,1000),reverse_swell_db=number(-60,0),
    target_lufs=number(-36,-16),ceiling_dbtp=number(-6,-.5),layers=dict(type="array",maxItems=12,items=LAYER),master=CHAIN)
FX_RECIPE=dict(oneOf=[CHAIN,obj(LAYERED_PROPS,[k for k in LAYERED_PROPS if k!="research_only"])])


def studio_methods(tool, S, ID, B):
    expression=obj(dict(exaggeration=number(0,1),cfg_weight=number(0,1),temperature=number(.1,1.5),
        repetition_penalty=number(1,2),min_p=number(0,1),top_p=number(.01,1)),[])
    return {
        "engines_list":tool("Consultar categorias, instalação e capacidades reais, sem carregar modelos."),
        "voice_setup_plan":tool("Receita V3 CPU isolada: componentes, versões, licenças e destino.",dict(destination=S),["destination"]),
        "voice_setup_install":tool("Instalar V3 CPU isolado após autorização; retorna sem bloquear. Cache local é copiado e verificado.",dict(destination=S,authorized=B,model_cache=dict(type="string")),["destination","authorized"]),
        "voice_environment_link":tool("Vincular ambiente V3 CPU por versões e hashes, sem alterá-lo.",dict(python_path=S,models=S),["python_path","models"]),
        "voice_profiles_list":tool("Perfis vocais do projeto; não garante identidade entre falas.",dict(project_id=ID),["project_id"]),
        "voice_profile_save":tool("Criar perfil; referência requer autorização explícita.",dict(project_id=ID,name=NAME,language=dict(enum=list(LANGUAGES)),reference_id=ID,authorized=B),["project_id","name","language"]),
        "voice_generate":tool("Enfileirar V3 CPU com texto exato e idioma explícito. Não acrescenta conteúdos ou continuações.",
            dict(project_id=ID,request_key=S,text=dict(type="string",minLength=1,maxLength=500),original_text=dict(type="string",maxLength=2000),
            language=dict(enum=list(LANGUAGES)),seed=dict(type="integer",minimum=0,maximum=4294967295),profile_id=ID,session_id=ID,expressivity=expression),
            ["project_id","request_key","text","language","seed"]),
        "fx_presets_list":tool("Presets globais e privados do projeto.",dict(project_id=ID)),
        "fx_preset_save":tool("Salvar nova revisão de preset genérico ou privado, sem sobrescrever.",dict(name=NAME,recipe=FX_RECIPE,project_id=ID),["name","recipe"]),
        "fx_preset_import":tool("Importar preset JSON validado para biblioteca local.",dict(path=S,project_id=ID),["path"]),
        "fx_preset_export":tool("Exportar preset sem sobrescrever arquivo.",dict(preset_id=ID,destination=S),["preset_id","destination"]),
        "fx_render":tool("Enfileirar DSP nativo, sem IA, com lineage; prévia limita a fonte a dez segundos.",dict(asset_id=ID,request_key=S,recipe=FX_RECIPE,preview=B),["asset_id","request_key","recipe"]),
        "result_export":tool("Copiar WAV original/processado para novo destino com verificação de hash.",dict(asset_id=ID,destination=S),["asset_id","destination"]),
    }
