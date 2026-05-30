"""
Async feed engine — per-ticker processing and manifest generation.

``FeedEngine`` is the central orchestrator.  It fetches data from all
configured sources in parallel, runs technical analysis, detects
anomalies, fuses signals, and writes Pine Script seed files.

``run_all()`` is a convenience coroutine that uses the default ticker
universe from ``config.py``.
"""

from __future__ import annotations

import asyncio
import concurrent.futures
import gzip
import json
import logging
import os
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

from ..config import (
    DATA_DIRS,
    SEED_HEADER,
    SEEDS_DIR,
    TA_BB_PERIOD,
    THREAD_POOL_WORKERS,
    TICKERS,
)
from ..indicators.ta import compute_ta
from ..signals.anomaly import detect_anomalies
from ..signals.correlation import build_corr_matrix, update_corr_cache
from ..signals.fusion import fuse_signals
from ..signals.quality import compute_seed_quality

log = logging.getLogger(__name__)


# ── I/O helpers ───────────────────────────────────────────────────────────────

def _tolower(v: Any) -> Any:
    if isinstance(v, str):
        return v.lower()
    if isinstance(v, dict):
        return {_tolower(k): _tolower(vv) for k, vv in v.items()}
    if isinstance(v, list):
        return [_tolower(i) for i in v]
    return v


def _load_json(path: Path) -> dict:
    try:
        with open(path, "r") as f:
            return _tolower(json.load(f))
    except Exception as e:
        log.warning("json load failed %s: %s", path, e)
        return {}


def _load_yfinance_dat(path: Path, ticker: str) -> pd.DataFrame:
    try:
        with gzip.open(path, "rb") as gz:
            raw = gz.read()
        fd, tmp = tempfile.mkstemp(suffix=".db", prefix="uf_yf_")
        try:
            os.write(fd, raw)
            os.close(fd)
            con = sqlite3.connect(tmp)
            df  = pd.read_sql_query(
                "select date,open,high,low,close,volume from prices "
                "where lower(ticker)=? order by date desc limit 60",
                con,
                params=(ticker.lower(),),
            )
            con.close()
        finally:
            os.unlink(tmp)
        return df
    except Exception as e:
        log.warning("yfinance dat load failed for %s: %s", ticker, e)
        return pd.DataFrame()


def _load_csv_tail(path: Path, n: int = 60) -> pd.DataFrame:
    try:
        df = pd.read_csv(path)
        df.columns = [c.lower().strip() for c in df.columns]
        return df.tail(n).reset_index(drop=True)
    except Exception as e:
        log.warning("csv load failed %s: %s", path, e)
        return pd.DataFrame()


def _epoch(date_str: Any) -> int:
    try:
        dt = pd.to_datetime(str(date_str))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except Exception:
        return int(time.time())


# ── Tensor aggregation ────────────────────────────────────────────────────────

def _tensor_agg(
    ohlcv_df: pd.DataFrame,
    sp_data:  dict,
    mp_data:  dict,
    gf_data:  dict,
    ta:       dict,
    fusion:   dict,
) -> list[tuple]:
    rows = []
    if ohlcv_df.empty:
        return rows

    closes = ohlcv_df["close"].values.astype(float)
    highs  = ohlcv_df["high"].values.astype(float)   if "high"   in ohlcv_df.columns else closes
    lows   = ohlcv_df["low"].values.astype(float)    if "low"    in ohlcv_df.columns else closes
    opens  = ohlcv_df["open"].values.astype(float)   if "open"   in ohlcv_df.columns else closes
    vols   = ohlcv_df["volume"].values.astype(float)  if "volume" in ohlcv_df.columns else np.ones_like(closes)

    n = len(closes)
    if n < 2:
        return rows

    rets   = np.diff(np.log(np.clip(closes, 1e-9, None)))
    vol_20 = np.std(rets[-20:]) * np.sqrt(252) if len(rets) >= 20 else np.std(rets) * np.sqrt(252)

    sp_proj  = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("projected_close", closes[-1]))
    sp_res   = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("resistance",      highs[-1]))
    sp_sup   = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("support",         lows[-1]))
    mp_tgt   = float(mp_data.get("prediction", {}).get("target_price",  closes[-1]))
    mp_res   = float(mp_data.get("prediction", {}).get("resistance",    highs[-1]))
    mp_sup   = float(mp_data.get("prediction", {}).get("support",       lows[-1]))
    gf_price = float(gf_data.get("price", closes[-1]) if gf_data else closes[-1])

    bb_mid   = ta.get("bb_mid") or closes[-1]
    vwap_val = ta.get("vwap")   or closes[-1]
    avg_rng  = float(np.mean(highs[-20:] - lows[-20:])) if n >= 20 else float(np.mean(highs - lows))

    fusion_sc = fusion.get("composite_score", 0.0)
    adj_delta = avg_rng * 0.3 * fusion_sc

    agg_close_tensor = np.array([sp_proj, mp_tgt, gf_price, closes[-1], bb_mid + adj_delta])
    agg_high_tensor  = np.array([sp_res, mp_res, highs[-1] + avg_rng * 0.5,
                                  (ta.get("bb_upper") or highs[-1])])
    agg_low_tensor   = np.array([sp_sup, mp_sup, lows[-1] - avg_rng * 0.5,
                                  (ta.get("bb_lower") or lows[-1])])

    w_close = np.array([0.30, 0.25, 0.15, 0.20, 0.10])
    agg_c   = float(np.dot(w_close, agg_close_tensor))
    agg_h   = float(np.max(agg_high_tensor))
    agg_l   = float(np.min(agg_low_tensor))

    bull_score_raw = float(
        (1.0 if sp_data.get("signal", "neutral").lower() == "bullish" else 0.0) * 0.35
        + (1.0 if mp_data.get("prediction", {}).get("signal", "neutral").lower() == "bullish" else 0.0) * 0.35
        + max(0.0, fusion_sc) * 0.30
    )
    bull_vol = int(np.clip(bull_score_raw * 1e7, 0, 1e9))

    date_col_name = None
    for possible in ("date", "time", "datetime"):
        if possible in ohlcv_df.columns:
            date_col_name = possible
            break

    for i in range(n):
        ts = _epoch(ohlcv_df.iloc[i][date_col_name]) if date_col_name else (
            int(time.time()) - (n - 1 - i) * 86400
        )
        if i < n - 1:
            rows.append((ts, opens[i], highs[i], lows[i], closes[i], int(vols[i])))
        else:
            rows.append((ts, opens[i], agg_h, agg_l, agg_c, bull_vol))

    return rows


# ── Seed writer ───────────────────────────────────────────────────────────────

def _write_seed(ticker: str, rows: list[tuple], seeds_dir: Path) -> str:
    sym = "unified_" + ticker.lower().replace("-", "")
    out = seeds_dir / f"{sym.upper()}.csv"
    lines = [SEED_HEADER]
    for r in rows:
        lines.append(",".join(str(x) for x in r) + "\n")
    with open(out, "w") as f:
        f.writelines(lines)
    log.info("wrote seed %s (%d rows)", out.name, len(rows))
    return str(out)


# ── Per-ticker async fetch helpers ────────────────────────────────────────────

async def _fetch_sp(_ticker: str, dirs: dict) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _load_json, dirs["sp"])


async def _fetch_mp(_ticker: str, dirs: dict) -> dict:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _load_json, dirs["mp"])


async def _fetch_gf(ticker: str, dirs: dict) -> dict:
    loop = asyncio.get_event_loop()
    d = await loop.run_in_executor(None, _load_json, dirs["gf"])
    quotes = d.get("quotes", [])
    for q in quotes:
        if q.get("ticker", "").lower().replace("-", "") == ticker.lower().replace("-", ""):
            return q
    return {}


async def _fetch_yf(ticker: str, dirs: dict) -> pd.DataFrame:
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, _load_yfinance_dat, dirs["yf"], ticker)


async def _fetch_gh(ticker: str, dirs: dict) -> pd.DataFrame:
    loop = asyncio.get_event_loop()
    sym  = ticker.upper().replace("-", "") + "_1MO_1D_LITE"
    p    = dirs["gh"] / f"{sym}.csv"
    if not p.exists():
        p = dirs["gh"] / f"{ticker.upper()}_1mo_1d_lite.csv"
    return await loop.run_in_executor(None, _load_csv_tail, p, 30)


async def _fetch_idx(ticker: str, dirs: dict) -> pd.DataFrame:
    loop = asyncio.get_event_loop()
    sym  = ticker.upper().replace("-", "") + "_1m"
    p    = dirs["idx"] / f"{sym}.csv"
    if not p.exists():
        return pd.DataFrame()
    return await loop.run_in_executor(None, _load_csv_tail, p, 390)


# ── FeedEngine ────────────────────────────────────────────────────────────────

class FeedEngine:
    """
    Orchestrates per-ticker data fetching, TA, signal fusion, and seed writing.

    Parameters
    ----------
    tickers:
        List of ticker symbols to process.  Defaults to ``config.TICKERS``.
    data_dirs:
        Dict mapping source keys to ``Path`` objects.  Defaults to
        ``config.DATA_DIRS``.
    seeds_dir:
        Directory to write Pine Script seed CSV files.  Defaults to
        ``config.SEEDS_DIR``.
    workers:
        Number of threads for the async executor pool.
    """

    def __init__(
        self,
        tickers:   list[str] | None = None,
        data_dirs: dict | None      = None,
        seeds_dir: Path | None      = None,
        workers:   int              = THREAD_POOL_WORKERS,
    ) -> None:
        self.tickers   = tickers   or list(TICKERS)
        self.data_dirs = data_dirs or dict(DATA_DIRS)
        self.seeds_dir = seeds_dir or SEEDS_DIR
        self.workers   = workers
        self.seeds_dir.mkdir(parents=True, exist_ok=True)

    async def process_ticker(self, ticker: str) -> dict | None:
        """Fetch, analyse, and write seed for a single *ticker*."""
        tk   = ticker.lower()
        loop = asyncio.get_event_loop()

        sp_data, mp_data, gf_data, yf_df, gh_df, _idx_df = await asyncio.gather(
            _fetch_sp(tk, self.data_dirs),
            _fetch_mp(tk, self.data_dirs),
            _fetch_gf(tk, self.data_dirs),
            _fetch_yf(tk, self.data_dirs),
            _fetch_gh(tk, self.data_dirs),
            _fetch_idx(tk, self.data_dirs),
            return_exceptions=True,
        )

        sp_data = sp_data if isinstance(sp_data, dict)         else {}
        mp_data = mp_data if isinstance(mp_data, dict)         else {}
        gf_data = gf_data if isinstance(gf_data, dict)         else {}
        yf_df   = yf_df   if isinstance(yf_df,   pd.DataFrame) else pd.DataFrame()
        gh_df   = gh_df   if isinstance(gh_df,   pd.DataFrame) else pd.DataFrame()

        ohlcv = yf_df if not yf_df.empty else gh_df
        if ohlcv.empty:
            log.warning("no ohlcv data for %s", tk)
            return None

        ta      = await loop.run_in_executor(None, compute_ta,           ohlcv)
        anomaly = await loop.run_in_executor(None, detect_anomalies,     ohlcv)
        quality = await loop.run_in_executor(None, compute_seed_quality, ohlcv, ta, anomaly)

        update_corr_cache(tk, ohlcv)

        fusion = fuse_signals(ta, sp_data, mp_data, gf_data, anomaly)

        rows = await loop.run_in_executor(
            None, _tensor_agg, ohlcv, sp_data, mp_data, gf_data, ta, fusion
        )
        if not rows:
            return None

        seed_path = await loop.run_in_executor(
            None, _write_seed, tk, rows, self.seeds_dir
        )
        return {
            "ticker":  tk,
            "seed":    str(Path(seed_path).name).lower(),
            "rows":    len(rows),
            "quality": quality,
            "fusion":  fusion,
            "ta":      ta,
            "anomaly": anomaly,
        }

    async def run(self) -> dict:
        """
        Process all configured tickers and write the manifest JSON.

        Returns the manifest dict.
        """
        log.info("FeedEngine starting — %d tickers", len(self.tickers))

        with concurrent.futures.ThreadPoolExecutor(max_workers=self.workers) as pool:
            asyncio.get_event_loop().set_default_executor(pool)
            results = await asyncio.gather(
                *[self.process_ticker(t) for t in self.tickers],
                return_exceptions=True,
            )

        ok_results = [r for r in results if isinstance(r, dict)]
        failures   = [r for r in results if isinstance(r, Exception)]

        log.info("done — %d ok, %d failed", len(ok_results), len(failures))
        for f in failures:
            log.error("ticker error: %s", f)

        corr_matrix = build_corr_matrix()

        for r in ok_results:
            log.info(
                "  %-12s  grade=%s  score=%+.3f  signal=%-12s  rsi=%-5s  anom=%s",
                r["ticker"],
                r["quality"]["grade"],
                r["fusion"]["composite_score"],
                r["fusion"]["signal_label"],
                r["ta"].get("rsi"),
                r["anomaly"]["is_anomaly"],
            )

        manifest: dict[str, Any] = {
            "generated_at":  datetime.now(timezone.utc).isoformat(),
            "tickers":       [t.lower() for t in self.tickers],
            "seeds":         [r["seed"] for r in ok_results],
            "repo":          "majixai/majixai.github.io",
            "seed_prefix":   "unified_",
            "corr_matrix":   corr_matrix,
            "ticker_details": [
                {
                    "ticker":  r["ticker"],
                    "quality": r["quality"],
                    "fusion":  r["fusion"],
                    "ta":      r["ta"],
                    "anomaly": r["anomaly"],
                }
                for r in ok_results
            ],
        }

        out = self.seeds_dir / "manifest.json"
        with open(out, "w") as f:
            json.dump(_tolower(manifest), f, indent=2)
        log.info("manifest written: %s", out)

        return manifest


async def run_all() -> None:
    """Convenience entry-point using the default configuration."""
    await FeedEngine().run()
