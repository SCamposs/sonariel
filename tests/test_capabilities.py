import json
import sys
from pathlib import Path

import pytest

from sonariel.capabilities import loop_creation_enabled, require_loop_creation
from sonariel.service import Service
from sonariel.store import Store


def test_loops_fail_closed_and_packaged_runtime_cannot_opt_in(tmp_path, monkeypatch):
    monkeypatch.delenv('SONARIEL_DEVELOPMENT_LOOPS',raising=False)
    assert not loop_creation_enabled(tmp_path)
    monkeypatch.setenv('SONARIEL_DEVELOPMENT_LOOPS','true')
    assert not loop_creation_enabled(tmp_path)
    monkeypatch.setenv('SONARIEL_DEVELOPMENT_LOOPS','1')
    assert loop_creation_enabled(tmp_path)
    assert not loop_creation_enabled(Path.home()/'.sonariel')
    assert not loop_creation_enabled(Path.home()/'.sonariel/child')
    monkeypatch.setattr(sys,'frozen',True,raising=False)
    assert not loop_creation_enabled(tmp_path)
    with pytest.raises(ValueError,match='unavailable'):
        require_loop_creation(tmp_path)


def test_disabled_loop_rejects_direct_rpc_before_accessing_source_or_queue(tmp_path, monkeypatch):
    monkeypatch.delenv('SONARIEL_DEVELOPMENT_LOOPS',raising=False)
    service=Service(Store(tmp_path),start_worker=False)
    assert service.rpc_snapshot()['capabilities']=={'loop_creation':False}
    with pytest.raises(ValueError,match='unavailable'):
        service.rpc_fx_loop_render('nonexistent','disabled-request',0,1,10)
    assert service.rpc_queue_list()==[]


def test_legacy_queued_loop_is_preserved_but_does_not_run_in_distribution(tmp_path, monkeypatch):
    monkeypatch.delenv('SONARIEL_DEVELOPMENT_LOOPS',raising=False)
    service=Service(Store(tmp_path),start_worker=False)
    project=service.rpc_project_create('Prior development project')['project_id']
    params={'_engine':'native-fx','recipe':{'operation':'loop','schema_version':1}}
    queued=service.enqueue_local(project,'legacy-loop',params)
    monkeypatch.setattr(service.local,'run',lambda *_:pytest.fail('Disabled loop started DSP'))
    service.work_local(service.store.job(queued['job_id']))
    job=service.store.job(queued['job_id'])
    assert job['state']=='interrupted' and 'unavailable' in job['error']
    assert job['params']==params and job['request_key']=='legacy-loop'
    assert service.rpc_results_list()==[]


def test_version_normalization_matches_candidate_across_ecosystems():
    import tomllib
    from packaging.version import Version
    from sonariel import __version__
    root=Path(__file__).resolve().parents[1]
    package=json.loads((root/'package.json').read_text())['version']
    lock=json.loads((root/'package-lock.json').read_text())
    assert package==__version__==lock['version']==lock['packages']['']['version']
    assert package==json.loads((root/'src-tauri/tauri.conf.json').read_text())['version']
    assert package==tomllib.loads((root/'src-tauri/Cargo.toml').read_text())['package']['version']
    assert Version(package)==Version(tomllib.loads((root/'pyproject.toml').read_text())['project']['version'])


def test_existing_loop_audio_and_lineage_remain_exportable_when_creation_is_disabled(tmp_path, monkeypatch):
    import hashlib
    import numpy as np
    import soundfile as sf
    monkeypatch.delenv('SONARIEL_DEVELOPMENT_LOOPS',raising=False)
    service=Service(Store(tmp_path/'profile'),start_worker=False)
    project=service.rpc_project_create('Preserved history')['project_id']
    original=tmp_path/'original.wav'
    sf.write(original,.1*np.sin(np.arange(24000)*.04),24000,subtype='FLOAT')
    parent=service.rpc_result_import(project,str(original),'Original')
    derived=tmp_path/'previous-loop.wav'
    derived.write_bytes(original.read_bytes())
    asset=service.rpc_result_import(project,str(derived),'Prior loop')
    metadata=asset['metadata']
    metadata['parameters']={'recipe':{'operation':'loop','start_seconds':0,'end_seconds':1,'crossfade_ms':0}}
    service.store.execute("UPDATE assets SET kind='fx',parent_id=?,metadata=? WHERE id=?",
                          (parent['id'],json.dumps(metadata),asset['id']))
    before=hashlib.sha256(derived.read_bytes()).hexdigest()
    assert service.verified_source(asset['id'])['parent_id']==parent['id']
    export=tmp_path/'export';export.mkdir()
    report=service.rpc_result_export_batch([asset['id']],str(export),manifest=True)
    assert report['files'][0]['status']=='exported'
    assert hashlib.sha256((export/report['files'][0]['file']).read_bytes()).hexdigest()==before
    assert service.store.asset(asset['id'])['metadata']['parameters']==metadata['parameters']
