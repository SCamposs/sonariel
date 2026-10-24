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
        assert db.execute('PRAGMA user_version').fetchone()[0]==3
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


def test_stable_requires_explicit_terms_before_any_install_or_link(service,tmp_path):
    from sonariel.stable_setup import StableSetup
    destination=tmp_path/'no-download'
    with pytest.raises(ValueError,match='aceite'):
        StableSetup(service.store).install(str(destination),'sm-music',True,False)
    assert not destination.exists()
    with pytest.raises(ValueError,match='Aceite'):
        service.invoke('stable_environment_link',dict(python_path='missing',source='missing',models='missing',families=['medium'],accepted_licenses=False))
    assert not service.store.setting('stable_environment')


def test_audacity_can_be_configured_without_a_music_engine(service,tmp_path):
    exe=tmp_path/'Audacity.exe';exe.write_bytes(b'fixture')
    value=service.invoke('audacity_configure',dict(executable=str(exe)))
    assert value['configured'] and not value['tested']
    assert service.store.setting('audacity_executable')==str(exe)
    assert service.store.setting('environment') is None
    with pytest.raises(ValueError):service.invoke('audacity_configure',dict(executable=str(tmp_path)))


def test_local_recovery_never_resubmits_uncertain_inference(service):
    project=service.invoke('project_create',dict(name='Recovery study'))['project_id']
    args=dict(project_id=project,request_key='recover-voice',text='Olá.',language='pt',seed=1)
    job=service.invoke('voice_generate',args)
    service.store.execute("UPDATE jobs SET state='generating' WHERE id=?",(job['job_id'],))
    service.recover()
    assert service.store.job(job['job_id'])['state']=='interrupted'
    assert service.invoke('voice_generate',args)['already_submitted']
    assert len(service.invoke('queue_list'))==1


def test_turbo_cold_gate_is_twelve_and_sft_is_not_advertised_as_operational(service):
    from sonariel.environment import recipe
    assert recipe()['minimum_available_ram_gib']==12
    sft=next(e for e in service.invoke('engines_list') if e['id']=='acestep-v15-sft')
    assert not sft['compatible'] and not sft['installed'] and sft['blocked_reason']


def test_stable_uses_shared_queue_separate_contract_and_idempotency(service):
    project=service.invoke('project_create',dict(name='Music study'))['project_id']
    args=dict(engine_id='stable-audio-3-small-music',project_id=project,request_key='music-1',prompt='Quiet piano.',seed=1,duration=10)
    with pytest.raises(ValueError,match='licenças'):
        service.invoke('music_generate',args)
    service.store.set('stable_environment',dict(accepted_licenses=True,families=['sm-music']))
    first=service.invoke('music_generate',args)
    assert service.invoke('music_generate',args)['already_submitted']
    job=service.store.job(first['job_id'])
    assert job['params']['steps']==8 and job['params']['batch_size']==1
    assert job['params']['cfg']==1 and 'bpm' not in job['params']
    with pytest.raises(Exception):service.invoke('music_generate',dict(args,bpm=72))
    with pytest.raises(Exception):service.invoke('music_generate',dict(args,batch_size=2))
    with pytest.raises(ValueError,match='licenças'):
        service.invoke('music_generate',dict(args,engine_id='stable-audio-3-medium'))


def test_stable_source_allows_crlf_but_rejects_changed_code(tmp_path):
    import hashlib
    from sonariel.stable_setup import verify_source, selected_files
    file=tmp_path/'runtime.py';file.write_bytes(b'print(1)\r\n')
    spec=dict(source_files=[dict(path='runtime.py',sha256=hashlib.sha256(b'print(1)\n').hexdigest())])
    verify_source(tmp_path,spec)
    file.write_bytes(b'print(2)\n')
    with pytest.raises(ValueError,match='diferente'):verify_source(tmp_path,spec)
    manifest=json.loads((Path(__file__).parents[1]/'core/sonariel/recipes/stable-models.json').read_text())
    files=selected_files(manifest,['sm-music'])
    assert len(files)==3 and not any('sa3-m/' in f['path'] for f in files)
    assert len(selected_files(manifest,['sm-music'],include_audio=True))==4


def test_stable_audio_input_explicit_source_integrity_and_lineage(service,tmp_path):
    project=service.invoke('project_create',dict(name='Music input'))['project_id']
    path=tmp_path/'input.wav'
    sf.write(path,.1*np.sin(np.arange(240000)*2*np.pi*220/48000),48000,subtype='FLOAT')
    source=service.invoke('reference_register',dict(project_id=project,path=str(path),name='Input source'))
    args=dict(engine_id='stable-audio-3-medium',project_id=project,request_key='a2a-1',prompt='Quiet tone.',seed=3,duration=5,
              mode='audio2audio',source_id=source['id'],init_noise_level=.25)
    service.store.set('stable_environment',dict(accepted_licenses=True,families=['medium']))
    with pytest.raises(ValueError,match='encoder'):service.invoke('music_generate',args)
    service.store.set('stable_environment',dict(accepted_licenses=True,families=['medium'],audio_input_ready=True))
    first=service.invoke('music_generate',args)
    assert service.invoke('music_generate',args)['already_submitted']
    params=service.store.job(first['job_id'])['params']
    assert params['_parent_id']==source['id'] and params['source_sha256']==source['metadata']['sha256']
    assert params['duration']==5 and params['mode']=='audio2audio'
    with pytest.raises(ValueError,match='Duração'):service.invoke('music_generate',dict(args,duration=6))
    with pytest.raises(ValueError,match='explícito'):service.invoke('music_generate',dict(args,mode='text2audio'))
    with pytest.raises(ValueError,match='60 segundos'):
        service.invoke('music_generate',dict({k:v for k,v in args.items() if k not in {'source_id','init_noise_level'}},mode='text2audio',duration=61))
    with pytest.raises(Exception):service.invoke('music_generate',dict(args,init_noise_level=1))
    with pytest.raises(Exception):service.invoke('music_generate',dict(args,duration=121))
    with pytest.raises(ValueError,match='source_id'):service.invoke('music_generate',{k:v for k,v in args.items() if k!='source_id'})
    other=service.invoke('project_create',dict(name='Other'))['project_id']
    with pytest.raises(ValueError,match='outro projeto'):service.invoke('music_generate',dict(args,project_id=other))
    path.write_bytes(b'changed')
    with pytest.raises(ValueError,match='mudou'):service.invoke('music_generate',args)
    assert len(service.invoke('queue_list'))==1


def test_stable_audio_input_helpers_resample_pad_and_mix(tmp_path):
    from sonariel.recipes.stable_worker import source_audio, mix_source_noise, sha
    path=tmp_path/'source.wav';sf.write(path,np.full(48000,.1,np.float32),48000,subtype='FLOAT')
    params=dict(source_path=str(path),source_sha256=sha(path),duration=1)
    class Resampler:
        @staticmethod
        def resample(audio,rate,target,quality):
            assert audio.shape==(48000,2) and (rate,target,quality)==(48000,44100,'HQ')
            return np.full((44100,2),.1,np.float32)
    audio,info=source_audio(params,45056,Resampler)
    assert audio.shape==(1,2,45056) and not audio[:,:,44100:].any()
    assert info['full_source'] and info['resampling']=='soxr HQ'
    mixed=mix_source_noise(np.ones((1,256,12)),np.zeros((1,256,12)),.25)
    assert np.allclose(mixed,.75)
    with pytest.raises(ValueError):mix_source_noise(mixed,mixed,1.)
    with pytest.raises(ValueError,match='trim'):source_audio(params,40000,Resampler)
    path.write_bytes(b'changed')
    with pytest.raises(ValueError,match='changed'):source_audio(params,45056,Resampler)


def test_stable_progress_retries_windows_read_race_without_failing_render(tmp_path,monkeypatch):
    from sonariel.recipes import stable_worker
    replace=Path.replace;attempts=[]
    def racing(path,target):
        attempts.append(1)
        if len(attempts)<3:raise PermissionError('Windows read handle')
        return replace(path,target)
    monkeypatch.setattr(Path,'replace',racing)
    monkeypatch.setattr(stable_worker.time,'sleep',lambda _:None)
    stable_worker.write_progress(tmp_path/'request.json','Encode source')
    assert len(attempts)==3 and json.loads((tmp_path/'progress.json').read_text())['stage']=='Encode source'
    monkeypatch.setattr(Path,'replace',lambda *args:(_ for _ in ()).throw(PermissionError('Busy')))
    stable_worker.write_progress(tmp_path/'request.json','Next stage')


def test_preview_cannot_be_selected_as_final_and_invalid_fx_rejected(service,tmp_path):
    _,asset=imported(service,tmp_path)
    service.store.execute("UPDATE assets SET kind='preview' WHERE id=?",(asset['id'],))
    with pytest.raises(ValueError,match='Renderize'):service.invoke('result_feedback',dict(asset_id=asset['id'],selected=True,favorite=False,notes=''))
    recipe=chain();recipe['chain']=[dict(wet=1,effect=dict(type='lowpass',hz=16000,q=.7))]
    with pytest.raises(ValueError,match='sample rate'):
        service.invoke('fx_render',dict(asset_id=asset['id'],request_key='nyquist',recipe=recipe))
