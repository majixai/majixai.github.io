"""Gzipped-SQLite .dat.gz database manager for unified_feed.

``DatabaseManager`` wraps a SQLite database that is kept on disk as a
gzip-compressed ``.dat.gz`` file.  All writes are performed atomically
(write-to-temp-then-rename) to avoid corruption on crash.  Rotation is
supported by date and/or file size.

By default the database is stored under the repository-root ``dbs/``
directory so it is immediately visible to the ``dbs/monitor.js`` file
watcher.  The ``dbs/files.json`` manifest is kept in sync automatically
after every write.

Usage::

    # Default — stored in <repo_root>/dbs/cache.dat.gz
    dm = DatabaseManager("cache.dat.gz")
    dm.open_dat()
    dm.append_summary("SPY", "1m", last_ts=1700000000, sha256="abc…", metadata={})
    rows = dm.query_summaries({"ticker": "SPY"})
    dm.close()

    # Explicit path
    dm = DatabaseManager("/data/feed.dat.gz")
"""

import gzip
import json
import logging
import os
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

# Repository root — three levels up from this file:
# tradingview_integration/unified_feed/db/dat_manager.py
_REPO_ROOT = Path(__file__).resolve().parents[4]

# Default storage directory (repo_root/dbs/) — matches the dbs/ monitor
_DEFAULT_DBS_DIR = _REPO_ROOT / "dbs"

# Manifest kept in sync by DatabaseManager
_FILES_JSON = _DEFAULT_DBS_DIR / "files.json"

# Maximum uncompressed DB size before automatic rotation (bytes)
DEFAULT_MAX_SIZE_BYTES = 50 * 1024 * 1024  # 50 MB

# SQL used to initialise a fresh database
_INIT_SQL = """
CREATE TABLE IF NOT EXISTS fetch_summary (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    ticker      TEXT    NOT NULL,
    interval    TEXT    NOT NULL,
    last_ts     INTEGER NOT NULL,
    sha256      TEXT    NOT NULL,
    filename_sha256 TEXT,
    metadata    TEXT,
    created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_fs_ticker   ON fetch_summary (ticker);
CREATE INDEX IF NOT EXISTS idx_fs_interval ON fetch_summary (interval);
CREATE INDEX IF NOT EXISTS idx_fs_last_ts  ON fetch_summary (last_ts);
"""


def _update_dbs_manifest(dbs_dir: Path) -> None:
    """Atomically rewrite ``dbs/files.json`` to list every file in *dbs_dir*.

    The manifest is read by ``dbs/monitor.js`` to display ``.dat`` /
    ``.dat.gz`` files.  The update is atomic (write-to-temp-then-rename) to
    avoid leaving a corrupt manifest visible to readers.

    Args:
        dbs_dir: Path to the repository-root ``dbs/`` directory.
    """
    if not dbs_dir.is_dir():
        return
    files = sorted(
        entry.name
        for entry in dbs_dir.iterdir()
        if entry.is_file() and entry.name != "files.json"
    )
    manifest_path = dbs_dir / "files.json"
    tmp_path = manifest_path.with_suffix(".tmp.json")
    tmp_path.write_text(json.dumps(files, indent=2) + "\n", encoding="utf-8")
    tmp_path.replace(manifest_path)
    log.debug("updated dbs/files.json (%d entries)", len(files))


class DatabaseManager:
    """Manages a gzip-compressed SQLite ``.dat.gz`` file.

    The live SQLite file is kept in a temporary location while open; it is
    re-compressed and written atomically to *dat_path* on :meth:`close` (or
    after every :meth:`append_summary` call for durability).

    When *dat_path* is a bare filename (no directory component) it is resolved
    relative to the repository-root ``dbs/`` directory so the file is
    immediately visible to ``dbs/monitor.js``.  The ``dbs/files.json``
    manifest is updated atomically after every flush whenever the file lives
    inside the ``dbs/`` directory.

    Args:
        dat_path: Path to the ``.dat.gz`` file (created if absent).
                  A bare filename is resolved to ``<repo_root>/dbs/<name>``.
        max_size_bytes: Uncompressed size threshold that triggers rotation.
    """

    def __init__(
        self,
        dat_path: Any,
        max_size_bytes: int = DEFAULT_MAX_SIZE_BYTES,
    ) -> None:
        p = Path(dat_path)
        # Bare filename → place in the default dbs/ directory
        if not p.is_absolute() and p.parent == Path("."):
            p = _DEFAULT_DBS_DIR / p
        self._dat_path = p
        self._max_size_bytes = max_size_bytes
        self._tmp_db: Optional[str] = None
        self._con: Optional[sqlite3.Connection] = None

    # ── Lifecycle ────────────────────────────────────────────────────────────

    def open_dat(self) -> None:
        """Decompress the .dat.gz file into a temp SQLite DB and open it.

        If the .dat.gz file does not exist a fresh database is created.
        """
        fd, tmp = tempfile.mkstemp(suffix=".db", prefix="uf_dm_")
        os.close(fd)
        self._tmp_db = tmp

        if self._dat_path.exists():
            try:
                with gzip.open(self._dat_path, "rb") as gz:
                    raw = gz.read()
                with open(self._tmp_db, "wb") as fh:
                    fh.write(raw)
                log.debug("decompressed %s → %s (%d bytes)",
                          self._dat_path.name, self._tmp_db, len(raw))
            except Exception as exc:
                log.warning("could not read %s, starting fresh: %s",
                            self._dat_path, exc)
                open(self._tmp_db, "wb").close()

        self._con = sqlite3.connect(self._tmp_db)
        self._con.execute("PRAGMA journal_mode=WAL")
        self._con.executescript(_INIT_SQL)
        self._con.commit()

    def close(self) -> None:
        """Flush and re-compress the temp DB back to the .dat.gz file."""
        if self._con is not None:
            self._con.close()
            self._con = None
        if self._tmp_db is not None:
            self._flush_to_dat()
            try:
                os.unlink(self._tmp_db)
            except OSError:
                pass
            self._tmp_db = None

    def __enter__(self) -> "DatabaseManager":
        self.open_dat()
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ── Public API ────────────────────────────────────────────────────────────

    def append_summary(
        self,
        ticker: str,
        interval: str,
        last_ts: int,
        sha256: str,
        metadata: Optional[Dict[str, Any]] = None,
        filename_sha256: Optional[str] = None,
    ) -> int:
        """Insert a fetch-summary row and flush to disk atomically.

        Args:
            ticker: Instrument symbol (e.g. ``"SPY"``).
            interval: Candle interval (e.g. ``"1m"``, ``"1h"``).
            last_ts: Unix timestamp of the most recent bar.
            sha256: SHA-256 hex digest of the parquet/data file content.
            metadata: Optional arbitrary dict stored as JSON.
            filename_sha256: Optional SHA-256 of the filename (see
                :func:`~.utils.sha256_provenance.sha256_of_filename`).

        Returns:
            ``lastrowid`` of the inserted row.
        """
        self._ensure_open()
        assert self._con is not None

        cur = self._con.execute(
            "INSERT INTO fetch_summary "
            "(ticker, interval, last_ts, sha256, filename_sha256, metadata, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (
                ticker.upper(),
                interval,
                int(last_ts),
                sha256,
                filename_sha256,
                json.dumps(metadata) if metadata else None,
                int(time.time()),
            ),
        )
        self._con.commit()
        rowid: int = cur.lastrowid  # type: ignore[assignment]

        # Check rotation threshold
        db_size = os.path.getsize(self._tmp_db) if self._tmp_db else 0
        if db_size >= self._max_size_bytes:
            log.info("DB size %d ≥ %d — rotating", db_size, self._max_size_bytes)
            self._rotate()

        self._flush_to_dat()
        return rowid

    def query_summaries(
        self,
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        """Query fetch-summary rows with optional equality filters.

        Args:
            filters: Dict of column→value equality constraints.  Supported
                     columns: ``ticker``, ``interval``, ``sha256``,
                     ``filename_sha256``.
            limit: Maximum number of rows to return (most recent first).

        Returns:
            List of row dicts with keys matching the ``fetch_summary`` schema.
        """
        self._ensure_open()
        assert self._con is not None

        where_clauses: List[str] = []
        params: List[Any] = []
        allowed = {"ticker", "interval", "sha256", "filename_sha256"}

        for col, val in (filters or {}).items():
            if col in allowed:
                # ticker is stored upper-case
                clause_val = val.upper() if col == "ticker" else val
                where_clauses.append(f"{col} = ?")
                params.append(clause_val)

        sql = "SELECT * FROM fetch_summary"
        if where_clauses:
            sql += " WHERE " + " AND ".join(where_clauses)
        sql += " ORDER BY created_at DESC LIMIT ?"
        params.append(limit)

        self._con.row_factory = sqlite3.Row
        rows = self._con.execute(sql, params).fetchall()
        self._con.row_factory = None

        results = []
        for row in rows:
            d = dict(row)
            if d.get("metadata"):
                try:
                    d["metadata"] = json.loads(d["metadata"])
                except Exception:
                    pass
            results.append(d)
        return results

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _ensure_open(self) -> None:
        if self._con is None:
            raise RuntimeError("DatabaseManager is not open — call open_dat() first")

    def _flush_to_dat(self) -> None:
        """Compress the temp DB and atomically replace the .dat.gz file.

        After a successful write, updates ``dbs/files.json`` when the file
        lives inside the repository-root ``dbs/`` directory.
        """
        if self._tmp_db is None:
            return
        self._dat_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_gz = self._dat_path.with_suffix(".tmp.gz")
        try:
            with open(self._tmp_db, "rb") as fh:
                raw = fh.read()
            with gzip.open(tmp_gz, "wb") as gz:
                gz.write(raw)
            tmp_gz.replace(self._dat_path)
            log.debug("flushed %s (%d bytes uncompressed)", self._dat_path.name, len(raw))
        except Exception as exc:
            log.error("flush to %s failed: %s", self._dat_path, exc)
            try:
                os.unlink(tmp_gz)
            except OSError:
                pass
            return

        # Keep dbs/files.json in sync when the file lives in the dbs/ dir
        try:
            if self._dat_path.resolve().parent == _DEFAULT_DBS_DIR.resolve():
                _update_dbs_manifest(_DEFAULT_DBS_DIR)
        except Exception as exc:
            log.warning("could not update dbs/files.json: %s", exc)

    def _rotate(self) -> None:
        """Rename the current .dat.gz to a timestamped archive copy."""
        if not self._dat_path.exists():
            return
        ts = datetime.now(tz=timezone.utc).strftime("%Y%m%dT%H%M%S")
        archive = self._dat_path.with_name(
            f"{self._dat_path.stem}_{ts}{self._dat_path.suffix}"
        )
        try:
            self._dat_path.rename(archive)
            log.info("rotated %s → %s", self._dat_path.name, archive.name)
        except OSError as exc:
            log.warning("rotation failed: %s", exc)
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
