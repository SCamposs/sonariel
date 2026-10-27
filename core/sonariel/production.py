"""Non-destructive production operations; no generative runtime imports."""
from __future__ import annotations

from pathlib import Path
import json
import math
import re
import shutil
import string
import time

from .environment import sha256
from .store import identifier

from .local_engine import FX_ID
from .capabilities import require_loop_creation

MUSIC_ENGINES = {"acestep-v15-turbo", "stable-audio-3-small-music", "stable-audio-3-medium"}
PORTABLE_FIELDS = {
    "_engine", "model", "seed", "duration", "audio_duration", "steps", "inference_steps",
    "bpm", "key_scale", "time_signature", "task_type", "mode", "audio_cover_strength",
    "init_noise_level", "batch_size", "cfg", "apg", "guidance_scale", "shift", "infer_method",
    "instrumental", "thinking", "sample_mode", "use_format", "use_cot_caption", "use_cot_language",
    "constrained_decoding", "allow_lm_batch", "use_random_seed", "audio_format", "backend",
    "operation", "schema_version", "start_seconds", "end_seconds", "crossfade_ms", "repetitions",
    "recipe", "output_channels", "tail_seconds", "bypass", "chain", "layers", "master", "wet",
    "effect", "type", "db", "hz", "q", "in_ms", "out_ms", "room_m", "rt60_s", "damping",
    "predelay_ms", "ms", "feedback", "separation_ms", "variation_ms", "rate_hz", "pitch_st",
    "formant_st", "time_ratio", "delay_ms", "gain_db", "pan", "ring_hz", "ring_depth_start",
    "ring_depth_end", "dry_db", "lead_ms", "reverse_swell_ms", "reverse_swell_db", "target_lufs",
    "ceiling_dbtp", "enabled", "expressivity", "exaggeration", "cfg_weight", "temperature",
    "repetition_penalty", "min_p", "top_p", "language", "model_revision", "checkpoint_revision",
    "beat_grid", "anchor_seconds", "beats_per_bar", "bars",
}


def portable_parameters(value):
    """Allowlisted production metadata; never serialize filesystem/credential context."""
    if isinstance(value, dict):
        return {key: portable_parameters(item) for key, item in value.items() if key in PORTABLE_FIELDS}
    if isinstance(value, list):
        return [portable_parameters(item) for item in value[:64]]
    if isinstance(value, (bool, int)) or value is None:
        return value
    if isinstance(value, float):
        return value if math.isfinite(value) else None
    if isinstance(value, str):
        # Strings here are technical names/enums, never prompts or file paths.
        return value if len(value) <= 120 and not re.search(r"[\\/:\r\n]", value) else None
    return None


def filename_part(value):
    name = re.sub(r'[<>:"/\\|?*\x00-\x1f]', "_", str(value)).strip(" .")[:100]
    if not name or name.split(".")[0].upper() in {"CON", "PRN", "AUX", "NUL", *[f"COM{i}" for i in range(1, 10)], *[f"LPT{i}" for i in range(1, 10)]}:
        name = "audio_" + name
    return name


def naming_fields(pattern):
    if not pattern or len(pattern) > 160 or re.search(r'[<>:"/\\|?*\x00-\x1f]', pattern):
        raise ValueError("Invalid export naming pattern")
    try:
        for _, field, spec, conversion in string.Formatter().parse(pattern):
            if field is not None and (field not in {"name", "id", "model", "seed", "index"} or spec or conversion):
                raise ValueError("Invalid export naming placeholder")
    except (ValueError, KeyError):
        raise ValueError("Use only {name}, {id}, {model}, {seed}, {index} in the naming pattern") from None


class Production:
    def rpc_result_export_batch(self, asset_ids: list[str], directory: str,
                                naming: str = "{index}_{name}", collisions: str = "rename",
                                manifest: bool = False, include_prompts: bool = False,
                                include_references: bool = False):
        naming_fields(naming)
        root = Path(directory)
        if not root.is_absolute() or str(root).startswith("\\\\") or not root.is_dir() or root.is_symlink() or root.is_junction():
            raise ValueError("Choose an existing local export folder")
        root = root.resolve(strict=True)
        report = []
        for index, asset_id in enumerate(asset_ids, 1):
            entry = dict(asset_id=asset_id, status="failed", file=None)
            try:
                asset = self.store.asset(asset_id)
                if asset["kind"] == "reference" and not include_references:
                    entry["error_code"] = "reference_requires_authorization"
                    continue
                if Path(asset["path"]).suffix.lower() != ".wav":
                    entry["error_code"] = "wav_required"
                    continue
                asset = self.verified_source(asset_id)
                params = asset["metadata"].get("parameters", {})
                model = params.get("model", params.get("_engine"))
                model = model if isinstance(model, str) and model in MUSIC_ENGINES | {FX_ID, "chatterbox-v3"} else None
                seed = params.get("seed")
                seed = seed if type(seed) is int else None
                fields = dict(name=filename_part(asset["name"]), id=asset_id[:12],
                              model=model or "unknown", seed=seed if seed is not None else "unknown", index=f"{index:03}")
                stem = filename_part(naming.format(**fields))
                if stem.lower().endswith(".wav"):
                    stem = stem[:-4]
                serial = 1
                while True:
                    candidate = root / f"{stem}{'' if serial == 1 else '_' + str(serial)}.wav"
                    try:
                        target = candidate.open("xb")
                        break
                    except FileExistsError:
                        if collisions == "skip":
                            entry.update(status="skipped", error_code="name_collision")
                            break
                        serial += 1
                        if serial > 10000:
                            raise OSError("Too many collisions")
                if entry["status"] == "skipped":
                    continue
                try:
                    with target, Path(asset["path"]).open("rb") as original:
                        shutil.copyfileobj(original, target)
                    if sha256(candidate) != asset["metadata"]["sha256"] or sha256(Path(asset["path"])) != asset["metadata"]["sha256"]:
                        candidate.unlink()  # Only this exclusively created copy, never its source.
                        entry["error_code"] = "source_changed"
                        continue
                except OSError:
                    # A partial, exclusively created output is reported rather than hidden.
                    entry.update(file=candidate.name, error_code="copy_failed")
                    continue
                metadata = asset["metadata"]
                parameters = portable_parameters(params)
                receipt = metadata.get("render_receipt", {})
                revisions = portable_parameters({field: receipt[field] for field in
                    ("model_revision", "checkpoint_revision") if field in receipt}) if isinstance(receipt, dict) else {}
                parameters.update({field: value for field, value in revisions.items() if value is not None})
                if include_prompts and isinstance(params.get("prompt"), str):
                    parameters["prompt"] = params["prompt"]
                lineage = {"parent_id": asset["parent_id"]}
                if isinstance(metadata.get("region"), dict):
                    region = metadata["region"]
                    lineage["region"] = {field: region[field] for field in ("source_id", "source_sha256", "start_frame", "end_frame", "sample_rate", "role", "engine_id") if field in region}
                for field in ("source_sha256", "reference_sha256"):
                    if re.fullmatch(r"[0-9a-f]{64}", str(params.get(field, ""))):
                        lineage[field] = params[field]
                entry.update(status="exported", file=candidate.name, sha256=metadata["sha256"],
                    model=model, seed=seed, duration=metadata["duration"], sample_rate=metadata["sample_rate"],
                    channels=metadata["channels"], parameters=parameters, lineage=lineage)
                if asset["job_id"] and (preset := self.music_preset_metadata(asset["job_id"])):
                    entry["music_preset"] = preset
            except ValueError:
                entry["error_code"] = "source_unavailable_or_changed"
            except OSError:
                entry["error_code"] = "destination_io_error"
            finally:
                report.append(entry)
        manifest_name = None
        manifest_error = None
        if manifest:
            manifest_name = f"sonariel-export-{identifier()}.json"
            try:
                with (root / manifest_name).open("x", encoding="utf-8") as stream:
                    json.dump(dict(schema_version=1, created=time.time(), files=report,
                                   prompts_included=include_prompts, references_authorized=include_references),
                              stream, ensure_ascii=False, indent=2, allow_nan=False)
            except OSError:
                manifest_error = "destination_io_error"
                manifest_name = None
        return dict(directory=str(root), files=report, manifest=manifest_name, manifest_error=manifest_error)

    def rpc_fx_loop_render(self, asset_id: str, request_key: str, start_seconds: float,
                           end_seconds: float, crossfade_ms: float, name: str = "Loop",
                           preview: bool = False, repetitions: int = 3, beat_grid: dict | None = None):
        require_loop_creation(self.store.home)
        asset = self.verified_source(asset_id)
        meta = asset["metadata"]
        if Path(asset["path"]).suffix.lower() != ".wav" or meta["channels"] not in (1, 2):
            raise ValueError("Loop source must be a mono or stereo WAV")
        sr = meta["sample_rate"]
        first, last = math.floor(start_seconds * sr + .5), math.floor(end_seconds * sr + .5)
        overlap = math.floor(crossfade_ms * sr / 1000 + .5)
        if first < 0 or last > round(meta["duration"] * sr) or last - first < sr / 10:
            raise ValueError("Loop region must fit the source and contain at least 0.1 seconds")
        if overlap and (overlap < 2 or overlap > (last - first) // 2):
            raise ValueError("Crossfade must fit half the region and contain at least two frames")
        if beat_grid:
            anchor = math.floor(beat_grid["anchor_seconds"] * sr + .5)
            period = math.floor(60 / beat_grid["bpm"] * beat_grid["beats_per_bar"] * beat_grid["bars"] * sr + .5)
            if first != anchor - overlap or last != anchor + period:
                raise ValueError("Beat grid does not match selected region; apply the grid again after changing the crossfade")
        repeat = repetitions if preview else 1
        if (last - first - overlap) * repeat > sr * 600:
            raise ValueError("Loop preview/output limit is ten minutes; shorten the region or reduce repetitions")
        recipe = dict(operation="loop", schema_version=1, name=name, start_seconds=start_seconds,
                      end_seconds=end_seconds, crossfade_ms=crossfade_ms, repetitions=repeat)
        params = dict(_engine=FX_ID, source_path=asset["path"], source_sha256=meta["sha256"],
                      _parent_id=asset_id, recipe=recipe, preview=preview)
        if beat_grid:
            params["beat_grid"] = beat_grid
        return self.enqueue_local(asset["project_id"], request_key, params, asset["session_id"])


def production_methods(tool, S, ID, B):
    return {
        "result_export_batch": tool(
            "Export selected WAV results to an existing local folder without overwrites. "
            "Optional portable JSON manifest omits paths/credentials and prompts by default. "
            "Reference audio requires explicit include_references authorization. Generation batch size is unchanged.",
            dict(asset_ids=dict(type="array", items=ID, minItems=1, maxItems=200, uniqueItems=True),
                 directory=S, naming=dict(type="string", minLength=1, maxLength=160),
                 collisions=dict(type="string", enum=["rename", "skip"]), manifest=B,
                 include_prompts=B, include_references=B), ["asset_ids", "directory"]),
        "fx_loop_render": tool(
            "Create a derived native-DSP loop with an explicit source region and circular linear crossfade. "
            "Preview repeats the complete edited cycle 2–4 times; full render contains one cycle. "
            "Duration is region minus crossfade. Original is preserved; no automatic beat alignment or perfect-loop guarantee.",
            dict(asset_id=ID, request_key=S, name=dict(type="string", minLength=1, maxLength=120),
                 start_seconds=dict(type="number", minimum=0, maximum=600),
                 end_seconds=dict(type="number", exclusiveMinimum=0, maximum=600),
                 crossfade_ms=dict(type="number", minimum=0, maximum=300000), preview=B,
                 repetitions=dict(type="integer", minimum=2, maximum=4),
                 beat_grid=dict(type="object", additionalProperties=False, properties=dict(
                    anchor_seconds=dict(type="number", minimum=0, maximum=600),
                    bpm=dict(type="number", minimum=30, maximum=300),
                    beats_per_bar=dict(type="integer", enum=[2, 3, 4, 6]),
                    bars=dict(type="integer", minimum=1, maximum=32)),
                    required=["anchor_seconds", "bpm", "beats_per_bar", "bars"])),
            ["asset_id", "request_key", "start_seconds", "end_seconds", "crossfade_ms"]),
    }
