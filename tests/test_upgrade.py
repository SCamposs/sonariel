"""Release-boundary regressions using the actual distributed schema, not schema relabeling."""
import json
import sqlite3
import subprocess
import sys
import time
from pathlib import Path

import pytest

from sonariel.service import Service
from sonariel.store import Store


def legacy_profile(home):
    home.mkdir()
    db = sqlite3.connect(home / "sonariel.sqlite3")
    db.executescript((Path(__file__).parent / 'fixtures/v0_3_2_schema.sql').read_text())
    db.execute("INSERT INTO projects VALUES('p','Preserved project','Private context',1)")
    db.execute("INSERT INTO sessions VALUES('s','p','Session',2)")
    db.execute("INSERT INTO assets VALUES('a','p','s',NULL,'synthetic.wav','Original','imported','{}',NULL,1,1,'Keep',3)")
    db.execute("INSERT INTO assets VALUES('b','p','s',NULL,'derived.wav','Derived','fx','{}','a',0,0,'',4)")
    db.execute("INSERT INTO voice_profiles VALUES('v','p','Voice','sw','a',1,5)")
    db.execute("INSERT INTO fx_presets VALUES('f','p','Gain','{}',6)")
    db.execute("INSERT INTO edits VALUES('e','b','synthetic.aup3',7)")
    for key, value in {'preferences': {'idle_minutes':17}, 'selected_project':'p',
                       'unrelated':{'keep':True}}.items():
        db.execute('INSERT INTO settings VALUES(?,?)', (key,json.dumps(value)))
    for index, (state, remote) in enumerate([('queued',None),('generating','remote-1'),('submitted',None)]):
        db.execute('INSERT INTO jobs VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)',
                   (f'j{index}',f'key{index}','p','s',state,'Previous stage','{}',remote,'{}',None,8,None,None))
    db.commit()
    return db


def snapshot(db):
    tables = [r[0] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name")]
    return {name: [tuple(row) for row in db.execute(f'SELECT * FROM "{name}" ORDER BY rowid')] for name in tables}


def test_actual_schema3_upgrade_preserves_rows_wal_backup_and_recovery(tmp_path):
    home = tmp_path/'profile'
    writer = legacy_profile(home)  # Keep a live WAL connection, never copy its open database file.
    before = snapshot(writer)
    store = Store(home)
    backups = list((home/'backups').glob('pre-schema5-*.sqlite3'))
    assert len(backups) == 1
    with sqlite3.connect(backups[0]) as backup:
        assert backup.execute('PRAGMA user_version').fetchone()[0] == 3
        assert snapshot(backup) == before
        assert backup.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
    with store.connect() as db:
        after = snapshot(db)
        for name, rows in before.items():
            if name == 'settings':
                assert all(row in after[name] for row in rows)
            else:
                assert after[name] == rows
        assert db.execute('PRAGMA foreign_key_check').fetchall() == []
    assert store.setting('ui_preferences') == {'locale':None,'existing_installation':True}
    service = Service(store,start_worker=False)
    service.recover()
    assert store.job('j0')['state'] == 'queued'
    assert store.job('j1')['state'] == 'queued' and store.job('j1')['remote_id'] == 'remote-1'
    assert store.job('j2')['state'] == 'interrupted'
    service.invoke('ui_preferences_save',{'locale':'en'})
    assert Store(home).setting('ui_preferences')['locale'] == 'en'
    assert len(list((home/'backups').glob('pre-schema5-*.sqlite3'))) == 1
    writer.close()


@pytest.mark.parametrize('failure', ['table','preference'])
def test_failed_upgrade_rolls_back_schema_version_and_rows_before_retry(tmp_path, failure):
    home = tmp_path/'profile'
    writer = legacy_profile(home)
    before = snapshot(writer)
    writer.close()

    class FaultStore(Store):
        def connect(self):
            db = super().connect()
            def authorize(action, name, *_):
                fail_table = failure == 'table' and action == sqlite3.SQLITE_CREATE_TABLE and name == 'library_filters'
                fail_pref = failure == 'preference' and action == sqlite3.SQLITE_INSERT and name == 'settings'
                return sqlite3.SQLITE_DENY if fail_table or fail_pref else sqlite3.SQLITE_OK
            db.set_authorizer(authorize)
            return db

    with pytest.raises(sqlite3.DatabaseError):
        FaultStore(home)
    with sqlite3.connect(home/'sonariel.sqlite3') as db:
        assert db.execute('PRAGMA user_version').fetchone()[0] == 3
        assert snapshot(db) == before
    assert Store(home).setting('ui_preferences')['existing_installation']


def test_newer_schema_is_rejected_without_database_changes(tmp_path):
    store = Store(tmp_path/'profile')
    store.execute('PRAGMA user_version=6')
    with sqlite3.connect(store.path) as db:
        before = snapshot(db)
    with pytest.raises(ValueError,match='mais nova'):
        Store(store.home)
    with sqlite3.connect(store.path) as db:
        assert db.execute('PRAGMA user_version').fetchone()[0] == 6
        assert snapshot(db) == before


def test_process_loss_during_upgrade_leaves_legacy_profile_recoverable(tmp_path):
    home = tmp_path/'profile'
    writer = legacy_profile(home)
    before = snapshot(writer)
    writer.close()
    marker = tmp_path/'transaction-reached'
    script = '''
import sys, time
from pathlib import Path
from sonariel.store import Store
class PausedStore(Store):
    def connect(self):
        db = super().connect()
        def trace(sql):
            if sql.startswith("INSERT OR IGNORE INTO settings"):
                Path(sys.argv[2]).write_text("uncommitted schema marker reached")
                time.sleep(30)
        db.set_trace_callback(trace)
        return db
PausedStore(Path(sys.argv[1]))
'''
    child = subprocess.Popen([sys.executable,'-c',script,str(home),str(marker)],
                             stdout=subprocess.PIPE,stderr=subprocess.PIPE)
    try:
        deadline = time.monotonic()+10
        while not marker.exists() and child.poll() is None and time.monotonic()<deadline:
            time.sleep(.02)
        assert marker.exists(), 'Child did not reach the uncommitted migration checkpoint'
    finally:
        if child.poll() is None:
            child.kill()  # Only this test-owned child, simulating process loss.
        child.communicate(timeout=10)
    with sqlite3.connect(home/'sonariel.sqlite3') as db:
        assert db.execute('PRAGMA integrity_check').fetchone()[0] == 'ok'
        assert db.execute('PRAGMA user_version').fetchone()[0] == 3
        assert snapshot(db) == before
    assert Store(home).setting('ui_preferences')['existing_installation']
