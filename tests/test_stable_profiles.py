import json
from pathlib import Path
import pytest
from sonariel.service import Service
from sonariel.store import Store
from sonariel.stable_setup import selected_files


def test_optional_fidelity_download_is_pinned_and_medium_only():
    manifest=json.loads((Path(__file__).parents[1]/'core/sonariel/recipes/stable-models.json').read_text())
    compact=selected_files(manifest,['medium'])
    fidelity=selected_files(manifest,['medium'],quality_profile='fidelity')
    added=[f for f in fidelity if f not in compact]
    assert {f['path'] for f in added}=={'tflite/sa3-m/dit_fp32.tflite','tflite/same-l/dec_fp32.tflite'}
    assert sum(f['bytes'] for f in added)==7596935760
    assert all(len(f['sha256'])==64 for f in added)
    with pytest.raises(ValueError):selected_files(manifest,['sm-music'],quality_profile='fidelity')


def test_fidelity_is_explicit_queued_idempotent_and_recorded_in_presets(tmp_path):
    s=Service(Store(tmp_path),start_worker=False)
    project=s.rpc_project_create('Test')['project_id']
    args=dict(engine_id='stable-audio-3-medium',project_id=project,request_key='fidelity',prompt='Original quiet synth.',seed=5,duration=30,quality_profile='fidelity')
    s.store.set('stable_environment',dict(accepted_licenses=True,families=['medium']))
    with pytest.raises(ValueError,match='optional'):s.invoke('music_generate',args)
    s.store.set('stable_environment',dict(accepted_licenses=True,families=['medium'],quality_profiles=['compact','fidelity']))
    result=s.invoke('music_generate',args)
    assert s.invoke('music_generate',args)['job_id']==result['job_id']
    assert s.store.job(result['job_id'])['params']['quality_profile']=='fidelity'
    with pytest.raises(ValueError,match='SAME-L FP32 encoder'):s.invoke('music_generate',dict(args,mode='audio2audio'))
    params={k:v for k,v in args.items() if k not in {'engine_id','project_id','request_key'}}
    preset=s.invoke('music_preset_save',dict(project_id=project,name='FP32',engine_id=args['engine_id'],parameters=params))
    assert preset['params']['quality_profile']=='fidelity'


def test_compact_is_default_and_small_does_not_advertise_fidelity(tmp_path):
    s=Service(Store(tmp_path),start_worker=False)
    s.store.set('stable_environment',dict(accepted_licenses=True,families=['medium','sm-music'],quality_profiles=['compact','fidelity']))
    engines=s.rpc_engines_list()
    assert next(e for e in engines if e['id']=='stable-audio-3-small-music')['quality_profiles']==['compact']
    project=s.rpc_project_create('Test')['project_id']
    j=s.invoke('music_generate',dict(engine_id='stable-audio-3-small-music',project_id=project,request_key='small',prompt='Quiet synth',seed=1,duration=30))
    assert s.store.job(j['job_id'])['params']['quality_profile']=='compact'
