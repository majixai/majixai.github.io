"""
fetch_ml_data.py — LSTM neural signal generator for Pine Script seed data.

Fetches 1-minute OHLCV data for a watchlist, computes technical indicators,
builds an LSTM neural network, runs a windowed forward pass on each ticker,
and emits buy/sell/hold probability scores alongside the classic rule-based
signals.  All results are written to pine_ml_data.csv for TradingView import.

Architecture
------------
Input window  : (1, SEQ_LEN=20, N_FEATURES=6)
                [rsi_norm, macd_norm, bb_pos, volume_ratio, momentum, ann_vol]
LSTM(64)      → Dropout(0.2)
LSTM(32)      → Dropout(0.2)
Dense(16, tanh)
Dense(3, softmax)  →  [P(BUY), P(HOLD), P(SELL)]

The model uses deterministic (seeded) weight initialisation so outputs are
reproducible across runs without training on labelled data.  The neural
probability is then fused with the rule-based signal (RSI + Bollinger) to
produce a final combined_signal column.
"""

from __future__ import annotations

import logging
import sys
from typing import Dict, Optional, Tuple

import numpy as np
import pandas as pd
import yfinance as yf

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
SEQ_LEN     = 20     # look-back window for LSTM sequences
N_FEATURES  = 6      # rsi_norm, macd_norm, bb_pos, vol_ratio, momentum, ann_vol
SEED        = 42
STOCK_SYMBOLS = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']


# ---------------------------------------------------------------------------
# Indicator helpers
# ---------------------------------------------------------------------------

def calculate_rsi(data: pd.DataFrame, period: int = 14) -> pd.Series:
    delta = data['Close'].diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss.replace(0, np.nan)
    return 100 - (100 / (1 + rs))


def calculate_macd(data: pd.DataFrame) -> Tuple[pd.Series, pd.Series]:
    exp1 = data['Close'].ewm(span=12, adjust=False).mean()
    exp2 = data['Close'].ewm(span=26, adjust=False).mean()
    macd = exp1 - exp2
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd, signal


def calculate_bollinger_bands(
    data: pd.DataFrame, window: int = 20
) -> Tuple[pd.Series, pd.Series, pd.Series]:
    mid = data['Close'].rolling(window=window).mean()
    std = data['Close'].rolling(window=window).std()
    return mid + std * 2, mid, mid - std * 2


# ---------------------------------------------------------------------------
# Neural model
# ---------------------------------------------------------------------------

def build_lstm_model(seq_len: int = SEQ_LEN, n_features: int = N_FEATURES):
    """
    Build LSTM(64) → LSTM(32) → Dense(3, softmax) classification model.

    Returns (model, tf) or (None, None) if TensorFlow is unavailable.
    """
    try:
        import tensorflow as tf  # noqa: PLC0415
        tf.random.set_seed(SEED)
        l2 = tf.keras.regularizers.l2(1e-4)
        model = tf.keras.Sequential([
            tf.keras.layers.InputLayer(shape=(seq_len, n_features)),
            tf.keras.layers.LSTM(64, return_sequences=True,
                                 kernel_regularizer=l2, recurrent_regularizer=l2),
            tf.keras.layers.Dropout(0.2, seed=SEED),
            tf.keras.layers.LSTM(32, kernel_regularizer=l2, recurrent_regularizer=l2),
            tf.keras.layers.Dropout(0.2, seed=SEED),
            tf.keras.layers.Dense(16, activation="tanh"),
            tf.keras.layers.Dense(3, activation="softmax"),
        ], name="fetch_ml_lstm")
        log.info("LSTM model built — params=%d", model.count_params())
        return model, tf
    except ImportError:
        log.warning("TensorFlow unavailable — using numpy fallback for neural signals.")
        return None, None


def numpy_neural_fallback(window: np.ndarray) -> np.ndarray:
    """Heuristic neural approximation when TensorFlow is absent."""
    mean_f = window.mean(axis=0)
    # Feature order: rsi_norm(0), macd_norm(1), bb_pos(2), vol_ratio(3), momentum(4), ann_vol(5)
    bull = 0.30 * mean_f[0] + 0.25 * mean_f[1] + 0.20 * mean_f[4] + 0.15 * mean_f[2]
    bear = -bull + 0.05 * mean_f[5]
    hold = 0.30 - 0.50 * abs(bull)
    raw = np.array([bull, hold, bear]) - max(bull, hold, bear)
    exp = np.exp(raw)
    return exp / exp.sum()


# ---------------------------------------------------------------------------
# Feature engineering
# ---------------------------------------------------------------------------

def build_feature_matrix(df: pd.DataFrame) -> Optional[np.ndarray]:
    """
    Build a (N, N_FEATURES) normalised feature matrix from an OHLCV DataFrame.

    Features: [rsi_norm, macd_norm, bb_pos, vol_ratio, momentum, ann_vol]
    """
    if len(df) < 30:
        return None

    rsi = calculate_rsi(df)
    macd, macd_sig = calculate_macd(df)
    bb_upper, bb_mid, bb_lower = calculate_bollinger_bands(df)

    roll_std = df['Close'].rolling(20).std()
    vol_ma   = df['Volume'].rolling(20).mean()
    log_ret  = np.log(df['Close'] / df['Close'].shift(1)).fillna(0)
    ann_vol  = log_ret.rolling(20).std() * np.sqrt(252)
    momentum = (df['Close'] - df['Close'].shift(5)) / df['Close'].shift(5).replace(0, np.nan)
    bb_width = (bb_upper - bb_lower).replace(0, np.nan)

    feat = pd.DataFrame({
        'rsi_norm':   (rsi - 50) / 50,
        'macd_norm':  (macd / (roll_std + 1e-10)).clip(-3, 3),
        'bb_pos':     ((df['Close'] - bb_mid) / (bb_width + 1e-10)).clip(-2, 2),
        'vol_ratio':  (df['Volume'] / (vol_ma + 1e-10) - 1).clip(-2, 2),
        'momentum':   momentum.clip(-0.5, 0.5),
        'ann_vol':    ann_vol.clip(0, 2),
    }).fillna(0)

    return feat.values.astype(np.float32)


# ---------------------------------------------------------------------------
# Per-ticker inference
# ---------------------------------------------------------------------------

def run_neural_inference(
    features: np.ndarray,
    model,
    tf_module,
    seq_len: int = SEQ_LEN,
) -> Dict[str, float]:
    """Run LSTM forward pass on the last *seq_len* rows of *features*."""
    n = len(features)
    if n < seq_len:
        pad = np.zeros((seq_len - n, features.shape[1]), dtype=np.float32)
        features = np.vstack([pad, features])

    last_seq = features[-seq_len:][np.newaxis, ...]  # (1, seq_len, n_features)

    if model is not None and tf_module is not None:
        probs = model(last_seq, training=False).numpy()[0]
    else:
        probs = numpy_neural_fallback(features[-seq_len:])

    labels = ['BUY', 'HOLD', 'SELL']
    signal_idx = int(np.argmax(probs))
    return {
        'neural_signal':   labels[signal_idx],
        'neural_buy_prob': round(float(probs[0]), 4),
        'neural_hold_prob': round(float(probs[1]), 4),
        'neural_sell_prob': round(float(probs[2]), 4),
        'neural_confidence': round(float(np.max(probs)), 4),
    }


# ---------------------------------------------------------------------------
# Data fetch + process
# ---------------------------------------------------------------------------

def fetch_stock_data(stock_symbols):
    data = {}
    for symbol in stock_symbols:
        try:
            df = yf.download(symbol, interval='1m', period='1d', progress=False)
            if not df.empty:
                data[symbol] = df
        except Exception as exc:
            log.warning("Failed to fetch %s: %s", symbol, exc)
    return data


def process_data(stock_symbols, model, tf_module):
    raw_data = fetch_stock_data(stock_symbols)
    all_records = []

    for symbol, df in raw_data.items():
        # Flatten possible MultiIndex columns
        if isinstance(df.columns, pd.MultiIndex):
            df.columns = df.columns.droplevel(1)

        df = df.copy()
        df['RSI']            = calculate_rsi(df)
        df['MACD'], df['Signal'] = calculate_macd(df)
        df['Upper_band'], _, df['Lower_band'] = calculate_bollinger_bands(df)
        df['Volume_ratio']   = df['Volume'] / df['Volume'].rolling(window=14).mean()

        # Rule-based signals
        df['Buy_signal']  = np.where((df['RSI'] < 30) & (df['Close'] < df['Lower_band']), 1, 0)
        df['Sell_signal'] = np.where((df['RSI'] > 70) & (df['Close'] > df['Upper_band']), -1, 0)

        # Neural signals
        neural_info = {'neural_signal': 'HOLD',
                       'neural_buy_prob': 0.33, 'neural_hold_prob': 0.34,
                       'neural_sell_prob': 0.33, 'neural_confidence': 0.34}
        features = build_feature_matrix(df)
        if features is not None:
            neural_info = run_neural_inference(features, model, tf_module)

        for col, val in neural_info.items():
            df[col] = val

        # Combined signal: agree between rule-based + neural
        def _combined(row):
            if row['Buy_signal'] == 1 and row['neural_signal'] == 'BUY':
                return 1
            if row['Sell_signal'] == -1 and row['neural_signal'] == 'SELL':
                return -1
            return 0

        df['combined_signal'] = df.apply(_combined, axis=1)
        df['Ticker'] = symbol
        all_records.append(df)

    if not all_records:
        log.warning("No data fetched — returning empty DataFrame.")
        return pd.DataFrame()

    return pd.concat(all_records, axis=0).fillna(0)


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    model, tf_module = build_lstm_model()
    final_data = process_data(STOCK_SYMBOLS, model, tf_module)
    if not final_data.empty:
        out = 'pine_ml_data.csv'
        final_data.to_csv(out, index=False)
        log.info("Saved %d rows → %s", len(final_data), out)
    else:
        log.error("No data to save.")
        sys.exit(1)

