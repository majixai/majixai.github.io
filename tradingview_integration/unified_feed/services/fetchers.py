"""fetchers — thin service layer over the unified_feed data sources.

This module wraps the raw data-fetch coroutines from ``feed.py`` and adds:
  * Parquet caching of OHLCV DataFrames.
  * SHA-256 provenance sidecars for every cached parquet file.
  * Fetch-summary rows appended to the active .dat.gz database via DatabaseManager.

The integration is opt-in: if the cache directory is not set (via
``FEED_CACHE_DIR`` env var or the ``cache_dir`` parameter) parquet caching is
skipped but data is still returned to callers.

Environment variables
---------------------
FEED_CACHE_DIR   Directory for parquet cache files and .dat.gz databases.
                 Default: ``<repo_root>/tradingview_integration/unified_feed/.cache``
"""

from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from tradingview_integration.unified_feed.db.dat_manager import DatabaseManager
from tradingview_integration.unified_feed.utils.sha256_provenance import (
    write_metadata_atomic,
)

log = logging.getLogger(__name__)

_REPO_ROOT = Path(__file__).resolve().parents[4]
_DEFAULT_CACHE_DIR = (
    Path(os.environ.get("FEED_CACHE_DIR", ""))
    if os.environ.get("FEED_CACHE_DIR")
    else _REPO_ROOT / "tradingview_integration" / "unified_feed" / ".cache"
)

# Module-level DatabaseManager instance (lazy init)
_db_manager: DatabaseManager | None = None


def _get_db_manager(cache_dir: Path) -> DatabaseManager:
    global _db_manager
    if _db_manager is None:
        db_dir = cache_dir / "dbs"
        db_dir.mkdir(parents=True, exist_ok=True)
        _db_manager = DatabaseManager(db_dir)
    return _db_manager


# ---------------------------------------------------------------------------
# Parquet cache helpers
# ---------------------------------------------------------------------------

def _parquet_path(cache_dir: Path, ticker: str, interval: str) -> Path:
    return cache_dir / "parquet" / f"{ticker.upper()}_{interval}.parquet"


def _load_cached(cache_dir: Path, ticker: str, interval: str) -> pd.DataFrame | None:
    p = _parquet_path(cache_dir, ticker, interval)
    if not p.exists():
        return None
    try:
        return pd.read_parquet(p)
    except Exception as exc:
        log.warning("cache load failed for %s/%s: %s", ticker, interval, exc)
        return None


def _save_cached(
    cache_dir: Path,
    ticker: str,
    interval: str,
    df: pd.DataFrame,
    extra_metadata: dict[str, Any] | None = None,
) -> None:
    """Write *df* to parquet and attach provenance sidecars + dat.gz summary row."""
    parquet_dir = cache_dir / "parquet"
    parquet_dir.mkdir(parents=True, exist_ok=True)
    p = _parquet_path(cache_dir, ticker, interval)

    try:
        df.to_parquet(p, index=False)
    except Exception as exc:
        log.warning("parquet write failed for %s/%s: %s", ticker, interval, exc)
        return

    # Determine last timestamp for provenance
    last_ts: str | None = None
    for col in ("date", "time", "datetime", "timestamp"):
        if col in df.columns and not df.empty:
            last_ts = str(df[col].iloc[-1])
            break

    meta = {
        "ticker":    ticker.upper(),
        "interval":  interval,
        "rows":      len(df),
        "last_ts":   last_ts,
        "source":    "unified_feed/fetchers",
        **(extra_metadata or {}),
    }

    # Write .meta.json and .sha256 sidecars
    sha256_hex: str | None = None
    try:
        _, sha_path = write_metadata_atomic(p, meta)
        sha256_hex = sha_path.read_text().strip()
    except Exception as exc:
        log.warning("provenance write failed for %s/%s: %s", ticker, interval, exc)

    # Append summary to .dat.gz
    try:
        mgr = _get_db_manager(cache_dir)
        mgr.append_summary(
            ticker=ticker,
            interval=interval,
            last_ts=last_ts,
            sha256=sha256_hex,
            metadata=meta,
        )
    except Exception as exc:
        log.warning("dat.gz summary write failed for %s/%s: %s", ticker, interval, exc)


# ---------------------------------------------------------------------------
# Public service functions
# ---------------------------------------------------------------------------

def fetch_ohlcv(
    ticker: str,
    interval: str = "1d",
    cache_dir: Path | str | None = None,
    force_refresh: bool = False,
) -> pd.DataFrame:
    """Return OHLCV DataFrame for *ticker* at *interval*, using cache when available.

    Parameters
    ----------
    ticker:        Ticker symbol, e.g. ``"AAPL"``.
    interval:      Bar interval string, e.g. ``"1d"``, ``"1h"``.
    cache_dir:     Override the default parquet cache directory.
    force_refresh: When True, bypass the cache and re-fetch.

    Returns
    -------
    pd.DataFrame with columns: date/time, open, high, low, close, volume (best-effort).
    """
    cdir = Path(cache_dir) if cache_dir else _DEFAULT_CACHE_DIR

    if not force_refresh:
        cached = _load_cached(cdir, ticker, interval)
        if cached is not None and not cached.empty:
            log.debug("cache hit: %s/%s (%d rows)", ticker, interval, len(cached))
            return cached

    # Lazy import to avoid circular dependency with feed.py at module level
    try:
        import yfinance as yf  # type: ignore[import-untyped]
        df = yf.download(
            ticker,
            period="1y",
            interval=interval,
            auto_adjust=True,
            progress=False,
        )
        if df is not None and not df.empty:
            df = df.reset_index()
            df.columns = [str(c).lower().replace(" ", "_") for c in df.columns]
            _save_cached(cdir, ticker, interval, df)
            log.info("fetched %s/%s: %d rows", ticker, interval, len(df))
            return df
    except Exception as exc:
        log.warning("yfinance fetch failed for %s/%s: %s", ticker, interval, exc)

    return pd.DataFrame()


def query_cache_summaries(
    ticker: str | None = None,
    interval: str | None = None,
    date: str | None = None,
    cache_dir: Path | str | None = None,
) -> list[dict]:
    """Query fetch-summary rows from the active .dat.gz.

    Parameters
    ----------
    ticker, interval, date: optional filter values.
    cache_dir: override the default cache directory.

    Returns
    -------
    List of row dicts with keys: ticker, interval, last_ts, sha256, metadata, updated_at.
    """
    cdir = Path(cache_dir) if cache_dir else _DEFAULT_CACHE_DIR
    mgr  = _get_db_manager(cdir)
    flt: dict[str, str] = {}
    if ticker:
        flt["ticker"] = ticker
    if interval:
        flt["interval"] = interval
    if date:
        flt["date"] = date
    return mgr.query_summaries(flt)
