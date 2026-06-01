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
_REPO_ROOT = Path(__file__).resolve().parents[3]

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
    """Hybrid manager for unified_feed registry and .dat.gz storage."""

    def __init__(
        self,
        dat_path: Any | None = None,
        max_size_bytes: int = DEFAULT_MAX_SIZE_BYTES,
        dbs_dir: Any | None = None,
    ) -> None:
        self._mode = "registry" if dbs_dir is not None else "sqlite"
        self._max_size_bytes = max_size_bytes
        self._tmp_db: Optional[str] = None
        self._con: Optional[sqlite3.Connection] = None
        self._dat_path: Optional[Path] = None
        self._dbs_dir: Optional[Path] = None
        self._files_json: Optional[Path] = None
        self._registered_files: List[str] = []

        if self._mode == "registry":
            self._dbs_dir = Path(dbs_dir) if dbs_dir is not None else _DEFAULT_DBS_DIR
            self._dbs_dir.mkdir(parents=True, exist_ok=True)
            self._files_json = self._dbs_dir / "files.json"
        else:
            if dat_path is None:
                raise TypeError("dat_path is required in sqlite mode")
            p = Path(dat_path)
            if not p.is_absolute() and p.parent == Path("."):
                p = _DEFAULT_DBS_DIR / p
            self._dat_path = p

    # ── Registry helpers ────────────────────────────────────────────────────

    def _resolve_registry_path(self, path: Any) -> Path:
        assert self._dbs_dir is not None
        p = Path(path)
        if not p.is_absolute() and p.parent == Path("."):
            p = self._dbs_dir / p
        return p

    def _write_registry_manifest(self) -> None:
        if self._files_json is None:
            return
        self._files_json.parent.mkdir(parents=True, exist_ok=True)
        tmp = self._files_json.with_suffix(".tmp.json")
        tmp.write_text(json.dumps(self._registered_files, indent=2) + "\n", encoding="utf-8")
        tmp.replace(self._files_json)

    def list_files(self) -> List[str]:
        if self._mode != "registry":
            raise RuntimeError("list_files() is only available in registry mode")
        return list(self._registered_files)

    def register(self, path: Any) -> str:
        if self._mode != "registry":
            raise RuntimeError("register() is only available in registry mode")
        resolved = str(self._resolve_registry_path(path))
        if resolved not in self._registered_files:
            self._registered_files.append(resolved)
            self._registered_files.sort()
            self._write_registry_manifest()
        return resolved

    def unregister(self, path: Any) -> bool:
        if self._mode != "registry":
            raise RuntimeError("unregister() is only available in registry mode")
        resolved = str(self._resolve_registry_path(path))
        if resolved in self._registered_files:
            self._registered_files.remove(resolved)
            self._write_registry_manifest()
            return True
        return False

    def exists(self, path: Any) -> bool:
        if self._mode != "registry":
            raise RuntimeError("exists() is only available in registry mode")
        resolved = str(self._resolve_registry_path(path))
        return resolved in self._registered_files

    def sync_from_disk(self) -> List[str]:
        if self._mode != "registry":
            raise RuntimeError("sync_from_disk() is only available in registry mode")
        assert self._dbs_dir is not None
        files = sorted(
            str(entry.resolve())
            for entry in self._dbs_dir.iterdir()
            if entry.is_file() and entry.name != "files.json"
        )
        self._registered_files = files
        self._write_registry_manifest()
        return list(self._registered_files)

    def metadata(self) -> Dict[str, Any]:
        if self._mode != "registry":
            raise RuntimeError("metadata() is only available in registry mode")
        assert self._dbs_dir is not None and self._files_json is not None
        return {
            "count": len(self._registered_files),
            "dbs_dir": str(self._dbs_dir),
            "files_json": str(self._files_json),
        }

    # ── SQLite lifecycle ────────────────────────────────────────────────────

    def open_dat(self) -> None:
        if self._mode != "sqlite":
            self._write_registry_manifest()
            return

        fd, tmp = tempfile.mkstemp(suffix=".db", prefix="uf_dm_")
        os.close(fd)
        self._tmp_db = tmp

        assert self._dat_path is not None
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
        if self._mode == "registry":
            self._write_registry_manifest()
            return

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
        if self._mode == "sqlite":
            self.open_dat()
        return self

    def __exit__(self, *_: Any) -> None:
        self.close()

    # ── SQLite public API ───────────────────────────────────────────────────

    def append_summary(
        self,
        ticker: str,
        interval: str,
        last_ts: int,
        sha256: str,
        metadata: Optional[Dict[str, Any]] = None,
        filename_sha256: Optional[str] = None,
    ) -> int:
        if self._mode != "sqlite":
            raise RuntimeError("append_summary() is only available in sqlite mode")
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
        if self._mode != "sqlite":
            raise RuntimeError("query_summaries() is only available in sqlite mode")
        self._ensure_open()
        assert self._con is not None

        where_clauses: List[str] = []
        params: List[Any] = []
        allowed = {"ticker", "interval", "sha256", "filename_sha256"}

        for col, val in (filters or {}).items():
            if col in allowed:
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

    # ── Internal helpers ────────────────────────────────────────────────────

    def _ensure_open(self) -> None:
        if self._con is None:
            raise RuntimeError("DatabaseManager is not open — call open_dat() first")

    def _flush_to_dat(self) -> None:
        if self._mode != "sqlite" or self._tmp_db is None or self._dat_path is None:
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

        try:
            if self._dat_path.resolve().parent == _DEFAULT_DBS_DIR.resolve():
                _update_dbs_manifest(_DEFAULT_DBS_DIR)
        except Exception as exc:
            log.warning("could not update dbs/files.json: %s", exc)

    def _rotate(self) -> None:
        if self._mode != "sqlite" or self._dat_path is None:
            return
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
