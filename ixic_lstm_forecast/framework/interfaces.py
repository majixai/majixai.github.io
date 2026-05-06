"""
ixic_lstm_forecast.framework.interfaces
========================================
Protocol definitions (interfaces) for the IXIC LSTM Forecast framework.

IModelForecaster — contract for any time-series ML model.
IStorageEngine   — contract for any persistence back-end.
"""

from __future__ import annotations

import logging
from typing import Any, Protocol

import numpy as np

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Protocol: IModelForecaster
# ---------------------------------------------------------------------------
class IModelForecaster(Protocol):
    """Interface for a trainable, sequence-producing forecaster."""

    def train(self, X: np.ndarray, y: np.ndarray) -> None:
        """Train the model on feature matrix X and targets y."""
        ...

    def predict_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """Return a predicted value (or array) from a single input sequence."""
        ...


# ---------------------------------------------------------------------------
# Protocol: IStorageEngine
# ---------------------------------------------------------------------------
class IStorageEngine(Protocol):
    """Interface for a commit-style data persistence engine."""

    def commit(self, data: Any) -> None:
        """Persist *data* atomically."""
        ...


log.debug("[interfaces] IModelForecaster and IStorageEngine protocols defined.")
