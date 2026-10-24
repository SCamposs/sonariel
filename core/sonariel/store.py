from __future__ import annotations

import json
import os
import sqlite3
import time
import uuid
from pathlib import Path


def data_home() -> Path:
    # A Windows Store Python can virtualize LOCALAPPDATA. Derive the same path
    # for development Python, the packaged core and every MCP client.
    default = Path.home() / ".sonariel"
    return Path(os.environ.get("SONARIEL_HOME", str(default))).resolve()


def identifier() -> str:
    return uuid.uuid4().hex


class Store:
    def __init__(self, home: Path | None = None):
        self.home = home or data_home()
        self.home.mkdir(parents=True, exist_ok=True)
        for name in ("output", "logs", "run", "backups", "cache"):
            (self.home / name).mkdir(exist_ok=True)
        self.path = self.home / "sonariel.sqlite3"
        with self.connect() as db:
            if db.execute("PRAGMA user_version").fetchone()[0] > 2:
                raise ValueError("Banco criado por versão mais nova do Sonariel; não será alterado")
            db.executescript('''
                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,context TEXT NOT NULL DEFAULT '',created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),session_id TEXT REFERENCES sessions(id),job_id TEXT,path TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,metadata TEXT NOT NULL,parent_id TEXT REFERENCES assets(id),favorite INTEGER NOT NULL DEFAULT 0,selected INTEGER NOT NULL DEFAULT 0,notes TEXT NOT NULL DEFAULT '',created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,project_id TEXT NOT NULL REFERENCES projects(id),session_id TEXT REFERENCES sessions(id),state TEXT NOT NULL,stage TEXT NOT NULL,params TEXT NOT NULL,remote_id TEXT,metrics TEXT NOT NULL DEFAULT '{}',error TEXT,created REAL NOT NULL,started REAL,finished REAL);
                CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,time REAL NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,job_id TEXT);
                CREATE TABLE IF NOT EXISTS edits(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES assets(id),project_path TEXT NOT NULL,created REAL NOT NULL);
            ''')
            version = db.execute("PRAGMA user_version").fetchone()[0]
            if version > 2:
                raise ValueError("Banco criado por versão mais nova do Sonariel; não será alterado")
            db.executescript('''
                CREATE TABLE IF NOT EXISTS fx_presets(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),name TEXT NOT NULL,recipe TEXT NOT NULL,created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS voice_profiles(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,language TEXT NOT NULL,reference_id TEXT REFERENCES assets(id),consent INTEGER NOT NULL,created REAL NOT NULL);
                PRAGMA user_version=2;
            ''')

    def connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.path, timeout=20)
        db.row_factory = sqlite3.Row
        db.execute("PRAGMA foreign_keys=ON")
        return db

    def rows(self, sql: str, args: tuple = ()) -> list[dict]:
        with self.connect() as db:
            rows = [dict(row) for row in db.execute(sql, args)]
        for row in rows:
            for key in ("params", "metadata", "metrics", "recipe"):
                if key in row:
                    row[key] = json.loads(row[key])
        return rows

    def execute(self, sql: str, args: tuple = ()) -> None:
        with self.connect() as db:
            db.execute(sql, args)

    def setting(self, key: str, default=None):
        rows = self.rows("SELECT value FROM settings WHERE key=?", (key,))
        return json.loads(rows[0]["value"]) if rows else default

    def set(self, key: str, value) -> None:
        self.execute("INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", (key, json.dumps(value)))

    def event(self, kind: str, message: str, job_id: str | None = None) -> None:
        self.execute("INSERT INTO events(time,kind,message,job_id) VALUES(?,?,?,?)", (time.time(), kind, message, job_id))

    def job(self, job_id: str) -> dict:
        rows = self.rows("SELECT * FROM jobs WHERE id=?", (job_id,))
        if not rows:
            raise ValueError("Tarefa não encontrada")
        return rows[0]

    def asset(self, asset_id: str) -> dict:
        rows = self.rows("SELECT * FROM assets WHERE id=?", (asset_id,))
        if not rows:
            raise ValueError("Áudio não encontrado")
        return rows[0]
