import json
import sqlite3

import numpy as np
import pytest
import soundfile as sf

from sonariel.service import Service
from sonariel.store import Store


@pytest.fixture
def setup(tmp_path):
    service = Service(Store(tmp_path / "profile"), start_worker=False)
    project = service.invoke("project_create", {"name": "Music configuration study"})["project_id"]
    settings = dict(prompt="Original synth study", seed=0, duration=10, bpm=72, key_scale="D minor", time_signature="4")
    # Contract stub: a queued request is not an inference integration test.
    job = service.invoke("generate", dict(project_id=project, request_key="contract-source", **settings))
    audio = tmp_path / "synthetic.wav"
    sf.write(audio, .1 * np.sin(np.arange(8000) * .04), 8000, subtype="FLOAT")
    asset = service.invoke("result_import", dict(project_id=project, path=str(audio), name="Synthetic contract fixture",
        parameters=service.store.job(job["job_id"])["params"]))
    return service, project, asset, settings


def test_capture_preserves_model_seed_and_settings_without_generating(setup):
    service, project, asset, settings = setup
    count = len(service.invoke("queue_list"))
    preset = service.invoke("music_preset_save", dict(project_id=project, name="Original configuration", description="Quiet", asset_id=asset["id"]))
    assert preset["engine_id"] == "acestep-v15-turbo"
    assert preset["params"]["seed"] == 0
    assert preset["params"]["key_scale"] == settings["key_scale"]
    assert "src_audio_path" not in preset["params"]
    assert len(service.invoke("queue_list")) == count
    assert service.invoke("music_presets_list", {"project_id": project})[0]["id"] == preset["id"]
    assert Service(Store(service.store.home), start_worker=False).invoke("music_presets_list")[0]["params"] == preset["params"]


def test_revisions_duplicates_and_favorites_do_not_rewrite_prior_settings(setup):
    service, project, asset, _ = setup
    preset = service.invoke("music_preset_save", dict(project_id=project, name="First", asset_id=asset["id"]))
    revision = service.invoke("music_preset_save", dict(project_id=project, name="Second", base_id=preset["id"], parameters={**preset["params"], "seed": 41}))
    duplicate = service.invoke("music_preset_save", dict(project_id=project, name="Independent copy", base_id=revision["id"], duplicate=True))
    assert revision["revision"] == 2 and revision["family_id"] == preset["id"]
    assert duplicate["revision"] == 1 and duplicate["family_id"] == duplicate["id"]
    assert duplicate["parent_id"] == revision["id"]
    service.invoke("music_preset_favorite", {"preset_id": preset["id"], "favorite": True})
    first = service._music_preset(preset["id"])
    assert first["favorite"] and first["params"]["seed"] == 0
    assert first["name"] == "First" and first["params"] == preset["params"]


def test_review_and_confirmed_generation_are_distinct_and_idempotent(setup):
    service, project, asset, _ = setup
    preset = service.invoke("music_preset_save", dict(project_id=project, name="Preset", asset_id=asset["id"]))
    before = len(service.invoke("queue_list"))
    service.invoke("music_preset_prepare", {"preset_id": preset["id"], "project_id": project})
    assert len(service.invoke("queue_list")) == before
    review = service.invoke("music_preset_prepare", {"preset_id": preset["id"], "project_id": project, "intent": "repeat"})
    args = dict(preset_id=preset["id"], project_id=project, request_key="repeat-1", intent="repeat", review_token=review["review_token"], confirmed=True)
    with pytest.raises(ValueError): service.invoke("music_preset_generate", {**args, "confirmed": False})
    with pytest.raises(ValueError): service.invoke("music_preset_generate", {**args, "review_token": "0" * 64})
    job = service.invoke("music_preset_generate", args)
    assert service.invoke("music_preset_generate", args)["already_submitted"]
    assert len(service.invoke("queue_list")) == before + 1
    stored = service.store.job(job["job_id"])
    assert stored["params"]["thinking"] is False and stored["params"]["batch_size"] == 1
    assert service.store.rows("SELECT * FROM music_preset_uses WHERE job_id=?", (job["job_id"],))[0]["preset_id"] == preset["id"]
    with pytest.raises(ValueError):
        service.invoke("music_preset_prepare", {"preset_id": preset["id"], "project_id": project, "intent": "variation"})
    varied = service.invoke("music_preset_prepare", {"preset_id": preset["id"], "project_id": project, "intent": "variation", "overrides": {"seed": 42}})
    assert varied["parameters"]["seed"] == 42
    with pytest.raises(ValueError):
        service.invoke("music_preset_generate", {**args, "intent": "variation", "overrides": {"seed": 42}, "review_token": varied["review_token"]})


def test_presets_validate_capabilities_without_cross_engine_coercion(setup):
    service, project, asset, _ = setup
    params = dict(prompt="Synth study", seed=1, duration=10, steps=8, mode="text2audio")
    stable = service.invoke("music_preset_save", dict(project_id=project, name="Stable", engine_id="stable-audio-3-medium", parameters=params))
    assert "bpm" not in stable["params"]
    with pytest.raises(Exception):
        service.invoke("music_preset_prepare", dict(preset_id=stable["id"], project_id=project, overrides={"bpm": 72}))
    with pytest.raises(ValueError):
        service.invoke("music_preset_save", dict(project_id=project, name="Wrong engine", base_id=stable["id"], engine_id="acestep-v15-turbo", parameters=params))
    with pytest.raises(Exception):
        service.invoke("music_preset_save", dict(project_id=project, name="Not a music engine", engine_id="native-fx", parameters=params))


def test_schema4_migration_backs_up_schema3_and_preserves_existing_records(tmp_path):
    store = Store(tmp_path / "profile")
    store.set("preferences", {"idle_minutes": 19})
    store.execute("INSERT INTO projects VALUES('keep','Existing project','Private context',1)")
    store.execute("DROP TABLE music_preset_uses")
    store.execute("DROP TABLE music_presets")
    store.execute("PRAGMA user_version=3")
    migrated = Store(store.home)
    assert migrated.setting("preferences")["idle_minutes"] == 19
    assert migrated.rows("SELECT * FROM projects")[0]["context"] == "Private context"
    with migrated.connect() as db: assert db.execute("PRAGMA user_version").fetchone()[0] == 4
    backups = list((store.home / "backups").glob("pre-schema4-*.sqlite3"))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as db:
        assert db.execute("PRAGMA user_version").fetchone()[0] == 3
        assert db.execute("SELECT name FROM projects").fetchone()[0] == "Existing project"


def test_conditioning_stays_protected_and_foreign_project_reuse_requires_replacement(setup):
    service, project, asset, _ = setup
    params = dict(prompt="Original source variation", seed=3, duration=1,
                  bpm=72, key_scale="D minor", time_signature="4", mode="cover", source_id=asset["id"])
    # The tiny fixture is below the music contract duration minimum; prepare a
    # ten-second synthetic source, without performing any model inference.
    source = service.store.home / "conditioning.wav"
    sf.write(source, .1 * np.sin(np.arange(80000) * .04), 8000, subtype="FLOAT")
    conditioning = service.invoke("result_import", dict(project_id=project, path=str(source), name="Conditioning"))
    params.update(duration=10, source_id=conditioning["id"])
    preset = service.invoke("music_preset_save", dict(project_id=project, name="Source guided", engine_id="acestep-v15-turbo", parameters=params))
    preview = service.invoke("storage_preview", {"asset_ids": [conditioning["id"]]})
    assert any("music preset" in str(entry.get("blocked", "")) for entry in preview["entries"])
    foreign = service.invoke("project_create", {"name": "Other project"})["project_id"]
    with pytest.raises(ValueError, match="another project"):
        service.invoke("music_preset_prepare", dict(preset_id=preset["id"], project_id=foreign))
    replacement = service.invoke("result_import", dict(project_id=foreign, path=str(source), name="Explicit replacement"))
    reviewed = service.invoke("music_preset_prepare", dict(preset_id=preset["id"], project_id=foreign,
        overrides={"source_id": replacement["id"]}))
    assert reviewed["parameters"]["mode"] == "cover"
    assert reviewed["parameters"]["source_id"] == replacement["id"]
    source.write_bytes(b"Changed original")
    with pytest.raises(ValueError):
        service.invoke("music_preset_prepare", dict(preset_id=preset["id"], project_id=project))
