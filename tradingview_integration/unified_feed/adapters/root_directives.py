"""
RootDirectives — discovers available data sources by scanning well-known
root directories and the root-level Python whitelist.

Scanned locations
-----------------
* ``dbs/``          — SQLite / dat / db files registered in dbs/files.json
* ``actions/``      — Action definition files (.py, .js)
* ``finance/``      — Finance data assets (JSON, CSV, manifest)
* ``mathematics/``  — Mathematics module files (if the directory exists)
* Root Python whitelist — selected Python scripts at the repo root

The ``scan()`` method returns a ``DirectiveCatalog`` describing what was
found, enabling downstream adapters to decide which sources are live.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parents[3]   # repo root

# Extensions considered as "data" files in scanned directories
_DATA_EXTS = {".json", ".csv", ".dat", ".db", ".sqlite", ".sqlite3"}
# Extensions for action/code files
_CODE_EXTS = {".py", ".js"}

# Root Python filenames that are whitelisted as directives
_ROOT_PYTHON_WHITELIST: frozenset[str] = frozenset([
    "config.py", "app.py", "engine.py", "run.py", "fetch_data.py",
    "database.py", "data_to_db.py",
])


@dataclass
class DirectiveEntry:
    """Represents a single discovered directive file."""
    path: Path
    category: str           # 'dbs' | 'actions' | 'finance' | 'mathematics' | 'root'
    kind: str               # 'data' | 'code' | 'other'
    exists: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "path":     str(self.path),
            "category": self.category,
            "kind":     self.kind,
            "exists":   self.exists,
        }


@dataclass
class DirectiveCatalog:
    """
    Full catalog produced by ``RootDirectives.scan()``.

    Attributes
    ----------
    root:
        Repository root directory.
    entries:
        All discovered ``DirectiveEntry`` objects.
    dbs_files:
        Entries sourced from the ``dbs/`` directory.
    action_files:
        Entries sourced from the ``actions/`` directory.
    finance_files:
        Entries sourced from the ``finance/`` directory.
    math_files:
        Entries sourced from the ``mathematics/`` directory (may be empty).
    root_python_files:
        Whitelisted Python files found at the repo root.
    """
    root: Path
    entries: list[DirectiveEntry] = field(default_factory=list)
    dbs_files: list[DirectiveEntry] = field(default_factory=list)
    action_files: list[DirectiveEntry] = field(default_factory=list)
    finance_files: list[DirectiveEntry] = field(default_factory=list)
    math_files: list[DirectiveEntry] = field(default_factory=list)
    root_python_files: list[DirectiveEntry] = field(default_factory=list)

    def as_dict(self) -> dict[str, Any]:
        return {
            "root":             str(self.root),
            "total":            len(self.entries),
            "dbs_files":        [e.as_dict() for e in self.dbs_files],
            "action_files":     [e.as_dict() for e in self.action_files],
            "finance_files":    [e.as_dict() for e in self.finance_files],
            "math_files":       [e.as_dict() for e in self.math_files],
            "root_python_files": [e.as_dict() for e in self.root_python_files],
        }

    def get_by_category(self, category: str) -> list[DirectiveEntry]:
        """Return all entries with the given *category*."""
        return [e for e in self.entries if e.category == category]

    def has_category(self, category: str) -> bool:
        """Return True if at least one entry with *category* was found."""
        return any(e.category == category for e in self.entries)


class RootDirectives:
    """
    Scans well-known root directories to build a ``DirectiveCatalog``.

    Parameters
    ----------
    root:
        Repository root path.  Defaults to the detected repository root.
    """

    def __init__(self, root: Path | None = None) -> None:
        self._root: Path = Path(root) if root else _ROOT

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _kind(self, path: Path) -> str:
        ext = path.suffix.lower()
        if ext in _DATA_EXTS:
            return "data"
        if ext in _CODE_EXTS:
            return "code"
        return "other"

    def _scan_dir(self, directory: Path, category: str) -> list[DirectiveEntry]:
        """Scan a single directory and return ``DirectiveEntry`` objects."""
        if not directory.is_dir():
            log.debug("scan_dir: %s does not exist, skipping", directory)
            return []
        entries: list[DirectiveEntry] = []
        for p in sorted(directory.iterdir()):
            if p.is_file() and not p.name.startswith("."):
                entries.append(
                    DirectiveEntry(path=p, category=category, kind=self._kind(p))
                )
        log.debug("scan_dir %s: found %d files", directory.name, len(entries))
        return entries

    def _scan_dbs(self) -> list[DirectiveEntry]:
        """
        Scan ``dbs/`` directory.

        If ``dbs/files.json`` exists it is read first to enumerate
        registered entries; the directory is also iterated to pick up any
        files that are on disk but not yet in the registry.
        """
        dbs_dir = self._root / "dbs"
        entries: list[DirectiveEntry] = []
        seen: set[Path] = set()

        # Load from files.json registry
        files_json = dbs_dir / "files.json"
        if files_json.is_file():
            try:
                with open(files_json) as fh:
                    registered = json.load(fh)
                for raw in registered:
                    p = Path(raw)
                    if not p.is_absolute():
                        p = dbs_dir / p
                    entries.append(
                        DirectiveEntry(
                            path=p,
                            category="dbs",
                            kind=self._kind(p),
                            exists=p.exists(),
                        )
                    )
                    seen.add(p.resolve())
            except Exception as exc:
                log.warning("dbs/files.json read error: %s", exc)

        # Also scan the directory itself for any unlisted files
        for p in sorted(dbs_dir.iterdir()) if dbs_dir.is_dir() else []:
            if p.is_file() and not p.name.startswith(".") and p.name != "files.json":
                if p.resolve() not in seen:
                    entries.append(
                        DirectiveEntry(path=p, category="dbs", kind=self._kind(p))
                    )
        return entries

    def _scan_root_python(self) -> list[DirectiveEntry]:
        """Return whitelisted Python files that exist at the repo root."""
        entries: list[DirectiveEntry] = []
        for name in sorted(_ROOT_PYTHON_WHITELIST):
            p = self._root / name
            if p.is_file():
                entries.append(
                    DirectiveEntry(path=p, category="root", kind="code")
                )
        return entries

    # ── Public API ────────────────────────────────────────────────────────────

    def scan(self) -> DirectiveCatalog:
        """
        Perform a full scan of all configured root directories.

        Returns a ``DirectiveCatalog`` describing every discovered file.
        """
        catalog = DirectiveCatalog(root=self._root)

        catalog.dbs_files       = self._scan_dbs()
        catalog.action_files    = self._scan_dir(self._root / "actions",     "actions")
        catalog.finance_files   = self._scan_dir(self._root / "finance",     "finance")
        catalog.math_files      = self._scan_dir(self._root / "mathematics", "mathematics")
        catalog.root_python_files = self._scan_root_python()

        catalog.entries = (
            catalog.dbs_files
            + catalog.action_files
            + catalog.finance_files
            + catalog.math_files
            + catalog.root_python_files
        )

        log.info(
            "RootDirectives.scan complete — %d entries "
            "(dbs=%d actions=%d finance=%d math=%d root_py=%d)",
            len(catalog.entries),
            len(catalog.dbs_files),
            len(catalog.action_files),
            len(catalog.finance_files),
            len(catalog.math_files),
            len(catalog.root_python_files),
        )
        return catalog

    def scan_dict(self) -> dict[str, Any]:
        """Convenience wrapper that returns ``scan().as_dict()``."""
        return self.scan().as_dict()
