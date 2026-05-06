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
    print(f"[*] Async pipeline fetching data for {symbol}...")

    import yfinance as yf  # noqa: PLC0415 — deferred to avoid import at module level

    loop = asyncio.get_event_loop()

    def _download() -> np.ndarray:
        log.debug("[async_data_pipeline] _download — blocking yfinance.download called")
        data = yf.download(symbol, period="1y", progress=False)
        close = data["Close"].values.reshape(-1, 1)
        log.debug(
            "[async_data_pipeline] _download complete — rows=%d  last_close=%.4f",
            len(close),
            float(close[-1][0]) if len(close) else float("nan"),
        )
        return close

    close_prices = await loop.run_in_executor(None, _download)

    log.info(
        "[async_data_pipeline] DONE — symbol=%s  samples=%d  "
        "first=%.4f  last=%.4f",
        symbol,
        len(close_prices),
        float(close_prices[0][0]),
        float(close_prices[-1][0]),
    )
    return close_prices
