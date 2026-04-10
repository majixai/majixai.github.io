"""
tensor.financial.regimes
========================
Five-class softmax regime classifier.

Maps the denoised feature matrix to a probability distribution over five
market regimes: STRONG_BULL, BULL, NEUTRAL, BEAR, STRONG_BEAR.
"""
from __future__ import annotations

import numpy as np


def classify_regimes_5(F_den: np.ndarray) -> np.ndarray:
    """
    Five-class softmax regime classifier.

    Logit construction::

        strong_bull  = return_score * 100
        bull         = return_score *  40
        neutral      = 0
        bear         = return_score * -40
        strong_bear  = return_score * -100

    Parameters
    ----------
    F_den:
        Denoised feature matrix, shape (n, m).  Column 1 must be log returns.

    Returns
    -------
    P : np.ndarray, shape (n, 5)
        Regime probabilities per bar, columns:
        [p_strong_bull, p_bull, p_neutral, p_bear, p_strong_bear]
    """
    rets   = F_den[:, 1]
    scales = np.array([100.0, 40.0, 0.0, -40.0, -100.0])
    logits = np.outer(rets, scales)                          # [n × 5]
    logits -= logits.max(axis=1, keepdims=True)
    e  = np.exp(logits)
    P  = e / e.sum(axis=1, keepdims=True)
    return P
