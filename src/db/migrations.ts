export const INITIAL_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS _migrations (
  id TEXT PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emotions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entries (
  date TEXT PRIMARY KEY,
  note TEXT NOT NULL DEFAULT '',
  primary_emotion_id INTEGER REFERENCES emotions(id) ON DELETE SET NULL,
  primary_color TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS entry_emotions (
  entry_date TEXT NOT NULL REFERENCES entries(date) ON DELETE CASCADE,
  emotion_id INTEGER NOT NULL REFERENCES emotions(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(entry_date, emotion_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_emotions_entry_date ON entry_emotions(entry_date);
CREATE INDEX IF NOT EXISTS idx_entry_emotions_emotion_id ON entry_emotions(emotion_id);
CREATE INDEX IF NOT EXISTS idx_entries_primary_emotion_id ON entries(primary_emotion_id);
`;

export const APP_MIGRATIONS = [
  {
    id: '0001_initial_schema',
    sql: INITIAL_SCHEMA_SQL,
  },
  {
    id: '0002_sync_incremental',
    sql: `
CREATE TABLE IF NOT EXISTS entry_deletions (
  entry_date TEXT PRIMARY KEY,
  deleted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS emotion_deletions (
  emotion_id INTEGER PRIMARY KEY,
  deleted_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_entry_deletions_deleted_at ON entry_deletions(deleted_at);
CREATE INDEX IF NOT EXISTS idx_emotion_deletions_deleted_at ON emotion_deletions(deleted_at);
`,
  },
  {
    id: '0003_mongo_local_first',
    sql: `
ALTER TABLE emotions ADD COLUMN sync_id TEXT;
UPDATE emotions SET sync_id = lower(hex(randomblob(16))) WHERE sync_id IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_emotions_sync_id ON emotions(sync_id);

CREATE TABLE IF NOT EXISTS sync_operations (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  entity_key TEXT NOT NULL,
  origin_instance_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,
  synced_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_sync_operations_pending ON sync_operations(origin_instance_id, synced_at, occurred_at);
CREATE INDEX IF NOT EXISTS idx_sync_operations_entity ON sync_operations(entity_type, entity_key, occurred_at);
`,
  },
  {
    id: '0004_system_sync_ids',
    sql: `
UPDATE emotions SET sync_id = 'system-' || slug WHERE is_system = 1;
`,
  },
];