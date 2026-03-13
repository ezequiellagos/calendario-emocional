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