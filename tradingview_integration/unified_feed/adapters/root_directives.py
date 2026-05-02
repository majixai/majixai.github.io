"""Root-directive adapters for unified_feed.

Safely loads optional YAML / JSON / Python directive files from several
well-known directories at the repository root:

* ``finance/`` and ``mathematics/`` — domain-specific model directives
* ``dbs/`` — database configuration / file manifests (JSON)
* ``actions/`` — action-dispatcher configuration snippets
* root-level ``*.py`` files whose names suggest directives (e.g.
  ``config.py``, ``settings.py``, ``directives.py``)

All loading is *read-only* and *optional*: the module logs a warning and
continues when a directory or file is absent or unreadable.

Typical usage::

    from tradingview_integration.unified_feed.adapters.root_directives import (
        load_all_directives,
        map_to_feature_engine_inputs,
        map_to_tensor_calculus_inputs,
    )

    directives = load_all_directives()
    fe_inputs = map_to_feature_engine_inputs(directives)
    tc_inputs = map_to_tensor_calculus_inputs(directives)
"""

import json
import logging
import os
from pathlib import Path
from typing import Any, Dict, List, Optional

log = logging.getLogger(__name__)

# Repository root is four levels up from this file:
# tradingview_integration/unified_feed/adapters/root_directives.py
_REPO_ROOT = Path(__file__).resolve().parents[4]

# Subdirectories to scan for directive files (order matters for merge priority)
_DIRECTIVE_DIRS: List[str] = ["finance", "mathematics", "dbs", "actions"]

# Root-level Python filenames treated as directive files (safe subset)
_ROOT_PY_DIRECTIVE_NAMES = {
    "config.py",
    "settings.py",
    "directives.py",
    "constants.py",
    "params.py",
}

# Supported file extensions (in priority order)
_SUPPORTED_EXTS = [".yaml", ".yml", ".json", ".py"]


# ─────────────────────────────────────────────────────────────────────────────
# File loaders
# ─────────────────────────────────────────────────────────────────────────────

def _load_yaml_safe(path: Path) -> Optional[Dict[str, Any]]:
    """Load a YAML file without executing arbitrary code."""
    try:
        import yaml  # type: ignore[import]
        with open(path, "r", encoding="utf-8") as fh:
            return yaml.safe_load(fh) or {}
    except ImportError:
        log.warning("PyYAML not installed — skipping %s", path.name)
        return None
    except Exception as exc:
        log.warning("could not load YAML %s: %s", path, exc)
        return None


def _load_json_safe(path: Path) -> Optional[Dict[str, Any]]:
    """Load a JSON file.  If the top-level value is a list, wrap it under
    the filename stem so callers always receive a plain dict."""
    try:
        with open(path, "r", encoding="utf-8") as fh:
            raw = json.load(fh)
        if isinstance(raw, list):
            return {path.stem: raw}
        if isinstance(raw, dict):
            return raw
        return {path.stem: raw}
    except Exception as exc:
        log.warning("could not load JSON %s: %s", path, exc)
        return None


def _load_py_safe(path: Path) -> Optional[Dict[str, Any]]:
    """Load a Python directive file by executing it in an isolated namespace.

    Only simple ``key = value`` assignments are expected.  The result is
    filtered to only include JSON-serialisable scalar / list / dict values.
    """
    namespace: Dict[str, Any] = {}
    try:
        with open(path, "r", encoding="utf-8") as fh:
            source = fh.read()
        exec(compile(source, str(path), "exec"), namespace)  # noqa: S102
    except Exception as exc:
        log.warning("could not exec directive %s: %s", path, exc)
        return None

    # Keep only simple values; discard builtins / callables
    result: Dict[str, Any] = {}
    for k, v in namespace.items():
        if k.startswith("_"):
            continue
        if callable(v):
            continue
        try:
            json.dumps(v)  # validate JSON-serialisability
            result[k] = v
        except (TypeError, ValueError):
            pass
    return result


def _load_file(path: Path) -> Optional[Dict[str, Any]]:
    ext = path.suffix.lower()
    if ext in (".yaml", ".yml"):
        return _load_yaml_safe(path)
    if ext == ".json":
        return _load_json_safe(path)
    if ext == ".py":
        return _load_py_safe(path)
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Public API
# ─────────────────────────────────────────────────────────────────────────────

def load_directives_from_dir(directory: Path) -> Dict[str, Any]:
    """Load all directive files from *directory* into a single dict.

    Files are merged in alphabetical order; later files override earlier ones
    for duplicate keys.

    Args:
        directory: Path to the directive directory (may not exist).

    Returns:
        Merged dict of all directives found, or ``{}`` if the directory is
        absent or empty.
    """
    if not directory.is_dir():
        log.debug("directive directory not found, skipping: %s", directory)
        return {}

    merged: Dict[str, Any] = {}
    for entry in sorted(directory.iterdir()):
        if entry.is_file() and entry.suffix.lower() in _SUPPORTED_EXTS:
            data = _load_file(entry)
            if data:
                merged.update(data)
                log.debug("loaded directive file %s (%d keys)", entry.name, len(data))

    return merged


def load_root_python_directives(repo_root: Optional[Path] = None) -> Dict[str, Any]:
    """Load directive values from well-known root-level Python files.

    Only files whose basenames are listed in ``_ROOT_PY_DIRECTIVE_NAMES`` are
    loaded (e.g. ``config.py``, ``settings.py``).  This avoids accidentally
    executing complex application scripts such as ``app.py`` or ``run.py``.

    Args:
        repo_root: Override the repository root path.

    Returns:
        Merged dict of all simple scalar / list / dict assignments found.
    """
    root = repo_root or _REPO_ROOT
    merged: Dict[str, Any] = {}

    for name in sorted(_ROOT_PY_DIRECTIVE_NAMES):
        candidate = root / name
        if candidate.is_file():
            data = _load_py_safe(candidate)
            if data:
                merged.update(data)
                log.debug("loaded root python directive %s (%d keys)", name, len(data))

    return merged


def load_all_directives(repo_root: Optional[Path] = None) -> Dict[str, Dict[str, Any]]:
    """Load directives from all configured root directories and root Python files.

    Scans the following sources (all optional / gracefully skipped when absent):

    * ``finance/``, ``mathematics/`` — domain model directives
    * ``dbs/`` — database configuration and file manifests
    * ``actions/`` — action-dispatcher configuration
    * Root-level ``*.py`` directive files (safe whitelist only)

    Args:
        repo_root: Override the repository root (defaults to auto-detected
                   root four levels above this file).

    Returns:
        Dict mapping source name (e.g. ``"finance"``, ``"dbs"``,
        ``"actions"``, ``"python"``) to its merged directive dict.
        Absent or empty sources are omitted from the result.
    """
    root = repo_root or _REPO_ROOT
    result: Dict[str, Dict[str, Any]] = {}

    for dir_name in _DIRECTIVE_DIRS:
        directives = load_directives_from_dir(root / dir_name)
        if directives:
            result[dir_name] = directives
            log.info("loaded %d directive key(s) from %s/", len(directives), dir_name)
        else:
            log.debug("no directives found in %s/", dir_name)

    # Root-level Python directive files (config.py, settings.py, etc.)
    py_directives = load_root_python_directives(root)
    if py_directives:
        result["python"] = py_directives
        log.info("loaded %d directive key(s) from root Python files", len(py_directives))

    return result


def map_to_feature_engine_inputs(
    directives: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """Flatten and validate directives for the Feature Engine.

    Extracts well-known Feature Engine keys (``features``, ``weights``,
    ``thresholds``) from the merged directive namespaces.  Unknown keys are
    passed through under an ``extra`` sub-dict.

    Args:
        directives: Output of :func:`load_all_directives`.

    Returns:
        Flat dict suitable for passing to a Feature Engine initialiser.
    """
    fe_keys = {"features", "weights", "thresholds", "lookback_periods"}
    result: Dict[str, Any] = {"extra": {}}

    for _ns, data in directives.items():
        for k, v in data.items():
            if k in fe_keys:
                result[k] = v
            else:
                result["extra"][k] = v

    return result


def map_to_tensor_calculus_inputs(
    directives: Dict[str, Dict[str, Any]],
) -> Dict[str, Any]:
    """Flatten and validate directives for tensor_calculus.

    Extracts ``metric_tensor``, ``connection_coefficients``, and
    ``geodesic_steps`` from the merged directive namespaces.

    Args:
        directives: Output of :func:`load_all_directives`.

    Returns:
        Flat dict suitable for tensor_calculus initialisation.
    """
    tc_keys = {"metric_tensor", "connection_coefficients", "geodesic_steps",
               "rk4_step_size", "manifold_dim"}
    result: Dict[str, Any] = {"extra": {}}

    for _ns, data in directives.items():
        for k, v in data.items():
            if k in tc_keys:
                result[k] = v
            else:
                result["extra"][k] = v

    return result

"""root_directives — optional loader for repo-root finance/mathematics directive files.

The repo root may contain ``finance/`` and ``mathematics/`` directories populated
with YAML, JSON, or plain-Python directive files.  These directories are entirely
**optional**; missing directories are logged at DEBUG level and silently skipped.

All loading is **read-only** — this module never writes to the root directories.

Supported directive file extensions
------------------------------------
.yaml / .yml    loaded with PyYAML (falls back gracefully if not installed)
.json           loaded with stdlib json
.py             exec-ed in a sandboxed namespace; must assign a top-level
                ``directives`` variable which must be a dict.

Public API
----------
load_finance_directives(root=None)   -> dict
    Load all directive files from ``<root>/finance/``.

load_mathematics_directives(root=None) -> dict
    Load all directive files from ``<root>/mathematics/``.

load_all_directives(root=None) -> dict
    Convenience — returns ``{"finance": {...}, "mathematics": {...}}``.

get_feature_engine_inputs(directives) -> dict
    Map loaded directives into a flat dict of Feature Engine configuration
    keys, ready to merge into the tensor_calculus pipeline inputs.

get_tensor_calculus_inputs(directives) -> dict
    Similar mapping for tensor/calculus pipeline inputs.
"""

from __future__ import annotations

import importlib.util
import json
import logging
from pathlib import Path
from typing import Any

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _repo_root() -> Path:
    """Return the repository root (three levels above this file)."""
    return Path(__file__).resolve().parents[4]


def _load_yaml(path: Path) -> dict:
    try:
        import yaml  # type: ignore[import-untyped]
        with open(path, "r") as fh:
            data = yaml.safe_load(fh)
        return data if isinstance(data, dict) else {}
    except ImportError:
        log.debug("PyYAML not available; skipping %s", path.name)
        return {}
    except Exception as exc:
        log.warning("YAML load failed for %s: %s", path, exc)
        return {}


def _load_json(path: Path) -> dict:
    try:
        with open(path, "r") as fh:
            data = json.load(fh)
        return data if isinstance(data, dict) else {}
    except Exception as exc:
        log.warning("JSON load failed for %s: %s", path, exc)
        return {}


def _load_py(path: Path) -> dict:
    """Exec the Python file in an isolated namespace and return its ``directives`` dict."""
    ns: dict[str, Any] = {}
    try:
        with open(path, "r") as fh:
            source = fh.read()
        code = compile(source, str(path), "exec")
        exec(code, ns)  # noqa: S102
        directives = ns.get("directives", {})
        if not isinstance(directives, dict):
            log.warning("directives in %s is not a dict — ignoring", path.name)
            return {}
        return directives
    except Exception as exc:
        log.warning("Python directive load failed for %s: %s", path, exc)
        return {}


def _load_directory(directory: Path) -> dict:
    """Load all recognised directive files from *directory* into a merged dict."""
    if not directory.exists():
        log.debug("root directive directory not found (skipped): %s", directory)
        return {}

    combined: dict[str, Any] = {}
    for candidate in sorted(directory.iterdir()):
        if candidate.is_dir():
            # Recurse one level
            sub = _load_directory(candidate)
            if sub:
                combined[candidate.name] = sub
            continue

        suffix = candidate.suffix.lower()
        if suffix in {".yaml", ".yml"}:
            data = _load_yaml(candidate)
        elif suffix == ".json":
            data = _load_json(candidate)
        elif suffix == ".py" and not candidate.name.startswith("_"):
            data = _load_py(candidate)
        else:
            continue

        if data:
            # Merge under the file stem to avoid collisions
            combined[candidate.stem] = data
            log.debug("root directive loaded: %s  (%d keys)", candidate.name, len(data))

    return combined


# ---------------------------------------------------------------------------
# Public loaders
# ---------------------------------------------------------------------------

def load_finance_directives(root: str | Path | None = None) -> dict:
    """Load directive files from ``<root>/finance/``."""
    r = Path(root) if root is not None else _repo_root()
    return _load_directory(r / "finance")


def load_mathematics_directives(root: str | Path | None = None) -> dict:
    """Load directive files from ``<root>/mathematics/``."""
    r = Path(root) if root is not None else _repo_root()
    return _load_directory(r / "mathematics")


def load_all_directives(root: str | Path | None = None) -> dict:
    """Return ``{"finance": ..., "mathematics": ...}`` from the repo root."""
    return {
        "finance":     load_finance_directives(root),
        "mathematics": load_mathematics_directives(root),
    }


# ---------------------------------------------------------------------------
# Pipeline input mappers
# ---------------------------------------------------------------------------

def get_feature_engine_inputs(directives: dict) -> dict:
    """Map *directives* into Feature Engine configuration keys.

    Recognised finance directive keys:
      indicators        -> feature_engine.indicators
      signal_weights    -> feature_engine.signal_weights
      lookback_periods  -> feature_engine.lookback_periods
      risk_limits       -> feature_engine.risk_limits

    Returns a flat dict ready to be merged into the Feature Engine config.
    """
    fin = directives.get("finance", {})
    inputs: dict[str, Any] = {}

    if "indicators" in fin:
        inputs["indicators"] = fin["indicators"]
    if "signal_weights" in fin:
        inputs["signal_weights"] = fin["signal_weights"]
    if "lookback_periods" in fin:
        inputs["lookback_periods"] = fin["lookback_periods"]
    if "risk_limits" in fin:
        inputs["risk_limits"] = fin["risk_limits"]

    # Merge any nested finance sub-directives
    for key, val in fin.items():
        if isinstance(val, dict) and key not in inputs:
            inputs[key] = val

    return inputs


def get_tensor_calculus_inputs(directives: dict) -> dict:
    """Map *directives* into tensor/calculus pipeline inputs.

    Recognised mathematics directive keys:
      tensor_config     -> tensor settings dict
      calculus_params   -> numerical method parameters
      transforms        -> named transform definitions
      timing_windows    -> short/medium/long term window definitions

    Returns a flat dict ready to be merged into tensor_calculus inputs.
    """
    mth = directives.get("mathematics", {})
    inputs: dict[str, Any] = {}

    if "tensor_config" in mth:
        inputs["tensor_config"] = mth["tensor_config"]
    if "calculus_params" in mth:
        inputs["calculus_params"] = mth["calculus_params"]
    if "transforms" in mth:
        inputs["transforms"] = mth["transforms"]
    if "timing_windows" in mth:
        inputs["timing_windows"] = mth["timing_windows"]

    for key, val in mth.items():
        if isinstance(val, dict) and key not in inputs:
            inputs[key] = val

    return inputs
