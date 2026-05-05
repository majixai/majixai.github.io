#!/usr/bin/env python3
"""
DJI OHLC TensorFlow Engine
===========================
Uses a TensorFlow LSTM model to compute Open, High, Low, and Close
predictions for the Dow Jones Industrial Average (^DJI) at nine
scheduled times throughout the day:

  Run mode       Local ET      UTC (EDT/UTC-4)   Purpose
  ─────────────  ──────────    ───────────────   ──────────────────────────
  midnight       12:00 AM      04:00             Overnight baseline OHLC
  1am            01:00 AM      05:00             Early pre-market OHLC
  6am            06:00 AM      10:00             Pre-market OHLC
  6_15am         06:15 AM      10:15             Pre-market OHLC update
  6_30am         06:30 AM      10:30             Futures-open OHLC
  9am            09:00 AM      13:00             Pre-open OHLC (T-30 min)
  noon           12:00 PM      16:00             Intraday midday OHLC
  1pm_report     01:00 PM      17:00             Daily report + feedback
  10pm_proj      10:00 PM      02:00 (next day)  Next-day projection

The run mode is resolved automatically from the current UTC time or can
be forced via the RUN_MODE environment variable.

Outputs
-------
output/dji_ohlc_results.json  — per-run OHLC prediction record
output/dji_ohlc_feedback.json — accumulated feedback (prediction vs actual)
"""

from __future__ import annotations

import json
import math
import os
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

# ---------------------------------------------------------------------------
# TensorFlow — imported after potential TF_CPP_MIN_LOG_LEVEL suppression
# ---------------------------------------------------------------------------
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "2")
os.environ.setdefault("TF_ENABLE_ONEDNN_OPTS", "0")

import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, callbacks

# ---------------------------------------------------------------------------
# Optional: yfinance for live data
# ---------------------------------------------------------------------------
try:
    import yfinance as yf
    HAS_YFINANCE = True
except ImportError:
    HAS_YFINANCE = False

# ============================================================================
# CONSTANTS
# ============================================================================
DJI_TICKER  = "^DJI"
LOOKBACK    = 60        # sequence length fed into LSTM
HORIZON     = 1         # bars ahead to predict (next bar = next trading day)
LSTM_UNITS  = 64
EPOCHS      = int(os.environ.get("TF_EPOCHS", "30"))  # override via TF_EPOCHS env var
BATCH_SIZE  = 16
SEED        = 42

OUTPUT_DIR   = Path(__file__).parent / "output"
RESULTS_FILE = OUTPUT_DIR / "dji_ohlc_results.json"
FEEDBACK_FILE = OUTPUT_DIR / "dji_ohlc_feedback.json"

# UTC (hour, minute) anchor for each scheduled run (EDT = UTC-4)
# A ±7-min tolerance window is used when auto-detecting the run mode.
MODE_SCHEDULE: Dict[str, Tuple[int, int]] = {
    "midnight"   : (4,  0),
    "1am"        : (5,  0),
    "6am"        : (10, 0),
    "6_15am"     : (10, 15),
    "6_30am"     : (10, 30),
    "9am"        : (13, 0),
    "noon"       : (16, 0),
    "1pm_report" : (17, 0),
    "10pm_proj"  : (2,  0),
}

MODE_LABELS: Dict[str, str] = {
    "midnight"   : "Overnight Baseline OHLC",
    "1am"        : "Early Pre-Market OHLC",
    "6am"        : "Pre-Market OHLC",
    "6_15am"     : "Pre-Market OHLC Update",
    "6_30am"     : "Futures Open OHLC",
    "9am"        : "Pre-Open OHLC (T-30)",
    "noon"       : "Intraday Midday OHLC",
    "1pm_report" : "Daily Report + Feedback Mechanism",
    "10pm_proj"  : "Next-Day Projection",
}

# ============================================================================
# UTILITY HELPERS
# ============================================================================

def _seed_everything(seed: int = SEED) -> None:
    np.random.seed(seed)
    tf.random.set_seed(seed)


def _resolve_run_mode() -> str:
    """
    Return the run mode string.  Priority:
    1. RUN_MODE environment variable (explicit override)
    2. Auto-detect from current UTC clock with ±7-minute tolerance
    3. Fall back to 'midnight' if nothing matches
    """
    env_mode = os.environ.get("RUN_MODE", "").strip().lower()
    if env_mode in MODE_SCHEDULE:
        print(f"[INFO] RUN_MODE forced by environment: {env_mode}")
        return env_mode

    now_utc = datetime.now(timezone.utc)
    now_mins = now_utc.hour * 60 + now_utc.minute
    tolerance = 7  # minutes

    best_mode = "midnight"
    best_delta = math.inf
    for mode, (h, m) in MODE_SCHEDULE.items():
        scheduled_mins = h * 60 + m
        # Circular delta (handles day-boundary wrap)
        delta = abs(now_mins - scheduled_mins)
        delta = min(delta, 1440 - delta)
        if delta < best_delta:
            best_delta = delta
            best_mode = mode

    if best_delta <= tolerance:
        print(f"[INFO] Auto-detected run mode: {best_mode} (Δ={best_delta} min)")
        return best_mode

    print(f"[WARN] No exact schedule match (closest: {best_mode}, Δ={best_delta} min). "
          f"Using '{best_mode}'.")
    return best_mode


# ============================================================================
# DATA LAYER
# ============================================================================

def _fetch_dji(period: str = "5y", interval: str = "1d") -> pd.DataFrame:
    """
    Fetch DJI OHLCV data via yfinance.  Falls back to synthetic data if
    yfinance is unavailable (CI without network access).
    """
    if HAS_YFINANCE:
        try:
            ticker = yf.Ticker(DJI_TICKER)
            df = ticker.history(period=period, interval=interval, auto_adjust=True)
            if df.empty:
                raise ValueError("yfinance returned empty data")
            df.index = pd.to_datetime(df.index, utc=True)
            # Standardise column names
            df = df.rename(columns=str.lower)[["open", "high", "low", "close"]]
            print(f"[INFO] Fetched {len(df)} bars from yfinance ({period}/{interval})")
            return df.dropna()
        except Exception as exc:
            print(f"[WARN] yfinance error: {exc}. Using synthetic data.")

    return _synthetic_dji_data()


def _synthetic_dji_data(n_bars: int = 1260) -> pd.DataFrame:
    """
    Generate synthetic DJI-like OHLCV data when live data is unavailable.
    Uses a GBM simulation anchored near 42 000.
    """
    rng = np.random.default_rng(SEED)
    S0, mu, sigma = 42_000.0, 0.07 / 252, 0.15 / math.sqrt(252)
    returns = rng.normal(mu, sigma, n_bars)
    prices  = S0 * np.exp(np.cumsum(returns))

    noise = lambda scale: rng.normal(0, scale, n_bars)
    opens  = prices * (1 + noise(0.002))
    highs  = np.maximum(opens, prices) * (1 + np.abs(noise(0.003)))
    lows   = np.minimum(opens, prices) * (1 - np.abs(noise(0.003)))
    closes = prices

    dates = pd.date_range(
        end=datetime.now(timezone.utc).date(),
        periods=n_bars,
        freq="B",
        tz="UTC",
    )
    return pd.DataFrame(
        {"open": opens, "high": highs, "low": lows, "close": closes},
        index=dates,
    )


# ============================================================================
# FEATURE ENGINEERING
# ============================================================================

_EPS = 1e-9  # epsilon shared by all forward-scale and inverse-transform paths


def _minmax_scale(arr: np.ndarray) -> Tuple[np.ndarray, float, float]:
    """Scale array to [0, 1]; return (scaled, min, max)."""
    lo, hi = arr.min(), arr.max()
    return (arr - lo) / (hi - lo + _EPS), lo, hi


def _build_sequences(
    df: pd.DataFrame,
    lookback: int = LOOKBACK,
) -> Tuple[np.ndarray, np.ndarray, Dict]:
    """
    Build (X, y) sequence pairs from the OHLC dataframe.

    Each input sequence X[i] has shape (lookback, 4):
        columns = [open_scaled, high_scaled, low_scaled, close_scaled]

    Each target y[i] has shape (4,):
        next-bar [open, high, low, close] — **unscaled**, used only for
        inverse-transform after prediction.

    Returns
    -------
    X       : float32 array, shape (N, lookback, 4)
    y       : float32 array, shape (N, 4)            — **scaled**
    scales  : dict with 'min' and 'max' per column for inverse-transform
    """
    ohlc = df[["open", "high", "low", "close"]].values.astype(np.float64)
    scales = {}
    ohlc_scaled = np.zeros_like(ohlc)
    for col_idx, col_name in enumerate(["open", "high", "low", "close"]):
        scaled, lo, hi = _minmax_scale(ohlc[:, col_idx])
        ohlc_scaled[:, col_idx] = scaled
        scales[col_name] = {"min": float(lo), "max": float(hi)}

    X, y = [], []
    for i in range(lookback, len(ohlc_scaled)):
        X.append(ohlc_scaled[i - lookback : i])
        y.append(ohlc_scaled[i])

    return (
        np.array(X, dtype=np.float32),
        np.array(y, dtype=np.float32),
        scales,
    )



def _inverse_transform(scaled: np.ndarray, scales: Dict) -> Dict[str, float]:
    """Convert scaled predictions back to price space using the same epsilon as forward scaling."""
    cols = ["open", "high", "low", "close"]
    result = {}
    for idx, col in enumerate(cols):
        lo = scales[col]["min"]
        hi = scales[col]["max"]
        result[col] = float(scaled[idx] * (hi - lo + _EPS) + lo)
    return result


# ============================================================================
# TENSORFLOW MODEL
# ============================================================================

def _build_model(lookback: int = LOOKBACK, n_features: int = 4) -> keras.Model:
    """
    LSTM encoder → dense decoder predicting next-bar OHLC (4 outputs).

    Architecture
    ────────────
    Input  (lookback, 4)
    LSTM   64 units  → return_sequences=True  (capture temporal dynamics)
    LSTM   32 units  → return_sequences=False (compress to context vector)
    Dense  32, ReLU
    Dense   4, sigmoid  (output in [0,1] — inverse-transform to prices later)
    """
    inp = keras.Input(shape=(lookback, n_features), name="ohlc_seq")
    x   = layers.LSTM(LSTM_UNITS, return_sequences=True, name="lstm_1")(inp)
    x   = layers.Dropout(0.2, name="drop_1")(x)
    x   = layers.LSTM(LSTM_UNITS // 2, return_sequences=False, name="lstm_2")(x)
    x   = layers.Dropout(0.2, name="drop_2")(x)
    x   = layers.Dense(32, activation="relu", name="dense_1")(x)
    out = layers.Dense(4, activation="sigmoid", name="ohlc_out")(x)

    model = keras.Model(inputs=inp, outputs=out, name="dji_ohlc_lstm")
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss="mse",
        metrics=["mae"],
    )
    return model


def _train_model(
    X_train: np.ndarray,
    y_train: np.ndarray,
    epochs: int = EPOCHS,
    batch_size: int = BATCH_SIZE,
    validation_split: float = 0.1,
) -> Tuple[keras.Model, Dict]:
    """Train the LSTM model and return (model, history_dict)."""
    model = _build_model(lookback=X_train.shape[1])

    early_stop = callbacks.EarlyStopping(
        monitor="val_loss", patience=5, restore_best_weights=True
    )
    reduce_lr = callbacks.ReduceLROnPlateau(
        monitor="val_loss", factor=0.5, patience=3, min_lr=1e-5
    )

    history = model.fit(
        X_train, y_train,
        epochs=epochs,
        batch_size=batch_size,
        validation_split=validation_split,
        callbacks=[early_stop, reduce_lr],
        verbose=0,
    )

    print(
        f"[INFO] Training complete — "
        f"best val_loss={min(history.history['val_loss']):.6f} "
        f"after {len(history.history['loss'])} epochs"
    )
    return model, {
        "loss":     [float(v) for v in history.history["loss"]],
        "val_loss": [float(v) for v in history.history["val_loss"]],
        "mae":      [float(v) for v in history.history["mae"]],
    }


def _predict_ohlc(
    model: keras.Model,
    df: pd.DataFrame,
    scales: Dict,
    horizon: int = HORIZON,
) -> List[Dict[str, float]]:
    """
    Predict *horizon* bars ahead using the last LOOKBACK bars of *df*.
    Returns a list of dicts [{"open": …, "high": …, "low": …, "close": …}].
    """
    ohlc = df[["open", "high", "low", "close"]].values.astype(np.float64)
    # Scale each column with the training scales
    ohlc_scaled = np.zeros_like(ohlc)
    for col_idx, col_name in enumerate(["open", "high", "low", "close"]):
        lo = scales[col_name]["min"]
        hi = scales[col_name]["max"]
        ohlc_scaled[:, col_idx] = (ohlc[:, col_idx] - lo) / (hi - lo + _EPS)

    sequence = ohlc_scaled[-LOOKBACK:].copy()
    predictions = []

    for _ in range(horizon):
        X = sequence[np.newaxis, :, :].astype(np.float32)   # (1, lookback, 4)
        pred_scaled = model.predict(X, verbose=0)[0]        # (4,)
        pred_price  = _inverse_transform(pred_scaled, scales)
        predictions.append(pred_price)
        # Auto-regressive: append prediction as next bar
        new_row = pred_scaled.reshape(1, 4)
        sequence = np.vstack([sequence[1:], new_row])

    return predictions


# ============================================================================
# CONFIDENCE / ENSEMBLE UTILITIES
# ============================================================================

def _monte_carlo_ohlc(
    model: keras.Model,
    df: pd.DataFrame,
    scales: Dict,
    n_samples: int = 100,
    dropout_inference: bool = True,
) -> Dict[str, Dict]:
    """
    Monte Carlo Dropout inference for uncertainty quantification.
    Runs *n_samples* stochastic forward passes and returns mean ± std
    per OHLC component.
    """
    ohlc = df[["open", "high", "low", "close"]].values.astype(np.float64)
    ohlc_scaled = np.zeros_like(ohlc)
    for col_idx, col_name in enumerate(["open", "high", "low", "close"]):
        lo = scales[col_name]["min"]
        hi = scales[col_name]["max"]
        ohlc_scaled[:, col_idx] = (ohlc[:, col_idx] - lo) / (hi - lo + _EPS)

    X = ohlc_scaled[-LOOKBACK:][np.newaxis, :, :].astype(np.float32)

    preds_scaled = np.stack(
        [model(X, training=dropout_inference).numpy()[0] for _ in range(n_samples)]
    )  # (n_samples, 4)

    result = {}
    for col_idx, col_name in enumerate(["open", "high", "low", "close"]):
        lo = scales[col_name]["min"]
        hi = scales[col_name]["max"]
        vals = preds_scaled[:, col_idx] * (hi - lo + _EPS) + lo
        result[col_name] = {
            "mean": float(vals.mean()),
            "std":  float(vals.std()),
            "p10":  float(np.percentile(vals, 10)),
            "p25":  float(np.percentile(vals, 25)),
            "p75":  float(np.percentile(vals, 75)),
            "p90":  float(np.percentile(vals, 90)),
        }
    return result


# ============================================================================
# FEEDBACK MECHANISM
# ============================================================================

def _load_feedback() -> List[Dict]:
    if FEEDBACK_FILE.exists():
        with open(FEEDBACK_FILE) as fh:
            return json.load(fh)
    return []


def _save_feedback(records: List[Dict]) -> None:
    with open(FEEDBACK_FILE, "w") as fh:
        json.dump(records, fh, indent=2, default=str)


def _compute_feedback_metrics(feedback: List[Dict]) -> Dict:
    """
    Aggregate Mean Absolute Percentage Error (MAPE) per OHLC component
    from all feedback records that contain both prediction and actual values.
    """
    cols = ["open", "high", "low", "close"]
    errs: Dict[str, List[float]] = {c: [] for c in cols}

    for rec in feedback:
        pred   = rec.get("prediction", {})
        actual = rec.get("actual", {})
        if not pred or not actual:
            continue
        for col in cols:
            p = pred.get(col)
            a = actual.get(col)
            if p and a and a != 0:
                errs[col].append(abs(p - a) / abs(a) * 100)

    metrics = {}
    for col in cols:
        if errs[col]:
            metrics[col] = {
                "mape": float(np.mean(errs[col])),
                "n":    len(errs[col]),
            }
    return metrics


def _run_feedback_mode(
    model: keras.Model,
    df: pd.DataFrame,
    scales: Dict,
    run_ts: str,
) -> Dict:
    """
    1pm_report mode: store yesterday's prediction vs today's actual OHLC
    and compute running accuracy metrics.
    """
    feedback = _load_feedback()

    # Actual today's OHLC (latest bar)
    latest = df.iloc[-1]
    actual_ohlc = {
        "open":  float(latest["open"]),
        "high":  float(latest["high"]),
        "low":   float(latest["low"]),
        "close": float(latest["close"]),
    }

    # See if the last feedback record is a pending prediction for today
    if feedback and feedback[-1].get("actual") is None:
        feedback[-1]["actual"]    = actual_ohlc
        feedback[-1]["actual_ts"] = run_ts
        print("[INFO] Filled in actual OHLC for the pending feedback record.")

    # Now generate a fresh prediction to add a pending record for tomorrow
    predictions = _predict_ohlc(model, df, scales, horizon=1)
    mc = _monte_carlo_ohlc(model, df, scales, n_samples=50)
    pred_ohlc = predictions[0]

    feedback.append({
        "date":       run_ts,
        "mode":       "1pm_report",
        "prediction": pred_ohlc,
        "mc":         mc,
        "actual":     None,
    })
    _save_feedback(feedback)

    metrics = _compute_feedback_metrics(feedback)
    print(
        "[FEEDBACK] MAPE per component:",
        {k: f"{v['mape']:.2f}% (n={v['n']})" for k, v in metrics.items()},
    )

    return {
        "actual":            actual_ohlc,
        "next_day_forecast": pred_ohlc,
        "mc_uncertainty":    mc,
        "accuracy_metrics":  metrics,
        "feedback_records":  len(feedback),
    }


# ============================================================================
# RESULTS I/O
# ============================================================================

def _load_results() -> List[Dict]:
    if RESULTS_FILE.exists():
        with open(RESULTS_FILE) as fh:
            return json.load(fh)
    return []


def _save_results(records: List[Dict]) -> None:
    with open(RESULTS_FILE, "w") as fh:
        json.dump(records, fh, indent=2, default=str)


# ============================================================================
# MAIN ENTRY POINT
# ============================================================================

def run() -> None:
    _seed_everything()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    run_ts   = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    run_mode = _resolve_run_mode()
    label    = MODE_LABELS[run_mode]

    print(f"[INFO] === DJI OHLC TensorFlow Engine ===")
    print(f"[INFO] Run mode : {run_mode}  ({label})")
    print(f"[INFO] Timestamp: {run_ts}")
    print(f"[INFO] TF version: {tf.__version__}")

    # ------------------------------------------------------------------
    # 1.  Fetch data
    # ------------------------------------------------------------------
    df = _fetch_dji(period="5y", interval="1d")
    print(f"[INFO] Data range: {df.index[0]} → {df.index[-1]}  ({len(df)} bars)")

    # ------------------------------------------------------------------
    # 2.  Build sequences & train
    # ------------------------------------------------------------------
    print("[INFO] Building training sequences …")
    X, y, scales = _build_sequences(df, lookback=LOOKBACK)
    print(f"[INFO] Sequence shape: X={X.shape}, y={y.shape}")

    # Train/test split (last 20% = test, not used to train)
    split    = int(len(X) * 0.8)
    X_train  = X[:split]
    y_train  = y[:split]

    print(f"[INFO] Training LSTM ({EPOCHS} epochs max, early-stopping active) …")
    model, history = _train_model(X_train, y_train)

    # ------------------------------------------------------------------
    # 3.  Per-mode inference
    # ------------------------------------------------------------------
    extra: Dict = {}

    if run_mode == "1pm_report":
        extra = _run_feedback_mode(model, df, scales, run_ts)
        predictions = [extra["next_day_forecast"]]
        mc = extra.pop("mc_uncertainty")
    else:
        # Determine horizon: 10pm_proj looks further ahead (3 bars)
        horizon = 3 if run_mode == "10pm_proj" else 1
        predictions = _predict_ohlc(model, df, scales, horizon=horizon)
        mc = _monte_carlo_ohlc(model, df, scales, n_samples=100)

    # ------------------------------------------------------------------
    # 4.  Print & persist results
    # ------------------------------------------------------------------
    print(f"\n{'='*60}")
    print(f"  DJI OHLC PREDICTION  [{label}]")
    print(f"  {run_ts}")
    print(f"{'='*60}")
    for i, pred in enumerate(predictions, 1):
        bar_label = f"Bar +{i}" if len(predictions) > 1 else "Next bar"
        print(f"  {bar_label}")
        for component, price in pred.items():
            print(f"    {component.upper():6s}: {price:>12,.2f}")

    print("\n  MC Uncertainty (mean ± 1σ):")
    for comp, stats in mc.items():
        print(f"    {comp.upper():6s}: {stats['mean']:>12,.2f}  ±{stats['std']:,.2f}"
              f"  [P10={stats['p10']:,.2f}, P90={stats['p90']:,.2f}]")
    print(f"{'='*60}\n")

    # Latest actual bar
    latest_bar = {
        col: float(df.iloc[-1][col]) for col in ["open", "high", "low", "close"]
    }

    record = {
        "run_ts":       run_ts,
        "run_mode":     run_mode,
        "label":        label,
        "ticker":       DJI_TICKER,
        "latest_bar":   latest_bar,
        "predictions":  predictions,
        "mc":           mc,
        "training": {
            "bars":      len(df),
            "sequences": int(X.shape[0]),
            "epochs":    len(history["loss"]),
            "final_val_loss": history["val_loss"][-1],
            "final_mae":      history["mae"][-1],
        },
        **extra,
    }

    results = _load_results()
    results.append(record)
    # Keep last 200 records to avoid unbounded growth
    results = results[-200:]
    _save_results(results)
    print(f"[INFO] Results saved → {RESULTS_FILE}")

    # For feedback: add a pending entry when NOT in 1pm_report mode,
    # so tomorrow's 1pm run can fill in the actual.
    if run_mode not in ("1pm_report",):
        pending_feedback = _load_feedback()
        # Only append a new pending record if the last one is already resolved
        if not pending_feedback or pending_feedback[-1].get("actual") is not None:
            pending_feedback.append({
                "date":       run_ts,
                "mode":       run_mode,
                "prediction": predictions[0],
                "mc":         mc,
                "actual":     None,
            })
            _save_feedback(pending_feedback)


if __name__ == "__main__":
    run()
