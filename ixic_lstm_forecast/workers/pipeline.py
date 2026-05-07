"""
ixic_lstm_forecast.workers.pipeline
======================================
Async data-acquisition pipeline.

``async_data_pipeline`` is a non-blocking coroutine that downloads 1-year
daily close prices for a given symbol from yfinance.  The blocking
``yfinance.download`` call is offloaded to a thread-pool executor so it
does not stall the event loop.
"""

from __future__ import annotations

import asyncio
import logging

import numpy as np

log = logging.getLogger(__name__)


async def async_data_pipeline(symbol: str) -> np.ndarray:
    """
    Asynchronously download 1-year daily close prices for *symbol*.

    The synchronous ``yfinance.download`` call is wrapped in
    ``loop.run_in_executor`` to prevent event-loop blocking.

    Parameters
    ----------
    symbol:
        Yahoo Finance ticker symbol, e.g. ``'^IXIC'``.

    Returns
    -------
    np.ndarray
        Close prices reshaped to ``(n, 1)``.
    """
    log.info(
        "[async_data_pipeline] START — symbol=%s  fetching 1y daily data...",
        symbol,
    )
    print(f"[IXIC] Async data pipeline: fetching 1y close history for {symbol}...", flush=True)

    import yfinance as yf  # noqa: PLC0415 — deferred to avoid import at module level

    loop = asyncio.get_event_loop()

    def _download() -> np.ndarray:
        log.debug("[async_data_pipeline] _download — blocking yfinance.download called")
        data = yf.download(symbol, period="1y", progress=False)
        if data is None or data.empty or "Close" not in data:
            log.warning(
                "[async_data_pipeline] empty download payload for %s (network/API issue likely)",
                symbol,
            )
            return np.empty((0, 1), dtype=float)
        close_series = data["Close"].dropna()
        if close_series.empty:
            log.warning(
                "[async_data_pipeline] no non-null close values returned for %s",
                symbol,
            )
            return np.empty((0, 1), dtype=float)
        close = close_series.values.reshape(-1, 1)
        log.debug(
            "[async_data_pipeline] _download complete — rows=%d  last_close=%.4f",
            len(close),
            float(close[-1][0]) if len(close) else float("nan"),
        )
        return close

    close_prices = await loop.run_in_executor(None, _download)

    if len(close_prices) == 0:
        log.error(
            "[async_data_pipeline] DONE — symbol=%s  samples=0 (no data returned)",
            symbol,
        )
        print(
            f"[IXIC] Async data pipeline: no close data returned for {symbol}; "
            "check network/DNS or Yahoo API availability.",
            flush=True,
        )
        return close_prices

    log.info(
        "[async_data_pipeline] DONE — symbol=%s  samples=%d  "
        "first=%.4f  last=%.4f",
        symbol,
        len(close_prices),
        float(close_prices[0][0]),
        float(close_prices[-1][0]),
    )
    print(
        f"[IXIC] Async data pipeline complete: {len(close_prices)} samples, "
        f"first={float(close_prices[0][0]):.4f}, last={float(close_prices[-1][0]):.4f}",
        flush=True,
    )
    return close_prices
