-- Exact SQL scripts from tag v0.3.2 core/sonariel/store.py; synthetic test profiles only.

                PRAGMA journal_mode=WAL;
                CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY, value TEXT NOT NULL);
                CREATE TABLE IF NOT EXISTS projects(id TEXT PRIMARY KEY,name TEXT NOT NULL,context TEXT NOT NULL DEFAULT '',created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS assets(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),session_id TEXT REFERENCES sessions(id),job_id TEXT,path TEXT NOT NULL,name TEXT NOT NULL,kind TEXT NOT NULL,metadata TEXT NOT NULL,parent_id TEXT REFERENCES assets(id),favorite INTEGER NOT NULL DEFAULT 0,selected INTEGER NOT NULL DEFAULT 0,notes TEXT NOT NULL DEFAULT '',created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,request_key TEXT UNIQUE NOT NULL,project_id TEXT NOT NULL REFERENCES projects(id),session_id TEXT REFERENCES sessions(id),state TEXT NOT NULL,stage TEXT NOT NULL,params TEXT NOT NULL,remote_id TEXT,metrics TEXT NOT NULL DEFAULT '{}',error TEXT,created REAL NOT NULL,started REAL,finished REAL);
                CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT,time REAL NOT NULL,kind TEXT NOT NULL,message TEXT NOT NULL,job_id TEXT);
                CREATE TABLE IF NOT EXISTS edits(id TEXT PRIMARY KEY,asset_id TEXT NOT NULL REFERENCES assets(id),project_path TEXT NOT NULL,created REAL NOT NULL);


                CREATE TABLE IF NOT EXISTS fx_presets(id TEXT PRIMARY KEY,project_id TEXT REFERENCES projects(id),name TEXT NOT NULL,recipe TEXT NOT NULL,created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS voice_profiles(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES projects(id),name TEXT NOT NULL,language TEXT NOT NULL,reference_id TEXT REFERENCES assets(id),consent INTEGER NOT NULL,created REAL NOT NULL);
                CREATE TABLE IF NOT EXISTS asset_trash(asset_id TEXT PRIMARY KEY REFERENCES assets(id),original_path TEXT NOT NULL,trash_path TEXT,sha256 TEXT NOT NULL,state TEXT NOT NULL,created REAL NOT NULL);
                PRAGMA user_version=3;
