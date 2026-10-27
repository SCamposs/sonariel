"""Filesystem lifecycle shared by recoverable discard and irreversible purge."""
from __future__ import annotations

import errno
import hashlib
import json
import shutil
import stat
import time
from pathlib import Path

from .environment import sha256

RETENTION_SECONDS = 30 * 86400


class StorageLifecycle:
    def _storage_expiration(self, journal):
        if not journal or not journal['trash_path']:
            return None
        return max(journal['created'], self.store.setting('storage_retention_started_at', journal['created'])) + RETENTION_SECONDS

    @staticmethod
    def _storage_safe_path(value):
        path = Path(value)
        if not path.is_absolute() or str(path).startswith('\\\\') or path.suffix.lower() not in {'.wav','.flac','.mp3','.ogg'}:
            raise ValueError('Unsafe audio path')
        for part in (path, *path.parents):
            if part.exists() or part.is_symlink():
                info = part.lstat()
                if stat.S_ISLNK(info.st_mode) or getattr(info,'st_file_attributes',0) & 0x400:
                    raise ValueError('Symlinks and junctions are not storage targets')
        return path

    def _storage_trash_path(self, value):
        path = self._storage_safe_path(value)
        roots = (self.store.home/'trash', self.store.home/'tmp/trash')
        if not any(path.parent.resolve()==root.resolve() for root in roots):
            raise ValueError('Invalid journaled trash target')
        return path

    @staticmethod
    def _storage_move(source, target, digest):
        try:
            source.rename(target)
        except OSError as error:
            if error.errno != errno.EXDEV and getattr(error,'winerror',None)!=17:
                raise
            with source.open('rb') as reader, target.open('xb') as writer:
                shutil.copyfileobj(reader, writer, 1024*1024)
            if sha256(target)!=digest or sha256(source)!=digest:
                raise ValueError('Audio changed during cross-volume move')
            source.unlink()

    def _storage_restore_file(self, asset_id):
        self._storage_idle()
        rows = self.store.rows('SELECT * FROM asset_trash WHERE asset_id=?',(asset_id,))
        if not rows or rows[0]['state'] in {'purged','purging'}:
            raise ValueError('Registro não está na lixeira restaurável')
        journal = rows[0]
        source = self._storage_safe_path(journal['original_path'])
        target = self._storage_trash_path(journal['trash_path']) if journal['trash_path'] else None
        if target and target.exists():
            if sha256(target)!=journal['sha256']:
                if journal['state']=='preparing' and source.is_file() and sha256(source)==journal['sha256']:
                    target.unlink()  # incomplete cross-volume copy, intact source
                else:
                    raise ValueError('Arquivo da lixeira foi alterado')
            elif source.exists():
                if journal['state']=='preparing' and source.is_file() and sha256(source)==journal['sha256']:
                    target.unlink()  # copy completed before interrupted unlink
                else:
                    raise ValueError('Destino original ocupado; nada foi sobrescrito')
            else:
                self._storage_move(target, source, journal['sha256'])
        if not source.is_file() or sha256(source)!=journal['sha256']:
            raise ValueError('Original ausente ou alterado; registro permanece recuperável')
        self.store.execute('DELETE FROM asset_trash WHERE asset_id=?',(asset_id,))
        self.store.event('storage','Restored: '+asset_id)
        return dict(restored=asset_id)

    def _storage_purge_protection(self, asset):
        key = asset['id']
        if asset['kind']=='reference' or asset['metadata'].get('region',{}).get('role')=='style':
            return 'Referência protegida'
        if asset['favorite'] or asset['selected']:
            return 'Favorita/escolhida: remova a marca antes de descartar'
        if self.store.rows("SELECT a.id FROM assets a LEFT JOIN asset_trash t ON a.id=t.asset_id WHERE a.parent_id=? AND (t.state IS NULL OR t.state!='purged')",(key,)):
            return 'Usada como origem de outra versão'
        if self.store.rows('SELECT id FROM voice_profiles WHERE reference_id=?',(key,)):
            return 'Usada por um perfil vocal'
        if self.store.rows("SELECT id FROM music_presets WHERE json_extract(params,'$.source_id')=? OR json_extract(params,'$.reference_id')=?",(key,key)):
            return 'Used as conditioning by a music preset'
        if self.store.rows('SELECT id FROM edits WHERE asset_id=?',(key,)):
            return 'Possui edição Audacity registrada'
        source = Path(asset['path']).resolve()
        for row in self.store.rows("SELECT a.path FROM assets a LEFT JOIN asset_trash t ON a.id=t.asset_id WHERE a.id!=? AND (t.state IS NULL OR t.state!='purged')",(key,)):
            if Path(row['path']).resolve()==source:
                return 'Arquivo compartilhado com outro registro'
        return None

    def rpc_storage_purge_preview(self, asset_ids, include_external_files=False):
        entries=[]
        for key in asset_ids:
            assets=self.store.rows('SELECT * FROM assets WHERE id=?',(key,))
            journals=self.store.rows('SELECT * FROM asset_trash WHERE asset_id=?',(key,))
            if not assets or not journals or journals[0]['state']=='purged':
                raise ValueError('Permanent deletion requires a trash entry')
            asset,journal=assets[0],journals[0]
            reason=self._storage_purge_protection(asset)
            target=None
            try:
                if journal['state']=='preparing':
                    raise ValueError('Restore the interrupted discard before deleting')
                if journal['trash_path']:
                    target=self._storage_trash_path(journal['trash_path'])
                elif include_external_files:
                    target=self._storage_safe_path(journal['original_path'])
                if target and target.exists() and (not target.is_file() or sha256(target)!=journal['sha256']):
                    raise ValueError('Arquivo alterado desde o registro')
                if target and not target.exists() and journal['state']!='purging':
                    raise ValueError('Arquivo ausente: revise antes de excluir')
            except (ValueError,OSError) as error:
                reason=str(error)
            entries.append(dict(id=key,name=asset['name'],path=str(target) if target else None,
                bytes=target.stat().st_size if target and target.is_file() else 0,sha256=journal['sha256'],
                action='delete_file' if target else 'forget_record',blocked=reason))
        return dict(entries=entries,token=hashlib.sha256(json.dumps(entries,sort_keys=True).encode()).hexdigest(),
                    reclaimed_bytes=sum(e['bytes'] for e in entries if e['action']=='delete_file' and not e['blocked']))

    def rpc_storage_purge(self, asset_ids, preview_token, confirmed, include_external_files=False):
        if not confirmed:
            raise ValueError('Confirm permanent deletion explicitly')
        self._storage_idle()
        plan=self.rpc_storage_purge_preview(asset_ids,include_external_files)
        if plan['token']!=preview_token or any(e['blocked'] for e in plan['entries']):
            raise ValueError('Prévia alterada ou seleção protegida; revise novamente')
        deleted=[]
        reclaimed=0
        for entry in plan['entries']:
            self.store.execute("UPDATE asset_trash SET state='purging' WHERE asset_id=?",(entry['id'],))
            if entry['path']:
                path=self._storage_safe_path(entry['path'])
                if path.exists():
                    if sha256(path)!=entry['sha256']:
                        raise ValueError('Arquivo alterado desde o registro')
                    path.unlink()
                    reclaimed+=entry['bytes']
            # Preserve lineage/job metadata, but permanently prevent restoration.
            self.store.execute("UPDATE asset_trash SET state='purged' WHERE asset_id=?",(entry['id'],))
            self.store.event('storage','Permanently deleted: '+entry['id'])
            deleted.append(entry['id'])
        return dict(deleted=deleted,reclaimed_bytes=reclaimed)

    def expire_storage_trash(self, now=None):
        self._storage_idle()
        now=time.time() if now is None else now
        # Existing recoverable trash was created under a no-deletion contract.
        # Give it a full grace period from first use of the new lifecycle.
        if now < self.store.setting('storage_retention_started_at', now) + RETENTION_SECONDS:
            return dict(deleted=[])
        # A legacy hide-only import has no trash_path and is NEVER auto-unlinked.
        rows=self.store.rows("SELECT asset_id FROM asset_trash WHERE trash_path IS NOT NULL AND state IN ('trashed','purging') AND created<=? LIMIT 100",(now-RETENTION_SECONDS,))
        deleted=[]
        for row in rows:
            try:
                plan=self.rpc_storage_purge_preview([row['asset_id']])
                if not any(e['blocked'] for e in plan['entries']):
                    deleted+=self.rpc_storage_purge([row['asset_id']],plan['token'],True)['deleted']
            except (ValueError,OSError) as error:
                self.store.event('storage_cleanup','Retained '+row['asset_id']+': '+str(error))
        return dict(deleted=deleted)
