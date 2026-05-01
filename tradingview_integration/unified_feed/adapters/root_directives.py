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
