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

    calculus = build_calculus_matrix_features(df)
    selected = score_and_select_patterns(
        overlays=overlays,
        calculus_strength=calculus["calculus_strength"],
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
