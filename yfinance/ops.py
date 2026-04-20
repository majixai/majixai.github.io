"""
Centralized yfinance operations used across this repository.
"""

from __future__ import annotations

from typing import Any, Dict

from . import _REAL_YFINANCE


def download(*args: Any, **kwargs: Any):
    """
    Wrapper around yfinance.download with repo defaults.
    """
    kwargs.setdefault("progress", False)
    return _REAL_YFINANCE.download(*args, **kwargs)


def ticker(symbol: str):
    """
    Return a yfinance.Ticker instance for symbol.
    """
    return _REAL_YFINANCE.Ticker(symbol)


def ticker_history(symbol: str, **kwargs: Any):
    """
    Convenience helper for Ticker.history.
    """
    return ticker(symbol).history(**kwargs)


def ticker_info(symbol: str) -> Dict[str, Any]:
    """
    Convenience helper for Ticker.info.
    """
    info = ticker(symbol).info
    return info if isinstance(info, dict) else {}

