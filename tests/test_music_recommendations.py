import pytest
from sonariel.service import Service
from sonariel.store import Store


@pytest.fixture
def service(tmp_path):
    return Service(Store(tmp_path), start_worker=False)


def test_public_recipe_is_available_without_models_and_never_inherits_compact_modes(service):
    recipe = service.invoke("music_recommendations_list", {})[0]
    assert recipe["parameters"] == dict(quality_profile="fidelity", mode="text2audio", steps=8, batch_size=1)
    assert not recipe["available"] and recipe["available_modes"] == []
    assert recipe["supported_modes"] == ["text2audio"]
    assert recipe["optional_download_bytes"] == 7596935760
    assert recipe["minimum_available_gib"] == 12
    assert len(recipe["checkpoints"]) == 3 and all(len(f["sha256"]) == 64 for f in recipe["checkpoints"])
    assert sum(f["bytes"] for f in recipe["checkpoints"] if 't5gemma' not in f['path']) == recipe['optional_download_bytes']
    service.store.set("stable_environment", dict(accepted_licenses=True, families=["medium"], audio_input_ready=True))
    assert not service.invoke("music_recommendations_list", {})[0]["available"]
    service.store.set("stable_environment", dict(accepted_licenses=True, families=["medium"], quality_profiles=["compact", "fidelity"], audio_input_ready=True))
    recipe = service.invoke("music_recommendations_list", {})[0]
    assert recipe["available"] and recipe["available_modes"] == ["text2audio"]
    assert service.rpc_queue_list() == []


def saved(service):
    project = service.rpc_project_create("Generic composition")["project_id"]
    args = dict(recommendation_id="medium-fp32-same-l-v1", project_id=project, name="Original texture",
        prompt="An original restrained synthesizer texture.", seed=7, duration=30)
    return args, service.invoke("music_recommendation_save", args)


def test_save_and_revision_preserve_origin_without_setup_or_generation(service):
    args, preset = saved(service)
    assert preset["params"]["steps"] == 8 and preset["params"]["quality_profile"] == "fidelity"
    origin = preset["origin_recommendation"]
    assert origin["id"] == args["recommendation_id"] and origin["revision"] == 1
    assert service.store.setting("stable_environment") is None
    assert service.rpc_queue_list() == []
    duplicate = service.invoke("music_preset_save", dict(project_id=args["project_id"], base_id=preset["id"], name="Edited copy",
        parameters={**preset["params"], "steps": 16}, duplicate=True))
    assert duplicate["origin_recommendation"] == origin
    assert duplicate["params"]["steps"] == 16
    assert service._music_preset(preset["id"])["params"]["steps"] == 8
    restarted = Service(Store(service.store.home), start_worker=False)
    assert restarted.invoke("music_presets_list", {"project_id": args["project_id"]})[0]["origin_recommendation"] == origin


def test_recommended_preset_uses_existing_confirmation_gate_and_job_lineage(service):
    args, preset = saved(service)
    review = service.invoke("music_preset_prepare", dict(preset_id=preset["id"], project_id=args["project_id"]))
    assert review["origin_recommendation"] == preset["origin_recommendation"]
    generation = dict(preset_id=preset["id"], project_id=args["project_id"], request_key="contract-only",
        review_token=review["review_token"], intent="repeat", confirmed=False)
    # Intent is bound into the token; review exact repeat before confirmation.
    repeat = service.invoke("music_preset_prepare", dict(preset_id=preset["id"], project_id=args["project_id"], intent="repeat"))
    generation["review_token"] = repeat["review_token"]
    with pytest.raises(ValueError, match="confirm"):
        service.invoke("music_preset_generate", generation)
    with pytest.raises(ValueError):
        service.invoke("music_preset_generate", dict(generation, confirmed=True))
    assert service.rpc_queue_list() == []
    service.store.set("stable_environment", dict(accepted_licenses=True, families=["medium"], quality_profiles=["fidelity"]))
    job = service.invoke("music_preset_generate", dict(generation, confirmed=True))
    assert service.invoke("music_preset_generate", dict(generation, confirmed=True))["job_id"] == job["job_id"]
    assert service.music_preset_metadata(job["job_id"])["origin_recommendation"] == preset["origin_recommendation"]
    assert len(service.rpc_queue_list()) == 1  # Worker disabled: a contract test, not inference.
    with pytest.raises(ValueError, match="Source-guided"):
        service.invoke("music_preset_prepare", dict(preset_id=preset["id"], project_id=args["project_id"], overrides={"mode": "audio2audio"}))


@pytest.mark.parametrize("change", [{"duration": 61}, {"seed": -1}, {"prompt": ""}, {"recommendation_id": "unknown"}])
def test_invalid_start_never_creates_a_preset(service, change):
    project = service.rpc_project_create("Validation")["project_id"]
    with pytest.raises(Exception):
        service.invoke("music_recommendation_save", dict(recommendation_id="medium-fp32-same-l-v1", project_id=project,
            name="Test", prompt="Original texture", seed=0, duration=30, **{}) | change)
    assert service.invoke("music_presets_list", {}) == []
    assert service.rpc_queue_list() == []
