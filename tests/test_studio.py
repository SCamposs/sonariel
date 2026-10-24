import json
import sqlite3
import sys
from pathlib import Path

import numpy as np
import pytest
import soundfile as sf

from sonariel.service import Service
from sonariel.store import Store
from sonariel.studio import validate_fx


@pytest.fixture
def service(tmp_path):
    return Service(Store(tmp_path/'data'),start_worker=False)


def chain():
    return dict(name='Gain study',schema_version=1,output_channels=2,tail_seconds=0,
                bypass=False,chain=[dict(wet=1,effect=dict(type='gain',db=-6))])


def imported(service,tmp_path):
    project=service.invoke('project_create',dict(name='Voice study'))['project_id']
    path=tmp_path/'tone.wav'
    sf.write(path,.1*np.sin(np.arange(24000)*2*np.pi*220/24000),24000,subtype='FLOAT')
    asset=service.invoke('result_import',dict(project_id=project,path=str(path),name='Source'))
    return project,asset


def test_three_engine_categories_without_loading_models(service):
    engines=service.invoke('engines_list')
    assert {e['category'] for e in engines}=={'music','voice','fx'}
    assert 'torch' not in sys.modules
    assert next(e for e in engines if e['id']=='chatterbox-v3')['continuation'] is False
    assert all(not e['compatible'] for e in engines if e['id'].startswith('stable-audio'))


def test_existing_database_rows_and_user_version_preserved(tmp_path):
    store=Store(tmp_path/'data')
    store.execute("INSERT INTO projects VALUES('original','Original','Keep this',1)")
    store.set('preferences',{'idle_minutes':7})
    store.execute('PRAGMA user_version=1')
    reopened=Store(store.home)
    assert reopened.rows('SELECT * FROM projects')[0]['context']=='Keep this'
    assert reopened.setting('preferences')['idle_minutes']==7
    with reopened.connect() as db:
        assert db.execute('PRAGMA user_version').fetchone()[0]==2
    store.execute('PRAGMA user_version=999')
    with pytest.raises(ValueError,match='mais nova'):
        Store(store.home)
    with sqlite3.connect(store.path) as db:
        assert db.execute('PRAGMA user_version').fetchone()[0]==999


def test_voice_text_exact_and_no_language_default(service):
    project=service.invoke('project_create',dict(name='Generic project'))['project_id']
    args=dict(project_id=project,request_key='voice-1',text='Zanuru, mali.',language='fr',seed=12,original_text='A greeting')
    first=service.invoke('voice_generate',args)
    assert service.store.job(first['job_id'])['params']['text']==args['text']
    assert service.invoke('voice_generate',args)['already_submitted']
    with pytest.raises(ValueError,match='request_key'):
        service.invoke('voice_generate',dict(args,text='Different'))
    with pytest.raises(Exception):
        service.invoke('voice_generate',{k:v for k,v in args.items() if k!='language'})
    assert len(service.invoke('queue_list'))==1


def test_reference_consent_and_project_boundary(service,tmp_path):
    project,asset=imported(service,tmp_path)
    args=dict(project_id=project,name='Own voice',language='pt',reference_id=asset['id'])
    with pytest.raises(ValueError,match='autorização'):
        service.invoke('voice_profile_save',args)
    profile=service.invoke('voice_profile_save',dict(args,authorized=True))
    job=service.invoke('voice_generate',dict(project_id=project,request_key='own-voice',text='Olá.',language='pt',profile_id=profile['id'],seed=1))
    assert service.store.job(job['job_id'])['params']['reference_sha256']==asset['metadata']['sha256']
    other=service.invoke('project_create',dict(name='Other'))['project_id']
    with pytest.raises(ValueError):
        service.invoke('voice_profile_save',dict(args,project_id=other,authorized=True))


def test_private_presets_not_in_global_catalog_and_duplicate_revisions(service):
    project=service.invoke('project_create',dict(name='Project'))['project_id']
    first=service.invoke('fx_preset_save',dict(name='Private mix',recipe=chain(),project_id=project))
    second=service.invoke('fx_preset_save',dict(name='Private mix',recipe=chain(),project_id=project))
    assert first['id']!=second['id']
    assert not service.invoke('fx_presets_list')
    assert len(service.invoke('fx_presets_list',dict(project_id=project)))==2


def test_fx_queue_is_shared_idempotent_and_lineage_is_explicit(service,tmp_path):
    project,asset=imported(service,tmp_path)
    args=dict(asset_id=asset['id'],request_key='fx1',recipe=chain(),preview=True)
    result=service.invoke('fx_render',args)
    assert service.invoke('fx_render',args)['job_id']==result['job_id']
    job=service.store.job(result['job_id'])
    assert job['project_id']==project and job['params']['_parent_id']==asset['id']
    assert job['params']['preview'] is True
    assert service.invoke('job_cancel',dict(job_id=job['id']))['state']=='cancelled'


def test_changed_source_refused_and_export_never_overwrites(service,tmp_path):
    _,asset=imported(service,tmp_path)
    out=tmp_path/'export.wav'
    assert service.invoke('result_export',dict(asset_id=asset['id'],destination=str(out)))['sha256']==asset['metadata']['sha256']
    with pytest.raises(ValueError):
        service.invoke('result_export',dict(asset_id=asset['id'],destination=str(out)))
    Path(asset['path']).write_bytes(b'changed')
    with pytest.raises(ValueError,match='mudou'):
        service.invoke('fx_render',dict(asset_id=asset['id'],request_key='changed',recipe=chain()))


def test_fx_schema_rejects_unknown_controls_and_nan():
    validate_fx(chain())
    bad=chain();bad['chain'][0]['effect']['shell']='invalid'
    with pytest.raises(Exception):validate_fx(bad)
    bad=chain();bad['chain'][0]['effect']['db']=float('nan')
    with pytest.raises(ValueError):validate_fx(bad)


def test_preset_json_roundtrip(service,tmp_path):
    first=service.invoke('fx_preset_save',dict(name='Shared',recipe=chain()))
    path=tmp_path/'preset.json'
    service.invoke('fx_preset_export',dict(preset_id=first['id'],destination=str(path)))
    second=service.invoke('fx_preset_import',dict(path=str(path)))
    assert first['recipe']==second['recipe']==json.loads(path.read_text())


def test_owned_local_crash_process_blocks_update_and_stop(service,monkeypatch):
    monkeypatch.setattr(service.local,'owned',lambda: object())
    with pytest.raises(ValueError,match='Conclua a fila'):service.prepare_update()
    with pytest.raises(ValueError,match='Inferência ativa'):service.invoke('engine_stop')
