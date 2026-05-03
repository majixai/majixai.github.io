#!/usr/bin/env python3
"""
yfinance_fetch_action.py — Manual-trigger yfinance fetch with caching and full forecasts.

Usage (invoked by .github/workflows/yfinance_manual_fetch.yml)
--------------------------------------------------------------
  python actions/yfinance_fetch_action.py \\
      --symbols-csv actions/symbols.csv \\
      --cache-db    dbs/yfinance_cache.db \\
      --period      1mo \\
      --interval    1d \\
      --output-csv  yfinance_data/forecast_results.csv \\
      --output-json dbs/forecast_report.json \\
      [--symbols    AAPL,MSFT,TSLA]  \\
      [--category   tech_mega]       \\
      [--force-refresh]              \\
      [--top-n      10]

Cache behaviour
---------------
Results are persisted to a SQLite DataStore (``dbs/yfinance_cache.db``).
On subsequent runs the script first checks whether a ticker already has a
cached entry younger than --cache-ttl-hours (default 24 h).  Cached entries
are returned immediately; only missing or stale tickers are re-fetched from
yfinance.

Forecast types produced per ticker
-----------------------------------
1. zone          — Expansion / Consolidation / Bull-Trigger (yfinance/zones.py)
2. bayesian      — Normal-approx 24-h return projection with 95 % CI
3. neural        — BUY / HOLD / SELL signal via NeuralBridge (LSTM + EKF)
4. ou_reversion  — Ornstein-Uhlenbeck mean-reversion speed κ and half-life
5. trend         — Simple linear-regression slope over the period

Exit codes
----------
0  — Completed successfully; no bull triggers found.
1  — Aborted (no symbols to process or argument error).
2  — Completed successfully AND bull triggers were detected.  This is an
     informational signal, not an error.  The workflow treats it as success
     (``if [ $EXIT -eq 2 ]; then exit 0; fi``).
"""

from __future__ import annotations

import argparse
import csv
import gzip
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

# ── Path bootstrap ────────────────────────────────────────────────────────────
_HERE = Path(__file__).resolve().parent
_REPO = _HERE.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

from yfinance.ops import download, DataStore, NeuralBridge  # noqa: E402
from yfinance.zones import classify_ticker, classify_many    # noqa: E402

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger(__name__)

# ── Defaults ──────────────────────────────────────────────────────────────────
DEFAULT_SYMBOLS_CSV = str(_HERE / "symbols.csv")
DEFAULT_CACHE_DB    = str(_REPO / "dbs" / "yfinance_cache.db")
DEFAULT_PERIOD      = "1mo"
DEFAULT_INTERVAL    = "1d"
DEFAULT_WORKERS     = 8
DEFAULT_BATCH_SIZE  = 100
DEFAULT_CACHE_TTL   = 24         # hours
DEFAULT_OUTPUT_CSV  = str(_REPO / "yfinance_data" / "forecast_results.csv")
DEFAULT_OUTPUT_JSON = str(_REPO / "dbs" / "forecast_report.json")
DEFAULT_TOP_N       = 10


# ─────────────────────────────────────────────────────────────────────────────
# Symbol loading
# ─────────────────────────────────────────────────────────────────────────────

def load_symbols_csv(path: str, category_filter: str = "") -> List[Tuple[str, str]]:
    """
    Load (symbol, category) pairs from *path*.

    Aggregates the canonical ``actions/symbols.csv`` which is generated from
    ``yfinance_data/tickers.py`` and therefore includes every symbol known to
    the repository.  An optional *category_filter* (exact match) limits the
    result to one category.
    """
    result: List[Tuple[str, str]] = []
    csv_path = Path(path)
    if not csv_path.exists():
        logger.warning("Symbols CSV not found at %s; falling back to built-in list", path)
        return [
            ("AAPL", "tech_mega"), ("MSFT", "tech_mega"), ("GOOGL", "tech_mega"),
            ("AMZN", "tech_mega"), ("TSLA", "tech_mega"), ("NVDA", "tech_mega"),
            ("META", "tech_mega"), ("JPM", "financials"), ("V", "fintech"),
            ("JNJ", "healthcare"), ("^GSPC", "indices"), ("BTC-USD", "crypto"),
        ]
    seen: set = set()
    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            sym = row.get("symbol", "").strip()
            cat = row.get("category", "").strip()
            if not sym or sym in seen:
                continue
            if category_filter and cat != category_filter:
                continue
            seen.add(sym)
            result.append((sym, cat))
    logger.info("Loaded %d symbols from %s (category_filter=%r)", len(result), path, category_filter or "all")
    return result


def parse_override_symbols(raw: str) -> List[str]:
    """Parse a comma-separated symbol string into a deduplicated list."""
    syms = [s.strip().upper() for s in raw.split(",") if s.strip()]
    seen: set = set()
    result = []
    for s in syms:
        if s not in seen:
            seen.add(s)
            result.append(s)
    return result


# ─────────────────────────────────────────────────────────────────────────────
# Cache helpers
# ─────────────────────────────────────────────────────────────────────────────

def _cache_key(ticker: str, period: str, interval: str) -> str:
    return f"forecast:{ticker}:{period}:{interval}"


def load_from_cache(
    store: DataStore,
    ticker: str,
    period: str,
    interval: str,
    ttl_hours: int,
) -> Optional[Dict[str, Any]]:
    """Return cached forecast dict if present and younger than *ttl_hours*, else None."""
    key = _cache_key(ticker, period, interval)
    entry = store.get(key)
    if entry is None:
        return None
    fetched_at = entry.get("_fetched_at", 0.0)
    age_hours = (time.time() - fetched_at) / 3600.0
    if age_hours > ttl_hours:
        logger.debug("Cache stale for %s (age=%.1f h > ttl=%d h)", ticker, age_hours, ttl_hours)
        return None
    return entry


def save_to_cache(
    store: DataStore,
    ticker: str,
    period: str,
    interval: str,
    data: Dict[str, Any],
) -> None:
    """Persist *data* dict for *ticker* with current timestamp."""
    key = _cache_key(ticker, period, interval)
    data["_fetched_at"] = time.time()
    store.put(key, data)


# ─────────────────────────────────────────────────────────────────────────────
# Forecast helpers
# ─────────────────────────────────────────────────────────────────────────────

def _bayesian_forecast(closes: pd.Series) -> Dict[str, Any]:
    """
    Normal-approximation Bayesian projection of next-period return.

    Uses the last 20 daily returns as the likelihood, the prior
    N(0, 0.02²), and returns a posterior mean with a 95 % CI.
    """
    ret = closes.pct_change().dropna().tail(20)
    if ret.empty:
        return {}
    mu_mle = float(ret.mean())
    sigma   = float(ret.std(ddof=1)) if len(ret) > 1 else 0.02
    # Conjugate normal–normal update: prior N(0, 0.02²), likelihood N(mu_mle, sigma²/n)
    prior_mu, prior_var = 0.0, 0.02 ** 2
    lik_var = (sigma ** 2) / max(len(ret), 1)
    post_var = 1.0 / (1.0 / prior_var + 1.0 / lik_var)
    post_mu  = post_var * (prior_mu / prior_var + mu_mle / lik_var)
    ci_lo = post_mu - 1.96 * post_var ** 0.5
    ci_hi = post_mu + 1.96 * post_var ** 0.5
    last = float(closes.iloc[-1])
    return {
        "change_pct":       round(post_mu * 100, 4),
        "projected_level":  round(last * (1 + post_mu), 2),
        "ci_low":           round(last * (1 + ci_lo), 2),
        "ci_high":          round(last * (1 + ci_hi), 2),
    }


def _ou_reversion_forecast(closes: pd.Series) -> Dict[str, Any]:
    """
    Estimate Ornstein-Uhlenbeck mean-reversion speed κ and half-life.

    Uses the discrete-time OLS estimator:
        Δx_t = κ(μ − x_{t-1}) δt + ε_t

    Returns κ, long-run mean μ, and half-life in days.
    """
    x = closes.dropna().values.astype(float)
    if len(x) < 10:
        return {}
    dx   = np.diff(x)
    x_lag = x[:-1]
    # OLS: dx = a + b * x_lag  →  κ = -b, μ = -a/b
    X = np.column_stack([np.ones(len(x_lag)), x_lag])
    try:
        coeffs, _, _, _ = np.linalg.lstsq(X, dx, rcond=None)
    except np.linalg.LinAlgError:
        return {}
    a, b = float(coeffs[0]), float(coeffs[1])
    kappa = max(-b, 1e-8)
    mu_ou = (-a / b) if abs(b) > 1e-10 else float(np.mean(x))
    half_life = float(np.log(2) / kappa)
    return {
        "kappa":       round(kappa, 6),
        "long_run_mean": round(mu_ou, 4),
        "half_life_days": round(half_life, 2),
    }


def _trend_forecast(closes: pd.Series) -> Dict[str, Any]:
    """
    Simple linear-regression trend slope (% per day) over the period.

    Returns the annualised slope, R², and the direction label.
    """
    y = closes.dropna().values.astype(float)
    if len(y) < 3:
        return {}
    x = np.arange(len(y), dtype=float)
    X = np.column_stack([np.ones(len(x)), x])
    try:
        coeffs, _, _, _ = np.linalg.lstsq(X, y, rcond=None)
    except np.linalg.LinAlgError:
        return {}
    slope = float(coeffs[1])
    mean_price = float(np.mean(y)) or 1.0
    slope_pct_per_day = slope / mean_price * 100.0
    # R²
    y_hat = X @ coeffs
    ss_res = float(np.sum((y - y_hat) ** 2))
    ss_tot = float(np.sum((y - np.mean(y)) ** 2)) or 1.0
    r2 = max(0.0, 1.0 - ss_res / ss_tot)
    return {
        "slope_pct_per_day": round(slope_pct_per_day, 6),
        "annualised_slope_pct": round(slope_pct_per_day * 252, 2),
        "r_squared": round(r2, 4),
        "direction": "up" if slope > 0 else "down",
    }


def build_forecasts(ticker: str, df: pd.DataFrame) -> Dict[str, Any]:
    """
    Run all forecast modules for a single ticker DataFrame.

    Returns
    -------
    dict with keys: zone, bayesian, neural, ou_reversion, trend
    """
    forecasts: Dict[str, Any] = {"ticker": ticker, "error": None}

    if df is None or df.empty or "Close" not in df.columns:
        forecasts["error"] = "no_data"
        return forecasts

    closes = df["Close"].dropna()
    if len(closes) < 2:
        forecasts["error"] = "insufficient_rows"
        return forecasts

    # ── 1. Zone classification ────────────────────────────────────────────
    try:
        zone_result = classify_ticker(ticker, df)
        forecasts["zone"] = {
            "expansion":    zone_result.expansion,
            "consolidation": zone_result.consolidation,
            "bull_trigger":  zone_result.bull_trigger,
            "atr":           round(zone_result.atr, 4) if not np.isnan(zone_result.atr) else None,
            "atr_zscore":    round(zone_result.atr_zscore, 4) if not np.isnan(zone_result.atr_zscore) else None,
            "range_pct":     round(zone_result.range_pct, 4) if not np.isnan(zone_result.range_pct) else None,
            "session_gain_pct": round(zone_result.session_gain_pct, 4) if not np.isnan(zone_result.session_gain_pct) else None,
            "last_close":    round(zone_result.last_close, 4) if not np.isnan(zone_result.last_close) else None,
            # Extended math zones (present when zones.py has them)
            "stoch_drift":   getattr(zone_result, "stoch_drift_zone", None),
            "vector_field":  getattr(zone_result, "vector_field_zone", None),
            "geo_curvature": getattr(zone_result, "geo_curvature_zone", None),
            "fractal_dim":   getattr(zone_result, "fractal_dim_zone", None),
            "diff_form":     getattr(zone_result, "diff_form_zone", None),
        }
    except Exception as exc:
        forecasts["zone"] = {"error": str(exc)}

    # ── 2. Bayesian projection ────────────────────────────────────────────
    try:
        forecasts["bayesian"] = _bayesian_forecast(closes)
    except Exception as exc:
        forecasts["bayesian"] = {"error": str(exc)}

    # ── 3. Neural BUY/HOLD/SELL signal ───────────────────────────────────
    try:
        bridge = NeuralBridge()
        close_arr  = closes.values.astype(np.float64)
        vol_col    = df["Volume"].dropna().values.astype(np.float64) if "Volume" in df.columns else np.ones_like(close_arr)
        high_arr   = df["High"].dropna().values.astype(np.float64)  if "High"   in df.columns else None
        low_arr    = df["Low"].dropna().values.astype(np.float64)   if "Low"    in df.columns else None
        forecasts["neural"] = bridge.infer(
            close=close_arr, volume=vol_col,
            high=high_arr,   low=low_arr,
        )
    except Exception as exc:
        forecasts["neural"] = {"error": str(exc)}

    # ── 4. OU mean-reversion ──────────────────────────────────────────────
    try:
        forecasts["ou_reversion"] = _ou_reversion_forecast(closes)
    except Exception as exc:
        forecasts["ou_reversion"] = {"error": str(exc)}

    # ── 5. Trend ─────────────────────────────────────────────────────────
    try:
        forecasts["trend"] = _trend_forecast(closes)
    except Exception as exc:
        forecasts["trend"] = {"error": str(exc)}

    return forecasts


# ─────────────────────────────────────────────────────────────────────────────
# Batch fetch
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_batch(batch: List[str], period: str, interval: str, retry: int = 2) -> pd.DataFrame:
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
        except Exception as exc:
            if attempt < retry:
                wait = 2 ** attempt
                logger.warning("Batch attempt %d failed (%s); retrying in %ds", attempt + 1, exc, wait)
                time.sleep(wait)
            else:
                logger.error("Batch failed after %d attempts: %s", retry + 1, exc)
                return pd.DataFrame()
    return pd.DataFrame()


def fetch_ticker_frames(
    tickers: List[str],
    period: str,
    interval: str,
    batch_size: int = DEFAULT_BATCH_SIZE,
    workers: int = DEFAULT_WORKERS,
) -> Dict[str, pd.DataFrame]:
    """Download OHLCV data for all *tickers* in parallel batches."""
    batches = [tickers[i: i + batch_size] for i in range(0, len(tickers), batch_size)]
    logger.info("Fetching %d tickers in %d batches (workers=%d)", len(tickers), len(batches), workers)

    frames: Dict[str, pd.DataFrame] = {}
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futs = {pool.submit(_fetch_batch, b, period, interval): b for b in batches}
        for fut in as_completed(futs):
            batch = futs[fut]
            try:
                batch_df = fut.result()
            except Exception as exc:
                logger.error("Batch %s failed: %s", batch[:3], exc)
                for sym in batch:
                    frames[sym] = pd.DataFrame()
                continue

            if batch_df is None or batch_df.empty:
                for sym in batch:
                    frames[sym] = pd.DataFrame()
                continue

            if isinstance(batch_df.columns, pd.MultiIndex):
                present = set(batch_df.columns.get_level_values(1))
                for sym in batch:
                    if sym in present:
                        frames[sym] = batch_df.xs(sym, level=1, axis=1, drop_level=True)
                    else:
                        frames[sym] = pd.DataFrame()
            else:
                if len(batch) == 1:
                    frames[batch[0]] = batch_df
                else:
                    for sym in batch:
                        frames[sym] = pd.DataFrame()

    logger.info("Fetch complete: %d frames returned", len(frames))
    return frames


# ─────────────────────────────────────────────────────────────────────────────
# Output writers
# ─────────────────────────────────────────────────────────────────────────────

def write_output_csv(results: List[Dict[str, Any]], path: str) -> None:
    """Write a flat CSV of forecast results — one row per ticker."""
    if not results:
        logger.warning("No results to write to CSV.")
        return
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    fieldnames = [
        "ticker", "error",
        # zone
        "zone_expansion", "zone_consolidation", "zone_bull_trigger",
        "zone_last_close", "zone_atr", "zone_atr_zscore",
        "zone_range_pct", "zone_session_gain_pct",
        "zone_stoch_drift", "zone_vector_field", "zone_geo_curvature",
        "zone_fractal_dim", "zone_diff_form",
        # bayesian
        "bay_change_pct", "bay_projected_level", "bay_ci_low", "bay_ci_high",
        # neural
        "neural_signal", "neural_buy_prob", "neural_hold_prob", "neural_sell_prob",
        "neural_confidence", "neural_method",
        # ou_reversion
        "ou_kappa", "ou_long_run_mean", "ou_half_life_days",
        # trend
        "trend_slope_pct_per_day", "trend_annualised_pct",
        "trend_r_squared", "trend_direction",
    ]

    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction="ignore")
        writer.writeheader()
        for r in results:
            zone    = r.get("zone") or {}
            bay     = r.get("bayesian") or {}
            neural  = r.get("neural") or {}
            ou      = r.get("ou_reversion") or {}
            trend   = r.get("trend") or {}
            writer.writerow({
                "ticker":  r.get("ticker", ""),
                "error":   r.get("error") or "",
                "zone_expansion":          zone.get("expansion"),
                "zone_consolidation":      zone.get("consolidation"),
                "zone_bull_trigger":       zone.get("bull_trigger"),
                "zone_last_close":         zone.get("last_close"),
                "zone_atr":                zone.get("atr"),
                "zone_atr_zscore":         zone.get("atr_zscore"),
                "zone_range_pct":          zone.get("range_pct"),
                "zone_session_gain_pct":   zone.get("session_gain_pct"),
                "zone_stoch_drift":        zone.get("stoch_drift"),
                "zone_vector_field":       zone.get("vector_field"),
                "zone_geo_curvature":      zone.get("geo_curvature"),
                "zone_fractal_dim":        zone.get("fractal_dim"),
                "zone_diff_form":          zone.get("diff_form"),
                "bay_change_pct":          bay.get("change_pct"),
                "bay_projected_level":     bay.get("projected_level"),
                "bay_ci_low":              bay.get("ci_low"),
                "bay_ci_high":             bay.get("ci_high"),
                "neural_signal":           neural.get("signal"),
                "neural_buy_prob":         neural.get("buy_prob"),
                "neural_hold_prob":        neural.get("hold_prob"),
                "neural_sell_prob":        neural.get("sell_prob"),
                "neural_confidence":       neural.get("confidence"),
                "neural_method":           neural.get("method"),
                "ou_kappa":                ou.get("kappa"),
                "ou_long_run_mean":        ou.get("long_run_mean"),
                "ou_half_life_days":       ou.get("half_life_days"),
                "trend_slope_pct_per_day": trend.get("slope_pct_per_day"),
                "trend_annualised_pct":    trend.get("annualised_slope_pct"),
                "trend_r_squared":         trend.get("r_squared"),
                "trend_direction":         trend.get("direction"),
            })
    logger.info("Forecast CSV written to %s (%d rows)", path, len(results))


def write_output_json(
    results: List[Dict[str, Any]],
    path: str,
    category_map: Dict[str, str],
    run_meta: Dict[str, Any],
) -> None:
    """Write the full JSON report with summary stats and per-ticker forecasts."""
    Path(path).parent.mkdir(parents=True, exist_ok=True)

    bull_triggers     = [r["ticker"] for r in results if (r.get("zone") or {}).get("bull_trigger")]
    expansion_zones   = [r["ticker"] for r in results if (r.get("zone") or {}).get("expansion")]
    consolidation     = [r["ticker"] for r in results if (r.get("zone") or {}).get("consolidation")]
    buy_signals       = [r["ticker"] for r in results if (r.get("neural") or {}).get("signal") == "BUY"]
    sell_signals      = [r["ticker"] for r in results if (r.get("neural") or {}).get("signal") == "SELL"]
    uptrend           = [r["ticker"] for r in results if (r.get("trend") or {}).get("direction") == "up"]
    errors            = [r["ticker"] for r in results if r.get("error")]

    report = {
        "meta": {
            **run_meta,
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_tickers": len(results),
            "errors": len(errors),
        },
        "summary": {
            "bull_triggers":   bull_triggers,
            "expansion_zones": expansion_zones,
            "consolidation":   consolidation,
            "neural_buy":      buy_signals,
            "neural_sell":     sell_signals,
            "uptrend":         uptrend,
        },
        "tickers": {
            r["ticker"]: {
                "category": category_map.get(r["ticker"], ""),
                **{k: v for k, v in r.items() if k != "ticker"},
            }
            for r in results
        },
    }

    with open(path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2, default=str)
    logger.info("JSON report written to %s", path)


# ─────────────────────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────────────────────

def parse_args(argv: Optional[List[str]] = None) -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Manual yfinance fetch with cache and multi-type forecasts",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--symbols-csv",    default=DEFAULT_SYMBOLS_CSV,
                   help="Path to symbols CSV (symbol,category columns)")
    p.add_argument("--symbols",        default="",
                   help="Comma-separated override symbols; skips CSV category filtering")
    p.add_argument("--category",       default="",
                   help="Filter to a single category from symbols-csv")
    p.add_argument("--cache-db",       default=DEFAULT_CACHE_DB,
                   help="SQLite cache database path (DataStore)")
    p.add_argument("--cache-ttl-hours", type=int, default=DEFAULT_CACHE_TTL,
                   help="Hours before a cached entry is considered stale")
    p.add_argument("--force-refresh",  action="store_true",
                   help="Bypass cache and re-fetch all tickers")
    p.add_argument("--period",         default=DEFAULT_PERIOD,
                   help="yfinance period (e.g. 1mo, 3mo, 1y)")
    p.add_argument("--interval",       default=DEFAULT_INTERVAL,
                   help="yfinance interval (e.g. 1d, 1h)")
    p.add_argument("--workers",        type=int, default=DEFAULT_WORKERS,
                   help="Parallel download threads")
    p.add_argument("--batch-size",     type=int, default=DEFAULT_BATCH_SIZE,
                   help="Tickers per yfinance.download call")
    p.add_argument("--output-csv",     default=DEFAULT_OUTPUT_CSV,
                   help="Path for the flat forecast results CSV")
    p.add_argument("--output-json",    default=DEFAULT_OUTPUT_JSON,
                   help="Path for the full JSON report")
    p.add_argument("--top-n",          type=int, default=DEFAULT_TOP_N,
                   help="Log top-N tickers per zone/signal category")
    p.add_argument("--limit",          type=int, default=0,
                   help="Process at most N symbols (0 = no limit)")
    return p.parse_args(argv)


def main(argv: Optional[List[str]] = None) -> int:
    args = parse_args(argv)

    # ── 1. Build symbol list ─────────────────────────────────────────────
    if args.symbols:
        raw_syms = parse_override_symbols(args.symbols)
        sym_pairs = [(s, "") for s in raw_syms]
        logger.info("Using %d override symbols from --symbols", len(sym_pairs))
    else:
        sym_pairs = load_symbols_csv(args.symbols_csv, category_filter=args.category)

    if args.limit and args.limit > 0:
        sym_pairs = sym_pairs[: args.limit]

    category_map = {sym: cat for sym, cat in sym_pairs}
    all_tickers  = [sym for sym, _ in sym_pairs]

    if not all_tickers:
        logger.error("No symbols to process — exiting.")
        return 1

    logger.info("Processing %d tickers (period=%s, interval=%s)", len(all_tickers), args.period, args.interval)

    # ── 2. Open cache ────────────────────────────────────────────────────
    Path(args.cache_db).parent.mkdir(parents=True, exist_ok=True)
    store = DataStore(args.cache_db)
    logger.info("Cache DB: %s (ttl=%d h, force_refresh=%s)", args.cache_db, args.cache_ttl_hours, args.force_refresh)

    # ── 3. Partition: cache hits vs. need-fetch ──────────────────────────
    cached_results: List[Dict[str, Any]] = []
    to_fetch: List[str] = []

    for ticker in all_tickers:
        if not args.force_refresh:
            hit = load_from_cache(store, ticker, args.period, args.interval, args.cache_ttl_hours)
            if hit is not None:
                cached_results.append(hit)
                logger.debug("Cache HIT: %s", ticker)
                continue
        to_fetch.append(ticker)

    logger.info("Cache hits: %d | To fetch: %d", len(cached_results), len(to_fetch))

    # ── 4. Fetch and forecast uncached tickers ───────────────────────────
    fresh_results: List[Dict[str, Any]] = []

    if to_fetch:
        frames = fetch_ticker_frames(
            to_fetch,
            period=args.period,
            interval=args.interval,
            batch_size=args.batch_size,
            workers=args.workers,
        )

        for ticker in to_fetch:
            df = frames.get(ticker, pd.DataFrame())
            result = build_forecasts(ticker, df)
            fresh_results.append(result)
            save_to_cache(store, ticker, args.period, args.interval, result)

    store.close()

    # ── 5. Combine and sort by original order ────────────────────────────
    result_map: Dict[str, Dict[str, Any]] = {}
    for r in cached_results + fresh_results:
        result_map[r["ticker"]] = r
    all_results = [result_map[t] for t in all_tickers if t in result_map]

    # ── 6. Log summary ───────────────────────────────────────────────────
    bull_triggers   = [r["ticker"] for r in all_results if (r.get("zone") or {}).get("bull_trigger")]
    buy_signals     = [r["ticker"] for r in all_results if (r.get("neural") or {}).get("signal") == "BUY"]
    expansion_zones = [r["ticker"] for r in all_results if (r.get("zone") or {}).get("expansion")]
    errors          = [r["ticker"] for r in all_results if r.get("error")]

    logger.info(
        "Results — total: %d | errors: %d | expansion: %d | bull triggers: %d | neural BUY: %d",
        len(all_results), len(errors), len(expansion_zones), len(bull_triggers), len(buy_signals),
    )
    n = args.top_n
    if bull_triggers:
        logger.info("🚀 BULL TRIGGERS (top %d): %s", n, bull_triggers[:n])
    if buy_signals:
        logger.info("🟢 NEURAL BUY (top %d): %s", n, buy_signals[:n])
    if expansion_zones:
        logger.info("📈 EXPANSION ZONES (top %d): %s", n, expansion_zones[:n])

    # ── 7. Write outputs ─────────────────────────────────────────────────
    if args.output_csv:
        write_output_csv(all_results, args.output_csv)

    if args.output_json:
        run_meta = {
            "period": args.period,
            "interval": args.interval,
            "symbols_csv": args.symbols_csv,
            "category_filter": args.category,
            "force_refresh": args.force_refresh,
            "cache_ttl_hours": args.cache_ttl_hours,
            "cached_hits": len(cached_results),
            "freshly_fetched": len(fresh_results),
        }
        write_output_json(all_results, args.output_json, category_map, run_meta)

    return 0 if not bull_triggers else 2


if __name__ == "__main__":
    sys.exit(main())
