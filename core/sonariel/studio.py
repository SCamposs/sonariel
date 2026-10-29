"""Generic voice profiles, immutable FX versions, and shared-queue contracts."""
from __future__ import annotations

import json
import shutil
import subprocess
import threading
import time
from pathlib import Path

from .environment import HIDDEN, sha256
from .local_engine import FX_ID, VOICE_ID, STABLE_IDS, LANGUAGES, catalog
from .setup import resource
from .store import identifier


def validate_fx(value, sample_rate=None):
    import jsonschema
    jsonschema.validate(value, FX_RECIPE)
    if len(json.dumps(value, allow_nan=False)) > 200000:
        raise ValueError("Preset excede limite de tamanho")
    if "layers" in value:
        if value["reverse_swell_ms"] > value["lead_ms"]:
            raise ValueError("Swell reverso não pode ultrapassar o pre-roll")
        chains=[value["master"],*[layer["chain"] for layer in value["layers"]]]
        if any(chain["output_channels"] != 2 for chain in chains):
            raise ValueError("Cadeias em camadas exigem saída estéreo")
        if any(layer["chain"]["tail_seconds"] > 6 for layer in value["layers"]):
            raise ValueError("Cauda individual de camada deve ser de até seis segundos")
    else:
        chains=[value]
    for chain in chains:
        for stage in chain["chain"]:
            effect=stage["effect"]
            if sample_rate and effect["type"] in {"bell","lowpass","highpass"} and effect["hz"] > sample_rate*.45:
                raise ValueError("Frequência do filtro excede 45% do sample rate da fonte")
            if effect["type"]=="chorus" and effect["variation_ms"]>=effect["separation_ms"]:
                raise ValueError("Variação do chorus deve ser menor que a separação")
    return value


class Studio:
    def rpc_engines_list(self):
        return catalog(self.store)

    def rpc_audacity_configure(self, executable: str):
        path = Path(executable).resolve(strict=True)
        if not path.is_file() or path.name.lower() != "audacity.exe":
            raise ValueError("Selecione o executável local Audacity.exe")
        if str(path).startswith("\\\\"):
            raise ValueError("Use uma instalação local do Audacity")
        self.store.set("audacity_executable", str(path))
        return dict(executable=str(path), configured=True, tested=False)

    def rpc_stable_setup_plan(self, destination: str, family: str, quality_profile: str = "compact", include_fidelity_audio: bool = False):
        from .stable_setup import StableSetup
        return StableSetup(self.store).plan(destination, family, quality_profile, include_fidelity_audio)

    def rpc_stable_setup_install(self, destination: str, family: str, authorized: bool,
                                 accepted_licenses: bool, model_cache: str = "", quality_profile: str = "compact", include_fidelity_audio: bool = False):
        from .stable_setup import StableSetup
        if not authorized or not accepted_licenses:
            raise ValueError("Autorize a instalação e aceite Stability Community e Gemma explicitamente")
        if self.active or self.local.owned() or (self.setup_thread and self.setup_thread.is_alive()):
            raise ValueError("Aguarde a operação ativa")
        if self.engine.owned_process() or self.external_heavy_process():
            raise ValueError("Descarregue os motores antes de instalar outro ambiente")
        setup = StableSetup(self.store)
        plan = setup.plan(destination, family, quality_profile, include_fidelity_audio)
        self.store.set("setup_status", dict(state="running", stage="Preparar LiteRT isolado", engine="stable-litert"))
        def install():
            try:
                linked = setup.install(destination, family, authorized, accepted_licenses, model_cache, quality_profile, include_fidelity_audio)
                self.rpc_stable_environment_link(**linked)
                self.store.set("setup_status", dict(state="completed", stage="LiteRT CPU instalado e vinculado", destination=plan["destination"], engine="stable-litert"))
            except Exception as error:
                self.store.set("setup_status", dict(state="error", stage=str(error), engine="stable-litert", destination=plan["destination"], retryable=True))
                self.store.event("setup_error", str(error))
        self.setup_thread = threading.Thread(target=install, daemon=True)
        self.setup_thread.start()
        return dict(state="running", destination=plan["destination"])

    def rpc_stable_environment_link(self, python_path: str, source: str, models: str,
                                    families: list[str], accepted_licenses: bool):
        from .stable_setup import VERSIONS, verify_source, selected_files
        if not accepted_licenses:
            raise ValueError("Aceite explícito de Stability Community e Gemma necessário")
        if self.active or self.local.owned():
            raise ValueError("Aguarde a fila antes de trocar o ambiente LiteRT")
        python = Path(python_path).resolve(strict=True)
        source_root, models_root = Path(source).resolve(strict=True), Path(models).resolve(strict=True)
        if python.name.lower() != "python.exe" or not source_root.is_dir() or not models_root.is_dir():
            raise ValueError("Selecione Python, fonte e modelos do ambiente isolado")
        code = "import sys,json,importlib.metadata as m; print(json.dumps({'python':list(sys.version_info[:3]),'packages':{k:m.version(k) for k in " + repr(list(VERSIONS)) + "}}))"
        result = subprocess.run([str(python), "-c", code], capture_output=True, text=True, timeout=30, **HIDDEN)
        if result.returncode:
            raise ValueError("Ambiente LiteRT incompleto")
        versions = json.loads(result.stdout)
        if versions["python"] != [3,11,15] or versions["packages"] != VERSIONS:
            raise ValueError("Versões fora da receita LiteRT CPU validada")
        manifest = json.loads(resource("stable-models.json").read_text(encoding="utf-8"))
        verify_source(source_root, manifest)
        for file in selected_files(manifest, families):
            path = models_root / file["path"]
            if not path.is_file() or path.stat().st_size != file["bytes"] or sha256(path) != file["sha256"]:
                raise ValueError("Checkpoint LiteRT ausente ou diferente: " + file["path"])
        encoder = next(file for file in manifest["files"] if file["path"] == "tflite/same-s/enc_w8a8.tflite")
        encoder_path = models_root / encoder["path"]
        encoder_present = encoder_path.is_file()
        if encoder_present and sha256(encoder_path) != encoder["sha256"]:
            raise ValueError("Encoder de áudio LiteRT diferente da receita")
        probe = subprocess.run([str(python), "-c", "import importlib.metadata as m; print(next((d.version for d in m.distributions() if d.metadata['Name'].lower()=='soxr'),''))"], capture_output=True, text=True, timeout=30, **HIDDEN)
        audio_input_ready = encoder_present and probe.returncode == 0 and probe.stdout.strip() == "1.0.0"
        from .stable_profiles import FIDELITY_PATHS, FIDELITY_ENCODER
        fidelity_ready = 'medium' in families
        for name in FIDELITY_PATHS:
            spec = next(f for f in manifest['files'] if f['path']==name)
            candidate = models_root/name
            if not candidate.is_file():
                fidelity_ready = False
            elif candidate.stat().st_size!=spec['bytes'] or sha256(candidate)!=spec['sha256']:
                raise ValueError('FP32/SAME-L checkpoint differs: '+name)
        fidelity_encoder = next(f for f in manifest['files'] if f['path'] == FIDELITY_ENCODER)
        candidate = models_root / FIDELITY_ENCODER
        fidelity_encoder_ready = False
        if candidate.is_file():
            if candidate.stat().st_size != fidelity_encoder['bytes'] or sha256(candidate) != fidelity_encoder['sha256']:
                raise ValueError('SAME-L FP32 encoder differs from the pinned recipe')
            fidelity_encoder_ready = True
        fidelity_audio_input_ready = fidelity_ready and fidelity_encoder_ready and probe.returncode == 0 and probe.stdout.strip() == '1.0.0'
        config = dict(fidelity_audio_input_ready=fidelity_audio_input_ready,
            quality_profiles=['compact','fidelity'] if fidelity_ready else ['compact'], python=str(python), source=str(source_root), models=str(models_root),
            families=families, versions=versions, accepted_licenses=True, acceptance_time=time.time(), model_revision=manifest["revision"],
            audio_input_ready=audio_input_ready, resampler_version=probe.stdout.strip() if probe.returncode == 0 else None)
        self.store.set("stable_environment", config)
        self.store.event("environment", "LiteRT CPU vinculado por versões e hashes; aceite de licenças registrado localmente")
        return config

    def rpc_music_generate(self, engine_id: str, project_id: str, request_key: str, prompt: str,
                            seed: int, duration: float, steps: int = 8, batch_size: int = 1,
                            session_id: str | None = None, mode: str = "text2audio",
                            source_id: str | None = None, init_noise_level: float | None = None, quality_profile: str = "compact"):
        if engine_id not in STABLE_IDS:
            raise ValueError("Este contrato aceita apenas Stable Audio LiteRT; Turbo mantém generate")
        environment = self.store.setting("stable_environment", {})
        if not environment.get("accepted_licenses") or STABLE_IDS[engine_id] not in environment.get("families", []):
            raise ValueError("Configure e aceite as licenças do motor escolhido antes de gerar")
        from .stable_profiles import profile_components
        profile_components(engine_id, quality_profile)
        if quality_profile=='fidelity':
            if 'fidelity' not in environment.get('quality_profiles', []):
                raise ValueError('Download or link the optional FP32/SAME-L profile first')
            if mode == 'audio2audio' and not environment.get('fidelity_audio_input_ready'):
                raise ValueError('Link the verified SAME-L FP32 encoder and resampler before fidelity audio2audio')
        params = dict(_engine=engine_id, quality_profile=quality_profile, prompt=prompt, seed=seed, duration=duration, steps=steps, batch_size=batch_size,
                      mode=mode, cfg=1., apg=1., backend="litert-cpu")
        if mode == "text2audio":
            if source_id is not None or init_noise_level is not None:
                raise ValueError("Áudio de entrada exige mode=audio2audio explícito; não é referência de estilo")
            if duration > 60:
                raise ValueError("text2audio mantém limite local de 60 segundos")
        elif mode == "audio2audio":
            if quality_profile == 'compact' and not environment.get("audio_input_ready"):
                raise ValueError("Prepare encoder SAME-S e resampler pelo setup LiteRT e vincule novamente o ambiente")
            if not source_id:
                raise ValueError("audio2audio exige source_id do projeto")
            asset = self.verified_source(source_id)
            self.validate_audio_role(asset, "source", engine_id)
            if asset["project_id"] != project_id:
                raise ValueError("Fonte de áudio pertence a outro projeto")
            if asset["metadata"]["channels"] not in (1, 2):
                raise ValueError("Fonte deve ser WAV mono ou estéreo")
            if abs(duration - asset["metadata"]["duration"]) > 1 / asset["metadata"]["sample_rate"]:
                raise ValueError("Duração audio2audio deve coincidir com a fonte completa; registre um trecho separado para recortar")
            sigma = (.65 if quality_profile == 'fidelity' else .25) if init_noise_level is None else init_noise_level
            if not .01 <= sigma < 1:
                raise ValueError("init_noise_level deve ser >=0.01 e <1; 1 ignoraria a fonte")
            params.update(source_id=source_id, source_path=asset["path"], source_sha256=asset["metadata"]["sha256"],
                          source_duration=asset["metadata"]["duration"], init_noise_level=sigma, _parent_id=source_id)
        else:
            raise ValueError("Modo musical não suportado")
        return self.enqueue_local(project_id, request_key, params, session_id)

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
        asset=self.verified_source(asset_id)
        validate_fx(recipe,asset["metadata"]["sample_rate"])
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
        "audacity_configure":tool("Selecionar Audacity local independentemente dos motores; não altera módulos ou preferências.",dict(executable=S),["executable"]),
        "stable_setup_plan":tool("Receita LiteRT CPU e termos Stability/Gemma antes de instalar.",dict(destination=S,family=dict(enum=["sm-music","medium"]),quality_profile=dict(enum=["compact","fidelity"]),include_fidelity_audio=B),["destination","family"]),
        "stable_setup_install":tool("Instalar LiteRT isolado após autorização e aceite explícito das duas licenças. Não registra uso comercial.",dict(destination=S,family=dict(enum=["sm-music","medium"]),authorized=B,accepted_licenses=B,model_cache=dict(type="string"),quality_profile=dict(enum=["compact","fidelity"]),include_fidelity_audio=B),["destination","family","authorized","accepted_licenses"]),
        "stable_environment_link":tool("Vincular LiteRT CPU por hashes/versões após aceite explícito das duas licenças.",dict(python_path=S,source=S,models=S,families=dict(type="array",items=dict(enum=["sm-music","medium"]),minItems=1,maxItems=2,uniqueItems=True),accepted_licenses=B),["python_path","source","models","families","accepted_licenses"]),
        "music_generate":tool("Stable Audio LiteRT: text2audio até 60s ou audio2audio explícito até 120s com source_id e duração integral da fonte. init_noise_level menor preserva mais a fonte; não é força de referência de estilo. Batch 1, CFG/APG 1. Turbo usa generate.",dict(engine_id=dict(enum=list(STABLE_IDS)),project_id=ID,request_key=S,prompt=dict(type="string",minLength=1,maxLength=4000),seed=dict(type="integer",minimum=0,maximum=4294967295),duration=number(5,120),steps=dict(type="integer",enum=[4,8,16]),batch_size=dict(const=1),session_id=ID,mode=dict(enum=["text2audio","audio2audio"]),source_id=ID,init_noise_level=dict(type="number",minimum=.01,exclusiveMaximum=1),quality_profile=dict(enum=["compact","fidelity"])),["engine_id","project_id","request_key","prompt","seed","duration"]),
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
