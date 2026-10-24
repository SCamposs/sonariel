import json
import time
from pathlib import Path
import pytest
from sonariel.service import Service
from sonariel.store import Store, identifier
from sonariel.environment import sha256


@pytest.fixture
def service(tmp_path):
    return Service(Store(tmp_path/'home'), start_worker=False)


def asset(service, path=None, kind='generated', **flags):
    project = service.rpc_project_create('Storage test')['project_id']
    key = identifier()
    path = path or service.store.home/'output'/f'{key}.wav'
    path.write_bytes(b'synthetic fixture, not production audio')
    service.store.execute('INSERT INTO assets(id,project_id,path,name,kind,metadata,created) VALUES(?,?,?,?,?,?,?)',
        (key, project, str(path), 'Fixture', kind, json.dumps(dict(sha256=sha256(path))), time.time()))
    for flag, value in flags.items():
        assert flag in {'favorite','selected','parent_id'}
        service.store.execute(f'UPDATE assets SET {flag}=? WHERE id=?', (value,key))
    return key, path


def discard(service, key):
    plan = service.invoke('storage_preview', dict(asset_ids=[key]))
    return service.invoke('storage_discard', dict(asset_ids=[key],preview_token=plan['token'],confirmed=True))


@pytest.mark.parametrize('kind',['generated','export','preview','voice','processed'])
def test_managed_discard_and_restore_preserve_bytes_metadata_and_lineage(service,kind):
    key, path = asset(service,kind=kind)
    digest = sha256(path)
    plan = service.invoke('storage_preview', dict(asset_ids=[key]))
    assert plan['reclaimed_bytes']==0 and plan['managed_bytes']==path.stat().st_size
    discard(service,key)
    assert not path.exists()
    assert not service.rpc_results_list()
    with pytest.raises(ValueError,match='lixeira'):
        service.store.asset(key)
    item = service.invoke('storage_list')['items'][0]
    assert item['trashed'] and sha256(Path(item['trash_path']))==digest
    service.invoke('storage_restore',dict(asset_id=key))
    assert sha256(path)==digest and service.store.asset(key)['parent_id'] is None
    assert len(service.rpc_results_list())==1


def test_external_file_is_only_hidden_and_never_moved(service,tmp_path):
    key,path=asset(service,tmp_path/'external.wav',kind='imported')
    data=path.read_bytes()
    assert not service.rpc_storage_list()['items'][0]['managed']
    discard(service,key)
    assert path.read_bytes()==data
    assert service.rpc_storage_list()['items'][0]['trash_path'] is None
    service.rpc_storage_restore(key)
    assert path.read_bytes()==data


@pytest.mark.parametrize('protection',['reference','favorite','selected','child','edit','shared','voice'])
def test_protected_assets_cannot_be_discarded(service, protection):
    key,path=asset(service,kind='reference' if protection=='reference' else 'generated')
    if protection in {'favorite','selected'}:
        service.store.execute(f'UPDATE assets SET {protection}=1 WHERE id=?',(key,))
    elif protection=='child':
        asset(service,parent_id=key)
    elif protection=='edit':
        service.store.execute('INSERT INTO edits VALUES(?,?,?,?)',(identifier(),key,'fixture.aup3',time.time()))
    elif protection=='shared':
        asset(service,path)
    elif protection=='voice':
        project=service.store.asset(key)['project_id']
        service.store.execute('INSERT INTO voice_profiles VALUES(?,?,?,?,?,?,?)',(identifier(),project,'Voice','sw',key,1,time.time()))
    plan=service.rpc_storage_preview([key])
    assert plan['entries'][0]['blocked']
    with pytest.raises(ValueError):
        service.rpc_storage_discard([key],plan['token'],True)
    assert path.exists()


def test_changed_preview_and_missing_confirmation_fail_closed(service):
    key,path=asset(service)
    plan=service.rpc_storage_preview([key])
    with pytest.raises(ValueError): service.rpc_storage_discard([key],plan['token'],False)
    path.write_bytes(b'changed')
    with pytest.raises(ValueError): service.rpc_storage_discard([key],plan['token'],True)
    assert path.exists()


def test_queue_blocks_discard_and_restore(service):
    key,path=asset(service)
    service.active=True
    with pytest.raises(ValueError,match='fila'): discard(service,key)
    service.active=False
    discard(service,key)
    service.active=True
    with pytest.raises(ValueError,match='fila'): service.rpc_storage_restore(key)


def test_restore_never_overwrites_and_checks_hash(service):
    key,path=asset(service)
    discard(service,key)
    path.write_bytes(b'new file')
    with pytest.raises(ValueError,match='ocupado'): service.rpc_storage_restore(key)
    assert path.read_bytes()==b'new file'


def test_interrupted_move_can_be_recovered(service,monkeypatch):
    key,path=asset(service)
    with monkeypatch.context() as patch:
        patch.setattr(Path,'rename',lambda *args: (_ for _ in ()).throw(OSError('simulated sharing violation')))
        with pytest.raises(OSError): discard(service,key)
    assert service.rpc_storage_list()['items'][0]['state']=='preparing'
    service.rpc_storage_restore(key)
    assert service.store.asset(key) and path.exists()


def test_migration_keeps_schema2_backup(service):
    service.store.execute('PRAGMA user_version=2')
    Store(service.store.home)
    assert len(list((service.store.home/'backups').glob('pre-schema3-*.sqlite3')))==1


def test_tampered_trash_cannot_be_restored(service):
    key,path=asset(service)
    discard(service,key)
    Path(service.rpc_storage_list()['items'][0]['trash_path']).write_bytes(b'changed trash')
    with pytest.raises(ValueError,match='alterado'): service.rpc_storage_restore(key)
    assert not path.exists()
