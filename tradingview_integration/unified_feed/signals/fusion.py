"""
Signal fusion — weighted ensemble of technical + fundamental signals.

Signal components
-----------------
  TA momentum   : EMA trend + MACD cross                  weight 0.30
  BB position   : BB Z-score clipped to [-1, 1] inverted  weight 0.20
  RSI regime    : normalised (RSI − 50) / 50              weight 0.15
  External proj : SP projection direction                  weight 0.20
  ML prediction : market_prediction signal                 weight 0.15

Final composite score ∈ [-1, 1]: positive = bullish, negative = bearish.
"""

from __future__ import annotations

import numpy as np


def fuse_signals(
    ta: dict,
    sp_data: dict,
    mp_data: dict,
    gf_data: dict,
    anomaly: dict,
) -> dict:
    """
    Produce a weighted composite signal from TA and external data.

    Parameters
    ----------
    ta:       Output of ``indicators.ta.compute_ta``.
    sp_data:  S&P closing projection dict.
    mp_data:  Market prediction dict.
    gf_data:  Google Finance quote dict for the ticker.
    anomaly:  Output of ``signals.anomaly.detect_anomalies``.

    Returns
    -------
    dict with ``composite_score``, ``signal_label``, ``components``,
    and ``anomaly_penalty``.
    """
    # TA momentum component
    ema_dir  = 1.0 if ta.get("ema_trend") == "BULL" else (-1.0 if ta.get("ema_trend") == "BEAR" else 0.0)
    macd_dir = 1.0 if ta.get("macd_cross") == "BULLISH" else (-1.0 if ta.get("macd_cross") == "BEARISH" else 0.0)
    ta_score = (ema_dir + macd_dir) / 2.0

    # BB position (mean-reversion: above BB mid = bearish)
    bbz      = ta.get("bb_zscore", 0.0) or 0.0
    bb_score = -float(np.clip(bbz, -1.0, 1.0))

    # RSI normalised
    rsi_v     = ta.get("rsi") or 50.0
    rsi_score = (rsi_v - 50.0) / 50.0

    # External SP projection
    sp_sig   = sp_data.get("signal", "neutral").lower()
    sp_score = 1.0 if sp_sig == "bullish" else (-1.0 if sp_sig == "bearish" else 0.0)

    # ML prediction
    mp_sig   = mp_data.get("prediction", {}).get("signal", "neutral").lower()
    mp_score = 1.0 if mp_sig == "bullish" else (-1.0 if mp_sig == "bearish" else 0.0)

    # Anomaly penalty
    anomaly_penalty = 0.5 if anomaly.get("is_anomaly") else 1.0

    composite = (
        0.30 * ta_score
        + 0.20 * bb_score
        + 0.15 * rsi_score
        + 0.20 * sp_score
        + 0.15 * mp_score
    ) * anomaly_penalty

    signal_label = (
        "STRONG_BULL" if composite >  0.6 else
        "BULL"        if composite >  0.2 else
        "STRONG_BEAR" if composite < -0.6 else
        "BEAR"        if composite < -0.2 else
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
