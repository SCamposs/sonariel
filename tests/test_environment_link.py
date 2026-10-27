import json
from types import SimpleNamespace

import pytest

from sonariel import environment
from sonariel.service import METHODS, Service
from sonariel.store import Store


@pytest.fixture
def engine(tmp_path, monkeypatch):
    root = tmp_path/'engine'
    repo = root/'ACE-Step-1.5'
    (root/'.venv/Scripts').mkdir(parents=True)
    (root/'.venv/Scripts/python.exe').write_bytes(b'not executed')
    (repo/'acestep').mkdir(parents=True)
    (repo/'acestep/api_server.py').write_text('# fixture')
    (repo/'acestep/model_downloader.py').write_text('MAIN_MODEL_COMPONENTS = ["vae"]')
    (repo/'sonariel-recipe.json').write_text(json.dumps({'commit':environment.recipe()['ace_commit']}))
    for name in ['acestep-v15-turbo/model.safetensors','vae/diffusion_pytorch_model.safetensors','Qwen3-Embedding-0.6B/model.safetensors']:
        model = repo/'checkpoints'/name
        model.parent.mkdir(parents=True, exist_ok=True)
        model.write_bytes(b'presence-only inspection fixture; never loaded')
    versions = {'python':environment.recipe()['python'],'packages':{'torch':'2.7.1+cpu','torchaudio':'2.7.1+cpu'}}
    monkeypatch.setattr(environment, 'run', lambda *a, **kw: SimpleNamespace(stdout=json.dumps(versions)))
    return root, versions


def test_link_without_editor_preserves_optional_editor_configuration(tmp_path, engine):
    service = Service(Store(tmp_path/'profile'), start_worker=False)
    root, _ = engine
    result = service.invoke('environment_link', {'root':str(root)})
    assert result['compatible'] and result['audacity'] == ''
    service.store.set('environment', {**result,'audacity':'previous-editor.exe'})
    assert service.invoke('environment_link', {'root':str(root)})['audacity'] == 'previous-editor.exe'
    service.store.set('audacity_executable','separately-configured.exe')
    assert service.invoke('environment_link', {'root':str(root),'audacity_path':'missing-editor.exe'})['audacity'] == 'separately-configured.exe'
    assert service.store.setting('audacity_executable') == 'separately-configured.exe'


def test_legacy_link_with_audacity_still_configures_editor(tmp_path, engine):
    service = Service(Store(tmp_path/'profile'), start_worker=False)
    editor = tmp_path/'Audacity.exe'
    editor.write_bytes(b'not executed')
    result = service.invoke('environment_link', {'root':str(engine[0]),'audacity_path':str(editor)})
    assert result['compatible'] and result['audacity'] == str(editor.resolve())
    assert METHODS['environment_link']['inputSchema']['required'] == ['root']


@pytest.mark.parametrize('missing',['model','torch'])
def test_editor_independence_does_not_weaken_engine_checks(tmp_path, engine, missing):
    root, versions = engine
    if missing == 'model':
        (root/'ACE-Step-1.5/checkpoints/vae/diffusion_pytorch_model.safetensors').unlink()
    else:
        versions['packages']['torch'] = '2.7.1+cu128'
    service = Service(Store(tmp_path/'profile'), start_worker=False)
    assert not service.invoke('environment_link', {'root':str(root)})['compatible']
    assert service.store.setting('environment') is None
