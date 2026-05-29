"""
Seed quality scoring — 0–100 scale.

Components
----------
  row_count_score   : 0–30 (capped at 60 rows = 30 pts)
  ta_completeness   : 0–40 (fraction of TA fields populated)
  anomaly_score     : 0–30 (30 pts when anomaly_pct < 5%)
"""

from __future__ import annotations

import pandas as pd

_TA_FIELDS = ["rsi", "macd", "bb_upper", "bb_lower", "atr", "ema_fast", "ema_slow", "vwap"]


def compute_seed_quality(
    ohlcv_df: pd.DataFrame,
    ta: dict,
    anomaly: dict,
) -> dict:
    """
    Score the seed data quality on a 0–100 scale.

    Parameters
    ----------
    ohlcv_df: OHLCV DataFrame.
    ta:       Output of ``indicators.ta.compute_ta``.
    anomaly:  Output of ``signals.anomaly.detect_anomalies``.

    Returns
    -------
    dict with ``total``, ``row``, ``ta``, ``anomaly``, and ``grade``.
    """
    n_rows = len(ohlcv_df)
    row_sc = min(30, int(n_rows / 60.0 * 30.0))

    populated = sum(1 for k in _TA_FIELDS if ta.get(k) is not None)
    ta_sc     = int(populated / len(_TA_FIELDS) * 40.0)

    anm_pct = anomaly.get("anomaly_pct", 100.0)
    anm_sc  = max(0, int(30.0 - anm_pct * 2.0))

    total = row_sc + ta_sc + anm_sc
    return {
        "total":   total,
        "row":     row_sc,
        "ta":      ta_sc,
        "anomaly": anm_sc,
        "grade":   "A" if total >= 80 else "B" if total >= 60 else "C" if total >= 40 else "D",
    }
