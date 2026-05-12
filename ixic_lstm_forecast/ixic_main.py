#!/usr/bin/env python3
"""
ixic_lstm_forecast / ixic_main.py
====================================
Main orchestration script for the IXIC LSTM Forecast pipeline.

Entry-point flow
-----------------
1.  IIFE banner (§11 — Immediately Invoked Function Expression pattern)
2.  Async data acquisition (``async_data_pipeline``)
3.  MinMax scaling + window dataset construction
     - Custom iterator  (``TimeSeriesIterator``)
     - Batched generator (``batch_generator``)
4.  LSTM training       (``LSTMCore.train``)
5.  Price forecasting   (``LSTMCore.predict_sequence`` + inverse-scaling)
6.  Distributed reporting worker via ``multiprocessing.Queue``
     - Maps payload → ``Tickers`` struct inside child process
     - Persists gzip binary payload via ``GitDatabaseStorage``
7.  Summary JSON written to ``output/ixic_summary.json``

Environment variables
----------------------
IXIC_SYMBOL        Ticker symbol to forecast (default: ``^IXIC``)
IXIC_SEQ_LENGTH    Look-back window in bars    (default: ``60``)
IXIC_EPOCHS        LSTM training epochs        (default: ``3``)
IXIC_BATCH_SIZE    Generator batch size        (default: ``256``)
IXIC_OUTPUT_DIR    Override output directory   (default: ``output/``)
"""

from __future__ import annotations

import asyncio
import json
import logging
import logging.handlers
import os
import sys
import warnings
from datetime import datetime, timezone
from multiprocessing import Process, Queue
from pathlib import Path

import numpy as np
from sklearn.preprocessing import MinMaxScaler

# ---------------------------------------------------------------------------
# Suppress TF/oneDNN chatter before TF is imported by sub-modules
# ---------------------------------------------------------------------------
os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
warnings.filterwarnings("ignore")

# ---------------------------------------------------------------------------
# Repo root on sys.path (allows imports from sibling root dirs)
# ---------------------------------------------------------------------------
_REPO_ROOT = Path(__file__).resolve().parents[1]
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

# ---------------------------------------------------------------------------
# Logging setup — must happen before importing sub-modules so their loggers
# inherit the root configuration.
# ---------------------------------------------------------------------------
_OUTPUT_DIR = Path(
    os.environ.get("IXIC_OUTPUT_DIR", Path(__file__).resolve().parent / "output")
)
_OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

_LOG_FILE = _OUTPUT_DIR / "ixic_forecast.log"
_LOG_LEVEL = os.environ.get("IXIC_LOG_LEVEL", "INFO").upper()
_SUPPRESSED_LOGGERS = ("tensorflow", "yfinance", "peewee", "h5py", "urllib3")

_log_fmt = "%(asctime)s  %(levelname)-8s  %(name)s | %(message)s"
_date_fmt = "%Y-%m-%dT%H:%M:%S"

logging.basicConfig(
    level=getattr(logging, _LOG_LEVEL, logging.INFO),
    format=_log_fmt,
    datefmt=_date_fmt,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(_LOG_FILE, mode="a", encoding="utf-8"),
    ],
)

log = logging.getLogger("ixic_main")
for _noisy_logger in _SUPPRESSED_LOGGERS:
    logging.getLogger(_noisy_logger).setLevel(logging.WARNING)


def _console_line(message: str) -> None:
    ts = datetime.now(tz=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    print(f"[IXIC][{ts}] {message}", flush=True)


log.info("=" * 70)
log.info("[ixic_main] IXIC LSTM Forecast pipeline initialising...")
log.info("[ixic_main] log file → %s", _LOG_FILE)
log.info("[ixic_main] repo root → %s", _REPO_ROOT)
log.info("[ixic_main] log level → %s", _LOG_LEVEL)
log.info("=" * 70)

# ---------------------------------------------------------------------------
# Runtime settings + sub-module imports (after logging is configured)
# ---------------------------------------------------------------------------
try:
    from ixic_lstm_forecast.runtime_settings import load_runtime_settings
except ImportError:  # pragma: no cover - direct script execution fallback
    from runtime_settings import load_runtime_settings
from ixic_lstm_forecast.framework import (
    TimeSeriesIterator,
    batch_generator,
)
from ixic_lstm_forecast.models import LSTMCore
from ixic_lstm_forecast.storage import GitDatabaseStorage
from ixic_lstm_forecast.workers import async_data_pipeline, reporting_worker

log.info("[ixic_main] all sub-modules imported successfully.")


# ---------------------------------------------------------------------------
# Configuration (resolved from environment + symbols CSV manifest)
# ---------------------------------------------------------------------------
RUNTIME_SETTINGS = load_runtime_settings()
SYMBOL: str = RUNTIME_SETTINGS["primary_symbol"]
SELECTED_SYMBOLS: list[str] = RUNTIME_SETTINGS["selected_symbols"]
SYMBOLS_CSV_PATH: str = RUNTIME_SETTINGS["symbols_csv_path"]
SEQ_LENGTH: int = int(os.environ.get("IXIC_SEQ_LENGTH", "60"))
EPOCHS: int = int(os.environ.get("IXIC_EPOCHS", "3"))
BATCH_SIZE: int = int(os.environ.get("IXIC_BATCH_SIZE", "256"))

log.info(
    "[ixic_main] config — SYMBOL=%s  SEQ_LENGTH=%d  EPOCHS=%d  BATCH_SIZE=%d  SELECTED_SYMBOLS=%s  SYMBOLS_CSV=%s",
    SYMBOL,
    SEQ_LENGTH,
    EPOCHS,
    BATCH_SIZE,
    SELECTED_SYMBOLS,
    SYMBOLS_CSV_PATH,
)


# ---------------------------------------------------------------------------
# §10 — Main controller (async)
# ---------------------------------------------------------------------------
async def main_controller() -> dict:
    """
    Orchestrate the full IXIC LSTM forecast pipeline.

    Returns
    -------
    dict
        Summary record written to ``output/ixic_summary.json``.
    """
    run_start = datetime.now(tz=timezone.utc)
    log.info("[main_controller] run_start=%s", run_start.isoformat())
    _console_line("Run started.")

    # ── 1. Fetch data asynchronously ─────────────────────────────────────
    log.info("[main_controller] STEP 1 — async data acquisition")
    _console_line(f"STEP 1/6: Fetching 1y daily close data for {SYMBOL}...")
    close_prices = await async_data_pipeline(SYMBOL)
    log.info(
        "[main_controller] acquired %d close-price samples for %s",
        len(close_prices),
        SYMBOL,
    )
    _console_line(f"STEP 1/6 complete: fetched {len(close_prices)} close samples.")

    if len(close_prices) < SEQ_LENGTH + 1:
        msg = (
            f"Insufficient data: got {len(close_prices)} bars, "
            f"need at least {SEQ_LENGTH + 1}."
        )
        log.error("[main_controller] %s", msg)
        _console_line(f"Run failed early: {msg}")
        raise ValueError(msg)

    # ── 2. Preprocessing — MinMax scaling ────────────────────────────────
    log.info("[main_controller] STEP 2 — MinMax scaling")
    _console_line("STEP 2/6: Scaling close-price series...")
    scaler = MinMaxScaler(feature_range=(0, 1))
    scaled_data = scaler.fit_transform(close_prices)
    log.info(
        "[main_controller] scaling complete — min=%.6f  max=%.6f",
        float(scaled_data.min()),
        float(scaled_data.max()),
    )

    # ── 3. Build dataset via iterator + generator ─────────────────────────
    log.info("[main_controller] STEP 3 — dataset construction (iterator + generator)")
    _console_line("STEP 3/6: Building model-ready sequence dataset...")
    iterator = TimeSeriesIterator(scaled_data, SEQ_LENGTH)
    log.info(
        "[main_controller] TimeSeriesIterator ready — estimated_samples=%d",
        len(iterator),
    )

    X_full: list = []
    y_full: list = []
    for X_batch, y_batch in batch_generator(iterator, batch_size=BATCH_SIZE):
        X_full.extend(X_batch)
        y_full.extend(y_batch)

    X_full_np = np.array(X_full)
    y_full_np = np.array(y_full)
    log.info(
        "[main_controller] dataset built — X.shape=%s  y.shape=%s",
        X_full_np.shape,
        y_full_np.shape,
    )
    _console_line(
        f"STEP 3/6 complete: training tensor shape={X_full_np.shape}, target shape={y_full_np.shape}."
    )

    # ── 4. Initialise and train LSTM model ────────────────────────────────
    log.info("[main_controller] STEP 4 — LSTM model initialisation and training")
    _console_line("STEP 4/6: Training LSTM model...")
    forecaster = LSTMCore(SEQ_LENGTH)
    log.info(
        "[main_controller] LSTMCore created — cache_status=%s",
        forecaster.__class__.__name__,
    )

    forecaster.train(X_full_np, y_full_np, epochs=EPOCHS)
    log.info("[main_controller] model training complete")
    _console_line("STEP 4/6 complete: training finished.")

    # ── 5. Forecast next close ────────────────────────────────────────────
    log.info("[main_controller] STEP 5 — generating next-close forecast")
    _console_line("STEP 5/6: Generating next-close forecast...")
    last_sequence = scaled_data[-SEQ_LENGTH:]
    X_test = np.reshape(last_sequence, (1, SEQ_LENGTH, 1))
    log.debug("[main_controller] X_test.shape=%s", X_test.shape)

    predicted_scaled = forecaster.predict_sequence(X_test)
    predicted_price = float(scaler.inverse_transform(predicted_scaled)[0][0])
    recent_close = float(close_prices[-1][0])
    delta_value = predicted_price - recent_close
    delta_pct_value = (delta_value / recent_close * 100) if recent_close != 0.0 else 0.0

    log.info(
        "[main_controller] forecast — recent_close=%.4f  predicted_next=%.4f  "
        "delta=%.4f  delta_pct=%.4f%%",
        recent_close,
        predicted_price,
        delta_value,
        delta_pct_value,
    )
    _console_line(
        "STEP 5/6 complete: "
        f"recent={recent_close:.4f}, projected={predicted_price:.4f}, "
        f"delta={delta_value:+.4f} ({delta_pct_value:+.4f}%)."
    )

    # ── 6. Distributed worker — reporting + storage ───────────────────────
    log.info("[main_controller] STEP 6 — distributed worker architecture")
    _console_line("STEP 6/6: Sending payload to distributed reporting/storage worker...")
    worker_queue: Queue = Queue()
    storage_engine = GitDatabaseStorage(output_dir=_OUTPUT_DIR)

    log.info("[main_controller] spawning reporting_worker child process...")
    worker_process = Process(
        target=reporting_worker,
        args=(worker_queue, storage_engine),
        daemon=False,
    )
    worker_process.start()
    log.info(
        "[main_controller] worker started — pid=%d", worker_process.pid or -1
    )

    # Send forecast payload to worker
    payload = {
        "symbol": SYMBOL,
        "selected_symbols": SELECTED_SYMBOLS,
        "symbols_csv_path": SYMBOLS_CSV_PATH,
        "recent": recent_close,
        "projected": predicted_price,
    }
    log.info("[main_controller] sending payload to worker — %s", payload)
    worker_queue.put(payload)

    # Graceful teardown
    log.info("[main_controller] sending TERMINATE sentinel to worker...")
    worker_queue.put("TERMINATE")
    worker_process.join(timeout=60)

    if worker_process.is_alive():
        log.warning(
            "[main_controller] worker pid=%d did not exit within timeout; "
            "terminating forcibly.",
            worker_process.pid or -1,
        )
        worker_process.terminate()
        worker_process.join()
        _console_line("Worker timeout reached; child process terminated.")
    else:
        log.info(
            "[main_controller] worker exited — exit_code=%d",
            worker_process.exitcode or 0,
        )
        _console_line(f"STEP 6/6 complete: worker exit_code={worker_process.exitcode or 0}.")

    # ── 7. Write summary JSON ─────────────────────────────────────────────
    run_end = datetime.now(tz=timezone.utc)
    elapsed = (run_end - run_start).total_seconds()

    summary = {
        "symbol": SYMBOL,
        "selected_symbols": SELECTED_SYMBOLS,
        "symbols_csv_path": SYMBOLS_CSV_PATH,
        "run_start": run_start.isoformat(),
        "run_end": run_end.isoformat(),
        "elapsed_seconds": round(elapsed, 2),
        "samples_fetched": int(len(close_prices)),
        "training_samples": int(len(X_full_np)),
        "seq_length": SEQ_LENGTH,
        "epochs": EPOCHS,
        "batch_size": BATCH_SIZE,
        "recent_close": round(recent_close, 4),
        "projected_close": round(predicted_price, 4),
        "delta": round(delta_value, 4),
        "delta_pct": round(delta_pct_value, 4),
    }

    summary_path = _OUTPUT_DIR / "ixic_summary.json"
    summary_path.write_text(json.dumps(summary, indent=2), encoding="utf-8")
    log.info("[main_controller] summary written to %s", summary_path)

    # ── Final console summary ─────────────────────────────────────────────
    sep = "=" * 70
    print(sep)
    print("  IXIC LSTM FORECAST — RUN SUMMARY")
    print(sep)
    print(f"  Symbol           : {summary['symbol']}")
    print(f"  Selected symbols : {', '.join(summary['selected_symbols'])}")
    print(f"  Run start (UTC)  : {summary['run_start']}")
    print(f"  Elapsed (s)      : {summary['elapsed_seconds']}")
    print(f"  Samples fetched  : {summary['samples_fetched']}")
    print(f"  Training samples : {summary['training_samples']}")
    print(f"  Seq length       : {summary['seq_length']}")
    print(f"  Epochs           : {summary['epochs']}")
    print(f"  Recent close     : {summary['recent_close']:.4f}")
    print(f"  Projected next   : {summary['projected_close']:.4f}")
    print(f"  Delta            : {summary['delta']:+.4f}  ({summary['delta_pct']:+.4f}%)")
    print(sep)

    log.info("[main_controller] pipeline complete — elapsed=%.2fs", elapsed)
    _console_line(f"Run complete in {elapsed:.2f}s.")
    return summary


# ---------------------------------------------------------------------------
# §11 — IIFE + async entry point
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    # IIFE — immediately invoked lambda for environment banner
    (lambda: (
        print("[IIFE] Initializing IXIC LSTM Action Runner Environment..."),
        log.info("[IIFE] IXIC LSTM Action Runner invoked"),
    ))()

    try:
        log.info("[ixic_main] launching asyncio event loop...")
        summary = asyncio.run(main_controller())
        log.info(
            "[ixic_main] event loop complete — projected_close=%.4f",
            summary.get("projected_close", float("nan")),
        )
        sys.exit(0)
    except KeyboardInterrupt:
        log.warning("[ixic_main] interrupted by user.")
        sys.exit(130)
    except Exception as exc:
        log.exception("[ixic_main] unhandled exception: %s", exc)
        sys.exit(1)
