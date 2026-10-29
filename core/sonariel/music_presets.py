"""Versioned, engine-specific musical configurations with explicit review before inference."""
from __future__ import annotations

import hashlib
import json
import time

import jsonschema

from .local_engine import STABLE_IDS
from .store import identifier

TURBO = "acestep-v15-turbo"
ENGINES = {TURBO, *STABLE_IDS}


def digest(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


class MusicPresets:
    def music_preset_metadata(self, job_id):
        rows = self.store.rows("SELECT p.id AS preset_id,p.family_id,p.revision,p.engine_id,p.source_asset_id,u.intent "
            "FROM music_preset_uses u JOIN music_presets p ON p.id=u.preset_id WHERE u.job_id=?", (job_id,))
        if not rows:
            return None
        return {**rows[0], "origin_recommendation": self.store.setting("music_recommendation:" + rows[0]["preset_id"])}

    def _music_preset(self, preset_id):
        rows = self.store.rows("SELECT * FROM music_presets WHERE id=?", (preset_id,))
        if not rows:
            raise ValueError("Music preset not found")
        return {**rows[0], "origin_recommendation": self.store.setting("music_recommendation:" + preset_id)}

    def rpc_music_recommendations_list(self):
        from .music_recommendations import recommendations
        return recommendations(self.store)

    def rpc_music_recommendation_save(self, recommendation_id: str, project_id: str, name: str,
                                      prompt: str, seed: int, duration: float):
        from .music_recommendations import recommendation
        recipe = recommendation()
        if recommendation_id != recipe["id"]:
            raise ValueError("Unknown music recommendation")
        # Pure preset creation: works before installing models, never accepts licenses or queues work.
        result = self.rpc_music_preset_save(project_id, name,
            description="Starting recipe: " + recipe["name"] + "; " + recipe["id"],
            engine_id=recipe["engine_id"], parameters={**recipe["parameters"], "prompt": prompt, "seed": seed, "duration": duration})
        self.store.set("music_recommendation:" + result["id"], recipe)
        return self._music_preset(result["id"])

    def _music_config(self, engine_id, params, project_id):
        # Reuse the existing public schema; do not broaden engine capabilities.
        from .service import METHODS
        if engine_id not in ENGINES:
            raise ValueError("Unsupported music preset engine")
        method = "generate" if engine_id == TURBO else "music_generate"
        excluded = {"project_id", "request_key", "session_id", "parent_id", "engine_id"}
        original = METHODS[method]["inputSchema"]
        schema = dict(type="object", additionalProperties=False,
            properties={k: v for k, v in original["properties"].items() if k not in excluded},
            required=[k for k in original["required"] if k not in excluded])
        jsonschema.validate(params, schema)
        value = dict(params)
        mode = value.setdefault("mode", "text2music" if engine_id == TURBO else "text2audio")
        value.setdefault("batch_size", 1)
        if engine_id == TURBO:
            value.setdefault("cover_strength", 1)
            if mode == "text2music" and (value.get("source_id") or value["cover_strength"] != 1):
                raise ValueError("text2music requires no source_id and cover_strength=1")
        else:
            value.setdefault("steps", 8)
            from .stable_profiles import profile_components
            value.setdefault('quality_profile', 'compact')
            profile_components(engine_id, value['quality_profile'])
            if value['quality_profile']=='fidelity' and mode!='text2audio':
                raise ValueError('FP32/SAME-L currently supports text2audio only')
            if mode == "text2audio" and (value["duration"] > 60 or value.get("source_id") or value.get("init_noise_level") is not None):
                raise ValueError("text2audio requires no source and at most 60 seconds")
        for role in ("reference_id", "source_id"):
            if value.get(role):
                source = self.verified_source(value[role])
                self.validate_audio_role(source, "style" if role == "reference_id" else "source", engine_id)
                if source["project_id"] != project_id:
                    raise ValueError("Preset conditioning belongs to another project; select an explicit replacement")
        if mode in {"cover", "audio2audio"}:
            if not value.get("source_id"):
                raise ValueError("Source-guided preset requires an explicit source_id")
            source = self.verified_source(value["source_id"])
            tolerance = .1 if engine_id == TURBO else 1 / source["metadata"]["sample_rate"]
            if abs(source["metadata"]["duration"] - value["duration"]) > tolerance:
                raise ValueError("Preset duration must match the full selected source")
            if engine_id != TURBO:
                value.setdefault("init_noise_level", .25)
        return value

    def _configuration_from_asset(self, asset_id, project_id):
        asset = self.store.asset(asset_id)
        if asset["project_id"] != project_id:
            raise ValueError("Preset result belongs to another project")
        raw = asset["metadata"].get("parameters", {})
        engine = raw.get("_engine", raw.get("model"))
        if engine == TURBO:
            if any(raw.get(flag) for flag in ("thinking", "sample_mode", "use_format", "use_cot_caption", "use_cot_language", "allow_lm_batch")) or raw.get("inference_steps", 8) != 8:
                raise ValueError("Result is outside the validated Turbo preset profile")
            params = dict(prompt=raw.get("prompt"), seed=raw.get("seed"), duration=raw.get("audio_duration"),
                bpm=raw.get("bpm"), key_scale=raw.get("key_scale"), time_signature=raw.get("time_signature"),
                mode=raw.get("task_type", "text2music"), cover_strength=raw.get("audio_cover_strength", 1), batch_size=1)
            roles = (("reference_audio_path", "reference_id"), ("src_audio_path", "source_id"))
        elif isinstance(engine, str) and engine in STABLE_IDS:
            if raw.get("cfg", 1) != 1 or raw.get("apg", 1) != 1:
                raise ValueError("Result is outside the validated Stable Audio preset profile")
            params = {key: raw[key] for key in ("prompt", "seed", "duration", "steps", "mode", "init_noise_level", "batch_size", "quality_profile") if key in raw}
            if raw.get('precision')=='DiT fp32 / SAME-L fp32 / T5Gemma fp16':
                params['quality_profile']='fidelity'
            roles = (("source_path", "source_id"),)
        else:
            raise ValueError("Choose a music generation result; DSP and voice presets are separate")
        for path_key, role in roles:
            if raw.get(path_key):
                rows = self.store.rows("SELECT id FROM assets WHERE project_id=? AND path=? ORDER BY created LIMIT 1", (project_id, raw[path_key]))
                if not rows:
                    raise ValueError("Preset conditioning source is no longer registered")
                params[role] = rows[0]["id"]
        return engine, self._music_config(engine, params, project_id)

    def rpc_music_presets_list(self, project_id: str | None = None):
        if project_id:
            self.require_project(project_id)
        rows = self.store.rows("SELECT id FROM music_presets" + (" WHERE project_id=?" if project_id else "")
                               + " ORDER BY created DESC", (project_id,) if project_id else ())
        return [self._music_preset(row["id"]) for row in rows]

    def rpc_music_preset_save(self, project_id: str, name: str, description: str = "", asset_id: str | None = None,
                              engine_id: str | None = None, parameters: dict | None = None,
                              base_id: str | None = None, duplicate: bool = False):
        self.require_project(project_id)
        base = self._music_preset(base_id) if base_id else None
        if base and base["project_id"] != project_id:
            raise ValueError("Preset revision belongs to another project")
        if asset_id:
            if engine_id is not None or parameters is not None:
                raise ValueError("Choose result capture or explicit configuration, not both")
            engine_id, parameters = self._configuration_from_asset(asset_id, project_id)
        elif base:
            engine_id = engine_id or base["engine_id"]
            parameters = base["params"] if parameters is None else parameters
        if not engine_id or parameters is None:
            raise ValueError("Provide a music result or explicit engine and parameters")
        if base and base["engine_id"] != engine_id:
            raise ValueError("Do not change engines within a preset family")
        params = self._music_config(engine_id, parameters, project_id)
        key = identifier()
        family = base["family_id"] if base and not duplicate else key
        revisions = self.store.rows("SELECT MAX(revision) AS revision FROM music_presets WHERE family_id=?", (family,))
        revision = (revisions[0]["revision"] or 0) + 1
        self.store.execute("INSERT INTO music_presets VALUES(?,?,?,?,?,?,?,?,?,?,?,?)",
            (key, project_id, name, description, engine_id, json.dumps(params, allow_nan=False), family,
             revision, base_id, 0, time.time(), asset_id or (base["source_asset_id"] if base else None)))
        if base and base.get("origin_recommendation"):
            self.store.set("music_recommendation:" + key, base["origin_recommendation"])
        return self._music_preset(key)

    def rpc_music_preset_favorite(self, preset_id: str, favorite: bool):
        self._music_preset(preset_id)
        self.store.execute("UPDATE music_presets SET favorite=? WHERE id=?", (favorite, preset_id))
        return self._music_preset(preset_id)

    def rpc_music_preset_prepare(self, preset_id: str, project_id: str, overrides: dict | None = None, intent: str = "reuse"):
        self.require_project(project_id)
        preset = self._music_preset(preset_id)
        config = self._music_config(preset["engine_id"], {**preset["params"], **(overrides or {})}, project_id)
        if intent == "variation" and config["seed"] == preset["params"]["seed"]:
            raise ValueError("A variation requires an explicitly different seed")
        if intent == "repeat" and config != preset["params"]:
            raise ValueError("Repeat preserves the saved configuration; choose variation for changed settings")
        review = dict(preset_id=preset_id, project_id=project_id, engine_id=preset["engine_id"],
                      revision=preset["revision"], parameters=config, intent=intent)
        if preset.get("origin_recommendation"):
            review["origin_recommendation"] = preset["origin_recommendation"]
        return {**review, "review_token": digest(review),
                "warning": "Reusing a seed does not guarantee identical audio across checkpoints or environments. Reuse only reviews settings; repeat/variation require a separate confirmed generation request."}

    def rpc_music_preset_generate(self, preset_id: str, project_id: str, request_key: str, review_token: str,
                                  intent: str, confirmed: bool, overrides: dict | None = None,
                                  session_id: str | None = None):
        if not confirmed:
            raise ValueError("Review and explicitly confirm the preset before generating")
        fingerprint = digest(dict(preset_id=preset_id, project_id=project_id, intent=intent,
                                  overrides=overrides or {}, session_id=session_id, review_token=review_token))
        existing = self.store.rows("SELECT * FROM jobs WHERE request_key=?", (request_key,))
        if existing:
            use = self.store.rows("SELECT * FROM music_preset_uses WHERE job_id=?", (existing[0]["id"],))
            if not use or use[0]["request_fingerprint"] != fingerprint:
                raise ValueError("request_key already used with different preset parameters")
            return dict(job_id=existing[0]["id"], state=existing[0]["state"], already_submitted=True)
        review = self.rpc_music_preset_prepare(preset_id, project_id, overrides, intent)
        if review_token != review["review_token"]:
            raise ValueError("Preset review changed; review the actual values again")
        engine = review["engine_id"]
        arguments = dict(project_id=project_id, request_key=request_key, **review["parameters"])
        if session_id:
            arguments["session_id"] = session_id
        if engine != TURBO:
            arguments["engine_id"] = engine
        job = self.invoke("generate" if engine == TURBO else "music_generate", arguments)
        self.store.execute("INSERT INTO music_preset_uses VALUES(?,?,?,?,?)",
            (job["job_id"], preset_id, intent, fingerprint, time.time()))
        return {**job, "preset_id": preset_id, "preset_revision": review["revision"]}


def music_preset_methods(tool, S, ID, B):
    parameters = dict(type="object", maxProperties=24)
    name = dict(type="string", minLength=1, maxLength=120)
    return {
        "music_recommendations_list": tool("List public recommended starting recipes, exact runtime/checkpoint configuration and installed availability. No models loaded; never changes the default engine. Fidelity supports text2audio only.", {}),
        "music_recommendation_save": tool("Save the public recommended recipe as a project music preset with explicit user direction, seed and duration. Never installs, accepts licenses or generates. Then use the existing preset review/confirmed-generation workflow. Origin is retained separately from later edits.",
            dict(recommendation_id=dict(type="string", enum=["medium-fp32-same-l-v1"]), project_id=ID, name=name,
                 prompt=dict(type="string", minLength=1, maxLength=4000), seed=dict(type="integer", minimum=0, maximum=4294967295),
                 duration=dict(type="number", minimum=5, maximum=60)),
            ["recommendation_id", "project_id", "name", "prompt", "seed", "duration"]),
        "music_presets_list": tool("List versioned music presets, separate from DSP presets. Does not load models.", dict(project_id=ID)),
        "music_preset_save": tool("Capture a music result or save an explicit engine-compatible configuration. Creates an immutable revision or explicit duplicate. Never generates audio.",
            dict(project_id=ID, name=name, description=dict(type="string", maxLength=2000), asset_id=ID,
                 engine_id=dict(type="string", enum=sorted(ENGINES)), parameters=parameters, base_id=ID, duplicate=B), ["project_id", "name"]),
        "music_preset_favorite": tool("Set a music preset favorite without changing its parameters.", dict(preset_id=ID, favorite=B), ["preset_id", "favorite"]),
        "music_preset_prepare": tool("Review engine-specific preset values before reuse. intent=reuse never enqueues audio; repeat preserves exact settings; variation requires a different seed. Returns a review token.",
            dict(preset_id=ID, project_id=ID, overrides=parameters, intent=dict(type="string", enum=["reuse", "repeat", "variation"])), ["preset_id", "project_id"]),
        "music_preset_generate": tool("Explicitly confirmed generation after music_preset_prepare with matching values/token. Request-key idempotent. Preserves existing engine/queue safeguards; never changes engine implicitly.",
            dict(preset_id=ID, project_id=ID, request_key=S, review_token=dict(type="string", pattern="^[a-f0-9]{64}$"),
                 intent=dict(type="string", enum=["repeat", "variation"]), confirmed=B, overrides=parameters, session_id=ID),
            ["preset_id", "project_id", "request_key", "review_token", "intent", "confirmed"]),
    }
