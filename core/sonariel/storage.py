"""Registered-audio inventory and recoverable, explicitly confirmed discard.

No recursive deletion, no external-file deletion, no automatic cleanup. A durable
journal is written before a managed WAV is moved, so interrupted moves can be restored.
"""
from __future__ import annotations

import hashlib
import json
import time
from pathlib import Path

from .environment import sha256


class Storage:
    def _storage_idle(self):
        if self.active or self.local.owned() or self.store.rows(
            "SELECT id FROM jobs WHERE state IN ('queued','loading','submitted','generating') "
            "OR (state='interrupted' AND remote_id IS NOT NULL)"
        ):
            raise ValueError("Aguarde a fila antes de descartar ou restaurar arquivos")

    def _storage_owned(self, asset):
        path = Path(asset['path'])
        root = self.store.home / 'output'
        # Only direct, application-generated output; imports and symlinks stay protected.
        return (asset['kind'] in {'generated', 'export', 'preview', 'voice', 'processed'}
                and path.suffix.lower() == '.wav' and not path.is_symlink()
                and not root.is_symlink() and root.resolve() == self.store.home.resolve() / 'output'
                and path.parent.resolve() == root.resolve())

    def rpc_storage_list(self, project_id: str | None = None):
        if project_id:
            self.require_project(project_id)
        assets = self.store.rows('SELECT * FROM assets' + (' WHERE project_id=?' if project_id else '')
                                 + ' ORDER BY created DESC', (project_id,) if project_id else ())
        trash = {r['asset_id']: r for r in self.store.rows('SELECT * FROM asset_trash')}
        result = []
        for asset in assets:
            journal = trash.get(asset['id'])
            path = Path(journal['trash_path'] if journal and journal['trash_path'] else asset['path'])
            try:
                size = path.stat().st_size if path.is_file() else 0
            except OSError:
                size = 0
            result.append(dict(id=asset['id'], project_id=asset['project_id'], name=asset['name'],
                path=asset['path'], kind=asset['kind'], favorite=bool(asset['favorite']),
                selected=bool(asset['selected']), managed=self._storage_owned(asset),
                bytes=size, exists=path.is_file(), trashed=bool(journal),
                trash_path=journal['trash_path'] if journal else None,
                state=journal['state'] if journal else 'available'))
        return dict(items=result, data_home=str(self.store.home),
                    note='Somente arquivos catalogados. Referências e arquivos externos não são apagados. Lixeira recuperável não libera espaço em disco.')

    def rpc_storage_preview(self, asset_ids: list[str]):
        entries = []
        for key in asset_ids:
            asset = self.store.asset(key)
            path = Path(asset['path'])
            reason = None
            if asset['kind'] == 'reference':
                reason = 'Referência protegida'
            elif asset['favorite'] or asset['selected']:
                reason = 'Favorita/escolhida: remova a marca antes de descartar'
            elif self.store.rows('SELECT id FROM assets WHERE parent_id=?', (key,)):
                reason = 'Usada como origem de outra versão'
            elif self.store.rows('SELECT id FROM voice_profiles WHERE reference_id=?', (key,)):
                reason = 'Usada por um perfil vocal'
            elif self.store.rows('SELECT id FROM edits WHERE asset_id=?', (key,)):
                reason = 'Possui edição Audacity registrada'
            elif not path.is_file():
                reason = 'Arquivo ausente: restaure o original antes de descartar'
            managed = self._storage_owned(asset)
            if managed and any(Path(row['path']).resolve() == path.resolve() for row in
                self.store.rows('SELECT path FROM assets WHERE id!=?', (key,))):
                reason = 'Arquivo compartilhado com outro registro'
            digest = sha256(path) if path.is_file() else None
            if digest != asset['metadata']['sha256']:
                reason = 'Arquivo alterado desde o registro'
            entries.append(dict(id=key, name=asset['name'], path=asset['path'],
                bytes=path.stat().st_size if path.is_file() else 0,
                sha256=digest, action='move_to_trash' if managed else 'hide_record', blocked=reason))
        token = hashlib.sha256(json.dumps(entries, sort_keys=True).encode()).hexdigest()
        return dict(entries=entries, token=token,
                    managed_bytes=sum(e['bytes'] for e in entries if e['action']=='move_to_trash' and not e['blocked']),
                    reclaimed_bytes=0)

    def rpc_storage_discard(self, asset_ids: list[str], preview_token: str, confirmed: bool):
        if not confirmed:
            raise ValueError('Confirme a prévia antes de descartar')
        self._storage_idle()
        plan = self.rpc_storage_preview(asset_ids)
        if plan['token'] != preview_token or any(e['blocked'] for e in plan['entries']):
            raise ValueError('Prévia alterada ou seleção protegida; revise novamente')
        root = self.store.home / 'trash'
        root.mkdir(exist_ok=True)
        if root.is_symlink() or root.resolve().parent != self.store.home.resolve():
            raise ValueError('Pasta da lixeira não é um diretório próprio seguro')
        completed = []
        for entry in plan['entries']:
            source = Path(entry['path'])
            target = root / (entry['id'] + '.wav') if entry['action'] == 'move_to_trash' else None
            if target and target.exists():
                raise ValueError('Destino da lixeira ocupado; nenhum arquivo será sobrescrito')
            # The journal survives a crash between either filesystem/SQLite operation.
            self.store.execute('INSERT INTO asset_trash VALUES(?,?,?,?,?,?)',
                (entry['id'], entry['path'], str(target) if target else None,
                 entry['sha256'], 'preparing', time.time()))
            if target:
                if source.is_symlink() or sha256(source) != entry['sha256']:
                    raise ValueError('Origem mudou; restaure o registro pela lixeira')
                source.rename(target)
            self.store.execute("UPDATE asset_trash SET state='trashed' WHERE asset_id=?", (entry['id'],))
            completed.append(entry['id'])
            self.store.event('storage', 'Registro descartado de forma recuperável: ' + entry['id'])
        return dict(discarded=completed, reclaimed_bytes=0)

    def rpc_storage_restore(self, asset_id: str):
        self._storage_idle()
        rows = self.store.rows('SELECT * FROM asset_trash WHERE asset_id=?', (asset_id,))
        if not rows:
            raise ValueError('Registro não está na lixeira')
        journal = rows[0]
        source = Path(journal['original_path'])
        target = Path(journal['trash_path']) if journal['trash_path'] else None
        if target:
            root = self.store.home / 'trash'
            if (root.is_symlink() or target.is_symlink() or source.is_symlink()
                or target.parent.resolve() != root.resolve()
                or source.parent.resolve() != (self.store.home/'output').resolve()
                or (self.store.home/'output').resolve() != self.store.home.resolve()/'output'
                or (self.store.home/'output').is_symlink()):
                raise ValueError('Caminhos de recuperação inválidos')
            if target.exists():
                if source.exists():
                    raise ValueError('Destino original ocupado; nada foi sobrescrito')
                if sha256(target) != journal['sha256']:
                    raise ValueError('Arquivo da lixeira foi alterado')
                target.rename(source)
        if not source.is_file() or sha256(source) != journal['sha256']:
            raise ValueError('Original ausente ou alterado; registro permanece recuperável')
        self.store.execute('DELETE FROM asset_trash WHERE asset_id=?', (asset_id,))
        self.store.event('storage', 'Registro restaurado: ' + asset_id)
        return dict(restored=asset_id)


def storage_methods(tool, ID, B):
    ids = dict(type='array', items=ID, minItems=1, maxItems=100, uniqueItems=True)
    return {
        'storage_list': tool('Inventário central dos áudios catalogados, caminhos, tamanho e lixeira; não varre nem move arquivos.', dict(project_id=ID)),
        'storage_preview': tool('Prévia obrigatória de descarte recuperável. Referências, favoritas, escolhidas e dependências são protegidas.', dict(asset_ids=ids), ['asset_ids']),
        'storage_discard': tool('Após escolha explícita: mover WAVs próprios à lixeira; externos apenas ocultam registro. Não libera espaço nem apaga permanentemente.', dict(asset_ids=ids, preview_token=dict(type='string',pattern='^[a-f0-9]{64}$'),confirmed=B), ['asset_ids','preview_token','confirmed']),
        'storage_restore': tool('Restaurar um registro/arquivo da lixeira sem sobrescrever destinos.',dict(asset_id=ID),['asset_id']),
    }
