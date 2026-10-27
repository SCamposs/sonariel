import json
import sqlite3
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
    project = service.invoke("project_create", {"name": "Region study"})["project_id"]
    source = tmp_path / "source.wav"
    sf.write(source, .1 * np.sin(np.arange(16000 * 15) * .04), 16000, subtype="PCM_24")
    asset = service.invoke("result_import", dict(project_id=project, path=str(source), name="Original"))
    return service, project, source, asset


def crop(service, asset, **overrides):
    return service.invoke("audio_region_create", dict(asset_id=asset["id"], request_key="region-1",
        start_seconds=1.125, end_seconds=12.125, name="Source region", role="source", engine_id="acestep-v15-turbo", **overrides))


def test_region_is_sample_exact_deduplicated_exportable_and_source_is_preserved(setup):
    service, project, source, asset = setup
    before = sha256(source)
    result = crop(service, asset)
    original, sr = sf.read(source, dtype="float32", always_2d=True)
    trimmed, rate = sf.read(result["path"], dtype="float32", always_2d=True)
    assert sr == rate and np.array_equal(trimmed, original[18000:194000])
    assert result["parent_id"] == asset["id"] and result["metadata"]["duration"] == 11
    assert result["metadata"]["region"]["role"] == "source"
    assert crop(service, asset)["id"] == result["id"]
    other = service.invoke("audio_region_create", dict(asset_id=asset["id"], request_key="second-key",
        start_seconds=1.125, end_seconds=12.125, name="Another name", role="source", engine_id="acestep-v15-turbo"))
    assert other["id"] == result["id"] and other["already_created"]
    assert len(service.invoke("results_list", {"project_id": project})) == 2
    destination = source.parent / "export"
    destination.mkdir()
    exported = service.invoke("result_export_batch", dict(asset_ids=[result["id"]], directory=str(destination), manifest=True))
    assert exported["files"][0]["lineage"]["region"]["start_frame"] == 18000
    assert sha256(destination / exported["files"][0]["file"]) == sha256(Path(result["path"]))
    assert sha256(source) == before
    assert service.invoke("storage_preview", {"asset_ids": [asset["id"]]})["entries"][0]["blocked"]


@pytest.mark.parametrize("start,end", [(0, 0), (-1, 12), (12, 11), (0, 20), (0, 5), (float("nan"), 12)])
def test_invalid_region_rejected_without_output(setup, start, end):
    service, _, _, asset = setup
    with pytest.raises(Exception):
        service.invoke("audio_region_create", dict(asset_id=asset["id"], request_key="bad", start_seconds=start,
            end_seconds=end, name="Invalid", role="source", engine_id="acestep-v15-turbo"))
    assert not list((service.store.home / "output").glob("*.wav"))


def test_role_engine_and_effective_duration_are_enforced_without_inference(setup):
    service, project, source, asset = setup
    result = crop(service, asset)
    args = dict(project_id=project, prompt="Synthetic contract", seed=2, duration=11, bpm=72, key_scale="D minor", time_signature="4")
    with pytest.raises(ValueError, match="role or engine"):
        service.invoke("generate", dict(**args, request_key="wrong-style", reference_id=result["id"]))
    with pytest.raises(ValueError, match="duração"):
        service.invoke("generate", dict(**{**args, "duration": 12}, request_key="wrong-duration", source_id=result["id"], mode="cover"))
    job = service.invoke("generate", dict(**args, request_key="valid-contract", source_id=result["id"], mode="cover"))
    assert service.store.job(job["job_id"])["params"]["src_audio_path"] == result["path"]
    with pytest.raises(ValueError):
        service.invoke("audio_region_create", dict(asset_id=asset["id"], request_key="bad-style", start_seconds=0,
            end_seconds=6, name="Invalid style", role="style", engine_id="stable-audio-3-medium"))
    with pytest.raises(ValueError, match="different region"):
        service.invoke("audio_region_create", dict(asset_id=asset["id"], request_key="region-1", start_seconds=0,
            end_seconds=11, name="Changed", role="source", engine_id="acestep-v15-turbo"))


def test_style_region_is_protected_and_visible_through_references_contract(setup):
    service, project, _, asset = setup
    reference = service.invoke("audio_region_create", dict(asset_id=asset["id"], request_key="style", start_seconds=0,
        end_seconds=3, name="Style excerpt", role="style", engine_id="acestep-v15-turbo"))
    assert reference["kind"] == "reference"
    assert service.invoke("references_list", {"project_id": project})[0]["id"] == reference["id"]
    assert service.invoke("snapshot")["references"][0]["id"] == reference["id"]
    assert service.invoke("storage_preview", {"asset_ids": [reference["id"]]})["entries"][0]["blocked"]


def test_tags_normalize_without_audio_changes_and_bulk_is_atomic_across_projects(setup):
    service, project, source, asset = setup
    before = sha256(source)
    args = dict(project_id=project, asset_ids=[asset["id"]])
    tagged = service.invoke("asset_tags_update", dict(**args, add=["  AMBIENT  ", "ambient", "Ｆｉｅｌｄ", "  Warm   Strings "]))
    assert tagged[0]["tags"] == ["ambient", "field", "warm strings"]
    service.invoke("asset_tags_update", dict(**args, remove=["FIELD"]))
    assert service.invoke("project_tags_list", {"project_id": project}) == [{"tag": "ambient", "count": 1}, {"tag": "warm strings", "count": 1}]
    foreign = service.invoke("project_create", {"name": "Foreign"})["project_id"]
    other = service.invoke("result_import", dict(project_id=foreign, path=str(source), name="Other"))
    with pytest.raises(ValueError):
        service.invoke("asset_tags_update", dict(project_id=project, asset_ids=[asset["id"], other["id"]], add=["unsafe"]))
    assert "unsafe" not in str(service.invoke("project_tags_list", {"project_id": project}))
    assert not service.invoke("project_tags_list", {"project_id": foreign})
    assert sha256(source) == before and service.store.asset(asset["id"])["metadata"] == asset["metadata"]
    for invalid in ([" "], ["x" * 49], ["a\x00b"]):
        with pytest.raises(ValueError): service.invoke("asset_tags_update", dict(**args, add=invalid))
    service.invoke("asset_tags_update", dict(**args, add=["Private project annotation"]))
    destination = source.parent / "tag-export"
    destination.mkdir()
    result = service.invoke("result_export_batch", dict(asset_ids=[asset["id"]], directory=str(destination), manifest=True))
    manifest = (destination / result["manifest"]).read_text(encoding="utf-8")
    assert "private project annotation" not in manifest and '"tags"' not in manifest


def test_filters_combine_and_persist_per_project_and_do_not_change_selection(setup):
    service, project, source, asset = setup
    session = service.invoke("session_create", {"project_id": project, "name": "Session"})["session_id"]
    service.store.execute("UPDATE assets SET session_id=?,favorite=1,selected=1 WHERE id=?", (session, asset["id"]))
    service.invoke("asset_tags_update", dict(project_id=project, asset_ids=[asset["id"]], add=["warm", "quiet"]))
    filters = dict(query="original", favorite=True, tags=["quiet", "warm"], session_id=session, kind="imported")
    service.invoke("library_filters_save", dict(project_id=project, filters=filters))
    assert [a["id"] for a in service.invoke("results_list", dict(project_id=project, **filters))] == [asset["id"]]
    assert not service.invoke("results_list", dict(project_id=project, **{**filters, "query": "missing"}))
    assert Service(Store(service.store.home), start_worker=False).invoke("snapshot")["library_filters"]["filters"] == filters
    foreign = service.invoke("project_create", {"name": "Other"})["project_id"]
    with pytest.raises(ValueError): service.invoke("library_filters_save", dict(project_id=foreign, filters=filters))
    assert service.invoke("snapshot")["library_filters"]["filters"] == {"tags": []}
    assert service.store.asset(asset["id"])["selected"] == 1


def test_schema5_backup_preserves_schema4_preferences_and_presets(setup):
    service, project, _, asset = setup
    service.store.set("ui_preferences", {"locale": "en", "existing_installation": True})
    service.store.execute("PRAGMA user_version=4")
    migrated = Store(service.store.home)
    assert migrated.setting("ui_preferences")["locale"] == "en"
    assert migrated.asset(asset["id"])["metadata"] == asset["metadata"]
    backups = list((migrated.home / "backups").glob("pre-schema5-*.sqlite3"))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 4
        assert db.execute("SELECT name FROM projects").fetchone()[0] == "Region study"


def test_import_session_and_derived_session_stay_in_their_project(setup):
    service, project, source, _ = setup
    session = service.invoke("session_create", dict(project_id=project, name="Imported session"))["session_id"]
    asset = service.invoke("result_import", dict(project_id=project, session_id=session, path=str(source), name="Session source"))
    region = crop(service, asset)
    assert asset["session_id"] == region["session_id"] == session
    other = service.invoke("project_create", {"name": "Other"})["project_id"]
    with pytest.raises(ValueError):
        service.invoke("reference_register", dict(project_id=other, session_id=session, path=str(source), name="Wrong session"))


@pytest.mark.parametrize("format_,subtype", [("FLAC", "PCM_24"), ("WAV", "FLOAT")])
def test_supported_decoding_preserves_stereo_frames_and_rate(setup, format_, subtype):
    service, project, source, _ = setup
    path = source.with_suffix("." + format_.lower())
    signal = .2 * np.sin(np.arange(48000 * 13) * .017)
    sf.write(path, np.stack([signal, signal * .6], axis=1), 48000, format=format_, subtype=subtype)
    asset = service.invoke("result_import", dict(project_id=project, path=str(path), name="Stereo"))
    result = crop(service, asset)
    original, _ = sf.read(path, dtype="float32", always_2d=True)
    actual, rate = sf.read(result["path"], dtype="float32", always_2d=True)
    assert rate == 48000 and actual.shape == (528000, 2)
    assert np.array_equal(actual, original[54000:582000])
