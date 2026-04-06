import asyncio
import concurrent.futures
import gzip
import json
import logging
import math
import os
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[3]
SEEDS_DIR = ROOT / "tradingview_integration" / "pine_seeds"
SEEDS_DIR.mkdir(parents=True, exist_ok=True)

DIRS = {
    "sp":  ROOT / "sp_closing_projection" / "latest_projection.json",
    "mp":  ROOT / "market_prediction" / "latest_prediction.json",
    "yf":  ROOT / "yfinance_data" / "yfinance.dat",
    "gf":  ROOT / "tradingview_integration" / "data" / "google_finance_quotes.json",
    "gh":  ROOT / "github_data" / "level1_csv",
    "idx": ROOT / "index" / "csv",
}

TICKERS = [
    "spy", "qqq", "dia", "iwm", "aapl", "msft", "nvda", "tsla", "btc-usd",
    "meta", "amzn", "gld", "slv", "tlt", "xom",
]

SEED_HEADER = (
    "#syminfo.type=index\n"
    "#syminfo.currency=usd\n"
    "#period=D\n"
    "time,open,high,low,close,volume\n"
)

# ── Technical indicator window lengths ─────────────────────────────────────────
TA_RSI_PERIOD   = 14
TA_MACD_FAST    = 12
TA_MACD_SLOW    = 26
TA_MACD_SIGNAL  = 9
TA_BB_PERIOD    = 20
TA_BB_STD       = 2.0
TA_ATR_PERIOD   = 14
TA_EMA_FAST     = 8
TA_EMA_SLOW     = 21
TA_CORR_WINDOW  = 20    # rolling correlation window across assets
ANOMALY_ZSCORE  = 2.5   # Z-score threshold for anomaly flagging


# ─────────────────────────────────────────────────────────────────────────────
# Utility helpers
# ─────────────────────────────────────────────────────────────────────────────

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
            df = pd.read_sql_query(
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


# ─────────────────────────────────────────────────────────────────────────────
# Technical Indicators
# ─────────────────────────────────────────────────────────────────────────────

def _ema(series: np.ndarray, period: int) -> np.ndarray:
    """Exponential moving average."""
    alpha  = 2.0 / (period + 1)
    result = np.full_like(series, np.nan, dtype=float)
    if len(series) == 0:
        return result
    result[0] = series[0]
    for i in range(1, len(series)):
        result[i] = alpha * series[i] + (1.0 - alpha) * result[i - 1]
    return result


def _rsi(closes: np.ndarray, period: int = TA_RSI_PERIOD) -> np.ndarray:
    """Wilder RSI."""
    n      = len(closes)
    result = np.full(n, np.nan)
    if n < period + 1:
        return result
    deltas = np.diff(closes)
    gains  = np.where(deltas > 0, deltas, 0.0)
    losses = np.where(deltas < 0, -deltas, 0.0)
    avg_g  = gains[:period].mean()
    avg_l  = losses[:period].mean()
    for i in range(period, n):
        avg_g = (avg_g * (period - 1) + gains[i - 1]) / period
        avg_l = (avg_l * (period - 1) + losses[i - 1]) / period
        rs    = avg_g / (avg_l + 1e-9)
        result[i] = 100.0 - 100.0 / (1.0 + rs)
    return result


def _macd(
    closes: np.ndarray,
    fast: int = TA_MACD_FAST,
    slow: int = TA_MACD_SLOW,
    signal: int = TA_MACD_SIGNAL,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """MACD line, signal line, histogram."""
    ema_f   = _ema(closes, fast)
    ema_s   = _ema(closes, slow)
    macd_l  = ema_f - ema_s
    sig_l   = _ema(macd_l, signal)
    hist    = macd_l - sig_l
    return macd_l, sig_l, hist


def _bollinger(
    closes: np.ndarray,
    period: int = TA_BB_PERIOD,
    std_mult: float = TA_BB_STD,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Bollinger Bands: upper, mid, lower."""
    n      = len(closes)
    upper  = np.full(n, np.nan)
    mid    = np.full(n, np.nan)
    lower  = np.full(n, np.nan)
    for i in range(period - 1, n):
        w      = closes[i - period + 1: i + 1]
        m      = w.mean()
        s      = w.std() + 1e-9
        mid[i] = m
        upper[i] = m + std_mult * s
        lower[i] = m - std_mult * s
    return upper, mid, lower


def _atr(
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    period: int = TA_ATR_PERIOD,
) -> np.ndarray:
    """Average True Range."""
    n   = len(closes)
    tr  = np.full(n, np.nan)
    atr = np.full(n, np.nan)
    for i in range(1, n):
        tr[i] = max(
            highs[i] - lows[i],
            abs(highs[i] - closes[i - 1]),
            abs(lows[i]  - closes[i - 1]),
        )
    if n > period:
        atr[period] = float(np.nanmean(tr[1: period + 1]))
        for i in range(period + 1, n):
            atr[i] = (atr[i - 1] * (period - 1) + tr[i]) / period
    return atr


def _vwap(
    highs: np.ndarray,
    lows: np.ndarray,
    closes: np.ndarray,
    volumes: np.ndarray,
) -> np.ndarray:
    """Cumulative VWAP from first bar."""
    typical   = (highs + lows + closes) / 3.0
    cum_tpv   = np.cumsum(typical * volumes)
    cum_vol   = np.cumsum(volumes) + 1e-9
    return cum_tpv / cum_vol


def compute_ta(ohlcv_df: pd.DataFrame) -> dict[str, Any]:
    """
    Compute a full technical analysis suite on the OHLCV dataframe.

    Returns a dict of indicator arrays (last-value scalars included for
    quick downstream access).
    """
    if ohlcv_df.empty:
        return {}

    closes  = ohlcv_df["close"].values.astype(float)
    highs   = ohlcv_df["high"].values.astype(float)  if "high"   in ohlcv_df.columns else closes
    lows    = ohlcv_df["low"].values.astype(float)   if "low"    in ohlcv_df.columns else closes
    volumes = ohlcv_df["volume"].values.astype(float) if "volume" in ohlcv_df.columns else np.ones_like(closes)

    rsi_arr               = _rsi(closes)
    macd_l, sig_l, hist_l = _macd(closes)
    bb_u, bb_m, bb_l      = _bollinger(closes)
    atr_arr               = _atr(highs, lows, closes)
    ema_fast              = _ema(closes, TA_EMA_FAST)
    ema_slow              = _ema(closes, TA_EMA_SLOW)
    vwap_arr              = _vwap(highs, lows, closes, volumes)

    def _last(arr: np.ndarray) -> float | None:
        valid = arr[~np.isnan(arr)]
        return round(float(valid[-1]), 4) if len(valid) else None

    # Z-score channel using last BB_PERIOD bars
    last_close = float(closes[-1]) if len(closes) else 0.0
    bb_mid     = _last(bb_m) or last_close
    bb_std     = float(np.nanstd(closes[-TA_BB_PERIOD:])) + 1e-9
    bb_zscore  = round((last_close - bb_mid) / bb_std, 3)

    # EMA trend direction
    ef = _last(ema_fast)
    es = _last(ema_slow)
    ema_trend = "BULL" if (ef and es and ef > es) else ("BEAR" if (ef and es and ef < es) else "FLAT")

    # MACD crossover signal
    last_macd = _last(macd_l) or 0.0
    last_sig  = _last(sig_l)  or 0.0
    last_hist = _last(hist_l) or 0.0
    macd_cross = "BULLISH" if last_macd > last_sig else ("BEARISH" if last_macd < last_sig else "FLAT")

    return {
        "rsi":       _last(rsi_arr),
        "macd":      round(last_macd, 4),
        "macd_sig":  round(last_sig, 4),
        "macd_hist": round(last_hist, 4),
        "macd_cross": macd_cross,
        "bb_upper":  _last(bb_u),
        "bb_mid":    round(bb_mid, 4),
        "bb_lower":  _last(bb_l),
        "bb_zscore": bb_zscore,
        "atr":       _last(atr_arr),
        "ema_fast":  ef,
        "ema_slow":  es,
        "ema_trend": ema_trend,
        "vwap":      _last(vwap_arr),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Anomaly Detection (rolling Z-score on returns)
# ─────────────────────────────────────────────────────────────────────────────

def detect_anomalies(ohlcv_df: pd.DataFrame, threshold: float = ANOMALY_ZSCORE) -> dict:
    """
    Flag return anomalies using rolling Z-scores.

    Returns:
      is_anomaly    : True if latest bar is anomalous
      zscore_last   : Z-score of the latest log-return
      anomaly_count : number of anomalous bars in the window
    """
    if ohlcv_df.empty or len(ohlcv_df) < 5:
        return {"is_anomaly": False, "zscore_last": 0.0, "anomaly_count": 0}

    closes = ohlcv_df["close"].values.astype(float)
    rets   = np.diff(np.log(np.clip(closes, 1e-9, None)))
    if len(rets) < 2:
        return {"is_anomaly": False, "zscore_last": 0.0, "anomaly_count": 0}

    mu  = rets.mean()
    sg  = rets.std() + 1e-9
    zs  = (rets - mu) / sg
    last_z = float(zs[-1])
    count  = int(np.sum(np.abs(zs) > threshold))

    return {
        "is_anomaly":    abs(last_z) > threshold,
        "zscore_last":   round(last_z, 3),
        "anomaly_count": count,
        "anomaly_pct":   round(count / len(zs) * 100, 1),
    }


# ─────────────────────────────────────────────────────────────────────────────
# Cross-Asset Correlation Matrix
# ─────────────────────────────────────────────────────────────────────────────

_CORR_CACHE: dict[str, np.ndarray] = {}


def update_corr_cache(ticker: str, ohlcv_df: pd.DataFrame) -> None:
    """Store the last CORR_WINDOW log-returns for cross-asset correlation."""
    if ohlcv_df.empty or "close" not in ohlcv_df.columns:
        return
    closes = ohlcv_df["close"].values.astype(float)
    rets   = np.diff(np.log(np.clip(closes, 1e-9, None)))
    _CORR_CACHE[ticker.lower()] = rets[-TA_CORR_WINDOW:]


def build_corr_matrix() -> dict:
    """
    Build pairwise Pearson correlation matrix from cached return series.
    Only pairs with matching length windows are computed.
    """
    tickers = sorted(_CORR_CACHE.keys())
    n       = len(tickers)
    if n < 2:
        return {"tickers": tickers, "matrix": []}

    mat = []
    for i in range(n):
        row = []
        for j in range(n):
            a = _CORR_CACHE[tickers[i]]
            b = _CORR_CACHE[tickers[j]]
            mn = min(len(a), len(b))
            if mn < 3:
                row.append(0.0)
                continue
            a_w = a[-mn:]
            b_w = b[-mn:]
            sg_a = a_w.std() + 1e-9
            sg_b = b_w.std() + 1e-9
            c = float(np.cov(a_w, b_w)[0, 1] / (sg_a * sg_b))
            row.append(round(c, 3))
        mat.append(row)

    return {"tickers": tickers, "matrix": mat}


# ─────────────────────────────────────────────────────────────────────────────
# Signal Fusion Layer
# ─────────────────────────────────────────────────────────────────────────────

def fuse_signals(
    ta: dict,
    sp_data: dict,
    mp_data: dict,
    gf_data: dict,
    anomaly: dict,
) -> dict:
    """
    Weighted ensemble of technical + fundamental signals.

    Signal components:
      TA momentum   : EMA trend + MACD cross                  weight 0.30
      BB position   : BB Z-score clipped to [-1, 1] inverted  weight 0.20
      RSI regime    : normalised (RSI − 50) / 50              weight 0.15
      External proj : SP projection direction                  weight 0.20
      ML prediction : market_prediction signal                 weight 0.15

    Final score ∈ [-1, 1]  positive = bullish, negative = bearish.
    """
    # TA momentum component
    ema_dir  = 1.0 if ta.get("ema_trend") == "BULL" else (-1.0 if ta.get("ema_trend") == "BEAR" else 0.0)
    macd_dir = 1.0 if ta.get("macd_cross") == "BULLISH" else (-1.0 if ta.get("macd_cross") == "BEARISH" else 0.0)
    ta_score = (ema_dir + macd_dir) / 2.0

    # BB position
    bbz      = ta.get("bb_zscore", 0.0) or 0.0
    bb_score = -float(np.clip(bbz, -1.0, 1.0))

    # RSI
    rsi_v    = ta.get("rsi") or 50.0
    rsi_score = (rsi_v - 50.0) / 50.0

    # External SP projection
    sp_sig  = sp_data.get("signal", "neutral").lower()
    sp_score = 1.0 if sp_sig == "bullish" else (-1.0 if sp_sig == "bearish" else 0.0)

    # ML prediction
    mp_sig  = mp_data.get("prediction", {}).get("signal", "neutral").lower()
    mp_score = 1.0 if mp_sig == "bullish" else (-1.0 if mp_sig == "bearish" else 0.0)

    # Anomaly penalty (dampen score if anomaly detected)
    anomaly_penalty = 0.5 if anomaly.get("is_anomaly") else 1.0

    composite = (
        0.30 * ta_score
        + 0.20 * bb_score
        + 0.15 * rsi_score
        + 0.20 * sp_score
        + 0.15 * mp_score
    ) * anomaly_penalty

    signal_label = (
        "STRONG_BULL" if composite > 0.6 else
        "BULL"        if composite > 0.2 else
        "BEAR"        if composite < -0.2 else
        "STRONG_BEAR" if composite < -0.6 else
        "NEUTRAL"
    )

    return {
        "composite_score": round(composite, 4),
        "signal_label":    signal_label,
        "components": {
            "ta_momentum": round(ta_score,  3),
            "bb_position": round(bb_score,  3),
            "rsi_regime":  round(rsi_score, 3),
            "sp_external": round(sp_score,  3),
            "ml_predict":  round(mp_score,  3),
        },
        "anomaly_penalty": anomaly_penalty,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Seed quality scoring
# ─────────────────────────────────────────────────────────────────────────────

def compute_seed_quality(ohlcv_df: pd.DataFrame, ta: dict, anomaly: dict) -> dict:
    """
    Score the seed data quality on a 0–100 scale.

    Components:
      row_count_score   : 0–30 (capped at 60 rows = 30 pts)
      ta_completeness   : 0–40 (fraction of TA fields populated)
      anomaly_score     : 0–30 (30 pts when anomaly_pct < 5%)
    """
    n_rows = len(ohlcv_df)
    row_sc = min(30, int(n_rows / 60.0 * 30.0))

    ta_fields = [
        "rsi", "macd", "bb_upper", "bb_lower", "atr", "ema_fast", "ema_slow", "vwap"
    ]
    populated = sum(1 for k in ta_fields if ta.get(k) is not None)
    ta_sc     = int(populated / len(ta_fields) * 40.0)

    anm_pct = anomaly.get("anomaly_pct", 100.0)
    anm_sc  = max(0, int(30.0 - anm_pct * 2.0))

    total = row_sc + ta_sc + anm_sc
    return {
        "total":    total,
        "row":      row_sc,
        "ta":       ta_sc,
        "anomaly":  anm_sc,
        "grade":    "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "D",
    }


# ─────────────────────────────────────────────────────────────────────────────
# Data fetch coroutines (unchanged interface, added idx_task)
# ─────────────────────────────────────────────────────────────────────────────

async def _fetch_sp(ticker: str) -> dict:
    return await asyncio.get_event_loop().run_in_executor(None, _load_json, DIRS["sp"])


async def _fetch_mp(ticker: str) -> dict:
    return await asyncio.get_event_loop().run_in_executor(None, _load_json, DIRS["mp"])


async def _fetch_gf(ticker: str) -> dict:
    d      = await asyncio.get_event_loop().run_in_executor(None, _load_json, DIRS["gf"])
    quotes = d.get("quotes", [])
    for q in quotes:
        if q.get("ticker", "").lower().replace("-", "") == ticker.lower().replace("-", ""):
            return q
    return {}


async def _fetch_yf(ticker: str) -> pd.DataFrame:
    return await asyncio.get_event_loop().run_in_executor(
        None, _load_yfinance_dat, DIRS["yf"], ticker
    )


async def _fetch_gh(ticker: str) -> pd.DataFrame:
    sym = ticker.upper().replace("-", "") + "_1MO_1D_LITE"
    p   = DIRS["gh"] / f"{sym}.csv"
    if not p.exists():
        sym2 = ticker.upper() + "_1mo_1d_lite"
        p    = DIRS["gh"] / f"{sym2}.csv"
    return await asyncio.get_event_loop().run_in_executor(None, _load_csv_tail, p, 30)


async def _fetch_idx(ticker: str) -> pd.DataFrame:
    sym = ticker.upper().replace("-", "") + "_1m"
    p   = DIRS["idx"] / f"{sym}.csv"
    if not p.exists():
        return pd.DataFrame()
    return await asyncio.get_event_loop().run_in_executor(None, _load_csv_tail, p, 390)


# ─────────────────────────────────────────────────────────────────────────────
# Tensor aggregation (extended: injects TA-adjusted OHLCV on last bar)
# ─────────────────────────────────────────────────────────────────────────────

def _tensor_agg(
    ohlcv_df: pd.DataFrame,
    sp_data: dict,
    mp_data: dict,
    gf_data: dict,
    ta: dict,
    fusion: dict,
) -> list[tuple]:
    rows = []
    if ohlcv_df.empty:
        return rows

    closes  = ohlcv_df["close"].values.astype(float)
    highs   = ohlcv_df["high"].values.astype(float)   if "high"   in ohlcv_df.columns else closes
    lows    = ohlcv_df["low"].values.astype(float)    if "low"    in ohlcv_df.columns else closes
    opens   = ohlcv_df["open"].values.astype(float)   if "open"   in ohlcv_df.columns else closes
    vols    = ohlcv_df["volume"].values.astype(float)  if "volume" in ohlcv_df.columns else np.ones_like(closes)

    n = len(closes)
    if n < 2:
        return rows

    rets   = np.diff(np.log(np.clip(closes, 1e-9, None)))
    vol_20 = np.std(rets[-20:]) * np.sqrt(252) if len(rets) >= 20 else np.std(rets) * np.sqrt(252)

    sp_proj = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("projected_close", closes[-1]))
    sp_res  = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("resistance", highs[-1]))
    sp_sup  = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("support",    lows[-1]))
    mp_tgt  = float(mp_data.get("prediction", {}).get("target_price", closes[-1]))
    mp_res  = float(mp_data.get("prediction", {}).get("resistance",   highs[-1]))
    mp_sup  = float(mp_data.get("prediction", {}).get("support",      lows[-1]))
    gf_price = float(gf_data.get("price", closes[-1]) if gf_data else closes[-1])

    # TA-adjusted last-bar close (blend with BB mid as mean-reversion anchor)
    bb_mid   = ta.get("bb_mid") or closes[-1]
    vwap_val = ta.get("vwap")   or closes[-1]
    avg_rng  = float(np.mean(highs[-20:] - lows[-20:])) if n >= 20 else float(np.mean(highs - lows))

    # Fusion score influences the close projection direction
    fusion_sc = fusion.get("composite_score", 0.0)
    adj_delta = avg_rng * 0.3 * fusion_sc   # ± fractional ATR bias

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
        if date_col_name:
            ts = _epoch(ohlcv_df.iloc[i][date_col_name])
        else:
            ts = int(time.time()) - (n - 1 - i) * 86400

        if i < n - 1:
            rows.append((ts, opens[i], highs[i], lows[i], closes[i], int(vols[i])))
        else:
            rows.append((ts, opens[i], agg_h, agg_l, agg_c, bull_vol))

    return rows


# ─────────────────────────────────────────────────────────────────────────────
# Seed writer
# ─────────────────────────────────────────────────────────────────────────────

def _write_seed(ticker: str, rows: list[tuple]) -> str:
    sym = "unified_" + ticker.lower().replace("-", "")
    out = SEEDS_DIR / f"{sym.upper()}.csv"
    lines = [SEED_HEADER]
    for r in rows:
        lines.append(",".join(str(x) for x in r) + "\n")
    with open(out, "w") as f:
        f.writelines(lines)
    log.info("wrote seed %s (%d rows)", out.name, len(rows))
    return str(out)


# ─────────────────────────────────────────────────────────────────────────────
# Per-ticker processing
# ─────────────────────────────────────────────────────────────────────────────

async def process_ticker(ticker: str) -> dict | None:
    tk = ticker.lower()

    # Parallel fetch all sources
    sp_data, mp_data, gf_data, yf_df, gh_df, idx_df = await asyncio.gather(
        _fetch_sp(tk),
        _fetch_mp(tk),
        _fetch_gf(tk),
        _fetch_yf(tk),
        _fetch_gh(tk),
        _fetch_idx(tk),
        return_exceptions=True,
    )

    sp_data = sp_data if isinstance(sp_data, dict)        else {}
    mp_data = mp_data if isinstance(mp_data, dict)        else {}
    gf_data = gf_data if isinstance(gf_data, dict)        else {}
    yf_df   = yf_df   if isinstance(yf_df,   pd.DataFrame) else pd.DataFrame()
    gh_df   = gh_df   if isinstance(gh_df,   pd.DataFrame) else pd.DataFrame()

    ohlcv = yf_df if not yf_df.empty else gh_df
    if ohlcv.empty:
        log.warning("no ohlcv data for %s", tk)
        return None

    loop = asyncio.get_event_loop()

    # Technical analysis
    ta      = await loop.run_in_executor(None, compute_ta,         ohlcv)
    anomaly = await loop.run_in_executor(None, detect_anomalies,   ohlcv)
    quality = await loop.run_in_executor(None, compute_seed_quality, ohlcv, ta, anomaly)

    # Update global correlation cache
    update_corr_cache(tk, ohlcv)

    # Fusion
    fusion  = fuse_signals(ta, sp_data, mp_data, gf_data, anomaly)

    # Tensor aggregation
    rows = await loop.run_in_executor(
        None, _tensor_agg, ohlcv, sp_data, mp_data, gf_data, ta, fusion
    )
    if not rows:
        return None

    seed_path = await loop.run_in_executor(None, _write_seed, tk, rows)
    return {
        "ticker":   tk,
        "seed":     str(Path(seed_path).name).lower(),
        "rows":     len(rows),
        "quality":  quality,
        "fusion":   fusion,
        "ta":       ta,
        "anomaly":  anomaly,
    }


# ─────────────────────────────────────────────────────────────────────────────
# Main runner
# ─────────────────────────────────────────────────────────────────────────────

async def run_all() -> None:
    log.info("unified feed starting — %d tickers", len(TICKERS))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        asyncio.get_event_loop().set_default_executor(pool)
        results = await asyncio.gather(
            *[process_ticker(t) for t in TICKERS],
            return_exceptions=True,
        )

    ok_results = [r for r in results if isinstance(r, dict)]
    fail       = [r for r in results if isinstance(r, Exception)]

    log.info("done — %d ok, %d failed", len(ok_results), len(fail))
    for f in fail:
        log.error("ticker error: %s", f)

    # Cross-asset correlation matrix (built after all tickers processed)
    corr_matrix = build_corr_matrix()

    # Per-ticker summary logging
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

    manifest = {
        "generated_at":    datetime.now(timezone.utc).isoformat(),
        "tickers":         [t.lower() for t in TICKERS],
        "seeds":           [r["seed"] for r in ok_results],
        "repo":            "majixai/majixai.github.io",
        "seed_prefix":     "unified_",
        "corr_matrix":     corr_matrix,
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

    out = SEEDS_DIR / "manifest.json"
    with open(out, "w") as f:
        json.dump(_tolower(manifest), f, indent=2)
    log.info("manifest written: %s", out)


if __name__ == "__main__":
    asyncio.run(run_all())
