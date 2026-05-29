"""
Anomaly detection — rolling Z-score on log-returns.
"""

from __future__ import annotations

import numpy as np
import pandas as pd

from ..config import ANOMALY_ZSCORE


def detect_anomalies(
    ohlcv_df: pd.DataFrame,
    threshold: float = ANOMALY_ZSCORE,
) -> dict:
    """
    Flag return anomalies using rolling Z-scores.

    Returns
    -------
    is_anomaly    : True if the latest bar is anomalous.
    zscore_last   : Z-score of the latest log-return.
    anomaly_count : Number of anomalous bars in the window.
    anomaly_pct   : Percentage of anomalous bars.
    """
    if ohlcv_df.empty or len(ohlcv_df) < 5:
        return {"is_anomaly": False, "zscore_last": 0.0, "anomaly_count": 0, "anomaly_pct": 0.0}

    closes = ohlcv_df["close"].values.astype(float)
    rets   = np.diff(np.log(np.clip(closes, 1e-9, None)))
    if len(rets) < 2:
        return {"is_anomaly": False, "zscore_last": 0.0, "anomaly_count": 0, "anomaly_pct": 0.0}

    mu     = rets.mean()
    sg     = rets.std() + 1e-9
    zs     = (rets - mu) / sg
    last_z = float(zs[-1])
    count  = int(np.sum(np.abs(zs) > threshold))

    return {
        "is_anomaly":    abs(last_z) > threshold,
        "zscore_last":   round(last_z, 3),
        "anomaly_count": count,
        "anomaly_pct":   round(count / len(zs) * 100, 1),
    }
