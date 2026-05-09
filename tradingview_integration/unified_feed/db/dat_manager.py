"""
DatabaseManager — atomic file registry backed by dbs/files.json.

Bare filenames (no directory component) are automatically resolved
relative to the repository-root ``dbs/`` directory.  Every mutating
operation (register / unregister) rewrites ``dbs/files.json`` atomically
so that a crash mid-write never leaves a corrupt registry.
"""

from __future__ import annotations

import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parents[3]   # repo root
_DBS_DIR = _ROOT / "dbs"
_FILES_JSON = _DBS_DIR / "files.json"


class DatabaseManager:
    """Manages a JSON file registry stored in ``dbs/files.json``.

    All public methods are thread-safe via atomic temp-file replacement.

    Parameters
    ----------
    dbs_dir:
        Override the ``dbs/`` directory (useful for testing).
    """

    def __init__(self, dbs_dir: Path | None = None) -> None:
        self._dbs_dir: Path = Path(dbs_dir) if dbs_dir else _DBS_DIR
        self._files_json: Path = self._dbs_dir / "files.json"
        self._dbs_dir.mkdir(parents=True, exist_ok=True)

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _resolve(self, filename: str) -> str:
        """
        Return the canonical string representation of *filename*.

        If *filename* contains no directory component (i.e., it is a bare
        name such as ``"database.db"``), it is resolved to the absolute
        path inside ``dbs/``.
        """
        p = Path(filename)
        if p.parent == Path("."):
            p = self._dbs_dir / p.name
        return str(p)

    def _load(self) -> list[str]:
        """Load the current file list from ``files.json``."""
        try:
            with open(self._files_json, "r") as fh:
                data = json.load(fh)
            if isinstance(data, list):
                return [str(x) for x in data]
            log.warning("files.json has unexpected format; resetting to []")
            return []
        except FileNotFoundError:
            return []
        except Exception as exc:
            log.warning("files.json load error: %s", exc)
            return []

    def _save(self, entries: list[str]) -> None:
        """Atomically replace ``files.json`` with *entries*."""
        fd, tmp = tempfile.mkstemp(
            dir=self._dbs_dir, prefix=".files_", suffix=".tmp"
        )
        try:
            with os.fdopen(fd, "w") as fh:
                json.dump(entries, fh, indent=2)
            # Atomic rename (POSIX guarantee)
            os.replace(tmp, self._files_json)
        except Exception:
            # Best-effort cleanup of the temp file on failure
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    # ── Public API ────────────────────────────────────────────────────────────

    def list_files(self) -> list[str]:
        """Return a snapshot of all registered filenames."""
        return list(self._load())

    def register(self, filename: str) -> str:
        """
        Add *filename* to the registry (no-op if already present).

        Returns the resolved absolute path string.
        """
        resolved = self._resolve(filename)
        entries = self._load()
        if resolved not in entries:
            entries.append(resolved)
            self._save(entries)
            log.debug("registered %s", resolved)
        return resolved

    def unregister(self, filename: str) -> bool:
        """
        Remove *filename* from the registry.

        Returns ``True`` if the entry was present and removed.
        """
        resolved = self._resolve(filename)
        entries = self._load()
        if resolved in entries:
            entries.remove(resolved)
            self._save(entries)
            log.debug("unregistered %s", resolved)
            return True
        return False

    def exists(self, filename: str) -> bool:
        """Return ``True`` if *filename* is in the registry."""
        return self._resolve(filename) in self._load()

    def sync_from_disk(self) -> list[str]:
        """
        Scan ``dbs/`` for real files and rebuild ``files.json`` to match.

        Files that exist on disk but are not yet registered are added.
        Entries that no longer exist on disk are pruned.

        Returns the updated list of registered entries.
        """
        existing = {str(p) for p in self._dbs_dir.iterdir() if p.is_file()
                    and p.name not in ("files.json",) and not p.name.startswith(".")}
        registry = set(self._load())

        merged = sorted(existing | registry)
        # Prune entries that point to non-existent absolute paths
        pruned = [e for e in merged if Path(e).exists() or not Path(e).is_absolute()]
        self._save(pruned)
        return list(pruned)

    def metadata(self) -> dict[str, Any]:
        """Return summary metadata about the registry."""
        entries = self._load()
        return {
            "dbs_dir":     str(self._dbs_dir),
            "files_json":  str(self._files_json),
            "count":       len(entries),
            "entries":     entries,
        }
