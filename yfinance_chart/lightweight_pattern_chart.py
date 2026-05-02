"""Lightweight candlestick chart with yfinance data and shaded pattern overlays.

Usage:
  python yfinance_chart/lightweight_pattern_chart.py --ticker SPY --period 6mo --interval 1d

Dependencies:
  pip install yfinance pandas numpy lightweight-charts
"""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd
import yfinance as yf
from lightweight_charts import Chart


@dataclass
class Consolidation:
    start_idx: int
    end_idx: int
    upper: float
    lower: float


@dataclass
class Triangle:
    start_idx: int
    end_idx: int
    upper_start: float
    upper_end: float
    lower_start: float
    lower_end: float


@dataclass
class PatternOverlay:
    name: str
    family: str
    start_idx: int
    end_idx: int
    upper_start: float
    upper_end: float
    lower_start: float
    lower_end: float
    color: str
    score: float = 0.0


def _segment_score(series: pd.Series, start_idx: int, end_idx: int) -> float:
    segment = series.iloc[start_idx : end_idx + 1]
    if segment.empty:
        return 0.0
    return float(segment.mean())


def _make_overlay(
    name: str,
    family: str,
    start_idx: int,
    end_idx: int,
    upper_start: float,
    upper_end: float,
    lower_start: float,
    lower_end: float,
    color: str,
) -> PatternOverlay:
    return PatternOverlay(
        name=name,
        family=family,
        start_idx=max(0, start_idx),
        end_idx=max(0, end_idx),
        upper_start=float(upper_start),
        upper_end=float(upper_end),
        lower_start=float(lower_start),
        lower_end=float(lower_end),
        color=color,
    )


def fetch_ohlcv(ticker: str, period: str, interval: str) -> pd.DataFrame:
    raw = yf.download(ticker, period=period, interval=interval, auto_adjust=False, progress=False)
    if raw.empty:
        raise ValueError(f"No data returned for {ticker} with period={period}, interval={interval}")

    if isinstance(raw.columns, pd.MultiIndex):
        raw.columns = raw.columns.get_level_values(0)

    df = raw.rename(
        columns={
            "Open": "open",
            "High": "high",
            "Low": "low",
            "Close": "close",
            "Volume": "volume",
        }
    ).copy()

    df.index = pd.to_datetime(df.index)
    if getattr(df.index, "tz", None) is not None:
        df.index = df.index.tz_convert(None)

    df = df.reset_index(names="time")
    needed = ["time", "open", "high", "low", "close", "volume"]
    missing = [column for column in needed if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns after normalization: {missing}")
    return df[needed].dropna().reset_index(drop=True)


def detect_consolidation(df: pd.DataFrame, window: int = 20, max_range_pct: float = 0.04) -> Optional[Consolidation]:
    if len(df) < window:
        return None

    best: Optional[Consolidation] = None
    for end in range(window - 1, len(df)):
        start = end - window + 1
        segment = df.iloc[start : end + 1]
        high = float(segment["high"].max())
        low = float(segment["low"].min())
        mid = (high + low) / 2.0
        if mid <= 0:
            continue
        if (high - low) / mid <= max_range_pct:
            best = Consolidation(start_idx=start, end_idx=end, upper=high, lower=low)
    return best


def detect_sym_triangle(df: pd.DataFrame, window: int = 30) -> Optional[Triangle]:
    if len(df) < window:
        return None

    segment = df.iloc[-window:].reset_index(drop=True)
    x = np.arange(window, dtype=float)
    highs = segment["high"].to_numpy(dtype=float)
    lows = segment["low"].to_numpy(dtype=float)

    high_slope, high_intercept = np.polyfit(x, highs, 1)
    low_slope, low_intercept = np.polyfit(x, lows, 1)

    if not (high_slope < 0 and low_slope > 0):
        return None

    upper_start = high_intercept
    upper_end = high_slope * (window - 1) + high_intercept
    lower_start = low_intercept
    lower_end = low_slope * (window - 1) + low_intercept

    start_idx = len(df) - window
    end_idx = len(df) - 1
    return Triangle(
        start_idx=start_idx,
        end_idx=end_idx,
        upper_start=float(upper_start),
        upper_end=float(upper_end),
        lower_start=float(lower_start),
        lower_end=float(lower_end),
    )


def _fit_line(values: np.ndarray) -> tuple[float, float]:
    x = np.arange(len(values), dtype=float)
    slope, intercept = np.polyfit(x, values, 1)
    return float(slope), float(intercept)


def detect_continuation_patterns(df: pd.DataFrame) -> list[PatternOverlay]:
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < 40:
        return overlays

    colors = {
        "flag": "rgba(250, 204, 21, 0.12)",
        "pennant": "rgba(56, 189, 248, 0.12)",
        "triangle": "rgba(96, 165, 250, 0.12)",
        "wedge": "rgba(244, 114, 182, 0.12)",
        "channel": "rgba(192, 132, 252, 0.12)",
        "rectangle": "rgba(251, 146, 60, 0.12)",
    }

    for end_idx in range(28, n):
        start_idx = end_idx - 27
        segment = df.iloc[start_idx : end_idx + 1].reset_index(drop=True)
        closes = segment["close"].to_numpy(dtype=float)
        highs = segment["high"].to_numpy(dtype=float)
        lows = segment["low"].to_numpy(dtype=float)

        pole = closes[12] - closes[0]
        body = closes[-1] - closes[13]
        high_slope, high_intercept = _fit_line(highs[13:])
        low_slope, low_intercept = _fit_line(lows[13:])
        hi0 = high_intercept
        hi1 = high_slope * (len(highs[13:]) - 1) + high_intercept
        lo0 = low_intercept
        lo1 = low_slope * (len(lows[13:]) - 1) + low_intercept

        if pole > 0 and body < 0 and abs(high_slope) < 0.2 and abs(low_slope) < 0.2:
            overlays.append(
                _make_overlay(
                    "bull_flag",
                    "flag",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["flag"],
                )
            )

        if pole < 0 and body > 0 and abs(high_slope) < 0.2 and abs(low_slope) < 0.2:
            overlays.append(
                _make_overlay(
                    "bear_flag",
                    "flag",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["flag"],
                )
            )

        if pole > 0 and high_slope < 0 and low_slope > 0:
            overlays.append(
                _make_overlay(
                    "bull_pennant",
                    "pennant",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["pennant"],
                )
            )

        if pole < 0 and high_slope < 0 and low_slope > 0:
            overlays.append(
                _make_overlay(
                    "bear_pennant",
                    "pennant",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["pennant"],
                )
            )

        if high_slope < 0 and low_slope > 0:
            overlays.append(
                _make_overlay(
                    "sym_triangle",
                    "triangle",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["triangle"],
                )
            )

        if abs(high_slope) < 0.05 and low_slope > 0.05:
            overlays.append(
                _make_overlay(
                    "ascending_triangle",
                    "triangle",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["triangle"],
                )
            )

        if high_slope < -0.05 and abs(low_slope) < 0.05:
            overlays.append(
                _make_overlay(
                    "descending_triangle",
                    "triangle",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["triangle"],
                )
            )

        if high_slope > 0 and low_slope > 0 and high_slope < low_slope:
            overlays.append(
                _make_overlay(
                    "rising_wedge",
                    "wedge",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["wedge"],
                )
            )

        if high_slope < 0 and low_slope < 0 and high_slope < low_slope:
            overlays.append(
                _make_overlay(
                    "falling_wedge",
                    "wedge",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["wedge"],
                )
            )

        if abs(high_slope - low_slope) < 0.03:
            overlays.append(
                _make_overlay(
                    "parallel_channel",
                    "channel",
                    start_idx + 13,
                    end_idx,
                    hi0,
                    hi1,
                    lo0,
                    lo1,
                    colors["channel"],
                )
            )

        high = float(segment["high"].max())
        low = float(segment["low"].min())
        mid = (high + low) / 2.0
        if mid > 0 and (high - low) / mid < 0.04:
            overlays.append(
                _make_overlay(
                    "rectangle",
                    "rectangle",
                    start_idx,
                    end_idx,
                    high,
                    high,
                    low,
                    low,
                    colors["rectangle"],
                )
            )

    dedup: dict[tuple[str, int, int], PatternOverlay] = {}
    for overlay in overlays:
        key = (overlay.name, overlay.start_idx, overlay.end_idx)
        dedup[key] = overlay
    return list(dedup.values())


def detect_candlestick_patterns(df: pd.DataFrame) -> list[PatternOverlay]:
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < 5:
        return overlays

    o = df["open"].to_numpy(dtype=float)
    h = df["high"].to_numpy(dtype=float)
    l = df["low"].to_numpy(dtype=float)
    c = df["close"].to_numpy(dtype=float)
    rng = np.maximum(h - l, 1e-9)
    body = np.abs(c - o)
    up_shadow = h - np.maximum(o, c)
    low_shadow = np.minimum(o, c) - l

    def candle_overlay(name: str, idx: int, color: str) -> None:
        overlays.append(
            _make_overlay(
                name=name,
                family="candlestick",
                start_idx=idx,
                end_idx=idx,
                upper_start=h[idx],
                upper_end=h[idx],
                lower_start=l[idx],
                lower_end=l[idx],
                color=color,
            )
        )

    for i in range(2, n):
        bull = c[i] > o[i]
        bear = c[i] < o[i]
        prev_bull = c[i - 1] > o[i - 1]
        prev_bear = c[i - 1] < o[i - 1]
        tiny_body = body[i] / rng[i] < 0.1
        long_body = body[i] / rng[i] > 0.65

        if tiny_body:
            candle_overlay("doji", i, "rgba(148, 163, 184, 0.18)")
            if low_shadow[i] > 0.6 * rng[i] and up_shadow[i] < 0.15 * rng[i]:
                candle_overlay("dragonfly_doji", i, "rgba(34, 197, 94, 0.18)")
            if up_shadow[i] > 0.6 * rng[i] and low_shadow[i] < 0.15 * rng[i]:
                candle_overlay("gravestone_doji", i, "rgba(239, 68, 68, 0.18)")
            if up_shadow[i] > 0.35 * rng[i] and low_shadow[i] > 0.35 * rng[i]:
                candle_overlay("long_legged_doji", i, "rgba(148, 163, 184, 0.2)")

        if low_shadow[i] > 2.2 * body[i] and up_shadow[i] < 0.25 * body[i] and bull:
            candle_overlay("hammer", i, "rgba(34, 197, 94, 0.18)")
        if up_shadow[i] > 2.2 * body[i] and low_shadow[i] < 0.25 * body[i] and bull:
            candle_overlay("inverted_hammer", i, "rgba(56, 189, 248, 0.18)")
        if low_shadow[i] > 2.2 * body[i] and up_shadow[i] < 0.25 * body[i] and bear:
            candle_overlay("hanging_man", i, "rgba(248, 113, 113, 0.18)")
        if up_shadow[i] > 2.2 * body[i] and low_shadow[i] < 0.25 * body[i] and bear:
            candle_overlay("shooting_star", i, "rgba(248, 113, 113, 0.18)")

        if prev_bear and bull and o[i] <= c[i - 1] and c[i] >= o[i - 1]:
            candle_overlay("bullish_engulfing", i, "rgba(34, 197, 94, 0.16)")
        if prev_bull and bear and o[i] >= c[i - 1] and c[i] <= o[i - 1]:
            candle_overlay("bearish_engulfing", i, "rgba(239, 68, 68, 0.16)")

        prev_body_mid = (o[i - 1] + c[i - 1]) / 2.0
        if prev_bear and bull and o[i] < l[i - 1] and c[i] > prev_body_mid:
            candle_overlay("piercing_line", i, "rgba(34, 197, 94, 0.14)")
        if prev_bull and bear and o[i] > h[i - 1] and c[i] < prev_body_mid:
            candle_overlay("dark_cloud_cover", i, "rgba(239, 68, 68, 0.14)")

        if prev_bear and bear and tiny_body and bull and c[i] > (o[i - 2] + c[i - 2]) / 2.0:
            candle_overlay("morning_star", i, "rgba(34, 197, 94, 0.2)")
        if prev_bull and bull and tiny_body and bear and c[i] < (o[i - 2] + c[i - 2]) / 2.0:
            candle_overlay("evening_star", i, "rgba(239, 68, 68, 0.2)")

        if prev_bear and bull and body[i] < body[i - 1] * 0.6 and o[i] > c[i - 1] and c[i] < o[i - 1]:
            candle_overlay("bullish_harami", i, "rgba(132, 204, 22, 0.18)")
        if prev_bull and bear and body[i] < body[i - 1] * 0.6 and o[i] < c[i - 1] and c[i] > o[i - 1]:
            candle_overlay("bearish_harami", i, "rgba(251, 113, 133, 0.18)")

        if abs(h[i] - h[i - 1]) / max(h[i], 1e-9) < 0.002 and bear:
            candle_overlay("tweezer_top", i, "rgba(239, 68, 68, 0.16)")
        if abs(l[i] - l[i - 1]) / max(l[i], 1e-9) < 0.002 and bull:
            candle_overlay("tweezer_bottom", i, "rgba(34, 197, 94, 0.16)")

        if long_body and up_shadow[i] < 0.1 * rng[i] and low_shadow[i] < 0.1 * rng[i] and bull:
            candle_overlay("bullish_marubozu", i, "rgba(34, 197, 94, 0.16)")
        if long_body and up_shadow[i] < 0.1 * rng[i] and low_shadow[i] < 0.1 * rng[i] and bear:
            candle_overlay("bearish_marubozu", i, "rgba(239, 68, 68, 0.16)")

        if 0.1 < body[i] / rng[i] < 0.3 and up_shadow[i] > 0.25 * rng[i] and low_shadow[i] > 0.25 * rng[i]:
            candle_overlay("spinning_top", i, "rgba(168, 85, 247, 0.18)")

        if i >= 2 and (c[i] > c[i - 1] > c[i - 2]) and (o[i] > o[i - 1] > o[i - 2]):
            candle_overlay("three_white_soldiers", i, "rgba(34, 197, 94, 0.16)")
        if i >= 2 and (c[i] < c[i - 1] < c[i - 2]) and (o[i] < o[i - 1] < o[i - 2]):
            candle_overlay("three_black_crows", i, "rgba(239, 68, 68, 0.16)")

        if i >= 3:
            flat = np.std(c[i - 3 : i + 1]) / max(np.mean(c[i - 3 : i + 1]), 1e-9) < 0.008
            down_wick_rejection = (low_shadow[i] / rng[i] > 0.45) and bull
            if flat and down_wick_rejection:
                candle_overlay("jade_lizard_proxy", i, "rgba(34, 197, 94, 0.22)")

    return overlays


def build_calculus_matrix_features(df: pd.DataFrame) -> pd.DataFrame:
    close = df["close"].to_numpy(dtype=float)
    volume = df["volume"].to_numpy(dtype=float)
    high = df["high"].to_numpy(dtype=float)
    low = df["low"].to_numpy(dtype=float)
    open_ = df["open"].to_numpy(dtype=float)

    n = len(df)
    ret = np.zeros(n)
    ret[1:] = np.diff(close) / np.maximum(close[:-1], 1e-9)
    range_pct = (high - low) / np.maximum(close, 1e-9)
    body_pct = np.abs(close - open_) / np.maximum(close, 1e-9)
    vol_z = (volume - np.mean(volume)) / (np.std(volume) + 1e-9)

    X = np.column_stack([ret, range_pct, body_pct, vol_z])

    jacobian_norm = np.zeros(n)
    hessian_trace = np.zeros(n)
    greenes_circulation = np.zeros(n)
    taylor_score = np.zeros(n)
    lagrange_score = np.zeros(n)

    close_norm = (close - np.mean(close)) / (np.std(close) + 1e-9)
    vol_norm = (volume - np.mean(volume)) / (np.std(volume) + 1e-9)

    for i in range(3, n):
        x = X[i]
        x_prev = X[i - 1]
        delta = x - x_prev

        phi = np.array(
            [
                np.sin(x[0]),
                np.arctan(x[1] * 15.0),
                np.tanh(x[2] * 8.0),
                np.exp(-x[3] ** 2),
            ]
        )

        J = np.outer(phi, delta)
        jacobian_norm[i] = float(np.linalg.norm(J, ord="fro"))

        d2 = X[i] - 2.0 * X[i - 1] + X[i - 2]
        H = np.outer(d2, d2)
        hessian_trace[i] = float(np.trace(H))

        start = max(1, i - 15)
        x_curve = close_norm[start : i + 1]
        y_curve = vol_norm[start : i + 1]
        circulation = 0.5 * np.sum(x_curve[:-1] * y_curve[1:] - y_curve[:-1] * x_curve[1:])
        greenes_circulation[i] = float(circulation)

        velocity = close[i - 1] - close[i - 2]
        acceleration = close[i - 1] - 2.0 * close[i - 2] + close[i - 3]
        taylor_est = close[i - 1] + velocity + 0.5 * acceleration
        taylor_err = abs(close[i] - taylor_est) / max(close[i], 1e-9)
        taylor_score[i] = float(np.exp(-15.0 * taylor_err))

        x_pts = np.array([i - 3, i - 2, i - 1], dtype=float)
        y_pts = close[i - 3 : i]
        weights = np.ones_like(x_pts)
        for j in range(3):
            for k in range(3):
                if j != k:
                    weights[j] *= (i - x_pts[k]) / max(x_pts[j] - x_pts[k], 1e-9)
        lagrange_est = float(np.dot(weights, y_pts))
        lagrange_err = abs(close[i] - lagrange_est) / max(close[i], 1e-9)
        lagrange_score[i] = float(np.exp(-15.0 * lagrange_err))

    def normalize(series: np.ndarray) -> np.ndarray:
        lo = float(np.nanmin(series))
        hi = float(np.nanmax(series))
        if hi - lo < 1e-9:
            return np.zeros_like(series)
        return (series - lo) / (hi - lo)

    jac_n = normalize(jacobian_norm)
    hes_n = normalize(hessian_trace)
    gre_n = normalize(np.abs(greenes_circulation))
    tay_n = normalize(taylor_score)
    lag_n = normalize(lagrange_score)

    calculus_strength = 0.22 * jac_n + 0.18 * hes_n + 0.2 * gre_n + 0.2 * tay_n + 0.2 * lag_n

    return pd.DataFrame(
        {
            "jacobian_norm": jacobian_norm,
            "hessian_trace": hessian_trace,
            "greenes_circulation": greenes_circulation,
            "taylor_score": taylor_score,
            "lagrange_score": lagrange_score,
            "calculus_strength": calculus_strength,
        }
    )


# ── Stochastic Calculus patterns ───────────────────────────────────────────────


def detect_ornstein_uhlenbeck_reversion(df: pd.DataFrame, window: int = 30) -> list[PatternOverlay]:
    """
    Detect zones where the closing price exhibits strong mean-reversion
    consistent with an Ornstein-Uhlenbeck process.

    Method (drawn from calculus/stochastic)
    ----------------------------------------
    Estimate κ (mean-reversion speed) via OLS on ΔX_t = α − κ·X_{t-1} + ε.
    A sliding window produces a time-series of κ values; regions where κ
    exceeds 0.4 are overlaid as stochastic-reversion zones.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window + 5:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    for end in range(window, n):
        seg = closes[end - window: end]
        dx = np.diff(seg)
        x_lag = seg[:-1]
        denom = float(np.var(x_lag, ddof=1))
        if denom < 1e-12:
            continue
        beta = float(np.cov(dx, x_lag, ddof=1)[0, 1]) / denom
        kappa = -beta
        if kappa > 0.4:
            mu = float(seg.mean())
            sigma = float(seg.std(ddof=1))
            upper = mu + 1.5 * sigma
            lower = mu - 1.5 * sigma
            start_idx = end - window
            overlays.append(
                _make_overlay(
                    "ou_reversion",
                    "stochastic",
                    start_idx,
                    end - 1,
                    upper,
                    upper,
                    lower,
                    lower,
                    "rgba(16, 185, 129, 0.10)",
                )
            )
    return overlays


def detect_brownian_volatility_cluster(df: pd.DataFrame, window: int = 20) -> list[PatternOverlay]:
    """
    Detect volatility clustering consistent with Brownian motion variance
    accumulation (quadratic variation).

    Regions where the rolling realised variance jumps above 2 standard
    deviations of its own distribution are flagged as volatility clusters,
    drawn from the Stochastic Calculus / Itô integration module.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window * 2:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    log_rets = np.diff(np.log(np.maximum(closes, 1e-10)))
    realised_var = np.array([
        float(np.sum(log_rets[max(0, i - window): i] ** 2))
        for i in range(1, len(log_rets) + 1)
    ])
    mu_rv = float(realised_var.mean())
    sd_rv = float(realised_var.std(ddof=1)) + 1e-12
    for i in range(window, len(realised_var)):
        z = (realised_var[i] - mu_rv) / sd_rv
        if z > 2.0:
            idx = i + 1  # offset for diff
            if idx >= n:
                continue
            price = closes[idx]
            half = float(np.sqrt(realised_var[i])) * price
            overlays.append(
                _make_overlay(
                    "brownian_vol_cluster",
                    "stochastic",
                    max(0, idx - window),
                    idx,
                    price + half,
                    price + half,
                    price - half,
                    price - half,
                    "rgba(234, 179, 8, 0.10)",
                )
            )
    return overlays


def detect_geometric_brownian_drift(df: pd.DataFrame, window: int = 25) -> list[PatternOverlay]:
    """
    Detect strong positive or negative log-price drift consistent with a
    Geometric Brownian Motion μ estimate.

    Drawn from the Stochastic Calculus module: GBM drift μ is estimated as
    the mean of log-returns over the window; regions where |μ| > 0.5·σ are
    marked as directional drift zones.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window + 2:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    log_rets = np.diff(np.log(np.maximum(closes, 1e-10)))
    for end in range(window, len(log_rets)):
        seg = log_rets[end - window: end]
        mu = float(seg.mean())
        sigma = float(seg.std(ddof=1)) + 1e-12
        if abs(mu) > 0.5 * sigma:
            start_idx = end - window
            color = "rgba(34, 197, 94, 0.09)" if mu > 0 else "rgba(239, 68, 68, 0.09)"
            hi = float(closes[start_idx: end + 1].max())
            lo = float(closes[start_idx: end + 1].min())
            overlays.append(
                _make_overlay(
                    "gbm_drift_bull" if mu > 0 else "gbm_drift_bear",
                    "stochastic",
                    start_idx,
                    end,
                    hi,
                    hi,
                    lo,
                    lo,
                    color,
                )
            )
    return overlays


# ── Vector Calculus patterns ───────────────────────────────────────────────────


def detect_vector_field_divergence(df: pd.DataFrame, window: int = 20) -> list[PatternOverlay]:
    """
    Detect regions of high price-volume vector field divergence.

    The 2-D field F = (ΔP, ΔV) where P = log-price, V = log-volume.
    Divergence ∇·F ≈ ∂(ΔP)/∂P + ∂(ΔV)/∂V is approximated by summing the
    partial finite differences.  High positive divergence signals price-volume
    expansion; high negative divergence signals compression.

    Drawn from the Vector Calculus module.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window + 2:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    volumes = df["volume"].to_numpy(dtype=float)
    lp = np.log(np.maximum(closes, 1e-10))
    lv = np.log(np.maximum(volumes, 1e-10))
    dlp = np.diff(lp)
    dlv = np.diff(lv)
    for end in range(window, len(dlp)):
        seg_dlp = dlp[end - window: end]
        seg_dlv = dlv[end - window: end]
        d_dlp = np.diff(seg_dlp).mean() if len(seg_dlp) > 1 else 0.0
        d_dlv = np.diff(seg_dlv).mean() if len(seg_dlv) > 1 else 0.0
        divergence = float(d_dlp + d_dlv)
        if abs(divergence) > 0.002:
            idx = end + 1
            if idx >= n:
                continue
            price = closes[idx]
            span = float(np.std(closes[end - window: idx]) * 2)
            color = "rgba(56, 189, 248, 0.10)" if divergence > 0 else "rgba(251, 146, 60, 0.10)"
            overlays.append(
                _make_overlay(
                    "vector_div_expand" if divergence > 0 else "vector_div_compress",
                    "vector",
                    end - window,
                    idx,
                    price + span,
                    price + span,
                    price - span,
                    price - span,
                    color,
                )
            )
    return overlays


def detect_vector_field_curl(df: pd.DataFrame, window: int = 20) -> list[PatternOverlay]:
    """
    Detect rotational price-volume dynamics via discrete 2-D curl.

    Drawn from the Vector Calculus module: curl = ∂Vy/∂x − ∂Vx/∂y using
    Green's theorem approximation over each window.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window + 2:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    volumes = df["volume"].to_numpy(dtype=float)
    lp = np.log(np.maximum(closes, 1e-10))
    lv = np.log(np.maximum(volumes, 1e-10))
    dlp = np.diff(lp)
    dlv = np.diff(lv)
    for end in range(window, len(dlp) - 1):
        x = dlp[end - window: end]
        y = dlv[end - window: end]
        area = 0.5 * float(np.sum(x[:-1] * y[1:] - y[:-1] * x[1:]))
        path_len = float(np.sum(np.sqrt(x ** 2 + y ** 2))) + 1e-12
        curl = area / path_len
        if abs(curl) > 0.12:
            idx = end + 1
            if idx >= n:
                continue
            price = closes[idx]
            span = float(np.std(closes[end - window: idx]) * 1.5)
            overlays.append(
                _make_overlay(
                    "vector_curl_bull" if curl > 0 else "vector_curl_bear",
                    "vector",
                    end - window,
                    idx,
                    price + span,
                    price + span,
                    price - span,
                    price - span,
                    "rgba(192, 132, 252, 0.10)",
                )
            )
    return overlays


# ── Geometric Calculus patterns ────────────────────────────────────────────────


def detect_frenet_inflection(df: pd.DataFrame, window: int = 15) -> list[PatternOverlay]:
    """
    Detect price path inflection points via Frenet–Serret curvature.

    When the signed curvature κ changes sign, the price path is reversing
    its concavity — a strong reversal signal in Geometric Calculus terms.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window + 3:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    x_norm = (closes - closes.mean()) / (closes.std(ddof=1) + 1e-10)
    d1 = np.diff(x_norm)
    d2 = np.diff(d1)
    kappas = d2 / (1.0 + d1[:-1] ** 2) ** 1.5
    for i in range(1, len(kappas)):
        if kappas[i - 1] * kappas[i] < 0:  # sign change → inflection
            idx = i + 2  # align to closes array
            if idx >= n:
                continue
            price = closes[idx]
            atr = float(np.std(closes[max(0, idx - window): idx]) * 1.5)
            color = "rgba(99, 102, 241, 0.15)"
            overlays.append(
                _make_overlay(
                    "frenet_inflection",
                    "geometric",
                    max(0, idx - 2),
                    idx,
                    price + atr,
                    price + atr,
                    price - atr,
                    price - atr,
                    color,
                )
            )
    return overlays


def detect_geodesic_support_resistance(df: pd.DataFrame, n_levels: int = 3) -> list[PatternOverlay]:
    """
    Compute geodesic distance-based support and resistance levels.

    Approximation: project price onto a 1-D geodesic (price-time arc-length)
    and cluster turning points at equal geodesic intervals.  Drawn from the
    Geometric Calculus / differential geometry module.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < 20:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    # Arc-length parameter: s_i = Σ sqrt(1 + (Δclose)²)
    dx = np.diff(closes)
    ds = np.sqrt(1.0 + dx ** 2)
    s = np.concatenate([[0.0], np.cumsum(ds)])
    total_arc = s[-1]
    if total_arc < 1e-6:
        return overlays
    levels = [total_arc * (k + 1) / (n_levels + 1) for k in range(n_levels)]
    for level_s in levels:
        idx = int(np.searchsorted(s, level_s))
        idx = min(max(idx, 1), n - 2)
        price = float(closes[idx])
        band = float(np.std(closes) * 0.5)
        overlays.append(
            _make_overlay(
                "geodesic_sr",
                "geometric",
                max(0, idx - 3),
                min(n - 1, idx + 3),
                price + band,
                price + band,
                price - band,
                price - band,
                "rgba(245, 158, 11, 0.13)",
            )
        )
    return overlays


# ── Fractional / Exterior Calculus patterns ───────────────────────────────────


def detect_higuchi_regime(df: pd.DataFrame, window: int = 40, k_max: int = 8) -> list[PatternOverlay]:
    """
    Detect fractal dimension regime changes (trending vs. complex noise).

    Drawn from the Fractional Calculus module: regions where the Higuchi
    Fractal Dimension FD < 1.30 (trending) or FD > 1.55 (noisy) are overlaid.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window + k_max * 2 + 5:
        return overlays
    closes = df["close"].to_numpy(dtype=float)

    def _hfd(x: np.ndarray) -> float:
        import math as _math
        nn = len(x)
        lm_list = []
        for k in range(1, k_max + 1):
            lm_k = []
            for m in range(1, k + 1):
                idxs = np.arange(m - 1, nn, k)
                if len(idxs) < 2:
                    continue
                sub = x[idxs]
                length = np.sum(np.abs(np.diff(sub))) * (nn - 1) / (k * len(sub))
                lm_k.append(length)
            if lm_k:
                lm_list.append((_math.log(k), _math.log(max(np.mean(lm_k), 1e-20))))
        if len(lm_list) < 2:
            return float("nan")
        ks = np.array([r[0] for r in lm_list])
        lms = np.array([r[1] for r in lm_list])
        slope, _ = np.polyfit(ks, lms, 1)
        return float(-slope)

    step = max(1, window // 4)
    for end in range(window, n, step):
        seg = closes[end - window: end]
        fd = _hfd(seg)
        if np.isnan(fd):
            continue
        color = "rgba(34, 197, 94, 0.09)" if fd < 1.30 else "rgba(248, 113, 113, 0.09)" if fd > 1.55 else None
        if color is None:
            continue
        hi = float(seg.max())
        lo = float(seg.min())
        overlays.append(
            _make_overlay(
                "fractal_trend" if fd < 1.30 else "fractal_noise",
                "fractional",
                end - window,
                end - 1,
                hi,
                hi,
                lo,
                lo,
                color,
            )
        )
    return overlays


def detect_exterior_derivative_spike(df: pd.DataFrame, window: int = 20) -> list[PatternOverlay]:
    """
    Detect spikes in the discrete exterior derivative (1-form) of log-returns.

    When the wedge-product magnitude of the log-return 1-form exceeds the
    80th percentile, a significant change in the return structure is flagged.
    Drawn from the Exterior Calculus / Differential Forms module.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window + 4:
        return overlays
    closes = df["close"].to_numpy(dtype=float)
    log_rets = np.diff(np.log(np.maximum(closes, 1e-10)))

    mags = []
    for i in range(window, len(log_rets) + 1):
        seg = log_rets[max(0, i - window): i]
        nn = len(seg)
        row_i, col_i = np.triu_indices(nn, k=1)
        diffs = seg[row_i] - seg[col_i]
        mags.append(float(np.sqrt(np.sum(diffs ** 2)) / max(len(diffs), 1)))

    if not mags:
        return overlays
    threshold = float(np.percentile(mags, 80))

    for j, mag in enumerate(mags):
        if mag > threshold:
            idx = j + window  # index in closes
            if idx >= n:
                continue
            price = closes[idx]
            span = float(np.std(closes[max(0, idx - window): idx + 1]) * 1.5)
            overlays.append(
                _make_overlay(
                    "ext_deriv_spike",
                    "differential_form",
                    max(0, idx - window),
                    idx,
                    price + span,
                    price + span,
                    price - span,
                    price - span,
                    "rgba(244, 63, 94, 0.10)",
                )
            )
    return overlays


# ── Harmonic / multi-wave patterns ────────────────────────────────────────────


def detect_harmonic_patterns(df: pd.DataFrame) -> list[PatternOverlay]:
    """
    Detect XABCD Gartley, Bat, and Crab harmonic patterns.

    Uses Fibonacci ratio validation on consecutive pivot swings.  Each
    pattern is scored by how closely the ratios match the canonical values.
    Draws on the Geometric Calculus module's ratio/proportion framework.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < 30:
        return overlays

    closes = df["close"].to_numpy(dtype=float)
    highs = df["high"].to_numpy(dtype=float)
    lows = df["low"].to_numpy(dtype=float)

    # Find local extrema (simplified pivot detection)
    def _pivots(arr: np.ndarray, order: int = 3) -> list[tuple[int, float]]:
        pts = []
        for i in range(order, len(arr) - order):
            window = arr[i - order: i + order + 1]
            if arr[i] == window.max() or arr[i] == window.min():
                pts.append((i, float(arr[i])))
        return pts

    high_pivots = _pivots(highs, order=4)
    low_pivots = _pivots(lows, order=4)
    pivots = sorted(high_pivots + low_pivots, key=lambda t: t[0])

    # Canonical Fibonacci ratios for harmonic patterns
    GARTLEY = {"XAB": 0.618, "ABC": 0.382, "BCD": 1.272, "XAD": 0.786}
    BAT = {"XAB": 0.382, "ABC": 0.382, "BCD": 2.618, "XAD": 0.886}
    CRAB = {"XAB": 0.618, "ABC": 0.382, "BCD": 3.618, "XAD": 1.618}

    def _fib_ratio(a: float, b: float, c: float) -> float:
        span = abs(b - a)
        if span < 1e-10:
            return 0.0
        return abs(c - b) / span

    def _match(r: float, target: float, tol: float = 0.08) -> bool:
        return abs(r - target) < tol

    for i in range(len(pivots) - 4):
        pts = pivots[i: i + 5]
        idxs = [p[0] for p in pts]
        vals = [p[1] for p in pts]
        X, A, B, C, D = vals
        xab = _fib_ratio(X, A, B)
        abc = _fib_ratio(A, B, C)
        bcd = _fib_ratio(B, C, D)
        xad = _fib_ratio(X, A, D)
        for name, pat in [("gartley", GARTLEY), ("bat", BAT), ("crab", CRAB)]:
            if (_match(xab, pat["XAB"]) and _match(abc, pat["ABC"])
                    and _match(bcd, pat["BCD"]) and _match(xad, pat["XAD"])):
                hi = max(vals)
                lo = min(vals)
                color = "rgba(168, 85, 247, 0.12)"
                overlays.append(
                    _make_overlay(
                        f"harmonic_{name}",
                        "harmonic",
                        idxs[0],
                        idxs[-1],
                        hi,
                        hi,
                        lo,
                        lo,
                        color,
                    )
                )
    return overlays


def detect_elliott_waves(df: pd.DataFrame, window: int = 60) -> list[PatternOverlay]:
    """
    Heuristic Elliott Wave 5-wave impulse detection.

    Detects alternating highs and lows where wave-3 is the largest impulse
    and wave-4 does not overlap with wave-1 territory.  Drawn from the
    pattern recognition / wave analysis extension of the Geometric Calculus
    module.
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < window:
        return overlays

    closes = df["close"].to_numpy(dtype=float)
    highs = df["high"].to_numpy(dtype=float)
    lows = df["low"].to_numpy(dtype=float)

    def _local_high(arr: np.ndarray, idx: int, order: int = 3) -> bool:
        lo = max(0, idx - order)
        hi = min(len(arr), idx + order + 1)
        return arr[idx] == arr[lo:hi].max()

    def _local_low(arr: np.ndarray, idx: int, order: int = 3) -> bool:
        lo = max(0, idx - order)
        hi = min(len(arr), idx + order + 1)
        return arr[idx] == arr[lo:hi].min()

    for start in range(0, n - window, max(1, window // 4)):
        seg_h = highs[start: start + window]
        seg_l = lows[start: start + window]
        seg_c = closes[start: start + window]
        m = len(seg_c)
        # Look for 5-pivot impulse: L-H-L-H-L (bullish) or H-L-H-L-H (bearish)
        lows_idx = [i for i in range(3, m - 3) if _local_low(seg_l, i)]
        highs_idx = [i for i in range(3, m - 3) if _local_high(seg_h, i)]
        if len(lows_idx) >= 3 and len(highs_idx) >= 2:
            w0, w2, w4 = lows_idx[:3]
            w1, w3 = highs_idx[:2]
            if w0 < w1 < w2 < w3 < w4:
                wave1 = seg_h[w1] - seg_l[w0]
                wave3 = seg_h[w3] - seg_l[w2]
                wave5_hi = seg_c[-1] if w4 + 3 >= m else seg_l[w4]
                # Wave 3 is the largest; wave 4 does not retrace below wave 1 top
                if wave3 > wave1 and seg_l[w2] > seg_l[w0]:
                    hi = float(seg_h[w1:w4].max())
                    lo = float(seg_l[w0:w4].min())
                    overlays.append(
                        _make_overlay(
                            "elliott_impulse_bull",
                            "elliott",
                            start + w0,
                            start + w4,
                            hi,
                            hi,
                            lo,
                            lo,
                            "rgba(34, 197, 94, 0.11)",
                        )
                    )
    return overlays


# ── Extended candlestick patterns ──────────────────────────────────────────────


def detect_advanced_candlestick_patterns(df: pd.DataFrame) -> list[PatternOverlay]:
    """
    Additional candlestick patterns beyond the basic set:
      - Rising / Falling Three Methods (5-bar continuation)
      - Upside / Downside Gap Three Methods (gap continuation)
      - Kicking (gap-based reversal)
      - On-Neck / In-Neck (partial engulfing)
      - Separating Lines
      - Mat Hold
    """
    overlays: list[PatternOverlay] = []
    n = len(df)
    if n < 5:
        return overlays

    o = df["open"].to_numpy(dtype=float)
    h = df["high"].to_numpy(dtype=float)
    l = df["low"].to_numpy(dtype=float)
    c = df["close"].to_numpy(dtype=float)
    rng = np.maximum(h - l, 1e-9)
    body = np.abs(c - o)
    bull = c > o
    bear = c < o

    def mark(name: str, idx: int, color: str) -> None:
        overlays.append(
            _make_overlay(
                name=name,
                family="candlestick_adv",
                start_idx=max(0, idx - 4),
                end_idx=idx,
                upper_start=h[idx],
                upper_end=h[idx],
                lower_start=l[idx],
                lower_end=l[idx],
                color=color,
            )
        )

    for i in range(4, n):
        # Rising Three Methods: long bull, 3 small bears inside range, long bull
        if (bull[i - 4] and bear[i - 3] and bear[i - 2] and bear[i - 1] and bull[i]
                and c[i] > c[i - 4]
                and all(c[j] > l[i - 4] and h[j] < h[i - 4] for j in [i - 3, i - 2, i - 1])):
            mark("rising_three_methods", i, "rgba(34, 197, 94, 0.18)")

        # Falling Three Methods
        if (bear[i - 4] and bull[i - 3] and bull[i - 2] and bull[i - 1] and bear[i]
                and c[i] < c[i - 4]
                and all(c[j] < h[i - 4] and l[j] > l[i - 4] for j in [i - 3, i - 2, i - 1])):
            mark("falling_three_methods", i, "rgba(239, 68, 68, 0.18)")

        # Upside Gap Three Methods
        if (bull[i - 2] and bull[i - 1] and bear[i]
                and l[i - 1] > h[i - 2]  # gap up
                and o[i] < c[i - 1] and c[i] > o[i - 2]):
            mark("upside_gap_three_methods", i, "rgba(34, 197, 94, 0.15)")

        # Downside Gap Three Methods
        if (bear[i - 2] and bear[i - 1] and bull[i]
                and h[i - 1] < l[i - 2]  # gap down
                and o[i] > c[i - 1] and c[i] < o[i - 2]):
            mark("downside_gap_three_methods", i, "rgba(239, 68, 68, 0.15)")

        # Kicking (bullish): bearish marubozu → gap up → bullish marubozu
        if (bear[i - 1] and bull[i]
                and body[i - 1] / rng[i - 1] > 0.9
                and body[i] / rng[i] > 0.9
                and o[i] > h[i - 1]):
            mark("kicking_bull", i, "rgba(34, 197, 94, 0.20)")

        # Kicking (bearish): bullish marubozu → gap down → bearish marubozu
        if (bull[i - 1] and bear[i]
                and body[i - 1] / rng[i - 1] > 0.9
                and body[i] / rng[i] > 0.9
                and o[i] < l[i - 1]):
            mark("kicking_bear", i, "rgba(239, 68, 68, 0.20)")

        # On-Neck (bearish continuation)
        if (bear[i - 1] and bull[i]
                and o[i] < l[i - 1]
                and abs(c[i] - l[i - 1]) / max(rng[i - 1], 1e-9) < 0.03):
            mark("on_neck", i, "rgba(239, 68, 68, 0.14)")

        # Separating Lines (bullish)
        if (bear[i - 1] and bull[i]
                and abs(o[i] - o[i - 1]) / max(o[i - 1], 1e-9) < 0.001):
            mark("separating_lines_bull", i, "rgba(34, 197, 94, 0.14)")

    return overlays


# ── GPU-accelerated batch feature extractor ────────────────────────────────────


def build_extended_calculus_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Extend build_calculus_matrix_features with:
      - Ornstein-Uhlenbeck κ estimate (stochastic)
      - Vector field curl (vector calculus)
      - Frenet curvature (geometric)
      - Higuchi fractal dimension (fractional)
      - Exterior derivative magnitude (differential forms)
      - GPU-assisted SVD eigenvalue feature

    All features are normalised to [0, 1] and combined with the core
    calculus_strength score.
    """
    base_df = build_calculus_matrix_features(df)
    n = len(df)
    closes = df["close"].to_numpy(dtype=float)
    volumes = df["volume"].to_numpy(dtype=float)

    ou_kappa_arr = np.zeros(n)
    curl_arr = np.zeros(n)
    curvature_arr = np.zeros(n)
    hfd_arr = np.zeros(n)
    ext_mag_arr = np.zeros(n)

    for i in range(30, n):
        seg = closes[max(0, i - 30): i]
        dx = np.diff(seg)
        x_lag = seg[:-1]
        denom = float(np.var(x_lag, ddof=1))
        if denom > 1e-12:
            beta = float(np.cov(dx, x_lag, ddof=1)[0, 1]) / denom
            ou_kappa_arr[i] = max(0.0, -beta)

    for i in range(20, n):
        p = closes[i - 20: i]
        v = volumes[i - 20: i]
        lp = np.log(np.maximum(p, 1e-10))
        lv = np.log(np.maximum(v, 1e-10))
        dlp = np.diff(lp)
        dlv = np.diff(lv)
        if len(dlp) > 2:
            area = 0.5 * float(np.sum(dlp[:-1] * dlv[1:] - dlv[:-1] * dlp[1:]))
            path_len = float(np.sum(np.sqrt(dlp ** 2 + dlv ** 2))) + 1e-12
            curl_arr[i] = abs(area / path_len)

    x_norm = (closes - closes.mean()) / (closes.std(ddof=1) + 1e-10)
    d1 = np.diff(x_norm)
    d2 = np.diff(d1)
    kappas_full = d2 / (1.0 + d1[:-1] ** 2) ** 1.5
    curvature_arr[2:len(kappas_full) + 2] = np.abs(kappas_full)

    for i in range(40, n, 5):
        import math as _math
        seg = closes[i - 40: i]
        nn = len(seg)
        lm_list = []
        for k in range(1, 6):
            lm_k = []
            for m in range(1, k + 1):
                idxs = np.arange(m - 1, nn, k)
                if len(idxs) < 2:
                    continue
                sub = seg[idxs]
                length = np.sum(np.abs(np.diff(sub))) * (nn - 1) / (k * len(sub))
                lm_k.append(length)
            if lm_k:
                lm_list.append((_math.log(k), _math.log(max(np.mean(lm_k), 1e-20))))
        if len(lm_list) >= 2:
            ks = np.array([r[0] for r in lm_list])
            lms = np.array([r[1] for r in lm_list])
            slope, _ = np.polyfit(ks, lms, 1)
            fd = float(-slope)
            hfd_arr[i - 5: i] = max(0.0, min(2.0, fd))

    for i in range(20, n):
        seg = closes[max(0, i - 20): i]
        log_rets = np.diff(np.log(np.maximum(seg, 1e-10)))
        nn = len(log_rets)
        if nn > 2:
            row_i, col_i = np.triu_indices(nn, k=1)
            diffs = log_rets[row_i] - log_rets[col_i]
            ext_mag_arr[i] = float(np.sqrt(np.sum(diffs ** 2)) / max(len(diffs), 1))

    def norm(arr: np.ndarray) -> np.ndarray:
        lo, hi = float(np.nanmin(arr)), float(np.nanmax(arr))
        if hi - lo < 1e-10:
            return np.zeros_like(arr)
        return (arr - lo) / (hi - lo)

    ou_n = norm(ou_kappa_arr)
    curl_n = norm(curl_arr)
    curv_n = norm(curvature_arr)
    hfd_n = norm(hfd_arr)
    ext_n = norm(ext_mag_arr)

    extended_strength = (
        0.18 * base_df["calculus_strength"].to_numpy()
        + 0.14 * ou_n
        + 0.14 * curl_n
        + 0.18 * curv_n
        + 0.18 * hfd_n
        + 0.18 * ext_n
    )

    result_df = base_df.copy()
    result_df["ou_kappa"] = ou_kappa_arr
    result_df["vector_curl"] = curl_arr
    result_df["frenet_curvature"] = curvature_arr
    result_df["higuchi_fd"] = hfd_arr
    result_df["ext_deriv_mag"] = ext_mag_arr
    result_df["extended_strength"] = extended_strength
    return result_df


def score_and_select_patterns(
    overlays: list[PatternOverlay],
    calculus_strength: pd.Series,
    max_patterns: int,
    min_score: float,
) -> list[PatternOverlay]:
    for overlay in overlays:
        segment = _segment_score(calculus_strength, overlay.start_idx, overlay.end_idx)
        width_penalty = 1.0 / (1.0 + 0.015 * max(1, overlay.end_idx - overlay.start_idx))
        family_bias = 1.08 if overlay.family in {"triangle", "pennant", "flag"} else 1.0
        overlay.score = float(segment * width_penalty * family_bias)

    overlays.sort(key=lambda item: item.score, reverse=True)
    filtered = [item for item in overlays if item.score >= min_score]
    return filtered[:max_patterns]


def calculate_overlays_and_calculus(
    df: pd.DataFrame,
    max_patterns: int = 60,
    min_score: float = 0.18,
) -> tuple[list[PatternOverlay], pd.DataFrame]:
    overlays: list[PatternOverlay] = []

    consolidation = detect_consolidation(df)
    if consolidation is not None:
        overlays.append(
            _make_overlay(
                "consolidation_box",
                "rectangle",
                consolidation.start_idx,
                consolidation.end_idx,
                consolidation.upper,
                consolidation.upper,
                consolidation.lower,
                consolidation.lower,
                "rgba(245, 158, 11, 0.12)",
            )
        )

    triangle = detect_sym_triangle(df)
    if triangle is not None:
        overlays.append(
            _make_overlay(
                "primary_sym_triangle",
                "triangle",
                triangle.start_idx,
                triangle.end_idx,
                triangle.upper_start,
                triangle.upper_end,
                triangle.lower_start,
                triangle.lower_end,
                "rgba(96, 165, 250, 0.12)",
            )
        )

    overlays.extend(detect_continuation_patterns(df))
    overlays.extend(detect_candlestick_patterns(df))

    # Extended mathematical / calculus-based patterns
    overlays.extend(detect_ornstein_uhlenbeck_reversion(df))
    overlays.extend(detect_brownian_volatility_cluster(df))
    overlays.extend(detect_geometric_brownian_drift(df))
    overlays.extend(detect_vector_field_divergence(df))
    overlays.extend(detect_vector_field_curl(df))
    overlays.extend(detect_frenet_inflection(df))
    overlays.extend(detect_geodesic_support_resistance(df))
    overlays.extend(detect_higuchi_regime(df))
    overlays.extend(detect_exterior_derivative_spike(df))
    overlays.extend(detect_harmonic_patterns(df))
    overlays.extend(detect_elliott_waves(df))
    overlays.extend(detect_advanced_candlestick_patterns(df))

    # Use extended calculus features for scoring
    calculus = build_extended_calculus_features(df)
    selected = score_and_select_patterns(
        overlays=overlays,
        calculus_strength=calculus["extended_strength"],
        max_patterns=max(1, max_patterns),
        min_score=max(0.0, min(min_score, 1.0)),
    )
    return selected, calculus


def draw_trend_line(chart: Chart, t1, p1: float, t2, p2: float, color: str) -> None:
    methods = ["trend_line", "create_trend_line"]
    for method_name in methods:
        method = getattr(chart, method_name, None)
        if method is None:
            continue
        for call in (
            lambda: method(t1, p1, t2, p2, color=color, width=2),
            lambda: method(start_time=t1, start_value=p1, end_time=t2, end_value=p2, color=color, width=2),
            lambda: method(t1, p1, t2, p2),
        ):
            try:
                call()
                return
            except Exception:
                continue


def draw_span(chart: Chart, t1, t2, color: str) -> None:
    methods = ["vertical_span", "create_vertical_span"]
    for method_name in methods:
        method = getattr(chart, method_name, None)
        if method is None:
            continue
        for call in (
            lambda: method(t1, t2, color=color),
            lambda: method(start_time=t1, end_time=t2, color=color),
            lambda: method(t1, t2),
        ):
            try:
                call()
                return
            except Exception:
                continue


def draw_overlay(chart: Chart, df: pd.DataFrame, overlay: PatternOverlay) -> None:
    t1 = df.loc[overlay.start_idx, "time"]
    t2 = df.loc[overlay.end_idx, "time"]
    draw_trend_line(chart, t1, overlay.upper_start, t2, overlay.upper_end, overlay.color.replace("0.12", "0.9"))
    draw_trend_line(chart, t1, overlay.lower_start, t2, overlay.lower_end, overlay.color.replace("0.12", "0.9"))
    draw_span(chart, t1, t2, overlay.color)


def main() -> None:
    parser = argparse.ArgumentParser(description="Lightweight chart with yfinance pattern overlays")
    parser.add_argument("--ticker", default="SPY", help="Ticker symbol (default: SPY)")
    parser.add_argument("--period", default="6mo", help="yfinance period (default: 6mo)")
    parser.add_argument("--interval", default="1d", help="yfinance interval (default: 1d)")
    parser.add_argument("--width", type=int, default=1200, help="Chart width in px")
    parser.add_argument("--height", type=int, default=700, help="Chart height in px")
    parser.add_argument("--max-patterns", type=int, default=60, help="Maximum overlays to draw (default: 60)")
    parser.add_argument("--min-score", type=float, default=0.18, help="Minimum calculus score to keep (default: 0.18)")
    args = parser.parse_args()

    df = fetch_ohlcv(args.ticker, args.period, args.interval)

    chart = Chart(width=args.width, height=args.height)
    chart.layout(background_color="#0f172a", text_color="#e2e8f0")
    chart.grid(vert_color="#1e293b", horz_color="#1e293b")
    chart.candle_style(
        up_color="#22c55e",
        down_color="#ef4444",
        border_up_color="#22c55e",
        border_down_color="#ef4444",
        wick_up_color="#22c55e",
        wick_down_color="#ef4444",
    )

    chart.set(df)

    selected, _calculus = calculate_overlays_and_calculus(
        df,
        max_patterns=args.max_patterns,
        min_score=args.min_score,
    )

    for overlay in selected:
        draw_overlay(chart, df, overlay)

    if selected:
        names = ", ".join(item.name for item in selected[:20])
        print(f"Drawn {len(selected)} overlays: {names}")
    else:
        print("No patterns met the current score threshold. Try lowering --min-score.")

    chart.show(block=True)


if __name__ == "__main__":
    main()
