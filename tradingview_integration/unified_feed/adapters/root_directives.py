"""
RootDirectives — discovers available data sources by scanning well-known
root directories and the root-level Python whitelist.

Scanned locations
-----------------
* ``dbs/``              — SQLite / dat files registered in dbs/files.json
* ``actions/``          — Action definition files (.py, .js)
* Mathematics dirs      — algebra, bayes, calculus, tensor, gpu, etc.
* Finance dirs          — market_prediction, sp_closing_projection, yfinance, etc.
* Infrastructure dirs   — github_data, index, router, scripts, etc.
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

from ..config import (
    FINANCE_ROOT_DIRS,
    INFRA_ROOT_DIRS,
    MATH_ROOT_DIRS,
    ROOT_PYTHON_WHITELIST,
)

log = logging.getLogger(__name__)

_ROOT = Path(__file__).resolve().parents[3]   # repo root

# Extensions considered as "data" files in scanned directories
_DATA_EXTS = {".json", ".csv", ".dat", ".db", ".sqlite", ".sqlite3"}
# Extensions for action/code files
_CODE_EXTS = {".py", ".js"}

_ROOT_PYTHON_WHITELIST: frozenset[str] = frozenset(ROOT_PYTHON_WHITELIST)


@dataclass
class DirectiveEntry:
    """Represents a single discovered directive file."""
    path: Path
    category: str   # 'dbs' | 'actions' | 'math' | 'finance' | 'infra' | 'root'
    kind: str       # 'data' | 'code' | 'other'
    source_dir: str = ""    # name of the root directory containing this entry
    exists: bool = True

    def as_dict(self) -> dict[str, Any]:
        return {
            "path":       str(self.path),
            "category":   self.category,
            "kind":       self.kind,
            "source_dir": self.source_dir,
            "exists":     self.exists,
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
    math_files:
        Entries sourced from mathematics root directories.
    finance_files:
        Entries sourced from finance/market root directories.
    infra_files:
        Entries sourced from infrastructure root directories.
    root_python_files:
        Whitelisted Python files found at the repo root.
    dir_summary:
        Mapping of root-directory name -> number of entries discovered.
    """
    root: Path
    entries: list[DirectiveEntry] = field(default_factory=list)
    dbs_files: list[DirectiveEntry] = field(default_factory=list)
    action_files: list[DirectiveEntry] = field(default_factory=list)
    math_files: list[DirectiveEntry] = field(default_factory=list)
    finance_files: list[DirectiveEntry] = field(default_factory=list)
    infra_files: list[DirectiveEntry] = field(default_factory=list)
    root_python_files: list[DirectiveEntry] = field(default_factory=list)
    dir_summary: dict[str, int] = field(default_factory=dict)

    def as_dict(self) -> dict[str, Any]:
        return {
            "root":              str(self.root),
            "total":             len(self.entries),
            "dbs_files":         [e.as_dict() for e in self.dbs_files],
            "action_files":      [e.as_dict() for e in self.action_files],
            "math_files":        [e.as_dict() for e in self.math_files],
            "finance_files":     [e.as_dict() for e in self.finance_files],
            "infra_files":       [e.as_dict() for e in self.infra_files],
            "root_python_files": [e.as_dict() for e in self.root_python_files],
            "dir_summary":       self.dir_summary,
        }

    def get_by_category(self, category: str) -> list[DirectiveEntry]:
        """Return all entries with the given *category*."""
        return [e for e in self.entries if e.category == category]

    def get_by_source_dir(self, source_dir: str) -> list[DirectiveEntry]:
        """Return all entries from the given root *source_dir* name."""
        return [e for e in self.entries if e.source_dir == source_dir]

    def has_category(self, category: str) -> bool:
        """Return True if at least one entry with *category* was found."""
        return any(e.category == category for e in self.entries)

    def has_source_dir(self, source_dir: str) -> bool:
        """Return True if at least one entry from *source_dir* was found."""
        return self.dir_summary.get(source_dir, 0) > 0


class RootDirectives:
    """
    Scans well-known root directories to build a ``DirectiveCatalog``.

    Parameters
    ----------
    root:
        Repository root path.  Defaults to the detected repository root.
    deep:
        When True, recurse one level into sub-directories of each scanned
        root directory (e.g. ``calculus/stochastic/*.py``).  Defaults to
        False so that only top-level files are returned.
    """

    def __init__(self, root: Path | None = None, *, deep: bool = False) -> None:
        self._root: Path = Path(root) if root else _ROOT
        self._deep = deep

    # ── Internal helpers ──────────────────────────────────────────────────────

    def _kind(self, path: Path) -> str:
        ext = path.suffix.lower()
        if ext in _DATA_EXTS:
            return "data"
        if ext in _CODE_EXTS:
            return "code"
        return "other"

    def _iter_files(self, directory: Path) -> list[Path]:
        """
        Return non-hidden files inside *directory*.

        If ``self._deep`` is True, also returns files in immediate
        sub-directories (depth 2 total).
        """
        files: list[Path] = []
        if not directory.is_dir():
            return files
        for p in sorted(directory.iterdir()):
            if p.name.startswith("."):
                continue
            if p.is_file():
                files.append(p)
            elif p.is_dir() and self._deep:
                for q in sorted(p.iterdir()):
                    if q.is_file() and not q.name.startswith("."):
                        files.append(q)
        return files

    def _scan_dir(
        self,
        directory: Path,
        category: str,
        source_dir: str = "",
    ) -> list[DirectiveEntry]:
        """Scan *directory* and return ``DirectiveEntry`` objects."""
        if not directory.is_dir():
            log.debug("scan_dir: %s does not exist, skipping", directory)
            return []
        src = source_dir or directory.name
        entries: list[DirectiveEntry] = []
        for p in self._iter_files(directory):
            entries.append(
                DirectiveEntry(
                    path=p,
                    category=category,
                    kind=self._kind(p),
                    source_dir=src,
                )
            )
        log.debug("scan_dir %s: found %d files", directory.name, len(entries))
        return entries

    def _scan_dbs(self) -> list[DirectiveEntry]:
        """
        Scan ``dbs/`` directory.

        Reads ``dbs/files.json`` first, then iterates the directory to
        capture files that may not yet be in the registry.
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
                            source_dir="dbs",
                            exists=p.exists(),
                        )
                    )
                    seen.add(p.resolve())
            except Exception as exc:
                log.warning("dbs/files.json read error: %s", exc)

        # Also scan the directory itself for any unlisted files
        for p in (sorted(dbs_dir.iterdir()) if dbs_dir.is_dir() else []):
            if p.is_file() and not p.name.startswith(".") and p.name != "files.json":
                if p.resolve() not in seen:
                    entries.append(
                        DirectiveEntry(
                            path=p,
                            category="dbs",
                            kind=self._kind(p),
                            source_dir="dbs",
                        )
                    )
        return entries

    def _scan_root_python(self) -> list[DirectiveEntry]:
        """Return whitelisted Python files that exist at the repo root."""
        entries: list[DirectiveEntry] = []
        for name in sorted(_ROOT_PYTHON_WHITELIST):
            p = self._root / name
            if p.is_file():
                entries.append(
                    DirectiveEntry(
                        path=p,
                        category="root",
                        kind="code",
                        source_dir=".",
                    )
                )
        return entries

    def _scan_dir_list(
        self,
        dir_names: list[str],
        category: str,
    ) -> list[DirectiveEntry]:
        """Scan multiple root directories by name, all assigned *category*."""
        entries: list[DirectiveEntry] = []
        for name in dir_names:
            d = self._root / name
            entries.extend(self._scan_dir(d, category, source_dir=name))
        return entries

    # ── Public API ────────────────────────────────────────────────────────────

    def scan(self) -> DirectiveCatalog:
        """
        Perform a full scan of all configured root directories.

        Returns a ``DirectiveCatalog`` describing every discovered file.
        """
        catalog = DirectiveCatalog(root=self._root)

        catalog.dbs_files         = self._scan_dbs()
        catalog.action_files      = self._scan_dir(self._root / "actions", "actions", "actions")
        catalog.math_files        = self._scan_dir_list(MATH_ROOT_DIRS,    "math")
        catalog.finance_files     = self._scan_dir_list(FINANCE_ROOT_DIRS, "finance")
        catalog.infra_files       = self._scan_dir_list(INFRA_ROOT_DIRS,   "infra")
        catalog.root_python_files = self._scan_root_python()

        catalog.entries = (
            catalog.dbs_files
            + catalog.action_files
            + catalog.math_files
            + catalog.finance_files
            + catalog.infra_files
            + catalog.root_python_files
        )

        # Build per-directory summary
        for e in catalog.entries:
            catalog.dir_summary[e.source_dir] = (
                catalog.dir_summary.get(e.source_dir, 0) + 1
            )

        log.info(
            "RootDirectives.scan complete — %d entries "
            "(dbs=%d actions=%d math=%d finance=%d infra=%d root_py=%d)",
            len(catalog.entries),
            len(catalog.dbs_files),
            len(catalog.action_files),
            len(catalog.math_files),
            len(catalog.finance_files),
            len(catalog.infra_files),
            len(catalog.root_python_files),
        )
        return catalog

    def scan_dict(self) -> dict[str, Any]:
        """Convenience wrapper that returns ``scan().as_dict()``."""
        return self.scan().as_dict()
