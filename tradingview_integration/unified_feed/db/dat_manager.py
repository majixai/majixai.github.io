"""dat_manager — gzipped SQLite .dat.gz database manager.

Each .dat.gz file is a gzip-compressed SQLite database that stores
fetch-summary rows keyed by (ticker, interval).  The manager supports:

  * Atomic writes  — the database file is written to a .tmp sibling then
    renamed so readers never see a partial write.
  * Date-based rotation — a new file is started each calendar day (UTC) or
    when the file exceeds a configurable size limit.
  * Size-based rotation — configurable via ``DAT_MAX_BYTES`` env var
    (default 50 MB).

Environment variables
---------------------
DAT_MAX_BYTES   Max file size in bytes before rotation (default 52_428_800 = 50 MB)
DAT_ROTATE_DAILY  "1" to rotate on date change (default "1")

Public API
----------
DatabaseManager(base_dir)
    Initialise the manager with a directory for .dat.gz files.

open_dat(path=None)
    Explicitly open / switch to a specific .dat.gz path.

append_summary(ticker, interval, last_ts, sha256, metadata)
    Insert or update a row in the current .dat.gz.

query_summaries(filter=None)
    Return a list of row dicts matching the optional *filter* dict
    (keys: ticker, interval, date).

close()
    Flush and close the active connection.
"""

from __future__ import annotations

import gzip
import logging
import os
import shutil
import sqlite3
import tempfile
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

_DAT_MAX_BYTES    = int(os.environ.get("DAT_MAX_BYTES",    52_428_800))  # 50 MB
_DAT_ROTATE_DAILY = os.environ.get("DAT_ROTATE_DAILY", "1") == "1"

# Schema DDL (also used in migrations)
_DDL = """
CREATE TABLE IF NOT EXISTS fetch_record (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT    NOT NULL,
    interval    TEXT    NOT NULL,
    last_ts     TEXT,
    sha256      TEXT,
    metadata    TEXT,
    updated_at  TEXT    NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_fetch_record_ticker_interval
    ON fetch_record (ticker, interval);
"""


class DatabaseManager:
    """Thread-safe manager for a single active .dat.gz database."""

    def __init__(self, base_dir: str | Path) -> None:
        self._base_dir = Path(base_dir)
        self._base_dir.mkdir(parents=True, exist_ok=True)
        self._lock     = threading.Lock()
        self._tmp_path: Path | None = None   # writable temp sqlite file
        self._con:      sqlite3.Connection | None = None
        self._dat_path: Path | None = None   # target .dat.gz path
        self._open_date: str | None = None   # UTC date string of current db

        self._ensure_open()

    # ------------------------------------------------------------------
    # Public interface
    # ------------------------------------------------------------------

    def open_dat(self, path: str | Path | None = None) -> None:
        """Open a specific .dat.gz file, flushing any active db first."""
        with self._lock:
            self._flush()
            if path is not None:
                self._dat_path = Path(path)
            self._load_or_init()

    def append_summary(
        self,
        ticker:   str,
        interval: str,
        last_ts:  str | None = None,
        sha256:   str | None = None,
        metadata: dict[str, Any] | None = None,
    ) -> None:
        """Upsert a fetch-summary row.

        Parameters
        ----------
        ticker:    Upper-case ticker symbol, e.g. ``"AAPL"``.
        interval:  Bar interval string, e.g. ``"1d"``.
        last_ts:   ISO-8601 timestamp of the last fetched bar.
        sha256:    SHA-256 hex digest of the cached parquet/CSV artifact.
        metadata:  Arbitrary JSON-serialisable dict stored as TEXT.
        """
        import json as _json

        with self._lock:
            self._ensure_open()
            updated_at = datetime.now(timezone.utc).isoformat()
            meta_json  = _json.dumps(metadata or {})
            self._con.execute(  # type: ignore[union-attr]
                """
                INSERT INTO fetch_record (ticker, interval, last_ts, sha256, metadata, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
                ON CONFLICT(ticker, interval) DO UPDATE SET
                    last_ts    = excluded.last_ts,
                    sha256     = excluded.sha256,
                    metadata   = excluded.metadata,
                    updated_at = excluded.updated_at
                """,
                (ticker.upper(), interval, last_ts, sha256, meta_json, updated_at),
            )
            self._con.commit()  # type: ignore[union-attr]
            self._rotate_if_needed()

    def query_summaries(self, filter: dict[str, Any] | None = None) -> list[dict]:
        """Return rows from fetch_record matching *filter*.

        *filter* may contain any subset of keys: ``ticker``, ``interval``,
        ``date`` (prefix match on updated_at).  An empty or None filter
        returns all rows.
        """
        import json as _json

        filter = filter or {}
        clauses: list[str] = []
        params:  list[Any] = []

        if "ticker" in filter:
            clauses.append("upper(ticker) = upper(?)")
            params.append(filter["ticker"])
        if "interval" in filter:
            clauses.append("interval = ?")
            params.append(filter["interval"])
        if "date" in filter:
            clauses.append("updated_at LIKE ?")
            params.append(filter["date"] + "%")

        where = ("WHERE " + " AND ".join(clauses)) if clauses else ""
        sql   = f"SELECT ticker, interval, last_ts, sha256, metadata, updated_at FROM fetch_record {where} ORDER BY updated_at DESC"

        with self._lock:
            self._ensure_open()
            cur = self._con.execute(sql, params)  # type: ignore[union-attr]
            cols = [d[0] for d in cur.description]
            rows = []
            for row in cur.fetchall():
                d = dict(zip(cols, row))
                try:
                    d["metadata"] = _json.loads(d["metadata"] or "{}")
                except Exception:
                    pass
                rows.append(d)
        return rows

    def close(self) -> None:
        """Flush and close the active connection."""
        with self._lock:
            self._flush()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _current_dat_path(self) -> Path:
        date_str = datetime.now(timezone.utc).strftime("%Y%m%d")
        return self._base_dir / f"feed_{date_str}.dat.gz"

    def _ensure_open(self) -> None:
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        if self._con is not None and self._open_date == today:
            return
        # Date rolled over or first open
        if self._con is not None:
            self._flush()
        self._dat_path  = self._dat_path or self._current_dat_path()
        self._open_date = today
        self._load_or_init()

    def _load_or_init(self) -> None:
        """Decompress existing .dat.gz into a temp file, or start fresh."""
        fd, tmp = tempfile.mkstemp(suffix=".db", prefix="dat_mgr_")
        os.close(fd)
        self._tmp_path = Path(tmp)

        if self._dat_path and self._dat_path.exists():
            try:
                with gzip.open(self._dat_path, "rb") as gz:
                    self._tmp_path.write_bytes(gz.read())
                log.debug("dat_manager: loaded %s", self._dat_path.name)
            except Exception as exc:
                log.warning("dat_manager: could not read %s: %s — starting fresh", self._dat_path, exc)
                self._tmp_path.write_bytes(b"")

        self._con = sqlite3.connect(str(self._tmp_path))
        self._con.executescript(_DDL)
        self._con.commit()

    def _flush(self) -> None:
        """Compress in-memory sqlite back to .dat.gz atomically."""
        if self._con is None or self._tmp_path is None or self._dat_path is None:
            return
        try:
            self._con.commit()
            self._con.close()
        except Exception:
            pass
        self._con = None

        try:
            raw = self._tmp_path.read_bytes()
            tmp_gz = self._dat_path.with_suffix(".dat.gz.tmp")
            with gzip.open(tmp_gz, "wb", compresslevel=6) as gz:
                gz.write(raw)
            os.replace(tmp_gz, self._dat_path)
            log.debug("dat_manager: flushed %s (%d bytes)", self._dat_path.name, self._dat_path.stat().st_size)
        except Exception as exc:
            log.error("dat_manager: flush failed: %s", exc)
        finally:
            try:
                self._tmp_path.unlink(missing_ok=True)
            except Exception:
                pass
            self._tmp_path = None

    def _rotate_if_needed(self) -> None:
        """Rotate to a new file if size or date limit is exceeded."""
        today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        size_exceeded = (
            self._dat_path is not None
            and self._dat_path.exists()
            and self._dat_path.stat().st_size > _DAT_MAX_BYTES
        )
        date_rolled = _DAT_ROTATE_DAILY and (self._open_date != today)

        if size_exceeded or date_rolled:
            log.info(
                "dat_manager: rotating (size_exceeded=%s, date_rolled=%s)",
                size_exceeded, date_rolled,
            )
            self._flush()
            self._dat_path  = self._current_dat_path()
            self._open_date = today
            self._load_or_init()

    def __del__(self) -> None:
        try:
            self.close()
        except Exception:
            pass
