import json
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from sonariel.environment import sha256
from sonariel.service import Service
from sonariel.store import Store


@pytest.fixture
def setup(tmp_path):
    service = Service(Store(tmp_path / "profile"), start_worker=False)
    project = service.invoke("project_create", {"name": "Export study"})["project_id"]
    source = tmp_path / "original.wav"
    sf.write(source, .1 * np.sin(np.arange(8000) * .04), 8000, subtype="FLOAT")
    params = {"model": "acestep-v15-turbo", "seed": 0, "bpm": 72, "key_scale": "D minor",
              "prompt": "Private original prompt", "src_audio_path": "C:/private/source.wav",
              "token": "private-token", "environment": {"secret": "private"},
              "recipe": {"operation": "loop", "name": "C:/private/preset", "crossfade_ms": 50}}
    asset = service.invoke("result_import", {"project_id": project, "path": str(source), "name": "CON", "parameters": params})
    other = service.invoke("result_import", {"project_id": project, "path": str(source), "name": "Second"})
    destination = tmp_path / "exports"
    destination.mkdir()
    return service, source, asset, other, destination


def test_batch_exports_valid_wavs_and_redacts_manifest_without_changing_sources(setup):
    service, source, asset, other, destination = setup
    before = sha256(source)
    result = service.invoke("result_export_batch", dict(asset_ids=[asset["id"], other["id"]],
        directory=str(destination), naming="{name}_{seed}", manifest=True))
    assert [entry["status"] for entry in result["files"]] == ["exported", "exported"]
    assert all(sha256(destination / item["file"]) == before for item in result["files"])
    manifest = json.loads((destination / result["manifest"]).read_text(encoding="utf-8"))
    encoded = json.dumps(manifest)
    assert "private" not in encoded.lower() and str(source) not in encoded
    assert "prompt" not in manifest["files"][0]["parameters"]
    assert manifest["files"][0]["seed"] == 0
    assert manifest["files"][1]["model"] is None
    assert manifest["files"][1]["seed"] is None
    assert manifest["files"][0]["parameters"]["recipe"] == {"operation": "loop", "crossfade_ms": 50}
    assert sha256(source) == before


def test_name_collisions_never_overwrite_and_selection_failures_are_per_file(setup):
    service, source, asset, other, destination = setup
    occupied = destination / "fixed.wav"
    occupied.write_bytes(b"Preserve this existing file")
    args = dict(asset_ids=[asset["id"], other["id"]], directory=str(destination), naming="fixed")
    skipped = service.invoke("result_export_batch", {**args, "collisions": "skip"})
    assert all(item["status"] == "skipped" for item in skipped["files"])
    renamed = service.invoke("result_export_batch", args)
    assert [item["file"] for item in renamed["files"]] == ["fixed_2.wav", "fixed_3.wav"]
    assert occupied.read_bytes() == b"Preserve this existing file"
    partial = service.invoke("result_export_batch", {**args, "asset_ids": ["f" * 32, asset["id"]]})
    assert [item["status"] for item in partial["files"]] == ["failed", "exported"]


def test_reference_and_prompt_export_require_separate_explicit_authorization(setup):
    service, source, asset, other, destination = setup
    reference = service.invoke("reference_register", {"project_id": asset["project_id"], "path": str(source), "name": "Reference"})
    args = dict(asset_ids=[reference["id"], asset["id"]], directory=str(destination), manifest=True)
    result = service.invoke("result_export_batch", args)
    assert result["files"][0]["error_code"] == "reference_requires_authorization"
    assert result["files"][1]["status"] == "exported"
    allowed = service.invoke("result_export_batch", {**args, "include_references": True, "include_prompts": True})
    assert all(item["status"] == "exported" for item in allowed["files"])
    manifest = json.loads((destination / allowed["manifest"]).read_text(encoding="utf-8"))
    assert manifest["files"][1]["parameters"]["prompt"] == "Private original prompt"
    assert "src_audio_path" not in json.dumps(manifest)


@pytest.mark.parametrize("pattern", ["../{name}", "{name.__class__}", "{unknown}", "{name!r}", "{", "{name:30}"])
def test_naming_cannot_escape_destination_or_inspect_objects(setup, pattern):
    service, _, asset, _, destination = setup
    with pytest.raises(ValueError):
        service.invoke("result_export_batch", {"asset_ids": [asset["id"]], "directory": str(destination), "naming": pattern})
    assert not list(destination.iterdir())


def test_changed_source_is_reported_without_export(setup):
    service, source, asset, _, destination = setup
    source.write_bytes(b"Changed after registration")
    result = service.invoke("result_export_batch", {"asset_ids": [asset["id"]], "directory": str(destination)})
    assert result["files"][0]["error_code"] == "source_unavailable_or_changed"
    assert not list(destination.iterdir())


def test_available_receipt_revision_is_portable_without_copying_runtime_context(setup):
    service, _, asset, _, destination = setup
    metadata = dict(asset["metadata"], render_receipt={"model_revision": "a" * 40,
        "checkpoint_revision": "C:/private/checkpoint", "checkpoints": [{"path": "C:/private/model"}],
        "runtime_versions": {"private": "ignored"}})
    service.store.execute("UPDATE assets SET metadata=? WHERE id=?", (json.dumps(metadata), asset["id"]))
    result = service.invoke("result_export_batch", dict(asset_ids=[asset["id"]], directory=str(destination), manifest=True))
    exported = result["files"][0]
    assert exported["parameters"]["model_revision"] == "a" * 40
    assert "checkpoint_revision" not in exported["parameters"]
    encoded = (destination / result["manifest"]).read_text(encoding="utf-8")
    assert "private" not in encoded and "checkpoints" not in encoded
