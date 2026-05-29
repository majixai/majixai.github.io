-- Migration 001: initialize core tables
-- Run once on any fresh .dat.gz or standalone SQLite database.

-- Artifact provenance
CREATE TABLE IF NOT EXISTS artifact_metadata (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    artifact_name TEXT    NOT NULL,
    sha256        TEXT    NOT NULL,
    written_at    TEXT    NOT NULL,
    metadata      TEXT    DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS ix_artifact_metadata_name
    ON artifact_metadata (artifact_name);

-- Per-ticker fetch records
CREATE TABLE IF NOT EXISTS fetch_record (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT    NOT NULL,
    interval    TEXT    NOT NULL,
    last_ts     TEXT,
    sha256      TEXT,
    metadata    TEXT    DEFAULT '{}',
    updated_at  TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fetch_record_ticker_interval
    ON fetch_record (ticker, interval);

-- Background job log
CREATE TABLE IF NOT EXISTS job (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_name    TEXT    NOT NULL,
    status      TEXT    NOT NULL DEFAULT 'pending',
    started_at  TEXT,
    finished_at TEXT,
    error       TEXT
);
