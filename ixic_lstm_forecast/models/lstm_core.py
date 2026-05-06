"""
ixic_lstm_forecast.models.lstm_core
=====================================
LSTMCore — the core LSTM forecasting model.

Implements both ``QuantFrameworkBase`` (OOP inheritance) and the
``IModelForecaster`` protocol (structural typing), bringing together:

* TensorFlow Keras LSTM + Dense architecture  (§8)
* WeakMap tensor cache registration           (§3)
* Lifecycle hook decoration on ``train``      (§4)
"""

from __future__ import annotations

import logging
import os
import warnings

import numpy as np

# Suppress TF/oneDNN verbose output before importing keras
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
warnings.filterwarnings("ignore")

from tensorflow.keras.layers import LSTM, Dense
from tensorflow.keras.models import Sequential

from ixic_lstm_forecast.framework.base import QuantFrameworkBase, _global_tensor_cache
from ixic_lstm_forecast.framework.decorators import lifecycle_hook, log_event

log = logging.getLogger(__name__)


class LSTMCore(QuantFrameworkBase):
    """
    Single-layer LSTM regressor for short-horizon price forecasting.

    Parameters
    ----------
    seq_length:
        Number of look-back time-steps fed into the LSTM layer.
    lstm_units:
        Number of LSTM hidden units (default: 25).
    """

    def __init__(self, seq_length: int, lstm_units: int = 25) -> None:
        log.info(
            "[LSTMCore] __init__ — seq_length=%d  lstm_units=%d",
            seq_length,
            lstm_units,
        )
        super().__init__()  # seeds TF + NumPy via QuantFrameworkBase
        self.seq_length = seq_length
        self.lstm_units = lstm_units

        log.debug("[LSTMCore] building Keras Sequential model...")
        self._model: Sequential = self._build_model()

        # Register in the WeakKeyDictionary cache (§3)
        _global_tensor_cache[self] = {"status": "compiled", "type": "LSTM"}
        log.info(
            "[LSTMCore] model compiled and registered in _global_tensor_cache. "
            "Cache entry: %s",
            _global_tensor_cache[self],
        )

    # ------------------------------------------------------------------
    def _build_model(self) -> Sequential:
        """Construct and compile the Keras LSTM → Dense model."""
        log.debug(
            "[LSTMCore] _build_model — input_shape=(%d, 1)  units=%d",
            self.seq_length,
            self.lstm_units,
        )
        model = Sequential(
            [
                LSTM(
                    self.lstm_units,
                    return_sequences=False,
                    input_shape=(self.seq_length, 1),
                ),
                Dense(1),
            ]
        )
        model.compile(optimizer="adam", loss="mse")
        log.info(
            "[LSTMCore] model built — layers=%d  optimizer=adam  loss=mse",
            len(model.layers),
        )
        model.summary(print_fn=lambda s: log.debug("[LSTMCore] model_summary | %s", s))
        return model

    # ------------------------------------------------------------------
    @lifecycle_hook(pre_callback=log_event)
    def train(self, X: np.ndarray, y: np.ndarray, epochs: int = 3) -> None:
        """
        Fit the model on pre-processed training data.

        Parameters
        ----------
        X:
            Feature tensor, shape ``(samples, seq_length, 1)``.
        y:
            Target vector, shape ``(samples,)``.
        epochs:
            Training epochs (default: 3).
        """
        log.info(
            "[LSTMCore] train — X.shape=%s  y.shape=%s  epochs=%d",
            X.shape,
            y.shape,
            epochs,
        )
        history = self._model.fit(X, y, epochs=epochs, verbose=0)
        final_loss = history.history["loss"][-1]
        log.info(
            "[LSTMCore] training complete — final_loss=%.6f  epoch_losses=%s",
            final_loss,
            [f"{v:.6f}" for v in history.history["loss"]],
        )

    # ------------------------------------------------------------------
    def predict_sequence(self, sequence: np.ndarray) -> np.ndarray:
        """
        Predict the next value from *sequence*.

        Parameters
        ----------
        sequence:
            Input array, shape ``(1, seq_length, 1)``.

        Returns
        -------
        np.ndarray
            Raw (scaled) predicted value, shape ``(1, 1)``.
        """
        log.debug(
            "[LSTMCore] predict_sequence — input.shape=%s", sequence.shape
        )
        prediction = self._model.predict(sequence, verbose=0)
        log.info(
            "[LSTMCore] prediction result (scaled) = %.6f", float(prediction[0][0])
        )
        return prediction
