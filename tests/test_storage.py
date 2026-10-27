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
    assert len(list((service.store.home/'backups').glob('pre-schema5-*.sqlite3')))==1


def test_tampered_trash_cannot_be_restored(service):
    key,path=asset(service)
    discard(service,key)
    Path(service.rpc_storage_list()['items'][0]['trash_path']).write_bytes(b'changed trash')
    with pytest.raises(ValueError,match='alterado'): service.rpc_storage_restore(key)
    assert not path.exists()


def purge(service, key, external=False):
    plan=service.invoke('storage_purge_preview',dict(asset_ids=[key],include_external_files=external))
    return service.invoke('storage_purge',dict(asset_ids=[key],preview_token=plan['token'],confirmed=True,include_external_files=external))


def test_imported_file_moves_only_after_explicit_opt_in_and_restores(service,tmp_path):
    key,path=asset(service,tmp_path/'imported.wav',kind='imported')
    digest=sha256(path)
    plan=service.invoke('storage_preview',dict(asset_ids=[key],include_external_files=True))
    service.invoke('storage_discard',dict(asset_ids=[key],include_external_files=True,preview_token=plan['token'],confirmed=True))
    item=service.rpc_storage_list()['items'][0]
    assert not path.exists() and Path(item['trash_path']).parent==service.store.home/'tmp/trash'
    assert item['expires_at']>time.time()+29*86400
    service.invoke('storage_restore',dict(asset_id=key))
    assert sha256(path)==digest


def test_permanent_delete_removes_bytes_keeps_tombstone_and_cannot_restore(service):
    key,path=asset(service)
    discard(service,key)
    trash=Path(service.rpc_storage_list()['items'][0]['trash_path'])
    result=purge(service,key)
    assert result['reclaimed_bytes']>0 and not trash.exists() and not path.exists()
    assert service.rpc_storage_list()['items']==[] and not service.rpc_results_list()
    assert service.store.rows('SELECT state FROM asset_trash')[0]['state']=='purged'
    with pytest.raises(ValueError):service.rpc_storage_restore(key)


def test_legacy_hidden_import_requires_explicit_file_deletion(service,tmp_path):
    key,path=asset(service,tmp_path/'external.wav',kind='imported')
    discard(service,key)
    service.expire_storage_trash(now=time.time()+31*86400)
    assert path.exists()
    purge(service,key,external=True)
    assert not path.exists()


def test_expiry_only_after_thirty_days_and_never_deletes_changed_files(service):
    key,path=asset(service)
    discard(service,key)
    created=service.store.rows('SELECT created FROM asset_trash')[0]['created']
    assert service.expire_storage_trash(now=created+30*86400-1)['deleted']==[]
    assert service.expire_storage_trash(now=created+30*86400)['deleted']==[key]
    other,_=asset(service)
    discard(service,other)
    trash=Path(service.rpc_storage_list()['items'][0]['trash_path'])
    trash.write_bytes(b'changed')
    assert service.expire_storage_trash(now=time.time()+31*86400)['deleted']==[]
    assert trash.exists()


def test_purge_rechecks_favorites_hashes_confirmation_and_queue(service):
    key,_=asset(service)
    discard(service,key)
    plan=service.rpc_storage_purge_preview([key])
    with pytest.raises(ValueError):service.rpc_storage_purge([key],plan['token'],False)
    service.active=True
    with pytest.raises(ValueError):service.rpc_storage_purge([key],plan['token'],True)
    service.active=False
    service.store.execute('UPDATE assets SET favorite=1 WHERE id=?',(key,))
    with pytest.raises(ValueError):service.rpc_storage_purge([key],plan['token'],True)
    assert service.expire_storage_trash(now=time.time()+31*86400)['deleted']==[]


def test_external_alias_of_reference_is_protected(service,tmp_path):
    key,path=asset(service,tmp_path/'shared.wav',kind='imported')
    asset(service,path,kind='reference')
    plan=service.rpc_storage_preview([key],include_external_files=True)
    assert plan['entries'][0]['blocked']


def test_cross_volume_interruption_preserves_original_and_can_restore(service,tmp_path,monkeypatch):
    import errno
    key,path=asset(service,tmp_path/'cross.wav',kind='imported')
    digest=sha256(path)
    with monkeypatch.context() as patch:
        patch.setattr(Path,'rename',lambda *args: (_ for _ in ()).throw(OSError(errno.EXDEV,'cross volume')))
        plan=service.rpc_storage_preview([key],True)
        service.rpc_storage_discard([key],plan['token'],True,True)
    assert not path.exists()
    service.rpc_storage_restore(key)
    assert sha256(path)==digest


def test_old_managed_trash_gets_thirty_day_grace_on_upgrade(service):
    key,_=asset(service)
    discard(service,key)
    service.store.execute('UPDATE asset_trash SET created=0 WHERE asset_id=?',(key,))
    started=service.store.setting('storage_retention_started_at')
    assert service.rpc_storage_list()['items'][0]['expires_at']==started+30*86400
    assert service.expire_storage_trash(now=started+1)['deleted']==[]
    assert service.expire_storage_trash(now=started+30*86400)['deleted']==[key]


def test_deleted_child_tombstone_does_not_permanently_lock_parent(service):
    parent,path=asset(service)
    child,_=asset(service,parent_id=parent)
    assert service.rpc_storage_preview([parent])['entries'][0]['blocked']
    discard(service,child)
    purge(service,child)
    assert not service.rpc_storage_preview([parent])['entries'][0]['blocked']
    discard(service,parent)
    purge(service,parent)
    assert not path.exists()


def test_partial_cross_volume_copy_restores_intact_original(service, tmp_path, monkeypatch):
    import errno
    from sonariel import storage_lifecycle
    key, path = asset(service, tmp_path/'partial.wav', kind='imported')
    original = path.read_bytes()
    def interrupted_copy(reader, writer, length):
        writer.write(reader.read(5))
        raise OSError('simulated disk interruption')
    with monkeypatch.context() as patch:
        patch.setattr(Path, 'rename', lambda *args: (_ for _ in ()).throw(OSError(errno.EXDEV, 'cross volume')))
        patch.setattr(storage_lifecycle.shutil, 'copyfileobj', interrupted_copy)
        plan = service.invoke('storage_preview', dict(asset_ids=[key], include_external_files=True))
        with pytest.raises(OSError, match='interruption'):
            service.invoke('storage_discard', dict(asset_ids=[key], include_external_files=True, preview_token=plan['token'], confirmed=True))
    journal = service.store.rows('SELECT * FROM asset_trash WHERE asset_id=?', (key,))[0]
    partial = Path(journal['trash_path'])
    assert path.read_bytes() == original and partial.read_bytes() == original[:5]
    assert service.rpc_storage_purge_preview([key])['entries'][0]['blocked']
    service.invoke('storage_restore', dict(asset_id=key))
    assert path.read_bytes() == original and not partial.exists()


def test_cross_volume_unlink_failure_restores_without_overwriting(service, tmp_path, monkeypatch):
    import errno
    key, path = asset(service, tmp_path/'locked.wav', kind='imported')
    original = path.read_bytes()
    unlink = Path.unlink
    def locked_source(candidate, *args, **kwargs):
        if candidate == path:
            raise PermissionError('simulated file lock')
        return unlink(candidate, *args, **kwargs)
    with monkeypatch.context() as patch:
        patch.setattr(Path, 'rename', lambda *args: (_ for _ in ()).throw(OSError(errno.EXDEV, 'cross volume')))
        patch.setattr(Path, 'unlink', locked_source)
        plan = service.rpc_storage_preview([key], True)
        with pytest.raises(PermissionError):
            service.rpc_storage_discard([key], plan['token'], True, True)
    journal = service.store.rows('SELECT * FROM asset_trash WHERE asset_id=?', (key,))[0]
    duplicate = Path(journal['trash_path'])
    assert path.read_bytes() == duplicate.read_bytes() == original
    service.invoke('storage_restore', dict(asset_id=key))
    assert path.read_bytes() == original and not duplicate.exists()


def test_permanent_delete_rechecks_file_hash_after_preview(service):
    key, _ = asset(service)
    discard(service, key)
    plan = service.rpc_storage_purge_preview([key])
    path = Path(plan['entries'][0]['path'])
    path.write_bytes(b'new content must survive')
    with pytest.raises(ValueError):
        service.invoke('storage_purge', dict(asset_ids=[key], preview_token=plan['token'], confirmed=True))
    assert path.read_bytes() == b'new content must survive'
    assert service.store.rows('SELECT state FROM asset_trash WHERE asset_id=?', (key,))[0]['state'] == 'trashed'


def test_purge_recovery_requires_new_review_after_unlink(service, monkeypatch):
    key, _ = asset(service)
    discard(service, key)
    plan = service.rpc_storage_purge_preview([key])
    execute = service.store.execute
    def interrupted_commit(sql, args=()):
        if "SET state='purged'" in sql:
            raise OSError('simulated commit interruption')
        return execute(sql, args)
    with monkeypatch.context() as patch:
        patch.setattr(service.store, 'execute', interrupted_commit)
        with pytest.raises(OSError):
            service.invoke('storage_purge', dict(asset_ids=[key], preview_token=plan['token'], confirmed=True))
    assert not Path(plan['entries'][0]['path']).exists()
    assert service.store.rows('SELECT state FROM asset_trash WHERE asset_id=?', (key,))[0]['state'] == 'purging'
    with pytest.raises(ValueError):
        service.invoke('storage_purge', dict(asset_ids=[key], preview_token=plan['token'], confirmed=True))
    retry = service.rpc_storage_purge_preview([key])
    service.invoke('storage_purge', dict(asset_ids=[key], preview_token=retry['token'], confirmed=True))
    assert service.store.rows('SELECT state FROM asset_trash WHERE asset_id=?', (key,))[0]['state'] == 'purged'
