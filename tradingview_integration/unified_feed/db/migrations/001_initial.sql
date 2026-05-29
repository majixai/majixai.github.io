-- Migration 001: Initial schema for unified_feed artifact tracking
-- Run this file against any new SQLite database to create the base tables.

CREATE TABLE IF NOT EXISTS artifact_metadata (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_name   TEXT    NOT NULL,
    artifact_path   TEXT    NOT NULL,
    sha256          TEXT    NOT NULL,
    filename_sha256 TEXT    NOT NULL,
    extra           TEXT,                -- JSON blob of additional metadata
    created_at      INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_am_artifact_name ON artifact_metadata (artifact_name);
CREATE INDEX IF NOT EXISTS idx_am_sha256        ON artifact_metadata (sha256);

CREATE TABLE IF NOT EXISTS fetch_record (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT    NOT NULL,
    interval    TEXT    NOT NULL,
    last_ts     INTEGER NOT NULL,
    sha256      TEXT    NOT NULL,
    filename_sha256 TEXT,
    status      TEXT    NOT NULL DEFAULT 'ok',  -- ok | error | skipped
    error_msg   TEXT,
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_fr_ticker   ON fetch_record (ticker);
CREATE INDEX IF NOT EXISTS idx_fr_interval ON fetch_record (interval);
CREATE INDEX IF NOT EXISTS idx_fr_last_ts  ON fetch_record (last_ts);

CREATE TABLE IF NOT EXISTS job (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_type    TEXT    NOT NULL,           -- fetch_batch | process | manifest
    status      TEXT    NOT NULL DEFAULT 'pending',
    started_at  INTEGER,
    finished_at INTEGER,
    error_msg   TEXT,
    meta        TEXT,                       -- JSON blob
    created_at  INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX IF NOT EXISTS idx_job_status ON job (status);
