import json
import subprocess

import numpy as np
import pytest
import soundfile as sf

from sonariel.environment import sha256
from sonariel.local_engine import fx_binary, prepare_fx
from sonariel.service import Service
from sonariel.store import Store


@pytest.fixture(autouse=True)
def authorized_development_loops(monkeypatch):
    monkeypatch.setenv('SONARIEL_DEVELOPMENT_LOOPS', '1')


def source(service, tmp_path):
    project = service.invoke("project_create", {"name": "Loop contract"})["project_id"]
    path = tmp_path / "tone.wav"
    samples = np.sin(np.arange(24000) * .025) * .5
    sf.write(path, samples, 24000, subtype="FLOAT")
    return service.invoke("result_import", {"project_id": project, "path": str(path), "name": "Original"})


def test_loop_contract_validates_region_preserves_source_and_is_idempotent(tmp_path):
    service = Service(Store(tmp_path / "profile"), start_worker=False)
    asset = source(service, tmp_path)
    before = sha256(tmp_path / "tone.wav")
    args = dict(asset_id=asset["id"], request_key="loop-1", start_seconds=.1,
                end_seconds=.9, crossfade_ms=50, preview=True, repetitions=3)
    result = service.invoke("fx_loop_render", args)
    assert service.invoke("fx_loop_render", args)["already_submitted"]
    job = service.store.job(result["job_id"])
    assert job["params"]["_parent_id"] == asset["id"]
    assert job["params"]["recipe"]["repetitions"] == 3
    folder = tmp_path / "prepare"
    folder.mkdir()
    command = prepare_fx(service.store, folder, job["params"], tmp_path / "out.wav")
    assert command[1] == asset["path"]  # Never truncate before applying region offsets.
    assert not (folder / "preview-source.wav").exists()
    for override in [dict(end_seconds=1.1), dict(crossfade_ms=401), dict(end_seconds=.11),
                     dict(start_seconds=-1), dict(repetitions=5), dict(crossfade_ms=-1)]:
        with pytest.raises(Exception):
            service.invoke("fx_loop_render", {**args, **override, "request_key": "invalid"})
    final = service.invoke("fx_loop_render", {**args, "request_key": "loop-final", "preview": False})
    assert service.store.job(final["job_id"])["params"]["recipe"]["repetitions"] == 1
    assert sha256(tmp_path / "tone.wav") == before
    assert len(service.invoke("results_list")) == 1


def test_explicit_beat_grid_compensates_overlap_and_rejects_stale_alignment(tmp_path):
    service = Service(Store(tmp_path / "profile"), start_worker=False)
    project = service.invoke("project_create", {"name": "Beat grid contract"})["project_id"]
    path = tmp_path / "rhythmic.wav"
    rate = 24000
    t = np.arange(rate * 12) / rate
    # A controlled periodic musical timing fixture, not human listening approval.
    signal = .2 * np.sin(2 * np.pi * 220 * t) * np.exp(-6 * (t % .5))
    sf.write(path, signal, rate, subtype="FLOAT")
    asset = service.invoke("result_import", dict(project_id=project, path=str(path), name="Rhythm timing"))
    grid = dict(anchor_seconds=2, bpm=120, beats_per_bar=4, bars=2)
    args = dict(asset_id=asset["id"], request_key="grid-loop", start_seconds=1.8, end_seconds=6,
                crossfade_ms=200, beat_grid=grid)
    job = service.invoke("fx_loop_render", args)
    params = service.store.job(job["job_id"])["params"]
    assert params["beat_grid"] == grid
    assert params["recipe"]["end_seconds"] - params["recipe"]["start_seconds"] - .2 == 4
    with pytest.raises(ValueError, match="Beat grid"):
        service.invoke("fx_loop_render", {**args, "request_key": "stale-grid", "crossfade_ms": 100})
    if fx_binary().is_file():
        recipe = tmp_path / "grid-recipe.json"
        output = tmp_path / "grid-loop.wav"
        recipe.write_text(json.dumps(params["recipe"]))
        subprocess.run([str(fx_binary()), str(path), str(output), str(recipe)], check=True, capture_output=True)
        audio, actual_rate = sf.read(output, dtype="float32", always_2d=True)
        assert actual_rate == rate and len(audio) == 4 * rate
        original, _ = sf.read(path, dtype="float32")
        assert audio[0, 0] == original[2 * rate]  # Export begins at the chosen audible anchor.


@pytest.mark.skipif(not fx_binary().is_file(), reason="Build native/fx before native loop acceptance")
def test_real_native_loop_has_expected_period_seam_preview_and_source_hash(tmp_path):
    service = Service(Store(tmp_path / "profile"), start_worker=False)
    asset = source(service, tmp_path)
    original = sha256(tmp_path / "tone.wav")
    def render(repetitions):
        recipe = dict(operation="loop", schema_version=1, name="Loop test", start_seconds=.1,
                      end_seconds=.9, crossfade_ms=50, repetitions=repetitions)
        preset = tmp_path / f"recipe-{repetitions}.json"
        preset.write_text(json.dumps(recipe))
        output = tmp_path / f"loop-{repetitions}.wav"
        result = subprocess.run([str(fx_binary()), asset["path"], str(output), str(preset)], capture_output=True, text=True)
        assert result.returncode == 0, result.stderr
        audio, sr = sf.read(output, always_2d=True)
        receipt = json.loads(output.with_suffix(".json").read_text())
        assert sr == 24000 and np.isfinite(audio).all() and np.max(np.abs(audio)) < 1
        assert sha256(tmp_path / "tone.wav") == original
        assert receipt["source_sha256"] == original
        assert receipt["loop_frames"] == 18000
        return audio, receipt
    cycle, receipt = render(1)
    preview, _ = render(3)
    assert cycle.shape == (18000, 2)
    np.testing.assert_array_equal(preview, np.tile(cycle, (3, 1)))
    assert np.max(np.abs(cycle[-1] - cycle[0])) < .013
    assert receipt["loop_duration_seconds"] == .75
    refused = subprocess.run([str(fx_binary()), asset["path"], str(tmp_path / "loop-1.wav"), str(tmp_path / "recipe-1.json")], capture_output=True)
    assert refused.returncode != 0
