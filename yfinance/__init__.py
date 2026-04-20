"""
Repository-local yfinance facade.

This package provides a centralized place for yfinance operations while
preserving compatibility with existing `import yfinance as yf` imports.
"""

from __future__ import annotations

import importlib.machinery
import importlib.util
import sys
from pathlib import Path
from types import ModuleType
from typing import Any, Iterable, List

_THIS_DIR = Path(__file__).resolve().parent
_REPO_ROOT = _THIS_DIR.parent


def _filtered_sys_path() -> List[str]:
    filtered: List[str] = []
    for entry in sys.path:
        value = entry if entry else "."
        try:
            resolved = Path(value).resolve()
        except OSError:
            filtered.append(entry)
            continue
        if resolved in {_THIS_DIR, _REPO_ROOT}:
            continue
        filtered.append(entry)
    return filtered


def _load_real_yfinance() -> ModuleType:
    spec = importlib.machinery.PathFinder.find_spec("yfinance", _filtered_sys_path())
    if spec is None or spec.loader is None:
        raise ModuleNotFoundError(
            "Unable to locate installed third-party 'yfinance' package."
        )
    module = importlib.util.module_from_spec(spec)
    local_module = sys.modules.get("yfinance")
    sys.modules["yfinance"] = module
    try:
        spec.loader.exec_module(module)
    finally:
        if local_module is None:
            sys.modules.pop("yfinance", None)
        else:
            sys.modules["yfinance"] = local_module
    sys.modules["_vendor_yfinance"] = module
    return module


def _dedupe(values: Iterable[str]) -> List[str]:
    seen = set()
    result = []
    for value in values:
        if value in seen:
            continue
        seen.add(value)
        result.append(value)
    return result


_REAL_YFINANCE = _load_real_yfinance()
__path__ = _dedupe([str(_THIS_DIR), *list(getattr(_REAL_YFINANCE, "__path__", []))])


def __getattr__(name: str) -> Any:
    return getattr(_REAL_YFINANCE, name)


def __dir__() -> List[str]:
    return sorted(set(globals().keys()) | set(dir(_REAL_YFINANCE)))


from .ops import download, ticker, ticker_history, ticker_info  # noqa: E402

Ticker = _REAL_YFINANCE.Ticker
