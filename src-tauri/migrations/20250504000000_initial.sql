-- Initial schema: library, snapshots, FTS5, chat

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS photos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    file_path TEXT NOT NULL,
    thumbnail_path TEXT,
    date_imported TEXT NOT NULL,
    tags TEXT NOT NULL DEFAULT '',
    ai_description TEXT NOT NULL DEFAULT '',
    exif_text TEXT NOT NULL DEFAULT ''
);

CREATE TABLE IF NOT EXISTS snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    photo_id INTEGER NOT NULL REFERENCES photos (id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    edit_state TEXT NOT NULL
);

CREATE VIRTUAL TABLE IF NOT EXISTS photos_fts USING fts5 (
    tags,
    ai_description,
    exif_text,
    content = 'photos',
    content_rowid = 'id'
);

CREATE TRIGGER IF NOT EXISTS photos_ai AFTER INSERT ON photos BEGIN
    INSERT INTO photos_fts (rowid, tags, ai_description, exif_text)
    VALUES (new.id, new.tags, new.ai_description, new.exif_text);
END;

CREATE TRIGGER IF NOT EXISTS photos_au AFTER UPDATE ON photos BEGIN
    INSERT INTO photos_fts (photos_fts, rowid, tags, ai_description, exif_text)
    VALUES ('delete', old.id, old.tags, old.ai_description, old.exif_text);
    INSERT INTO photos_fts (rowid, tags, ai_description, exif_text)
    VALUES (new.id, new.tags, new.ai_description, new.exif_text);
END;

CREATE TRIGGER IF NOT EXISTS photos_ad AFTER DELETE ON photos BEGIN
    INSERT INTO photos_fts (photos_fts, rowid, tags, ai_description, exif_text)
    VALUES ('delete', old.id, old.tags, old.ai_description, old.exif_text);
END;

CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    scope_kind TEXT NOT NULL CHECK (scope_kind IN ('workspace', 'photo')),
    scope_key TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    UNIQUE (scope_kind, scope_key)
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL REFERENCES conversations (id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id, created_at);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
