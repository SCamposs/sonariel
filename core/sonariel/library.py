"""Project-local organization and reproducible, non-destructive audio regions."""
from __future__ import annotations

import hashlib
import json
import math
import time
import unicodedata
from pathlib import Path

import soundfile as sf
import numpy as np

from .environment import sha256, telemetry
from .store import identifier

MUSIC = ["acestep-v15-turbo", "stable-audio-3-small-music", "stable-audio-3-medium"]
KINDS = ["generated", "imported", "processed", "export", "voice", "region", "reference"]


def tags_normalized(tags):
    values = set()
    for raw in tags:
        tag = " ".join(unicodedata.normalize("NFKC", raw).split()).casefold()
        if not tag or len(tag) > 48 or any(unicodedata.category(c).startswith("C") for c in tag):
            raise ValueError("Tags must contain 1–48 visible characters")
        values.add(tag)
    if len(values) > 32:
        raise ValueError("Use at most 32 tags per audio")
    return sorted(values)


def signature(value):
    return hashlib.sha256(json.dumps(value, sort_keys=True, allow_nan=False).encode()).hexdigest()


def inspect_region(path):
    """Bounded-memory verification; never allocate an entire high-rate excerpt."""
    peaks, squared, samples = [], 0., 0
    with sf.SoundFile(path) as audio:
        frames, rate, channels, subtype = len(audio), audio.samplerate, audio.channels, audio.subtype
        block_frames = max(1, math.ceil(frames / 160))
        while True:
            block = audio.read(block_frames, dtype="float32", always_2d=True)
            if not len(block):
                break
            if not np.isfinite(block).all():
                raise ValueError("Áudio vazio ou com amostras inválidas")
            peaks.append(float(np.abs(block).max()))
            squared += float(np.square(block, dtype=np.float64).sum())
            samples += block.size
    if not samples:
        raise ValueError("Áudio vazio ou com amostras inválidas")
    peak, rms = max(peaks), math.sqrt(squared / samples)
    if peak < 1e-5 or rms < 1e-6:
        raise ValueError("Áudio silencioso")
    return dict(duration=frames/rate, sample_rate=rate, channels=channels, subtype=subtype,
                peak=peak, rms=rms, waveform=[round(p, 5) for p in peaks])


class Library:
    def with_tags(self, assets):
        if not assets:
            return assets
        ids = {a["id"] for a in assets}
        tags = {}
        for row in self.store.rows("SELECT * FROM asset_tags"):
            if row["asset_id"] in ids:
                tags.setdefault(row["asset_id"], []).append(row["tag"])
        return [{**a, "tags": sorted(tags.get(a["id"], []))} for a in assets]

    def validate_filters(self, project_id, filters):
        self.require_project(project_id)
        filters = {"query": "", "favorite": False, "tags": [], "session_id": None, "kind": None, **filters}
        filters["query"] = filters["query"].strip()
        filters["tags"] = tags_normalized(filters["tags"])
        if filters["session_id"] and not self.store.rows("SELECT id FROM sessions WHERE id=? AND project_id=?", (filters["session_id"], project_id)):
            raise ValueError("Session filter belongs to another project")
        known = {r["tag"] for r in self.rpc_project_tags_list(project_id)}
        if set(filters["tags"]) - known:
            raise ValueError("Select tags from the active project")
        return filters

    def rpc_library_filters_save(self, project_id, filters):
        filters = self.validate_filters(project_id, filters)
        self.store.execute("INSERT INTO library_filters VALUES(?,?) ON CONFLICT(project_id) DO UPDATE SET params=excluded.params",
                           (project_id, json.dumps(filters, ensure_ascii=False)))
        return {"project_id": project_id, "filters": filters}

    def library_filters(self, project_id):
        rows = self.store.rows("SELECT params FROM library_filters WHERE project_id=?", (project_id,)) if project_id else []
        filters = rows[0]["params"] if rows else {}
        # A removed tag must not make saved filters unusable forever.
        known = {r["tag"] for r in self.rpc_project_tags_list(project_id)} if project_id else set()
        return {"project_id": project_id, "filters": {**filters, "tags": [t for t in filters.get("tags", []) if t in known]}}

    def rpc_project_tags_list(self, project_id):
        self.require_project(project_id)
        return self.store.rows("SELECT t.tag,COUNT(*) AS count FROM asset_tags t JOIN assets a ON a.id=t.asset_id "
            "WHERE a.project_id=? AND a.id NOT IN (SELECT asset_id FROM asset_trash) GROUP BY t.tag ORDER BY t.tag", (project_id,))

    def rpc_asset_tags_update(self, project_id, asset_ids, add=None, remove=None):
        self.require_project(project_id)
        add, remove = tags_normalized(add or []), tags_normalized(remove or [])
        if set(add) & set(remove):
            raise ValueError("A tag cannot be added and removed in the same request")
        # Validate the entire batch before any write.
        for key in asset_ids:
            if self.store.asset(key)["project_id"] != project_id:
                raise ValueError("Tag selection belongs to another project")
            current = {r["tag"] for r in self.store.rows("SELECT tag FROM asset_tags WHERE asset_id=?", (key,))}
            if len((current - set(remove)) | set(add)) > 32:
                raise ValueError("Use at most 32 tags per audio")
        with self.store.connect() as db:
            for key in asset_ids:
                for tag in remove:
                    db.execute("DELETE FROM asset_tags WHERE asset_id=? AND tag=?", (key, tag))
                for tag in add:
                    db.execute("INSERT OR IGNORE INTO asset_tags VALUES(?,?)", (key, tag))
        return self.with_tags([self.store.asset(key) for key in asset_ids])

    def validate_audio_role(self, asset, role, engine_id):
        region = asset["metadata"].get("region")
        if region and (region["role"] != role or region["engine_id"] != engine_id):
            raise ValueError("Region role or engine differs; confirm a new region for this use")

    def rpc_audio_region_create(self, asset_id, request_key, start_seconds, end_seconds,
                                role, engine_id, name):
        asset = self.verified_source(asset_id)
        if engine_id not in MUSIC or (role == "style" and engine_id != MUSIC[0]):
            raise ValueError("This engine supports source audio only, not style references")
        if not all(math.isfinite(v) for v in (start_seconds, end_seconds)):
            raise ValueError("Region boundaries must be finite")
        with sf.SoundFile(asset["path"]) as source:
            rate, channels, frames = source.samplerate, source.channels, len(source)
            first, last = math.floor(start_seconds * rate + .5), math.floor(end_seconds * rate + .5)
            duration = (last - first) / rate
            minimum = .1 if role == "style" else 10 if engine_id == MUSIC[0] else 5
            if channels not in (1, 2) or not 8000 <= rate <= 192000:
                raise ValueError("Choose mono/stereo audio at 8–192 kHz")
            if not 0 <= first < last <= frames or not minimum <= duration <= 120:
                raise ValueError("Region is outside the source or engine duration limits")
            region = dict(source_id=asset_id, source_sha256=asset["metadata"]["sha256"],
                start_frame=first, end_frame=last, sample_rate=rate, role=role, engine_id=engine_id)
            content_key = signature(region)
            fingerprint = signature(dict(region=region, name=name))
            prior = self.store.rows("SELECT * FROM region_requests WHERE request_key=?", (request_key,))
            if prior:
                if prior[0]["fingerprint"] != fingerprint:
                    raise ValueError("request_key already used with different region parameters")
                return {**self.verified_source(prior[0]["asset_id"]), "already_created": True}
            existing = self.store.rows("SELECT id FROM assets WHERE project_id=? AND json_extract(metadata,'$.region_signature')=?", (asset["project_id"], content_key))
            if existing:
                result = self.verified_source(existing[0]["id"])
                self.store.execute("INSERT INTO region_requests VALUES(?,?,?)", (request_key, fingerprint, result["id"]))
                return {**result, "already_created": True}
            # Crop by streaming; inspection has bounded allocation and must not
            # compete with a heavy job for the last available memory.
            required = .5
            if telemetry()["available_gib"] < required:
                raise ValueError("Not enough available RAM for region verification; try again after processing finishes")
            key = identifier()
            output = self.store.home / "output" / f"{key}.wav"
            created = False
            try:
                with output.open("xb") as file:
                    created = True
                    with sf.SoundFile(file, mode="w", samplerate=rate, channels=channels, format="WAV", subtype="FLOAT") as target:
                        source.seek(first)
                        remaining = last - first
                        while remaining:
                            chunk = source.read(min(65536, remaining), dtype="float32", always_2d=True)
                            if not len(chunk):
                                raise ValueError("Source ended before the selected region")
                            target.write(chunk)
                            remaining -= len(chunk)
                if sha256(Path(asset["path"])) != region["source_sha256"]:
                    raise ValueError("Source changed during region creation")
                metadata = inspect_region(output)
                metadata.update(sha256=sha256(output), region=region, region_signature=content_key)
                if round(metadata["duration"] * rate) != last - first:
                    raise ValueError("Region frame count does not match selection")
                kind = "reference" if role == "style" or asset["kind"] == "reference" else "region"
                with self.store.connect() as db:
                    db.execute("INSERT INTO assets(id,project_id,session_id,path,name,kind,metadata,parent_id,created) VALUES(?,?,?,?,?,?,?,?,?)",
                        (key, asset["project_id"], asset["session_id"], str(output), name, kind, json.dumps(metadata), asset_id, time.time()))
                    db.execute("INSERT INTO region_requests VALUES(?,?,?)", (request_key, fingerprint, key))
                return self.store.asset(key)
            except Exception:
                if created:
                    output.unlink(missing_ok=True)  # Only this newly created file.
                raise


def library_methods(tool, S, ID, B):
    tags = dict(type="array", maxItems=32, items=dict(type="string", minLength=1, maxLength=100))
    filters = dict(type="object", additionalProperties=False, properties=dict(query=dict(type="string", maxLength=500),
        favorite=B, tags=tags, session_id=dict(anyOf=[ID, {"type": "null"}]), kind=dict(type=["string", "null"], enum=[*KINDS, None])))
    return {
        "audio_region_create": tool("Confirm a sample-exact region as a derived WAV, without changing source. Explicit engine and role (style/source); does not generate or load a model. Stable Audio has no style role. Source minimum: Turbo 10s, Stable 5s; maximum 120s. Reuse request_key after uncertainty; identical regions reuse their registered asset.",
            dict(asset_id=ID, request_key=S, start_seconds=dict(type="number", minimum=0), end_seconds=dict(type="number", exclusiveMinimum=0),
                 role=dict(type="string", enum=["style", "source"]), engine_id=dict(type="string", enum=MUSIC),
                 name=dict(type="string", minLength=1, maxLength=120)), ["asset_id", "request_key", "start_seconds", "end_seconds", "role", "engine_id", "name"]),
        "project_tags_list": tool("List only this project's active asset tags and counts.", dict(project_id=ID), ["project_id"]),
        "asset_tags_update": tool("Atomically add/remove organizational tags on explicitly selected assets in one project. No audio or immutable generation parameters are changed. NFKC, whitespace folding and casefold deduplicate tags; 1–48 characters, maximum 32 tags/audio.",
            dict(project_id=ID, asset_ids=dict(type="array", items=ID, minItems=1, maxItems=200, uniqueItems=True), add=tags, remove=tags), ["project_id", "asset_ids"]),
        "library_filters_save": tool("Persist combined library filters only for the specified project. Tags combine with AND, then text/favorite/session/kind filters. No files moved or generated.", dict(project_id=ID, filters=filters), ["project_id", "filters"]),
    }, filters["properties"]
