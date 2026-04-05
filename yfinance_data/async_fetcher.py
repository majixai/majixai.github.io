#!/usr/bin/env python3
"""
Async YFinance Data Fetcher — asyncio + aiohttp edition.

Fetches OHLCV data for the full 1 500+ ticker universe concurrently using
asyncio tasks gated behind an asyncio.Semaphore.  CPU-bound indicator
calculations run in a ThreadPoolExecutor so the event loop stays free.

Architecture
------------
                          ┌────────────────────────────────────┐
  tickers list ──► batch  │  asyncio event loop                │
                          │  ┌─────────────────────────────┐   │
                          │  │  Semaphore(MAX_CONCURRENT)  │   │
                          │  │   aiohttp.ClientSession     │   │
                          │  │   ├── fetch ticker A  ──►   │   │
                          │  │   ├── fetch ticker B  ──►   │   │──► JSON .dat
                          │  │   └── ...            ──►   │   │
                          │  └─────────────────────────────┘   │
                          │  ThreadPoolExecutor (CPU work)     │
                          └────────────────────────────────────┘

Usage
-----
    # CLI — fetch a comma-separated list of tickers
    python async_fetcher.py --tickers AAPL,MSFT,NVDA --period 1y

    # Programmatic
    import asyncio
    from async_fetcher import AsyncTickerFetcher

    async def main():
        async with AsyncTickerFetcher(max_concurrent=40) as fetcher:
            results = await fetcher.fetch_all(tickers, period='1y', interval='1d')
        return results

    all_data = asyncio.run(main())
"""

from __future__ import annotations

import argparse
import asyncio
import gzip
import json
import logging
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
MAX_CONCURRENT: int = 40       # parallel HTTP requests in-flight at once
RETRY_ATTEMPTS: int = 3        # per-ticker retries on transient errors
RETRY_BASE_DELAY: float = 1.0  # exponential-backoff base (seconds)
CPU_WORKERS: int = min(8, (os.cpu_count() or 4))

# Yahoo Finance v8 chart API
_YF_CHART_URL = (
    "https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
    "?interval={interval}&range={period}&includePrePost=false"
)
_YF_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
    ),
    "Accept": "application/json",
}

# Interval → yfinance range mapping (period names differ slightly)
_PERIOD_MAP = {
    "1d":  "1d",
    "5d":  "5d",
    "1mo": "1mo",
    "3mo": "3mo",
    "6mo": "6mo",
    "1y":  "1y",
    "2y":  "2y",
    "5y":  "5y",
    "10y": "10y",
    "max": "max",
}


# ---------------------------------------------------------------------------
# Core class
# ---------------------------------------------------------------------------

class AsyncTickerFetcher:
    """
    Async context-manager for concurrent ticker data fetching.

    Parameters
    ----------
    max_concurrent : int
        Maximum number of simultaneous HTTP requests.
    retry_attempts : int
        Number of per-ticker retries on failure.
    cpu_workers : int
        Thread-pool size for CPU-bound indicator calculations.
    """

    def __init__(
        self,
        max_concurrent: int = MAX_CONCURRENT,
        retry_attempts: int = RETRY_ATTEMPTS,
        cpu_workers: int = CPU_WORKERS,
    ) -> None:
        self.max_concurrent = max_concurrent
        self.retry_attempts = retry_attempts
        self.cpu_workers = cpu_workers
        self._session = None
        self._semaphore: Optional[asyncio.Semaphore] = None
        self._executor: Optional[ThreadPoolExecutor] = None

    # ------------------------------------------------------------------ #
    # Context manager
    # ------------------------------------------------------------------ #

    async def __aenter__(self) -> "AsyncTickerFetcher":
        try:
            import aiohttp  # noqa: PLC0415
        except ImportError as exc:
            raise ImportError(
                "aiohttp is required for async fetching: pip install aiohttp"
            ) from exc

        import aiohttp as _aiohttp  # noqa: PLC0415

        connector = _aiohttp.TCPConnector(
            limit=self.max_concurrent * 2,
            ttl_dns_cache=300,
            ssl=True,
        )
        timeout = _aiohttp.ClientTimeout(total=30, connect=10)
        self._session = _aiohttp.ClientSession(
            connector=connector,
            timeout=timeout,
            headers=_YF_HEADERS,
        )
        self._semaphore = asyncio.Semaphore(self.max_concurrent)
        self._executor = ThreadPoolExecutor(
            max_workers=self.cpu_workers,
            thread_name_prefix="async_fetcher_cpu",
        )
        return self

    async def __aexit__(self, *_) -> None:
        if self._session:
            await self._session.close()
        if self._executor:
            self._executor.shutdown(wait=False)

    # ------------------------------------------------------------------ #
    # Public API
    # ------------------------------------------------------------------ #

    async def fetch_all(
        self,
        tickers: List[str],
        period: str = "1y",
        interval: str = "1d",
        progress_cb=None,
    ) -> Dict[str, Any]:
        """
        Fetch OHLCV data for *all* tickers concurrently.

        Parameters
        ----------
        tickers     : list of ticker symbols
        period      : data range (e.g. '1y', '5y')
        interval    : bar size (e.g. '1d', '1h')
        progress_cb : optional async callable(done, total, ticker) for progress

        Returns
        -------
        dict  {ticker: {'ohlcv': DataFrame-like dict, 'records': int, ...}}
        """
        t0 = time.perf_counter()
        total = len(tickers)
        logger.info(
            "AsyncTickerFetcher: starting %d tickers  concurrent=%d",
            total, self.max_concurrent,
        )

        done_count = 0
        results: Dict[str, Any] = {}
        lock = asyncio.Lock()

        async def _worker(ticker: str) -> None:
            nonlocal done_count
            result = await self._fetch_one(ticker, period, interval)
            async with lock:
                done_count += 1
                if result is not None:
                    results[ticker] = result
                if progress_cb is not None:
                    await progress_cb(done_count, total, ticker)
                if done_count % 100 == 0 or done_count == total:
                    elapsed = time.perf_counter() - t0
                    rate = done_count / elapsed if elapsed > 0 else 0
                    logger.info(
                        "  progress: %d/%d  (%.0f t/s)  ✓ %d",
                        done_count, total, rate, len(results),
                    )

        await asyncio.gather(*[_worker(t) for t in tickers])

        elapsed = time.perf_counter() - t0
        logger.info(
            "AsyncTickerFetcher: finished %d/%d in %.1fs  (%.0f t/s)",
            len(results), total, elapsed, total / elapsed if elapsed > 0 else 0,
        )
        return results

    async def fetch_one(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d",
    ) -> Optional[Dict[str, Any]]:
        """Fetch a single ticker (public convenience wrapper)."""
        return await self._fetch_one(ticker, period, interval)

    # ------------------------------------------------------------------ #
    # Internal helpers
    # ------------------------------------------------------------------ #

    async def _fetch_one(
        self,
        ticker: str,
        period: str,
        interval: str,
    ) -> Optional[Dict[str, Any]]:
        """Semaphore-gated fetch with exponential-backoff retry."""
        async with self._semaphore:
            for attempt in range(self.retry_attempts + 1):
                try:
                    raw = await self._http_fetch(ticker, period, interval)
                    if raw is None:
                        return None
                    # Offload CPU-bound parsing + indicator calculation to thread pool
                    loop = asyncio.get_event_loop()
                    result = await loop.run_in_executor(
                        self._executor,
                        _parse_and_enrich,
                        ticker,
                        raw,
                    )
                    return result
                except asyncio.TimeoutError:
                    logger.debug("%s: timeout (attempt %d)", ticker, attempt + 1)
                except Exception as exc:
                    logger.debug("%s: error %s (attempt %d)", ticker, exc, attempt + 1)

                if attempt < self.retry_attempts:
                    await asyncio.sleep(RETRY_BASE_DELAY * (2 ** attempt))

            logger.warning("%s: all %d attempts failed", ticker, self.retry_attempts + 1)
            return None

    async def _http_fetch(
        self,
        ticker: str,
        period: str,
        interval: str,
    ) -> Optional[Dict]:
        """Single HTTP GET to Yahoo Finance chart API."""
        url = _YF_CHART_URL.format(
            ticker=ticker,
            interval=interval,
            period=_PERIOD_MAP.get(period, period),
        )
        async with self._session.get(url) as resp:
            if resp.status == 404:
                logger.debug("%s: 404 not found", ticker)
                return None
            resp.raise_for_status()
            data = await resp.json(content_type=None)
        return data

    # ------------------------------------------------------------------ #
    # Convenience: save results to compressed .dat
    # ------------------------------------------------------------------ #

    @staticmethod
    def save_dat(results: Dict[str, Any], path: str) -> None:
        """Compress and save *results* dict to a gzip-JSON .dat file."""
        payload = json.dumps(results, default=str).encode("utf-8")
        with gzip.open(path, "wb") as fh:
            fh.write(payload)
        size_kb = os.path.getsize(path) / 1024
        logger.info("Saved %d records to %s (%.1f KB)", len(results), path, size_kb)


# ---------------------------------------------------------------------------
# CPU-bound parsing (runs in ThreadPoolExecutor)
# ---------------------------------------------------------------------------

def _parse_and_enrich(ticker: str, raw: Dict) -> Optional[Dict[str, Any]]:
    """
    Parse the Yahoo Finance JSON chart response and compute technical indicators.
    Runs in the thread pool so the asyncio event loop is never blocked.
    """
    try:
        result_block = raw.get("chart", {}).get("result")
        if not result_block:
            return None
        r = result_block[0]
        meta = r.get("meta", {})
        timestamps = r.get("timestamp", [])
        quotes = r.get("indicators", {}).get("quote", [{}])[0]

        if not timestamps:
            return None

        opens = _clean(quotes.get("open", []))
        highs = _clean(quotes.get("high", []))
        lows = _clean(quotes.get("low", []))
        closes = _clean(quotes.get("close", []))
        volumes = _clean(quotes.get("volume", []))
        n = min(len(timestamps), len(closes))

        if n < 2:
            return None

        closes_np = np.asarray(closes[:n], dtype=float)
        volumes_np = np.asarray(volumes[:n], dtype=float)

        # Technical indicators (numpy-only, no pandas dependency)
        sma20 = _sma(closes_np, 20)
        sma50 = _sma(closes_np, 50)
        ema12 = _ema(closes_np, 12)
        ema26 = _ema(closes_np, 26)
        rsi14 = _rsi(closes_np, 14)
        macd_line = ema12 - ema26
        macd_sig = _ema(macd_line, 9)
        bb_upper, bb_mid, bb_lower = _bollinger(closes_np, 20, 2)

        records = []
        for i in range(n):
            if closes[i] is None:
                continue
            records.append({
                "timestamp": timestamps[i],
                "open": opens[i],
                "high": highs[i],
                "low": lows[i],
                "close": closes[i],
                "volume": volumes[i],
                "sma20": _fmt(sma20[i]),
                "sma50": _fmt(sma50[i]),
                "ema12": _fmt(ema12[i]),
                "ema26": _fmt(ema26[i]),
                "rsi": _fmt(rsi14[i]),
                "macd": _fmt(macd_line[i]),
                "macd_signal": _fmt(macd_sig[i]),
                "bb_upper": _fmt(bb_upper[i]),
                "bb_mid": _fmt(bb_mid[i]),
                "bb_lower": _fmt(bb_lower[i]),
            })

        return {
            "ticker": ticker,
            "currency": meta.get("currency", "USD"),
            "exchange": meta.get("exchangeName", ""),
            "records": len(records),
            "data": records,
            "fetched_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
    except Exception as exc:
        logger.debug("%s: parse error — %s", ticker, exc)
        return None


# ---------------------------------------------------------------------------
# Indicator helpers (pure numpy, no pandas)
# ---------------------------------------------------------------------------

def _clean(lst: list) -> list:
    """Replace None/NaN entries with None for safe downstream use."""
    return [v if v is not None and not (isinstance(v, float) and np.isnan(v)) else None
            for v in lst]


def _fmt(v: float) -> Optional[float]:
    return round(float(v), 6) if np.isfinite(v) else None


def _sma(arr: np.ndarray, w: int) -> np.ndarray:
    out = np.full_like(arr, np.nan)
    cs = np.cumsum(arr)
    cs[w:] = cs[w:] - cs[:-w]
    out[w - 1:] = cs[w - 1:] / w
    return out


def _ema(arr: np.ndarray, span: int) -> np.ndarray:
    alpha = 2.0 / (span + 1)
    out = np.empty_like(arr, dtype=float)
    out[0] = arr[0]
    for i in range(1, len(arr)):
        out[i] = alpha * arr[i] + (1.0 - alpha) * out[i - 1]
    return out


def _rsi(arr: np.ndarray, period: int = 14) -> np.ndarray:
    delta = np.diff(arr, prepend=arr[0])
    gain = np.where(delta > 0, delta, 0.0)
    loss = np.where(delta < 0, -delta, 0.0)
    avg_g = _ema_wilder(gain, period)
    avg_l = _ema_wilder(loss, period)
    rs = avg_g / np.maximum(avg_l, 1e-10)
    return 100.0 - 100.0 / (1.0 + rs)


def _ema_wilder(arr: np.ndarray, period: int) -> np.ndarray:
    alpha = 1.0 / period
    out = np.empty_like(arr, dtype=float)
    out[0] = arr[0]
    for i in range(1, len(arr)):
        out[i] = alpha * arr[i] + (1.0 - alpha) * out[i - 1]
    return out


def _bollinger(arr: np.ndarray, w: int, k: float):
    mid = _sma(arr, w)
    std = np.array([arr[max(0, i - w + 1):i + 1].std() for i in range(len(arr))])
    return mid + k * std, mid, mid - k * std


# ---------------------------------------------------------------------------
# CLI entry point
# ---------------------------------------------------------------------------

async def _cli_main(args) -> int:
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

    if args.tickers:
        tickers = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
    elif args.category:
        from tickers import TICKER_CATEGORIES  # noqa: PLC0415
        tickers = TICKER_CATEGORIES.get(args.category, [])
        if not tickers:
            logger.error("Unknown category: %s", args.category)
            return 1
    else:
        from tickers import TICKERS  # noqa: PLC0415
        tickers = TICKERS

    logger.info("Fetching %d tickers (period=%s interval=%s)", len(tickers), args.period, args.interval)

    async with AsyncTickerFetcher(max_concurrent=args.concurrent) as fetcher:
        results = await fetcher.fetch_all(tickers, period=args.period, interval=args.interval)

    out_path = args.output or os.path.join(
        os.path.dirname(os.path.abspath(__file__)),
        f"async_{args.period}_{args.interval}.dat",
    )
    AsyncTickerFetcher.save_dat(results, out_path)
    print(f"[OK] {len(results)}/{len(tickers)} tickers → {out_path}")
    return 0


def main() -> None:
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s %(levelname)s %(message)s",
    )
    parser = argparse.ArgumentParser(description="Async YFinance ticker fetcher")
    parser.add_argument("--tickers", help="Comma-separated ticker list")
    parser.add_argument("--category", help="Ticker category (from tickers.py)")
    parser.add_argument("--period", default="1y", help="Data period (default: 1y)")
    parser.add_argument("--interval", default="1d", help="Bar interval (default: 1d)")
    parser.add_argument("--concurrent", type=int, default=MAX_CONCURRENT,
                        help=f"Max concurrent requests (default: {MAX_CONCURRENT})")
    parser.add_argument("--output", help="Output .dat file path")
    args = parser.parse_args()
    sys.exit(asyncio.run(_cli_main(args)))


if __name__ == "__main__":
    main()
