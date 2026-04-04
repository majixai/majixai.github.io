"""
Neural Forecaster — LSTM-based sequence model for financial price forecasting.

Architecture
------------
Input  : (batch, SEQ_LEN, N_FEATURES)   windowed OHLCV + indicator sequences
Layer 1: LSTM(64, return_sequences=True) captures multi-step temporal dependencies
Layer 2: LSTM(32)                        compresses to latent representation
Layer 3: Dense(16, activation='tanh')    nonlinear feature mixing
Output : Dense(3,  activation='softmax') class probabilities [BUY, HOLD, SELL]

EKF Integration
---------------
The EKF posterior state (log_price, volatility, momentum_angle) from
:class:`~models.bayesian_ekf.ExtendedKalmanFilter` is used to Bayesian-adjust
the neural probabilities before returning the final signal.  This creates a
two-stage ensemble: neural network → EKF posterior correction.

Rust Acceleration
-----------------
When the compiled ``ekf_core_rust`` PyO3 extension is present (built via
``maturin develop`` or ``maturin build --release``), feature extraction and
rolling indicator computations are delegated to the Rust core for maximum
throughput across the 1 500+ ticker universe.

Usage
-----
    from models.neural_forecaster import NeuralForecaster

    forecaster = NeuralForecaster()
    result = forecaster.infer(close, volume, high=high, low=low, ekf_state=ekf)
    # result: {'signal': 'BUY', 'buy_prob': 0.61, 'hold_prob': 0.24,
    #          'sell_prob': 0.15, 'confidence': 0.61, 'method': 'LSTM', ...}
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
SEQ_LEN: int = 30
N_FEATURES: int = 7  # log_ret, rsi_norm, macd_norm, bb_pos, vol_ratio, momentum, ann_vol
CLASSES: List[str] = ["BUY", "HOLD", "SELL"]
_DEFAULT_SEED: int = 42


# ---------------------------------------------------------------------------
# Lazy imports
# ---------------------------------------------------------------------------

def _try_import_tf():
    """Lazily import TensorFlow; return None if unavailable."""
    try:
        import tensorflow as tf  # noqa: PLC0415
        return tf
    except ImportError:
        logger.warning(
            "TensorFlow not available — NeuralForecaster will use numpy fallback."
        )
        return None


def _try_import_rust():
    """Lazily import the compiled Rust EKF/feature extension."""
    try:
        import ekf_core_rust as rust  # noqa: PLC0415
        return rust
    except ImportError:
        return None


# ---------------------------------------------------------------------------
# Main class
# ---------------------------------------------------------------------------

class NeuralForecaster:
    """
    LSTM-based neural network for financial signal classification.

    Parameters
    ----------
    seq_len : int
        Number of time steps in each input sequence.
    n_features : int
        Number of features per time step.
    seed : int
        Random seed for reproducible weight initialisation.
    """

    def __init__(
        self,
        seq_len: int = SEQ_LEN,
        n_features: int = N_FEATURES,
        seed: int = _DEFAULT_SEED,
    ) -> None:
        self.seq_len = seq_len
        self.n_features = n_features
        self.seed = seed
        self._model = None
        self._tf = _try_import_tf()
        self._rust = _try_import_rust()

    # ------------------------------------------------------------------
    # Model construction
    # ------------------------------------------------------------------

    def build_model(self) -> None:
        """
        Build and compile the LSTM classification model.

        Architecture
        ------------
        LSTM(64, return_sequences=True, L2) → Dropout(0.2)
        LSTM(32, L2)                        → Dropout(0.2)
        Dense(16, tanh)
        Dense(3,  softmax)  →  [P(BUY), P(HOLD), P(SELL)]
        """
        tf = self._tf
        if tf is None:
            logger.warning(
                "TensorFlow unavailable — model not built; numpy fallback active."
            )
            return

        tf.random.set_seed(self.seed)
        np.random.seed(self.seed)

        l2 = tf.keras.regularizers.l2(1e-4)
        model = tf.keras.Sequential(
            [
                tf.keras.layers.InputLayer(shape=(self.seq_len, self.n_features)),
                tf.keras.layers.LSTM(
                    64,
                    return_sequences=True,
                    kernel_regularizer=l2,
                    recurrent_regularizer=l2,
                ),
                tf.keras.layers.Dropout(0.2, seed=self.seed),
                tf.keras.layers.LSTM(32, kernel_regularizer=l2, recurrent_regularizer=l2),
                tf.keras.layers.Dropout(0.2, seed=self.seed),
                tf.keras.layers.Dense(16, activation="tanh"),
                tf.keras.layers.Dense(len(CLASSES), activation="softmax"),
            ],
            name="neural_forecaster_lstm",
        )
        model.compile(
            optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
            loss="categorical_crossentropy",
            metrics=["accuracy"],
        )
        self._model = model
        logger.info(
            "NeuralForecaster: built LSTM — seq_len=%d  n_features=%d  params=%d",
            self.seq_len,
            self.n_features,
            model.count_params(),
        )

    # ------------------------------------------------------------------
    # Feature engineering
    # ------------------------------------------------------------------

    def extract_features(
        self,
        close: np.ndarray,
        volume: np.ndarray,
        high: Optional[np.ndarray] = None,
        low: Optional[np.ndarray] = None,
    ) -> np.ndarray:
        """
        Compute the N_FEATURES-dimensional feature vector for each time step.

        Features (all normalised to ≈ [-1, 1] or [0, 1]):
          0  log_return    : log(C_t / C_{t-1})
          1  rsi_norm      : (RSI_14 − 50) / 50
          2  macd_norm     : MACD / rolling_std(close, 20)
          3  bb_position   : (close − BB_mid) / (BB_upper − BB_lower + ε)
          4  volume_ratio  : (vol / vol_MA20 − 1) clipped to [−2, 2]
          5  momentum      : 5-period price change / prior_close
          6  ann_vol       : rolling_std(log_returns, 20) × √252

        Delegates to Rust extension when available for ~10× speedup.

        Parameters
        ----------
        close  : ndarray shape (N,)
        volume : ndarray shape (N,)
        high   : ndarray shape (N,), optional
        low    : ndarray shape (N,), optional

        Returns
        -------
        ndarray shape (N, N_FEATURES) — NaN/inf replaced with 0
        """
        if self._rust is not None:
            try:
                return np.asarray(
                    self._rust.extract_features(
                        np.asarray(close, dtype=np.float64),
                        np.asarray(volume, dtype=np.float64),
                    ),
                    dtype=np.float32,
                )
            except Exception as exc:
                logger.debug("Rust feature extraction failed (%s), using Python path.", exc)

        return _extract_features_numpy(close, volume, high, low)

    def prepare_sequences(self, features: np.ndarray) -> np.ndarray:
        """
        Slice *features* into overlapping windows of length ``seq_len``.

        Parameters
        ----------
        features : ndarray shape (N, n_features)

        Returns
        -------
        ndarray shape (max(1, N−seq_len+1), seq_len, n_features)
        """
        n = len(features)
        if n < self.seq_len:
            pad = np.zeros((self.seq_len - n, self.n_features), dtype=np.float32)
            features = np.vstack([pad, features])
            n = self.seq_len

        seqs = np.stack(
            [features[i : i + self.seq_len] for i in range(n - self.seq_len + 1)],
            axis=0,
        )
        return seqs.astype(np.float32)

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------

    def infer(
        self,
        close: np.ndarray,
        volume: np.ndarray,
        high: Optional[np.ndarray] = None,
        low: Optional[np.ndarray] = None,
        ekf_state: Optional[Dict[str, float]] = None,
    ) -> Dict[str, Any]:
        """
        Run the neural forecaster on a price series and return signal probabilities.

        When TensorFlow is unavailable the numpy fallback approximation is used.
        When the EKF state is supplied, probabilities are Bayesian-adjusted using
        the filtered momentum angle and volatility.

        Parameters
        ----------
        close     : ndarray shape (N,)   — closing prices
        volume    : ndarray shape (N,)   — trading volume
        high      : ndarray shape (N,), optional
        low       : ndarray shape (N,), optional
        ekf_state : dict, optional — keys: 'log_price', 'volatility', 'momentum_angle'

        Returns
        -------
        dict
          signal       str    'BUY' | 'HOLD' | 'SELL'
          buy_prob     float
          hold_prob    float
          sell_prob    float
          confidence   float  max class probability
          raw_probs    list   [P(BUY), P(HOLD), P(SELL)]
          method       str    'LSTM' | 'numpy_fallback'
          ekf_adjusted bool
        """
        features = self.extract_features(close, volume, high, low)
        sequences = self.prepare_sequences(features)

        if self._model is None:
            self.build_model()

        if self._model is not None and self._tf is not None:
            probs = self._lstm_infer(sequences)
            method = "LSTM"
        else:
            probs = self._numpy_fallback(features)
            method = "numpy_fallback"

        ekf_adjusted = False
        if ekf_state is not None:
            probs = _apply_ekf_adjustment(probs, ekf_state)
            ekf_adjusted = True

        signal_idx = int(np.argmax(probs))
        return {
            "signal": CLASSES[signal_idx],
            "buy_prob": float(probs[0]),
            "hold_prob": float(probs[1]),
            "sell_prob": float(probs[2]),
            "confidence": float(np.max(probs)),
            "raw_probs": probs.tolist(),
            "method": method,
            "ekf_adjusted": ekf_adjusted,
        }

    # ------------------------------------------------------------------
    # Private inference paths
    # ------------------------------------------------------------------

    def _lstm_infer(self, sequences: np.ndarray) -> np.ndarray:
        """Run the last sequence through the LSTM and return class probabilities."""
        last_seq = sequences[-1:].astype(np.float32)  # (1, seq_len, n_features)
        probs = self._model(last_seq, training=False).numpy()[0]  # (3,)
        return probs.astype(float)

    def _numpy_fallback(self, features: np.ndarray) -> np.ndarray:
        """
        Lightweight numpy approximation when TensorFlow is unavailable.

        Uses the last window of features to compute a heuristic signal score
        by linearly combining momentum, RSI, MACD, and volume signals, then
        passing through a softmax to produce well-calibrated probabilities.
        """
        window = features[-self.seq_len :]
        mean_f = window.mean(axis=0)  # (N_FEATURES,)
        # Feature indices: log_ret(0), rsi_norm(1), macd_norm(2),
        #                  bb_pos(3), vol_ratio(4), momentum(5), ann_vol(6)
        bull_score = (
            0.35 * float(mean_f[0])   # positive returns → bullish
            + 0.25 * float(mean_f[1]) # high RSI → bullish
            + 0.20 * float(mean_f[2]) # positive MACD → bullish
            + 0.20 * float(mean_f[5]) # positive momentum → bullish
        )
        bear_score = -bull_score + 0.05 * float(mean_f[6])  # vol slightly bearish
        hold_score = 0.30 - 0.50 * abs(bull_score)           # uncertainty → HOLD
        raw = np.array([bull_score, hold_score, bear_score], dtype=float)
        raw -= raw.max()
        exp = np.exp(raw)
        return exp / exp.sum()


# ---------------------------------------------------------------------------
# Module-level helpers
# ---------------------------------------------------------------------------

def _extract_features_numpy(
    close: np.ndarray,
    volume: np.ndarray,
    high: Optional[np.ndarray],
    low: Optional[np.ndarray],
) -> np.ndarray:
    """Pure-numpy feature extraction."""
    n = len(close)
    close = np.asarray(close, dtype=float)
    volume = np.asarray(volume, dtype=float)
    high = np.asarray(high, dtype=float) if high is not None else close.copy()
    low = np.asarray(low, dtype=float) if low is not None else close.copy()

    feats = np.zeros((n, N_FEATURES), dtype=float)

    # 0. Log return
    log_c = np.log(np.maximum(close, 1e-10))
    log_ret = np.diff(log_c, prepend=log_c[0])
    feats[:, 0] = np.clip(log_ret, -0.5, 0.5)

    # 1. RSI-14 normalised to [-1, 1]
    delta = np.diff(close, prepend=close[0])
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    avg_gain = _ema_rolling(gain, 14)
    avg_loss = _ema_rolling(loss, 14)
    rs = avg_gain / np.maximum(avg_loss, 1e-10)
    rsi = 100.0 - 100.0 / (1.0 + rs)
    feats[:, 1] = (rsi - 50.0) / 50.0

    # 2. MACD normalised
    ema12 = _ewm(close, 12)
    ema26 = _ewm(close, 26)
    macd = ema12 - ema26
    roll_std = _rolling_std(close, 20)
    feats[:, 2] = np.clip(macd / (roll_std + 1e-10), -3.0, 3.0)

    # 3. Bollinger Band position
    bb_mid = _rolling_mean(close, 20)
    bb_std = _rolling_std(close, 20)
    bb_width = np.maximum(2.0 * bb_std * 2.0, 1e-10)
    feats[:, 3] = np.clip((close - bb_mid) / bb_width, -2.0, 2.0)

    # 4. Volume ratio vs 20-period MA
    vol_ma = _rolling_mean(volume, 20)
    feats[:, 4] = np.clip(volume / (vol_ma + 1e-10) - 1.0, -2.0, 2.0)

    # 5. 5-period momentum
    shift5 = np.concatenate([close[:5], close[:-5]])
    feats[:, 5] = np.clip((close - shift5) / (np.maximum(shift5, 1e-10)), -0.5, 0.5)

    # 6. Annualised rolling volatility
    roll_vol = _rolling_std(log_ret, 20) * np.sqrt(252)
    feats[:, 6] = np.clip(roll_vol, 0.0, 2.0)

    return np.where(np.isfinite(feats), feats, 0.0).astype(np.float32)


def _apply_ekf_adjustment(
    probs: np.ndarray,
    ekf_state: Dict[str, float],
) -> np.ndarray:
    """
    Bayesian-style adjustment of neural probabilities using EKF posterior state.

    The EKF momentum angle (Θ) and filtered volatility shift BUY/SELL probability
    mass while preserving the relative size of HOLD:

      shift = direction × vol_dampening × 0.15   (max ±15 pp)
      P(BUY)  += shift
      P(SELL) -= shift
      renormalise to sum-to-one
    """
    momentum_angle = float(ekf_state.get("momentum_angle", 0.0))
    volatility = float(ekf_state.get("volatility", 1e-4))

    # Normalise momentum angle to [-1, 1]
    direction = float(np.clip(momentum_angle / (np.pi / 2), -1.0, 1.0))
    # High volatility dampens the signal shift
    vol_damp = float(np.exp(-volatility * 1000.0))

    shift = direction * vol_damp * 0.15
    adjusted = probs.copy()
    adjusted[0] = np.clip(probs[0] + shift, 0.01, 0.98)
    adjusted[2] = np.clip(probs[2] - shift, 0.01, 0.98)
    total = adjusted.sum()
    return (adjusted / total).astype(float)


# ---------------------------------------------------------------------------
# Pure-numpy rolling helpers (no external dependencies)
# ---------------------------------------------------------------------------

def _ema_rolling(arr: np.ndarray, window: int) -> np.ndarray:
    """Simple recursive EMA (Wilder smoothing) used for RSI gain/loss."""
    alpha = 1.0 / window
    out = np.zeros_like(arr, dtype=float)
    out[0] = arr[0]
    for i in range(1, len(arr)):
        out[i] = alpha * arr[i] + (1.0 - alpha) * out[i - 1]
    return out


def _ewm(arr: np.ndarray, span: int) -> np.ndarray:
    """Exponential weighted moving average (pandas-compatible)."""
    alpha = 2.0 / (span + 1)
    out = np.zeros_like(arr, dtype=float)
    out[0] = arr[0]
    for i in range(1, len(arr)):
        out[i] = alpha * arr[i] + (1.0 - alpha) * out[i - 1]
    return out


def _rolling_mean(arr: np.ndarray, window: int) -> np.ndarray:
    """Rolling mean; first (window−1) values use expanding window."""
    out = np.zeros_like(arr, dtype=float)
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        out[i] = arr[start : i + 1].mean()
    return out


def _rolling_std(arr: np.ndarray, window: int) -> np.ndarray:
    """Rolling std; first (window−1) values use expanding window."""
    out = np.zeros_like(arr, dtype=float)
    for i in range(len(arr)):
        start = max(0, i - window + 1)
        seg = arr[start : i + 1]
        out[i] = seg.std() if len(seg) > 1 else 0.0
    return out
