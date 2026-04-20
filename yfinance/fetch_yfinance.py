#!/usr/bin/env python3
"""
fetch_yfinance.py — CLI entry point for the Top-Heavy reporting pipeline.

Usage
-----
# Process up to 1,500 tickers, write compressed data and text summary:
python yfinance/fetch_yfinance.py --limit 1500 --output raw_data.dat --summary summary.txt

# Also write the full Markdown report:
python yfinance/fetch_yfinance.py --limit 500 --report forecast_report.md

# Dry-run (no yfinance downloads) using cached data file:
python yfinance/fetch_yfinance.py --dat-in raw_data.dat --report forecast_report.md --no-fetch
"""

from __future__ import annotations

import argparse
import gzip
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd

# ── Repository path bootstrap ─────────────────────────────────────────────────
_HERE = Path(__file__).resolve().parent
_REPO = _HERE.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from yfinance.ops import download  # noqa: E402 – repo facade
from yfinance.zones import (  # noqa: E402
    ZoneResult,
    ZoneSummary,
    classify_ticker,
    classify_many,
)
from yfinance.report import build_report, write_summary_txt  # noqa: E402

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Defaults ──────────────────────────────────────────────────────────────────
DEFAULT_PERIOD = "1mo"
DEFAULT_INTERVAL = "1d"
DEFAULT_WORKERS = 8
DEFAULT_BATCH_SIZE = 200   # tickers per yfinance.download call
DEFAULT_LIMIT = 1500


# ── Ticker list helpers ───────────────────────────────────────────────────────

def _load_tickers(limit: int) -> List[str]:
    """Return up to *limit* unique tickers from yfinance_data/tickers.py."""
    tickers_py = _REPO / "yfinance_data" / "tickers.py"
    if tickers_py.exists():
        import importlib.util

        spec = importlib.util.spec_from_file_location("_yfdata_tickers", tickers_py)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        tickers = mod.get_unique_tickers()
        return tickers[:limit]

    # Fallback: small built-in list when yfinance_data is unavailable
    fallback = [
        "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA",
        "META", "NVDA", "JPM", "V", "JNJ",
        "^GSPC", "BTC-USD",
    ]
    return fallback[:limit]


# ── Network fetch helpers ─────────────────────────────────────────────────────

def _fetch_batch(
    batch: List[str],
    period: str,
    interval: str,
    retry: int = 2,
) -> pd.DataFrame:
    """Download a batch of tickers with simple retry logic."""
    for attempt in range(retry + 1):
        try:
            df = download(
                tickers=batch,
                period=period,
                interval=interval,
                group_by="ticker",
                auto_adjust=True,
                progress=False,
                timeout=60,
            )
            return df
        except Exception as exc:  # noqa: BLE001
            if attempt < retry:
                wait = 2 ** attempt
                logger.warning("Batch fetch attempt %d failed (%s); retrying in %ds", attempt + 1, exc, wait)
                time.sleep(wait)
            else:
                logger.error("Batch fetch failed after %d attempts: %s", retry + 1, exc)
                return pd.DataFrame()
    return pd.DataFrame()


def fetch_all_frames(
    tickers: List[str],
    period: str = DEFAULT_PERIOD,
    interval: str = DEFAULT_INTERVAL,
    batch_size: int = DEFAULT_BATCH_SIZE,
    workers: int = DEFAULT_WORKERS,
) -> Dict[str, pd.DataFrame]:
    """
    Download OHLCV data for all *tickers* in batches.

    Returns
    -------
    dict mapping symbol → DataFrame
    """
    batches = [tickers[i: i + batch_size] for i in range(0, len(tickers), batch_size)]
    logger.info("Fetching %d tickers in %d batches (workers=%d)", len(tickers), len(batches), workers)

    ticker_frames: Dict[str, pd.DataFrame] = {}

    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(_fetch_batch, b, period, interval): b for b in batches}
        for fut in as_completed(futs):
            batch = futs[fut]
            try:
                batch_df = fut.result()
            except Exception as exc:  # noqa: BLE001
                logger.error("Batch %s failed: %s", batch[:3], exc)
                for sym in batch:
                    ticker_frames[sym] = pd.DataFrame()
                continue

            if batch_df is None or batch_df.empty:
                for sym in batch:
                    ticker_frames[sym] = pd.DataFrame()
                continue

            # Unpack multi-level columns
            if isinstance(batch_df.columns, pd.MultiIndex):
                present = set(batch_df.columns.get_level_values(1))
                for sym in batch:
                    if sym in present:
                        sub = batch_df.xs(sym, level=1, axis=1, drop_level=True)
                        ticker_frames[sym] = sub
                    else:
                        ticker_frames[sym] = pd.DataFrame()
            else:
                # Single-ticker case
                if len(batch) == 1:
                    ticker_frames[batch[0]] = batch_df
                else:
                    for sym in batch:
                        ticker_frames[sym] = pd.DataFrame()

    logger.info("Fetch complete: %d tickers", len(ticker_frames))
    return ticker_frames


# ── .dat serialisation helpers ────────────────────────────────────────────────

def _save_dat(results: List[ZoneResult], path: str) -> None:
    """Serialise ZoneResult list to a gzip-compressed JSON .dat file."""
    data = [r.to_dict() for r in results]
    payload = json.dumps(data, separators=(",", ":")).encode("utf-8")
    with gzip.open(path, "wb") as fh:
        fh.write(payload)
    logger.info("Saved %d records to %s (%.1f KB)", len(data), path, Path(path).stat().st_size / 1024)


def _load_dat(path: str) -> List[Dict[str, Any]]:
    """Load a .dat file produced by _save_dat."""
    with gzip.open(path, "rb") as fh:
        return json.loads(fh.read().decode("utf-8"))


# ── Projection stub ───────────────────────────────────────────────────────────

def _build_projections(frames: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
    """
    Generate simple Bayesian-style projections for S&P 500 and BTC.

    Uses the last 20 daily returns to estimate a posterior mean and a 95%
    confidence interval via a normal-approximation likelihood.
    """
    projections: Dict[str, Any] = {}

    def _project(sym: str, alias: str) -> None:
        df = frames.get(sym)
        if df is None or df.empty or "Close" not in df.columns:
            return
        closes = df["Close"].dropna()
        if len(closes) < 2:
            return
        returns = closes.pct_change().dropna().tail(20)
        if returns.empty:
            return
        mu = float(returns.mean())
        sigma = float(returns.std(ddof=1)) if len(returns) > 1 else 0.0
        # 95 % CI on next-period return
        ci_lo_ret = mu - 1.96 * sigma
        ci_hi_ret = mu + 1.96 * sigma
        last_price = float(closes.iloc[-1])
        projections[alias] = {
            "change_pct": round(mu * 100, 4),
            "projected_level": round(last_price * (1 + mu), 2),
            "ci_low": round(last_price * (1 + ci_lo_ret), 2),
            "ci_high": round(last_price * (1 + ci_hi_ret), 2),
        }

    _project("^GSPC", "sp500")
    _project("BTC-USD", "btc")
    return projections


# ── Main ──────────────────────────────────────────────────────────────────────

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Top-Heavy yfinance pipeline: fetch → classify zones → generate report",
    )
    p.add_argument("--limit", type=int, default=DEFAULT_LIMIT,
                   help="Maximum number of tickers to process (default: %(default)s)")
    p.add_argument("--period", default=DEFAULT_PERIOD,
                   help="yfinance period string (default: %(default)s)")
    p.add_argument("--interval", default=DEFAULT_INTERVAL,
                   help="yfinance interval string (default: %(default)s)")
    p.add_argument("--workers", type=int, default=DEFAULT_WORKERS,
                   help="Parallel download workers (default: %(default)s)")
    p.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE,
                   help="Tickers per yfinance.download call (default: %(default)s)")
    p.add_argument("--output", default="",
                   help="Write gzip-compressed .dat snapshot to this path")
    p.add_argument("--summary", default="",
                   help="Write machine-readable summary.txt to this path")
    p.add_argument("--report", default="",
                   help="Write full Top-Heavy Markdown report to this path")
    p.add_argument("--dat-in", default="",
                   help="Load results from an existing .dat file (skips download)")
    p.add_argument("--no-fetch", action="store_true",
                   help="Skip network fetch; requires --dat-in")
    p.add_argument("--top-n", type=int, default=5,
                   help="Number of top tickers per zone section (default: %(default)s)")
    return p.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    # ── 1. Obtain per-ticker DataFrames ──────────────────────────────────────
    all_results: List[ZoneResult] = []

    if args.no_fetch:
        if not args.dat_in:
            logger.error("--no-fetch requires --dat-in")
            return 1
        logger.info("Loading cached data from %s", args.dat_in)
        raw = _load_dat(args.dat_in)
        # Reconstruct minimal ZoneResult objects from stored dicts
        from yfinance.zones import ZoneResult as ZR  # noqa: PLC0415
        import numpy as np
        for d in raw:
            r = ZR(ticker=d.get("ticker", "?"))
            r.expansion = bool(d.get("expansion"))
            r.consolidation = bool(d.get("consolidation"))
            r.bull_trigger = bool(d.get("bull_trigger"))
            for attr in ("atr", "atr_zscore", "range_pct", "session_gain_pct", "last_close"):
                val = d.get(attr)
                setattr(r, attr, float(val) if val is not None else float("nan"))
            r.error = d.get("error")
            all_results.append(r)

        # Rebuild ZoneSummary from the results
        summary = ZoneSummary(total=len(all_results))
        for r in all_results:
            if r.error:
                summary.errors.append(r)
            else:
                if r.expansion:
                    summary.expansion_zones.append(r)
                if r.consolidation:
                    summary.consolidation_zones.append(r)
                if r.bull_trigger:
                    summary.bull_triggers.append(r)
        projections: Dict[str, Any] = {}

    else:
        tickers = _load_tickers(args.limit)
        logger.info("Processing %d tickers", len(tickers))

        ticker_frames = fetch_all_frames(
            tickers,
            period=args.period,
            interval=args.interval,
            batch_size=args.batch_size,
            workers=args.workers,
        )

        summary = classify_many(ticker_frames)

        # Build flat all_results list preserving input order
        result_map: Dict[str, ZoneResult] = {}
        for r in (
            summary.expansion_zones
            + summary.consolidation_zones
            + summary.bull_triggers
            + summary.errors
        ):
            result_map[r.ticker] = r
        all_results = [result_map[t] for t in tickers if t in result_map]

        projections = _build_projections(ticker_frames)

    # ── 2. Log highlights ────────────────────────────────────────────────────
    logger.info(
        "Summary: %d expansion, %d consolidation, %d bull triggers",
        len(summary.expansion_zones),
        len(summary.consolidation_zones),
        len(summary.bull_triggers),
    )
    if summary.bull_triggers:
        logger.info("🚀 BULL TRIGGERS: %s", [r.ticker for r in summary.bull_triggers])

    # ── 3. Persist outputs ───────────────────────────────────────────────────
    if args.output:
        _save_dat(all_results, args.output)

    if args.summary:
        write_summary_txt(summary, args.summary)
        logger.info("Summary written to %s", args.summary)

    if args.report:
        md = build_report(
            summary,
            projections=projections or None,
            all_results=all_results,
            top_n=args.top_n,
        )
        Path(args.report).write_text(md, encoding="utf-8")
        logger.info("Report written to %s", args.report)

    # Exit code signals whether bull triggers were found (useful for CI shell logic)
    return 0 if not summary.bull_triggers else 2


if __name__ == "__main__":
    sys.exit(main())
