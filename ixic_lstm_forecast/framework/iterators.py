"""
ixic_lstm_forecast.framework.iterators
=========================================
Custom iterator and generator utilities for financial time-series data.

Classes / Functions
--------------------
TimeSeriesIterator
    A Python iterator that steps through a 1-D price array, yielding
    (sequence, target) pairs suitable for supervised LSTM training.

batch_generator
    A generator that wraps ``TimeSeriesIterator`` and accumulates samples
    into fixed-size batches before yielding them as NumPy arrays.
"""

from __future__ import annotations

import logging
from typing import Generator, Tuple

import numpy as np

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# §7 — Custom Iterator
# ---------------------------------------------------------------------------
class TimeSeriesIterator:
    """
    Stepping iterator over a 1-D (or 2-D column) financial data array.

    Parameters
    ----------
    data:
        Scaled price array, shape ``(n,)`` or ``(n, 1)``.
    window:
        Lookback window length for each sequence.
    """

    def __init__(self, data: np.ndarray, window: int) -> None:
        self.data = data
        self.window = window
        self.index = window
        log.debug(
            "[TimeSeriesIterator] created — data.shape=%s  window=%d  "
            "total_samples=%d",
            data.shape,
            window,
            max(0, len(data) - window),
        )

    # ------------------------------------------------------------------
    def __iter__(self) -> "TimeSeriesIterator":
        log.debug("[TimeSeriesIterator] __iter__ called — resetting index to %d", self.window)
        self.index = self.window
        return self

    # ------------------------------------------------------------------
    def __next__(self) -> Tuple[np.ndarray, np.ndarray]:
        if self.index >= len(self.data):
            log.debug(
                "[TimeSeriesIterator] StopIteration — exhausted at index=%d", self.index
            )
            raise StopIteration

        seq = self.data[self.index - self.window : self.index]
        target = self.data[self.index]
        self.index += 1

        if self.index % 50 == 0:
            log.debug(
                "[TimeSeriesIterator] __next__ — yielded index=%d  seq.shape=%s",
                self.index - 1,
                seq.shape,
            )
        return seq, target

    # ------------------------------------------------------------------
    def __len__(self) -> int:
        return max(0, len(self.data) - self.window)


# ---------------------------------------------------------------------------
# §7 — Batch Generator
# ---------------------------------------------------------------------------
def batch_generator(
    iterator: TimeSeriesIterator, batch_size: int
) -> Generator[Tuple[np.ndarray, np.ndarray], None, None]:
    """
    Yield ``(X_batch, y_batch)`` arrays of shape
    ``(batch_size, window)`` and ``(batch_size,)`` respectively.

    The final batch may be smaller than *batch_size* if samples do not
    divide evenly.

    Parameters
    ----------
    iterator:
        A ``TimeSeriesIterator`` (or any iterable of ``(seq, target)`` pairs).
    batch_size:
        Number of samples per yielded batch.
    """
    log.info(
        "[batch_generator] starting — batch_size=%d  estimated_total=%s",
        batch_size,
        len(iterator) if hasattr(iterator, "__len__") else "unknown",
    )

    X_batch: list = []
    y_batch: list = []
    batches_yielded = 0

    for seq, target in iterator:
        X_batch.append(seq)
        y_batch.append(target)
        if len(X_batch) == batch_size:
            log.debug(
                "[batch_generator] yielding batch #%d — size=%d",
                batches_yielded + 1,
                len(X_batch),
            )
            yield np.array(X_batch), np.array(y_batch)
            batches_yielded += 1
            X_batch, y_batch = [], []

    # Yield remaining samples (last partial batch)
    if X_batch:
        log.debug(
            "[batch_generator] yielding final partial batch #%d — size=%d",
            batches_yielded + 1,
            len(X_batch),
        )
        yield np.array(X_batch), np.array(y_batch)
        batches_yielded += 1

    log.info("[batch_generator] complete — total batches yielded=%d", batches_yielded)
