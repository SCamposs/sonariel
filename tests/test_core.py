import io
import json
import zipfile
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from sonariel.engine import inspect_wav
from sonariel.environment import sha256
from sonariel.service import METHODS, Service, local_audio
from sonariel.setup import Setup, completion_stage, download, extract
from sonariel.store import Store


@pytest.fixture
def service(tmp_path):
    return Service(Store(tmp_path / "data"), start_worker=False)


@pytest.fixture
def project(service):
    return service.invoke("project_create", {"name": "Local sound study", "context": "Curiosity"})["project_id"]


@pytest.fixture
def audio(tmp_path):
    path = tmp_path / "source.wav"
    samples = .1 * np.sin(2 * np.pi * 220 * np.arange(48000) / 48000)
    sf.write(path, np.column_stack([samples, samples]), 48000)
    return path


def params(project, **extra):
    return {"project_id": project, "request_key": "request-1", "prompt": "Quiet original electronic instrumental", "seed": 41, "duration": 10, "bpm": 70, "key_scale": "D minor", "time_signature": "4", **extra}


def test_no_torch_imported():
    import sys
    assert "torch" not in sys.modules


def test_context_and_sessions_persist(service, project):
    session = service.invoke("session_create", {"project_id": project, "name": "First listening"})
    other = Service(Store(service.store.home), start_worker=False)
    snapshot = other.invoke("snapshot")
    assert snapshot["projects"][0]["context"] == "Curiosity"
    assert snapshot["sessions"][0]["id"] == session["session_id"]


def test_idempotent_generation(service, project):
    first = service.invoke("generate", params(project))
    second = service.invoke("generate", params(project))
    assert first["job_id"] == second["job_id"]
    assert len(service.invoke("queue_list")) == 1
    assert service.store.job(first["job_id"])["params"]["thinking"] is False


def test_idempotent_key_cannot_hide_changed_request(service, project):
    service.invoke("generate", params(project))
    with pytest.raises(ValueError, match="parâmetros diferentes"):
        service.invoke("generate", params(project, seed=42))
    assert len(service.invoke("queue_list")) == 1


def test_uncertain_remote_blocks_engine_stop(service, project):
    job = service.invoke("generate", params(project))
    service.store.execute("UPDATE jobs SET state='interrupted',remote_id='remote' WHERE id=?", (job["job_id"],))
    with pytest.raises(ValueError, match="Inferência ativa"):
        service.invoke("engine_stop")


def test_codex_registration_preserves_config_and_is_repeatable(service, tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    monkeypatch.setenv("CODEX_HOME", str(tmp_path / ".codex"))
    root = tmp_path / ".codex"
    root.mkdir()
    original = '[mcp_servers.existing]\ncommand = "existing-server"\n'
    config = root / "config.toml"
    config.write_text(original)
    assert service.invoke("codex_register")["skill_installed"]
    assert config.read_text().startswith(original)
    backups = list((service.store.home / "backups").glob("codex-config-*.toml"))
    assert len(backups) == 1 and backups[0].read_text() == original
    service.invoke("codex_register")
    assert config.read_text().count("[mcp_servers.sonariel]") == 1


def test_codex_skill_conflict_does_not_change_config(service, tmp_path, monkeypatch):
    monkeypatch.setattr(Path, "home", classmethod(lambda cls: tmp_path))
    monkeypatch.setenv("CODEX_HOME", str(tmp_path / ".codex"))
    skill = tmp_path / ".agents/skills/sonariel/SKILL.md"
    skill.parent.mkdir(parents=True)
    skill.write_text("User-owned content")
    with pytest.raises(ValueError, match="skill sonariel diferente"):
        service.invoke("codex_register")
    assert not (tmp_path / ".codex/config.toml").exists()
    assert skill.read_text() == "User-owned content"


@pytest.mark.parametrize("extra", [{"batch_size": 2}, {"mode": "unknown"}, {"thinking": True}, {"duration": 2}, {"seed": -1}, {"shell": "echo x"}])
def test_reject_unsupported_generation(service, project, extra):
    with pytest.raises(Exception):
        service.invoke("generate", params(project, **extra))


def test_cover_requires_source(service, project):
    with pytest.raises(ValueError, match="source_id"):
        service.invoke("generate", params(project, mode="cover"))


def test_text2music_does_not_silently_cover(service, project, audio):
    asset = service.invoke("reference_register", {"project_id": project, "path": str(audio), "name": "Reference"})
    with pytest.raises(ValueError, match="source_id"):
        service.invoke("generate", params(project, source_id=asset["id"]))


def test_reference_integrity_and_selection(service, project, audio):
    before = sha256(audio)
    one = service.invoke("result_import", {"project_id": project, "path": str(audio), "name": "One"})
    two = service.invoke("result_import", {"project_id": project, "path": str(audio), "name": "Two", "parent_id": one["id"]})
    for asset in (one, two):
        service.invoke("result_feedback", {"asset_id": asset["id"], "favorite": True, "selected": True, "notes": "Listen again"})
    assert sum(a["selected"] for a in service.invoke("results_list")) == 1
    assert sha256(audio) == before
    assert service.store.asset(two["id"])["parent_id"] == one["id"]


def test_only_waiting_jobs_cancel(service, project):
    job = service.invoke("generate", params(project))
    assert service.invoke("job_cancel", {"job_id": job["job_id"]})["state"] == "cancelled"
    with pytest.raises(ValueError):
        service.invoke("job_cancel", {"job_id": job["job_id"]})


def test_submitted_jobs_cannot_cancel(service, project):
    job = service.invoke("generate", params(project))
    service.store.execute("UPDATE jobs SET remote_id='remote',state='generating' WHERE id=?", (job["job_id"],))
    with pytest.raises(ValueError):
        service.invoke("job_cancel", {"job_id": job["job_id"]})
    with pytest.raises(ValueError):
        service.invoke("engine_stop")


def test_recovery_queries_remote_without_resubmission(service, project):
    first = service.invoke("generate", params(project))
    second = service.invoke("generate", params(project, request_key="request-2"))
    service.store.execute("UPDATE jobs SET state='generating',remote_id='remote-1' WHERE id=?", (first["job_id"],))
    service.store.execute("UPDATE jobs SET state='submitted' WHERE id=?", (second["job_id"],))
    service.recover()
    assert service.store.job(first["job_id"])["remote_id"] == "remote-1"
    assert service.store.job(first["job_id"])["state"] == "queued"
    assert service.store.job(second["job_id"])["state"] == "interrupted"


def test_wav_validation(audio, tmp_path):
    assert inspect_wav(audio)["channels"] == 2
    silent = tmp_path / "silent.wav"
    sf.write(silent, np.zeros(4800), 48000)
    with pytest.raises(ValueError, match="silencioso"):
        inspect_wav(silent)


@pytest.mark.parametrize("path", ["https://host/music.wav", r"\\server\share\file.wav", "relative.wav", 'bad"name.wav'])
def test_reject_external_or_unsafe_paths(path):
    with pytest.raises(ValueError):
        local_audio(path)


def test_setup_refuses_unowned_directory(service, tmp_path):
    root = tmp_path / "existing"
    root.mkdir()
    (root / "keep.txt").write_text("preserve")
    with pytest.raises(ValueError, match="vazia"):
        service.setup.install(str(root), authorized=True)
    assert (root / "keep.txt").read_text() == "preserve"


def test_setup_refuses_git_destination(service, tmp_path):
    (tmp_path / ".git").mkdir()
    with pytest.raises(ValueError, match="Git"):
        service.setup.plan(str(tmp_path / "engine"))


def test_setup_requires_authorization(service, tmp_path):
    with pytest.raises(ValueError, match="Autorize"):
        service.setup.install(str(tmp_path / "new"), authorized=False)


def test_zip_path_traversal(tmp_path):
    path = tmp_path / "archive.zip"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("../outside", "bad")
    with pytest.raises(ValueError):
        extract(path, tmp_path / "dest")


def test_verified_download_cache_avoids_network(tmp_path, monkeypatch):
    path = tmp_path / "cached.bin"
    path.write_bytes(b"known content")
    monkeypatch.setattr("requests.get", lambda *a, **k: pytest.fail("Network should not be used"))
    assert download("https://example.invalid", path, sha256(path)) == path


def test_download_resumes_verified_partial(tmp_path, monkeypatch):
    import hashlib
    path = tmp_path / "model.bin"
    partial = path.with_suffix(".bin.part")
    partial.write_bytes(b"first-")
    class Response:
        status_code = 206
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def raise_for_status(self): pass
        def iter_content(self, _): yield b"second"
    def get(_url, **kwargs):
        assert kwargs["headers"]["Range"] == "bytes=6-"
        return Response()
    monkeypatch.setattr("requests.get", get)
    download("https://example.invalid/model", path, hashlib.sha256(b"first-second").hexdigest())
    assert path.read_bytes() == b"first-second"
    assert not partial.exists()


def test_corrupt_download_is_never_published(tmp_path, monkeypatch):
    import hashlib
    path = tmp_path / "model.bin"
    class Response:
        status_code = 200
        def __enter__(self): return self
        def __exit__(self, *_): pass
        def raise_for_status(self): pass
        def iter_content(self, _): yield b"corrupt"
    monkeypatch.setattr("requests.get", lambda *_a, **_k: Response())
    with pytest.raises(RuntimeError, match="Integridade"):
        download("https://example.invalid/model", path, hashlib.sha256(b"expected").hexdigest())
    assert not path.exists()


def test_early_setup_failure_is_retryable_and_visible(service, tmp_path, monkeypatch):
    monkeypatch.setattr(service.setup, "plan", lambda _: {})
    def fail(*_args): raise ValueError("Unowned destination preserved")
    monkeypatch.setattr(service.setup, "install", fail)
    service.invoke("setup_install", {"destination": str(tmp_path / "engine"), "authorized": True})
    service.setup_thread.join(timeout=2)
    status = service.store.setting("setup_status")
    assert status["state"] == "error" and status["retryable"] is True
    assert "Unowned" in status["stage"]


def test_setup_completion_keeps_required_manual_action_visible():
    action = "Feche o Audacity após salvar seus projetos."
    assert action in completion_stage({"configured": False, "manual_action": action})
    assert completion_stage({"configured": True}) == "Ambiente instalado e verificado"


def test_audacity_guard_refuses_wrong_project(service, monkeypatch):
    monkeypatch.setattr("sonariel.audacity.tracks", lambda: [{"name": "Existing unrelated project"}])
    with pytest.raises(RuntimeError, match="projeto ativo"):
        service.audacity.verify("sonariel-test")


def test_all_tools_have_closed_schemas():
    import jsonschema
    for method in METHODS.values():
        jsonschema.Draft202012Validator.check_schema(method["inputSchema"])
        assert method["inputSchema"]["additionalProperties"] is False


def test_no_arbitrary_command_rpc(service):
    with pytest.raises(ValueError):
        service.invoke("execute_shell", {"command": "whoami"})
