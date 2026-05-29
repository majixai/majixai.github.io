"""
ixic_lstm_forecast
===================
IXIC LSTM Forecast package — top-level re-exports.

Sub-packages
------------
framework   Protocols, base classes, decorators, iterators.
models      LSTMCore LSTM model.
storage     GitDatabaseStorage persistence layer.
workers     Async data pipeline and distributed reporter.

Entry point
-----------
Run ``python ixic_lstm_forecast/ixic_main.py`` (or invoke from the GitHub
Actions workflow ``ixic_lstm_forecast.yml``).
"""

from ixic_lstm_forecast.framework import (
    IModelForecaster,
    IStorageEngine,
    QuantFrameworkBase,
    Tickers,
    _global_tensor_cache,
    lifecycle_hook,
    log_event,
    TimeSeriesIterator,
    batch_generator,
)
from ixic_lstm_forecast.models import LSTMCore
from ixic_lstm_forecast.storage import GitDatabaseStorage
from ixic_lstm_forecast.workers import async_data_pipeline, reporting_worker

__all__ = [
    "IModelForecaster",
    "IStorageEngine",
    "QuantFrameworkBase",
    "Tickers",
    "_global_tensor_cache",
    "lifecycle_hook",
    "log_event",
    "TimeSeriesIterator",
    "batch_generator",
    "LSTMCore",
    "GitDatabaseStorage",
    "async_data_pipeline",
    "reporting_worker",
]
