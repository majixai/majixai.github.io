"""
Zone detection for the Top-Heavy reporting pipeline.

Definitions
-----------
Expansion Zone
    A ticker whose 14-day Average True Range (ATR) has risen more than 2
    standard deviations above its own 20-day rolling mean.  This signals
    an abnormal volatility expansion that warrants immediate attention.

Consolidation Zone
    A ticker whose 20-day price range (High − Low) is less than 1 % of
    the current closing price.  The narrow channel suggests the ticker is
    coiling before a breakout.

Bull Trigger
    A ticker that sits inside an Expansion Zone *and* has gained more than
    3 % since the prior closing session.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Tunable thresholds ──────────────────────────────────────────────────────
ATR_WINDOW: int = 14          # bars used to calculate each ATR point
ATR_MEAN_WINDOW: int = 20     # rolling window for ATR mean/std
ATR_STDEV_THRESHOLD: float = 2.0   # z-score above which expansion is triggered
CONSOL_RANGE_WINDOW: int = 20      # look-back bars for consolidation range
CONSOL_PCT_THRESHOLD: float = 0.01  # 1 % of price
BULL_TRIGGER_PCT: float = 0.03      # 3 % single-session gain


@dataclass
class ZoneResult:
    """Outcome of the zone classification for one ticker."""

    ticker: str
    expansion: bool = False
    consolidation: bool = False
    bull_trigger: bool = False

    # Underlying metrics (NaN when data was unavailable)
    atr: float = float("nan")
    atr_zscore: float = float("nan")
    range_pct: float = float("nan")
    session_gain_pct: float = float("nan")
    last_close: float = float("nan")

    error: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "ticker": self.ticker,
            "expansion": self.expansion,
            "consolidation": self.consolidation,
            "bull_trigger": self.bull_trigger,
            "atr": round(self.atr, 4) if not np.isnan(self.atr) else None,
            "atr_zscore": round(self.atr_zscore, 4) if not np.isnan(self.atr_zscore) else None,
            "range_pct": round(self.range_pct, 6) if not np.isnan(self.range_pct) else None,
            "session_gain_pct": round(self.session_gain_pct, 6) if not np.isnan(self.session_gain_pct) else None,
            "last_close": round(self.last_close, 4) if not np.isnan(self.last_close) else None,
            "error": self.error,
        }


@dataclass
class ZoneSummary:
    """Aggregate classification output for all processed tickers."""

    total: int = 0
    expansion_zones: List[ZoneResult] = field(default_factory=list)
    consolidation_zones: List[ZoneResult] = field(default_factory=list)
    bull_triggers: List[ZoneResult] = field(default_factory=list)
    errors: List[ZoneResult] = field(default_factory=list)

    def top_expansion(self, n: int = 5) -> List[ZoneResult]:
        """Return up to *n* highest-z-score expansion tickers."""
        return sorted(
            self.expansion_zones,
            key=lambda r: r.atr_zscore if not np.isnan(r.atr_zscore) else -1,
            reverse=True,
        )[:n]

    def top_consolidation(self, n: int = 5) -> List[ZoneResult]:
        """Return up to *n* tightest consolidation tickers (smallest range_pct)."""
        return sorted(
            self.consolidation_zones,
            key=lambda r: r.range_pct if not np.isnan(r.range_pct) else 1.0,
        )[:n]

    def to_dict(self) -> Dict:
        return {
            "total": self.total,
            "expansion_count": len(self.expansion_zones),
            "consolidation_count": len(self.consolidation_zones),
            "bull_trigger_count": len(self.bull_triggers),
            "error_count": len(self.errors),
        }


# ── Core calculation helpers (vectorised, DataFrame-in / scalar-out) ─────────

def _true_range(df: pd.DataFrame) -> pd.Series:
    """Compute True Range from a DataFrame with High, Low, Close columns."""
    high = df["High"]
    low = df["Low"]
    prev_close = df["Close"].shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr


def _atr(df: pd.DataFrame, window: int = ATR_WINDOW) -> pd.Series:
    """Compute ATR (simple rolling mean of TR)."""
    return _true_range(df).rolling(window).mean()


def classify_ticker(ticker: str, df: pd.DataFrame) -> ZoneResult:
    """
    Classify *one* ticker DataFrame into zones.

    Parameters
    ----------
    ticker:
        Symbol string.
    df:
        DataFrame returned by yfinance.download or equivalent.  Must contain
        columns Open, High, Low, Close, Volume sorted ascending by date.

    Returns
    -------
    ZoneResult
    """
    result = ZoneResult(ticker=ticker)

    if df is None or df.empty or len(df) < max(ATR_MEAN_WINDOW + ATR_WINDOW, CONSOL_RANGE_WINDOW + 1):
        result.error = f"insufficient data ({len(df) if df is not None else 0} rows)"
        return result

    # Normalise multi-level columns produced by yfinance batch download
    if isinstance(df.columns, pd.MultiIndex):
        df = df.xs(ticker, level=1, axis=1, drop_level=True) if ticker in df.columns.get_level_values(1) else df
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]

    required = {"High", "Low", "Close"}
    if not required.issubset(set(df.columns)):
        result.error = f"missing columns {required - set(df.columns)}"
        return result

    df = df[list(required)].copy()
    df = df.dropna()

    # ── ATR z-score ──────────────────────────────────────────────────────────
    atr_series = _atr(df)
    rolling_mean = atr_series.rolling(ATR_MEAN_WINDOW).mean()
    rolling_std = atr_series.rolling(ATR_MEAN_WINDOW).std(ddof=1)

    latest_atr = atr_series.iloc[-1]
    m = rolling_mean.iloc[-1]
    s = rolling_std.iloc[-1]

    result.atr = float(latest_atr) if not pd.isna(latest_atr) else float("nan")
    if not any(pd.isna(v) for v in (latest_atr, m, s)) and s > 0:
        result.atr_zscore = float((latest_atr - m) / s)
        result.expansion = result.atr_zscore > ATR_STDEV_THRESHOLD
    else:
        result.atr_zscore = float("nan")

    # ── Consolidation range ───────────────────────────────────────────────────
    window_slice = df.tail(CONSOL_RANGE_WINDOW)
    high_max = window_slice["High"].max()
    low_min = window_slice["Low"].min()
    last_close = float(df["Close"].iloc[-1])
    result.last_close = last_close

    if last_close > 0:
        result.range_pct = (high_max - low_min) / last_close
        result.consolidation = result.range_pct < CONSOL_PCT_THRESHOLD

    # ── Session gain ─────────────────────────────────────────────────────────
    if len(df) >= 2:
        prev_close = float(df["Close"].iloc[-2])
        if prev_close > 0:
            result.session_gain_pct = (last_close - prev_close) / prev_close

    # ── Bull Trigger ─────────────────────────────────────────────────────────
    if result.expansion and not np.isnan(result.session_gain_pct):
        result.bull_trigger = result.session_gain_pct > BULL_TRIGGER_PCT

    return result


def classify_many(
    ticker_frames: Dict[str, pd.DataFrame],
    *,
    log_interval: int = 50,
) -> ZoneSummary:
    """
    Classify a dict of {ticker → DataFrame} into a ZoneSummary.

    Parameters
    ----------
    ticker_frames:
        Mapping of symbol → OHLCV DataFrame.
    log_interval:
        How often to emit a progress log.
    """
    summary = ZoneSummary(total=len(ticker_frames))

    for idx, (sym, df) in enumerate(ticker_frames.items(), 1):
        if idx % log_interval == 0:
            logger.info("classify_many: processed %d / %d", idx, summary.total)

        result = classify_ticker(sym, df)

        if result.error:
            summary.errors.append(result)
            continue

        if result.expansion:
            summary.expansion_zones.append(result)
        if result.consolidation:
            summary.consolidation_zones.append(result)
        if result.bull_trigger:
            summary.bull_triggers.append(result)

    logger.info(
        "Zone scan complete: %d tickers → %d expansion, %d consolidation, %d bull triggers, %d errors",
        summary.total,
        len(summary.expansion_zones),
        len(summary.consolidation_zones),
        len(summary.bull_triggers),
        len(summary.errors),
    )
    return summary


def classify_from_batch_df(
    batch_df: pd.DataFrame,
    tickers: List[str],
    *,
    log_interval: int = 50,
) -> ZoneSummary:
    """
    Classify zones from a single multi-ticker DataFrame produced by
    ``yfinance.download(tickers, ...)``.

    The DataFrame is expected to have a two-level MultiIndex on columns
    (field, ticker) – e.g. ``("Close", "AAPL")``.  If yfinance returned
    only a single-level column frame (one ticker), it is wrapped.
    """
    if batch_df is None or batch_df.empty:
        return ZoneSummary(total=len(tickers))

    # Build per-ticker frames without copying the whole dataset
    ticker_frames: Dict[str, pd.DataFrame] = {}

    if isinstance(batch_df.columns, pd.MultiIndex):
        for sym in tickers:
            try:
                sub = batch_df.xs(sym, level=1, axis=1, drop_level=True)
                ticker_frames[sym] = sub
            except KeyError:
                # Ticker not present in the batch result – treat as empty
                ticker_frames[sym] = pd.DataFrame()
    else:
        # Single-ticker fallback: the whole frame belongs to tickers[0]
        if len(tickers) == 1:
            ticker_frames[tickers[0]] = batch_df
        else:
            logger.warning("classify_from_batch_df: single-level columns but multiple tickers; skipping.")
            return ZoneSummary(total=len(tickers))

    return classify_many(ticker_frames, log_interval=log_interval)
