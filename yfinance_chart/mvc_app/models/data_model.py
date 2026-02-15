from __future__ import annotations

import csv
import json
import lzma
import time
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import skew as scipy_skew

from lightweight_pattern_chart import calculate_overlays_and_calculus, fetch_ohlcv

CACHE_TTL_SECONDS = 45
_cache: dict[tuple[str, str, str], tuple[float, object]] = {}


def _cache_get(key: tuple[str, str, str]):
    payload = _cache.get(key)
    if payload is None:
        return None
    ts, value = payload
    if time.time() - ts > CACHE_TTL_SECONDS:
        _cache.pop(key, None)
        return None
    return value


def _cache_set(key: tuple[str, str, str], value):
    _cache[key] = (time.time(), value)


def get_df(ticker: str, period: str, interval: str):
    key = (ticker, period, interval)
    cached = _cache_get(key)
    if cached is not None:
        return cached
    df = fetch_ohlcv(ticker=ticker, period=period, interval=interval)
    _cache_set(key, df)
    return df


def build_overlays_payload(df, max_patterns: int, min_score: float) -> tuple[list[dict], dict]:
    selected, calculus = calculate_overlays_and_calculus(
        df=df,
        max_patterns=max(1, max_patterns),
        min_score=max(0.0, min(min_score, 1.0)),
    )

    overlays_payload = [
        {
            "name": item.name,
            "family": item.family,
            "start_idx": int(item.start_idx),
            "end_idx": int(item.end_idx),
            "upper_start": float(item.upper_start),
            "upper_end": float(item.upper_end),
            "lower_start": float(item.lower_start),
            "lower_end": float(item.lower_end),
            "color": item.color,
            "score": float(item.score),
        }
        for item in selected
    ]
    tail = calculus.tail(1).iloc[0].to_dict()
    return overlays_payload, {k: float(v) for k, v in tail.items()}


def _interval_seconds(interval: str) -> int:
    token = (interval or "1d").strip().lower()
    if token.endswith("mo"):
        value = int(token[:-2] or "1")
        return value * 30 * 24 * 3600
    unit = token[-1] if token else "d"
    value = int(token[:-1] or "1") if token[:-1].isdigit() else 1
    if unit == "m":
        return value * 60
    if unit == "h":
        return value * 3600
    if unit == "d":
        return value * 24 * 3600
    if unit == "w":
        return value * 7 * 24 * 3600
    return 24 * 3600


def build_projection_payload(df: pd.DataFrame, interval: str, horizon: int = 24) -> dict:
    if df.empty:
        return {"horizon": 0, "points": []}

    close = df["close"].astype(float)
    returns = close.pct_change().replace([np.inf, -np.inf], np.nan).dropna()
    if len(returns) < 5:
        return {"horizon": 0, "points": []}

    lookback = min(200, len(returns))
    tail_returns = returns.tail(lookback)
    drift = float(tail_returns.mean())
    sigma = float(tail_returns.std(ddof=0))
    skewness = float(scipy_skew(tail_returns, bias=False)) if len(tail_returns) > 2 else 0.0

    median_ret = float(np.median(tail_returns))
    mad = float(np.median(np.abs(tail_returns - median_ret)) + 1e-9)
    robust_sigma = 1.4826 * mad

    last_close = float(close.iloc[-1])
    last_time = pd.to_datetime(df["time"].iloc[-1])
    step_seconds = _interval_seconds(interval)

    points: list[dict] = []
    for step in range(1, max(1, horizon) + 1):
        sqrt_t = np.sqrt(step)
        mean = last_close * (1.0 + drift * step)
        std_dev = sigma * sqrt_t
        robust_dev = robust_sigma * sqrt_t

        skew_up_mult = 1.0 + 0.45 * max(skewness, 0.0)
        skew_dn_mult = 1.0 + 0.45 * max(-skewness, 0.0)

        std1_upper = mean * (1.0 + std_dev)
        std1_lower = max(0.0, mean * (1.0 - std_dev))
        std2_upper = mean * (1.0 + 2.0 * std_dev)
        std2_lower = max(0.0, mean * (1.0 - 2.0 * std_dev))
        std3_upper = mean * (1.0 + 3.0 * std_dev)
        std3_lower = max(0.0, mean * (1.0 - 3.0 * std_dev))

        skew_upper = mean * (1.0 + std_dev * skew_up_mult)
        skew_lower = max(0.0, mean * (1.0 - std_dev * skew_dn_mult))

        robust_upper = mean * (1.0 + 2.0 * robust_dev)
        robust_lower = max(0.0, mean * (1.0 - 2.0 * robust_dev))

        point_time = last_time + pd.to_timedelta(step_seconds * step, unit="s")
        points.append(
            {
                "time": point_time.strftime("%Y-%m-%dT%H:%M:%S"),
                "mean": float(mean),
                "std1_upper": float(std1_upper),
                "std1_lower": float(std1_lower),
                "std2_upper": float(std2_upper),
                "std2_lower": float(std2_lower),
                "std3_upper": float(std3_upper),
                "std3_lower": float(std3_lower),
                "skew_upper": float(skew_upper),
                "skew_lower": float(skew_lower),
                "robust_upper": float(robust_upper),
                "robust_lower": float(robust_lower),
            }
        )

    return {
        "horizon": int(horizon),
        "drift": drift,
        "sigma": sigma,
        "skewness": skewness,
        "robust_sigma": robust_sigma,
        "points": points,
    }


def search_manifest_records(data_base_dir: Path, query: str, ticker: str, limit: int) -> list[dict]:
    index_path = data_base_dir / "level2_datastore" / "manifests" / "index.csv"
    if not index_path.exists():
        return []

    query_lower = query.lower().strip()
    ticker_upper = ticker.upper().strip()
    matches: list[dict] = []

    with index_path.open("r", encoding="utf-8", newline="") as fp:
        reader = csv.DictReader(fp)
        for row in reader:
            row_ticker = (row.get("ticker") or "").upper()
            haystack = " ".join(
                [
                    row.get("ticker", ""),
                    row.get("period", ""),
                    row.get("interval", ""),
                    row.get("sha256", ""),
                    row.get("object", ""),
                    row.get("created_utc", ""),
                ]
            ).lower()

            if ticker_upper and row_ticker != ticker_upper:
                continue
            if query_lower and query_lower not in haystack:
                continue
            matches.append(row)

    matches.sort(key=lambda item: item.get("created_utc", ""), reverse=True)
    return matches[:limit]


def preview_from_dat(data_base_dir: Path, object_rel_path: str) -> dict:
    object_path = data_base_dir / "level2_datastore" / object_rel_path
    if not object_path.exists():
        return {"error": "object file not found"}
    try:
        compressed = object_path.read_bytes()
        payload = json.loads(lzma.decompress(compressed).decode("utf-8"))
    except Exception as exc:
        return {"error": f"decompression failed: {type(exc).__name__}"}

    overlays = payload.get("overlays", [])
    calculus_tail = payload.get("calculus_tail", [])
    lite_tail = payload.get("lite_tail", [])

    return {
        "meta": payload.get("meta", {}),
        "overlay_count": len(overlays),
        "overlay_names": [item.get("name") for item in overlays[:10]],
        "calculus_latest": calculus_tail[-1] if calculus_tail else {},
        "lite_latest": lite_tail[-1] if lite_tail else {},
    }
