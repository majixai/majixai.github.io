#!/usr/bin/env python3
"""
Download ^IXIC data for multiple yfinance intervals and write timestamped CSVs.

By default, this script stores each timeframe in the repository root as:

    ixic_<interval>_<UTC timestamp>.csv
"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable, List, Sequence, Tuple

import pandas as pd

_REPO_ROOT = Path(__file__).resolve().parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from yfinance.ops import download  # noqa: E402

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
LOGGER = logging.getLogger(__name__)

DEFAULT_SYMBOL = "^IXIC"
DEFAULT_OUTPUT_DIR = _REPO_ROOT

TIMEFRAME_REQUESTS: Sequence[Tuple[str, str]] = (
    ("1m", "7d"),
    ("2m", "60d"),
    ("5m", "60d"),
    ("15m", "60d"),
    ("30m", "60d"),
    ("60m", "730d"),
    ("90m", "60d"),
    ("1h", "730d"),
    ("1d", "max"),
    ("1wk", "max"),
    ("1mo", "max"),
    ("3mo", "max"),
)


def _slugify_symbol(symbol: str) -> str:
    return symbol.replace("^", "").replace("/", "_").replace("=", "_").lower()


def _timestamp() -> str:
    return datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")


def _normalize_frame(frame: pd.DataFrame, symbol: str, interval: str) -> pd.DataFrame:
    frame = frame.copy().reset_index()
    if frame.columns.size:
        frame = frame.rename(columns={frame.columns[0]: "Date"})
    frame.insert(0, "symbol", symbol)
    frame.insert(1, "interval", interval)
    return frame


def _fetch_with_retry(symbol: str, interval: str, period: str, retries: int = 2) -> pd.DataFrame:
    for attempt in range(retries + 1):
        try:
            frame = download(
                tickers=symbol,
                period=period,
                interval=interval,
                auto_adjust=False,
                progress=False,
                timeout=60,
            )
            if frame is None or frame.empty:
                return pd.DataFrame()
            return _normalize_frame(frame, symbol, interval)
        except Exception as exc:  # noqa: BLE001
            if attempt >= retries:
                LOGGER.error(
                    "Failed to fetch %s @ %s after %d attempts: %s",
                    symbol,
                    interval,
                    retries + 1,
                    exc,
                )
                return pd.DataFrame()
            wait = 2 ** attempt
            LOGGER.warning(
                "Fetch attempt %d for %s @ %s failed (%s); retrying in %ds",
                attempt + 1,
                symbol,
                interval,
                exc,
                wait,
            )
            time.sleep(wait)
    return pd.DataFrame()


def _selected_requests(intervals: Iterable[str]) -> List[Tuple[str, str]]:
    available = {interval: period for interval, period in TIMEFRAME_REQUESTS}
    selected: List[Tuple[str, str]] = []
    for interval in intervals:
        if interval not in available:
            raise ValueError(f"Unsupported interval: {interval}")
        selected.append((interval, available[interval]))
    return selected


def parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Fetch ^IXIC across multiple yfinance intervals.")
    parser.add_argument("--symbol", default=DEFAULT_SYMBOL, help="Ticker symbol to download (default: %(default)s)")
    parser.add_argument(
        "--output-dir",
        default=str(DEFAULT_OUTPUT_DIR),
        help="Directory for timestamped CSV outputs (default: repository root)",
    )
    parser.add_argument(
        "--intervals",
        nargs="*",
        default=[interval for interval, _ in TIMEFRAME_REQUESTS],
        help="Subset of intervals to fetch (default: all supported intervals)",
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    output_dir = Path(args.output_dir)
    output_dir.mkdir(parents=True, exist_ok=True)
    stamp = _timestamp()
    slug = _slugify_symbol(args.symbol)

    try:
        requests = _selected_requests(args.intervals)
    except ValueError as exc:
        LOGGER.error(str(exc))
        return 1

    saved_files: List[Path] = []
    for interval, period in requests:
        LOGGER.info("Fetching %s at interval %s (period=%s)", args.symbol, interval, period)
        frame = _fetch_with_retry(args.symbol, interval, period)
        if frame.empty:
            LOGGER.warning("No data returned for %s @ %s", args.symbol, interval)
            continue
        output_path = output_dir / f"{slug}_{interval}_{stamp}.csv"
        frame.to_csv(output_path, index=False)
        saved_files.append(output_path)
        LOGGER.info("Saved %d rows to %s", len(frame), output_path)

    if not saved_files:
        LOGGER.error("No CSV files were written.")
        return 2

    LOGGER.info("Wrote %d CSV file(s) to %s", len(saved_files), output_dir)
    for path in saved_files:
        LOGGER.info("  %s", path.name)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
