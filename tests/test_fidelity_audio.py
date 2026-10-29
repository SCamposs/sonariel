"""Contract fixtures only; real CPU inference is a separately authorized smoke test."""
import hashlib
import json
from pathlib import Path
from types import SimpleNamespace
import numpy as np
import pytest
import soundfile as sf
from sonariel.service import Service
from sonariel.store import Store
from sonariel.stable_setup import selected_files


@pytest.fixture
def setup(tmp_path):
    s = Service(Store(tmp_path / 'profile'), start_worker=False)
    p = s.rpc_project_create('Source contract')['project_id']
    path = tmp_path / 'source.wav'
    sf.write(path, .03*np.sin(np.arange(5*48000)*2*np.pi*220/48000), 48000, subtype='FLOAT')
    source = s.invoke('result_import', dict(project_id=p, path=str(path), name='Synthetic full source'))
    env = dict(accepted_licenses=True, families=['medium'], quality_profiles=['compact','fidelity'], fidelity_audio_input_ready=True)
    s.store.set('stable_environment', env)
    return s, p, source, env


def test_source_recipe_is_separate_immutable_and_requires_exact_registered_source(setup):
    s, p, source, env = setup
    text, audio = s.invoke('music_recommendations_list')
    assert text['id']=='medium-fp32-same-l-v1' and text['parameters']['mode']=='text2audio'
    assert text['optional_download_bytes']==7596935760 and len(text['checkpoints'])==3
    assert audio['id']=='medium-fp32-same-l-audio-v1' and audio['parameters']['init_noise_level']==.65
    assert audio['optional_download_bytes']==9313455284 and len(audio['checkpoints'])==4
    assert audio['available_modes']==['audio2audio'] and audio['max_duration']==120
    args = dict(recommendation_id=audio['id'], project_id=p, name='Source recipe', prompt='An original quiet tone.', seed=0, duration=5)
    with pytest.raises(Exception): s.invoke('music_recommendation_save',args)
    preset = s.invoke('music_recommendation_save',dict(args,source_id=source['id']))
    assert preset['params']['init_noise_level']==.65 and preset['params']['source_id']==source['id']
    assert preset['origin_recommendation']['id']==audio['id'] and s.rpc_queue_list()==[]
    review = s.invoke('music_preset_prepare',dict(project_id=p,preset_id=preset['id'],intent='repeat'))
    job = s.invoke('music_preset_generate',dict(project_id=p,preset_id=preset['id'],intent='repeat',request_key='fidelity-source-contract',review_token=review['review_token'],confirmed=True))
    params = s.store.job(job['job_id'])['params']
    assert params['quality_profile']=='fidelity' and params['init_noise_level']==.65 and params['steps']==8
    assert params['source_sha256']==source['metadata']['sha256'] and params['_parent_id']==source['id']
    assert s.music_preset_metadata(job['job_id'])['origin_recommendation']==preset['origin_recommendation']
    # Same request/token returns the same queue item; worker is deliberately disabled.
    again = s.invoke('music_preset_generate',dict(project_id=p,preset_id=preset['id'],intent='repeat',request_key='fidelity-source-contract',review_token=review['review_token'],confirmed=True))
    assert again['job_id']==job['job_id'] and len(s.rpc_queue_list())==1


def test_fidelity_input_never_inherits_compact_encoder_readiness(setup):
    s,p,source,env = setup
    env['fidelity_audio_input_ready']=False;env['audio_input_ready']=True
    s.store.set('stable_environment',env)
    text,audio=s.invoke('music_recommendations_list')
    assert text['available'] and not audio['available'] and audio['available_modes']==[]
    args=dict(engine_id='stable-audio-3-medium', project_id=p, request_key='missing-encoder', prompt='Original tone',seed=1,duration=5,mode='audio2audio',quality_profile='fidelity',source_id=source['id'])
    with pytest.raises(ValueError,match='SAME-L FP32 encoder'):s.invoke('music_generate',args)
    assert s.rpc_queue_list()==[]


def test_defaults_and_source_guards_remain_profile_specific(setup):
    s,p,source,env=setup
    args=dict(engine_id='stable-audio-3-medium',project_id=p,request_key='default',prompt='Original tone',seed=1,duration=5,mode='audio2audio',quality_profile='fidelity',source_id=source['id'])
    job=s.invoke('music_generate',args);assert s.store.job(job['job_id'])['params']['init_noise_level']==.65
    with pytest.raises(ValueError,match='Duração'):s.invoke('music_generate',dict(args,request_key='duration',duration=6))
    other=s.rpc_project_create('Other project')['project_id']
    with pytest.raises(ValueError,match='outro projeto'):s.invoke('music_generate',dict(args,project_id=other,request_key='wrong-project'))
    Path(source['path']).write_bytes(b'changed fixture')
    with pytest.raises(ValueError):s.invoke('music_generate',dict(args,request_key='changed'))
    assert len(s.rpc_queue_list())==1


def test_encoder_download_is_additive_explicit_and_hash_pinned():
    manifest=json.loads((Path(__file__).parents[1]/'core/sonariel/recipes/stable-models.json').read_text())
    text=selected_files(manifest,['medium'],include_audio=True,quality_profile='fidelity')
    audio=selected_files(manifest,['medium'],include_audio=True,quality_profile='fidelity',include_fidelity_audio=True)
    added=[f for f in audio if f not in text]
    assert len(added)==1 and added[0]['path']=='tflite/same-l/enc_fp32.tflite'
    assert added[0]['bytes']==1716519524 and added[0]['sha256']=='1560c83c097df534786b29bc63570ccfbeedbaeed225e1c45d9183eb60516a2c'
    with pytest.raises(ValueError):selected_files(manifest,['medium'],include_fidelity_audio=True)


def test_link_detects_missing_or_corrupted_optional_encoder_without_model_loading(tmp_path,monkeypatch):
    import sonariel.studio as studio
    from sonariel.stable_setup import VERSIONS
    from sonariel.stable_profiles import FIDELITY_PATHS,FIDELITY_ENCODER
    root=tmp_path/'engine';root.mkdir();python=root/'python.exe';python.write_bytes(b'fixture executable, not run')
    files=[]
    for name in ['tflite/t5gemma/encoder_fp16.tflite','tflite/sa3-m/dit_w8a8.tflite','tflite/same-s/dec_w8a8.tflite',*FIDELITY_PATHS,FIDELITY_ENCODER]:
        path=root/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(name.encode())
        files.append(dict(path=name,bytes=path.stat().st_size,sha256=hashlib.sha256(path.read_bytes()).hexdigest()))
    # Compact encoder intentionally absent; its optional manifest entry still exists.
    files.append(dict(path='tflite/same-s/enc_w8a8.tflite',bytes=1,sha256='0'*64))
    spec=root/'manifest.json';spec.write_text(json.dumps(dict(files=files,source_files=[],revision='fixture')))
    monkeypatch.setattr(studio,'resource',lambda name:spec)
    def probe(args,**kwargs):
        return SimpleNamespace(returncode=0,stdout=json.dumps(dict(python=[3,11,15],packages=VERSIONS)) if 'list(sys.version_info' in args[-1] else '1.0.0')
    monkeypatch.setattr(studio.subprocess,'run',probe)
    s=Service(Store(tmp_path/'profile'),start_worker=False)
    args=dict(python_path=str(python),source=str(root),models=str(root),families=['medium'],accepted_licenses=True)
    ready=s.invoke('stable_environment_link',args)
    assert ready['fidelity_audio_input_ready'] and not ready['audio_input_ready']
    (root/FIDELITY_ENCODER).unlink()
    missing=s.invoke('stable_environment_link',args)
    assert 'fidelity' in missing['quality_profiles'] and not missing['fidelity_audio_input_ready']
    (root/FIDELITY_ENCODER).write_bytes(b'corrupted')
    with pytest.raises(ValueError,match='encoder differs'):s.invoke('stable_environment_link',args)
    assert not s.store.setting('stable_environment')['fidelity_audio_input_ready']
