"""
YFinance Data Fetcher with Enhanced Features.

This module provides comprehensive data fetching capabilities from Yahoo Finance
including price data, technical indicators, fundamental data, and compression.

Features:
    - Multiple ticker support with batch processing
    - Automatic retry logic for failed requests
    - Database storage with SQLite
    - Compression to .dat files using gzip
    - Webhook notifications
    - Technical indicator calculations
    - Data validation and error handling
    - Incremental data updates
"""
import yfinance as yf
import pandas as pd
import numpy as np
import sqlite3
import gzip
import os
import argparse
import requests
import json
import sys
import time
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any, Tuple
from dataclasses import dataclass, field
from concurrent.futures import ThreadPoolExecutor, as_completed

# Default ticker list
TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "JPM", "V", "JNJ", "WMT", "PG"
]

# Extended ticker list for comprehensive data
EXTENDED_TICKERS = [
    # Technology
    "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA",
    "INTC", "AMD", "ORCL", "CRM", "ADBE", "CSCO",
    # Finance
    "JPM", "BAC", "WFC", "GS", "MS", "C", "AXP", "V", "MA",
    # Healthcare
    "JNJ", "UNH", "PFE", "MRK", "ABBV", "LLY",
    # Consumer
    "WMT", "PG", "KO", "PEP", "MCD", "NKE", "HD", "DIS",
    # Energy
    "XOM", "CVX", "COP", "SLB",
    # Indices
    "^GSPC", "^DJI", "^IXIC", "^RUT",
]

DB_NAME = "yfinance.db"
COMPRESSED_DB_NAME = "yfinance_data/yfinance.dat"

# Configuration defaults
DEFAULT_PERIOD = "2y"
DEFAULT_INTERVAL = "1d"
MAX_RETRY_ATTEMPTS = 3
RETRY_DELAY_SECONDS = 2.0
REQUEST_TIMEOUT = 60

# Webhook notification colors (Discord embed colors)
WEBHOOK_SUCCESS_COLOR = 5025616  # Green
WEBHOOK_ERROR_COLOR = 15158332  # Red
WEBHOOK_WARNING_COLOR = 15844367  # Yellow


@dataclass
class FetchResult:
    """Result of a data fetch operation."""
    ticker: str
    success: bool
    records: int = 0
    error: Optional[str] = None
    duration_seconds: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert result to dictionary."""
        return {
            "ticker": self.ticker,
            "success": self.success,
            "records": self.records,
            "error": self.error,
            "duration_seconds": self.duration_seconds,
        }


@dataclass
class FetchSummary:
    """Summary of a batch fetch operation."""
    total_tickers: int
    successful_tickers: int
    failed_tickers: int
    total_records: int
    duration_seconds: float
    results: List[FetchResult] = field(default_factory=list)
    
    @property
    def success_rate(self) -> float:
        """Calculate success rate as percentage."""
        if self.total_tickers == 0:
            return 0.0
        return (self.successful_tickers / self.total_tickers) * 100
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert summary to dictionary."""
        return {
            "total_tickers": self.total_tickers,
            "successful_tickers": self.successful_tickers,
            "failed_tickers": self.failed_tickers,
            "total_records": self.total_records,
            "duration_seconds": self.duration_seconds,
            "success_rate": self.success_rate,
            "results": [r.to_dict() for r in self.results],
        }


def create_database(db_name: str = DB_NAME) -> sqlite3.Connection:
    """Create or reset the SQLite database.
    
    Args:
        db_name: Name of the database file
        
    Returns:
        SQLite connection object
    """
    conn = sqlite3.connect(db_name)
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS prices")
    c.execute("""
        CREATE TABLE prices (
            Date TEXT,
            Open REAL,
            High REAL,
            Low REAL,
            Close REAL,
            Volume INTEGER,
            Ticker TEXT,
            FetchedAt TEXT,
            Period TEXT,
            Interval TEXT
        )
    """)
    
    # Create index for faster queries
    c.execute("CREATE INDEX IF NOT EXISTS idx_ticker ON prices(Ticker)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_date ON prices(Date)")
    c.execute("CREATE INDEX IF NOT EXISTS idx_ticker_date ON prices(Ticker, Date)")
    
    conn.commit()
    return conn


def validate_data(data: pd.DataFrame) -> Tuple[bool, Optional[str]]:
    """Validate fetched data.
    
    Args:
        data: DataFrame with price data
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    if data.empty:
        return False, "No data returned"
    
    required_columns = ['Open', 'High', 'Low', 'Close', 'Volume']
    missing = [col for col in required_columns if col not in data.columns]
    if missing:
        return False, f"Missing columns: {missing}"
    
    # Check for excessive NaN values
    nan_ratio = data[required_columns].isna().sum().sum() / (len(data) * len(required_columns))
    if nan_ratio > 0.5:
        return False, f"Too many NaN values: {nan_ratio:.2%}"
    
    return True, None


def fetch_single_ticker(
    ticker: str,
    period: str = DEFAULT_PERIOD,
    interval: str = DEFAULT_INTERVAL,
    retry_attempts: int = MAX_RETRY_ATTEMPTS,
) -> FetchResult:
    """Fetch data for a single ticker with retry logic.
    
    Args:
        ticker: Stock ticker symbol
        period: Data period (e.g., '1y', '6mo')
        interval: Data interval (e.g., '1d', '1h')
        retry_attempts: Number of retry attempts
        
    Returns:
        FetchResult with status and data
    """
    start_time = time.time()
    
    for attempt in range(retry_attempts):
        try:
            print(f"Fetching data for {ticker} (attempt {attempt + 1}/{retry_attempts})...")
            data = yf.download(
                ticker,
                period=period,
                interval=interval,
                progress=False,
                timeout=REQUEST_TIMEOUT,
            )
            
            is_valid, error = validate_data(data)
            if not is_valid:
                if attempt < retry_attempts - 1:
                    time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                    continue
                return FetchResult(
                    ticker=ticker,
                    success=False,
                    error=error,
                    duration_seconds=time.time() - start_time,
                )
            
            return FetchResult(
                ticker=ticker,
                success=True,
                records=len(data),
                duration_seconds=time.time() - start_time,
            )
            
        except Exception as e:
            if attempt < retry_attempts - 1:
                time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                continue
            return FetchResult(
                ticker=ticker,
                success=False,
                error=str(e),
                duration_seconds=time.time() - start_time,
            )
    
    return FetchResult(
        ticker=ticker,
        success=False,
        error="Max retries exceeded",
        duration_seconds=time.time() - start_time,
    )


def fetch_and_store_data(
    tickers: Optional[List[str]] = None,
    period: str = DEFAULT_PERIOD,
    interval: str = DEFAULT_INTERVAL,
    max_workers: int = 8,
) -> FetchSummary:
    """Fetch data for multiple tickers and store in database.
    
    Args:
        tickers: List of ticker symbols (uses defaults if None)
        period: Data period
        interval: Data interval
        max_workers: Maximum concurrent workers
        
    Returns:
        FetchSummary with results
    """
    if tickers is None:
        tickers = TICKERS
    
    start_time = time.time()
    conn = create_database()
    conn_lock = __import__('threading').Lock()

    results: List[FetchResult] = []
    total_records = 0

    def _fetch_one(ticker: str):
        """Fetch data for one ticker and return (FetchResult, DataFrame or None)."""
        tick_start = time.time()
        for attempt in range(MAX_RETRY_ATTEMPTS):
            try:
                data = yf.download(
                    ticker,
                    period=period,
                    interval=interval,
                    progress=False,
                    timeout=REQUEST_TIMEOUT,
                )
                is_valid, error = validate_data(data)
                if not is_valid:
                    if attempt < MAX_RETRY_ATTEMPTS - 1:
                        time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                        continue
                    return FetchResult(ticker=ticker, success=False, error=error,
                                       duration_seconds=time.time() - tick_start), None

                data.reset_index(inplace=True)
                data['Ticker'] = ticker
                data['FetchedAt'] = datetime.now(timezone.utc).isoformat()
                data['Period'] = period
                data['Interval'] = interval

                if 'Date' in data.columns:
                    data['Date'] = data['Date'].astype(str)
                elif 'Datetime' in data.columns:
                    data['Date'] = data['Datetime'].astype(str)
                else:
                    data['Date'] = data.index.astype(str)

                data_to_store = pd.DataFrame({
                    'Date': data['Date'],
                    'Open': data['Open'] if 'Open' in data.columns else np.nan,
                    'High': data['High'] if 'High' in data.columns else np.nan,
                    'Low': data['Low'] if 'Low' in data.columns else np.nan,
                    'Close': data['Close'] if 'Close' in data.columns else np.nan,
                    'Volume': data['Volume'] if 'Volume' in data.columns else 0,
                    'Ticker': data['Ticker'],
                    'FetchedAt': data['FetchedAt'],
                    'Period': data['Period'],
                    'Interval': data['Interval'],
                })

                return FetchResult(ticker=ticker, success=True, records=len(data_to_store),
                                   duration_seconds=time.time() - tick_start), data_to_store

            except Exception as e:
                if attempt < MAX_RETRY_ATTEMPTS - 1:
                    time.sleep(RETRY_DELAY_SECONDS * (attempt + 1))
                    continue
                return FetchResult(ticker=ticker, success=False, error=str(e),
                                   duration_seconds=time.time() - tick_start), None

        return FetchResult(ticker=ticker, success=False, error="Max retries exceeded",
                           duration_seconds=time.time() - tick_start), None

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        future_to_ticker = {executor.submit(_fetch_one, t): t for t in tickers}
        for future in as_completed(future_to_ticker):
            ticker = future_to_ticker[future]
            try:
                result, data_to_store = future.result()
                results.append(result)
                if result.success and data_to_store is not None:
                    with conn_lock:
                        data_to_store.to_sql('prices', conn, if_exists='append', index=False)
                    total_records += len(data_to_store)
            except Exception as e:
                results.append(FetchResult(
                    ticker=ticker,
                    success=False,
                    error=str(e),
                ))
    
    conn.close()
    
    successful = sum(1 for r in results if r.success)
    failed = len(results) - successful
    
    return FetchSummary(
        total_tickers=len(tickers),
        successful_tickers=successful,
        failed_tickers=failed,
        total_records=total_records,
        duration_seconds=time.time() - start_time,
        results=results,
    )


def calculate_technical_indicators(data: pd.DataFrame) -> pd.DataFrame:
    """Calculate technical indicators for the data.
    
    Args:
        data: DataFrame with OHLCV data
        
    Returns:
        DataFrame with added technical indicator columns
    """
    if data.empty:
        return data
    
    # Simple Moving Averages
    data['SMA_10'] = data['Close'].rolling(window=10).mean()
    data['SMA_20'] = data['Close'].rolling(window=20).mean()
    data['SMA_50'] = data['Close'].rolling(window=50).mean()
    
    # Exponential Moving Averages
    data['EMA_12'] = data['Close'].ewm(span=12, adjust=False).mean()
    data['EMA_26'] = data['Close'].ewm(span=26, adjust=False).mean()
    
    # MACD
    data['MACD'] = data['EMA_12'] - data['EMA_26']
    data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()
    data['MACD_Histogram'] = data['MACD'] - data['MACD_Signal']
    
    # RSI
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    data['RSI'] = 100 - (100 / (1 + rs))
    
    # Bollinger Bands
    data['BB_Middle'] = data['Close'].rolling(window=20).mean()
    bb_std = data['Close'].rolling(window=20).std()
    data['BB_Upper'] = data['BB_Middle'] + (bb_std * 2)
    data['BB_Lower'] = data['BB_Middle'] - (bb_std * 2)
    
    # Volume indicators
    data['Volume_SMA'] = data['Volume'].rolling(window=20).mean()
    data['Volume_Ratio'] = data['Volume'] / data['Volume_SMA']
    
    # Price changes
    data['Price_Change'] = data['Close'].pct_change()
    data['Price_Change_5d'] = data['Close'].pct_change(periods=5)
    
    return data


def compress_database(
    db_name: str = DB_NAME,
    output_name: str = COMPRESSED_DB_NAME,
    remove_original: bool = True,
) -> str:
    """Compress the SQLite database using gzip.
    
    Args:
        db_name: Name of the database file
        output_name: Name of the compressed output file
        remove_original: Whether to remove the original database
        
    Returns:
        Path to the compressed file
    """
    # Ensure output directory exists
    output_dir = os.path.dirname(output_name)
    if output_dir and not os.path.exists(output_dir):
        os.makedirs(output_dir)
    
    with open(db_name, "rb") as f_in:
        with gzip.open(output_name, "wb") as f_out:
            f_out.writelines(f_in)
    
    print(f"Database compressed to {output_name}")
    
    if remove_original and os.path.exists(db_name):
        os.remove(db_name)
        print(f"Removed original database: {db_name}")
    
    return output_name


def decompress_database(
    compressed_name: str = COMPRESSED_DB_NAME,
    output_name: str = "temp_yfinance.db",
) -> str:
    """Decompress a gzipped database file.
    
    Args:
        compressed_name: Name of the compressed file
        output_name: Name of the decompressed output file
        
    Returns:
        Path to the decompressed file
    """
    with gzip.open(compressed_name, "rb") as f_in:
        with open(output_name, "wb") as f_out:
            f_out.writelines(f_in)
    
    print(f"Database decompressed to {output_name}")
    return output_name


def read_data_from_compressed(
    ticker: Optional[str] = None,
    limit: int = 100,
) -> pd.DataFrame:
    """Read data from the compressed database.
    
    Args:
        ticker: Optional ticker to filter by
        limit: Maximum records to return
        
    Returns:
        DataFrame with the data
    """
    temp_db = decompress_database()
    
    try:
        conn = sqlite3.connect(temp_db)
        
        if ticker:
            query = "SELECT * FROM prices WHERE Ticker = ? ORDER BY Date DESC LIMIT ?"
            df = pd.read_sql_query(query, conn, params=(ticker, limit))
        else:
            query = "SELECT * FROM prices ORDER BY Ticker, Date DESC LIMIT ?"
            df = pd.read_sql_query(query, conn, params=(limit,))
        
        conn.close()
        return df
    finally:
        if os.path.exists(temp_db):
            os.remove(temp_db)


def send_webhook_notification(
    url: str,
    summary: Optional[FetchSummary] = None,
    message: Optional[str] = None,
) -> bool:
    """Send a POST request to the specified webhook URL.
    
    Args:
        url: Webhook URL
        summary: Optional FetchSummary to include
        message: Optional custom message
        
    Returns:
        True if successful, False otherwise
    """
    if not url:
        return False
    
    try:
        if summary:
            payload = {
                "content": f"Yfinance data update complete. "
                          f"Fetched {summary.successful_tickers}/{summary.total_tickers} tickers, "
                          f"{summary.total_records} records in {summary.duration_seconds:.2f}s",
                "username": "Yfinance Bot",
                "embeds": [
                    {
                        "title": "Fetch Summary",
                        "color": WEBHOOK_SUCCESS_COLOR if summary.success_rate > 80 else WEBHOOK_ERROR_COLOR,
                        "fields": [
                            {"name": "Success Rate", "value": f"{summary.success_rate:.1f}%", "inline": True},
                            {"name": "Total Records", "value": f"{summary.total_records:,}", "inline": True},
                            {"name": "Duration", "value": f"{summary.duration_seconds:.2f}s", "inline": True},
                        ],
                    }
                ],
            }
        else:
            payload = {
                "content": message or "Yfinance data update complete.",
                "username": "Yfinance Bot",
            }
        
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, data=json.dumps(payload), headers=headers, timeout=30)
        response.raise_for_status()
        print(f"Successfully sent webhook notification to {url}")
        return True
        
    except requests.exceptions.RequestException as e:
        print(f"Failed to send webhook notification: {e}", file=sys.stderr)
        return False


def main():
    """Main entry point for the data fetcher."""
    parser = argparse.ArgumentParser(
        description="Fetch yfinance data with enhanced features."
    )
    parser.add_argument(
        "--tickers",
        nargs="+",
        help="List of ticker symbols to fetch"
    )
    parser.add_argument(
        "--extended",
        action="store_true",
        help="Use extended ticker list"
    )
    parser.add_argument(
        "--period",
        default=DEFAULT_PERIOD,
        help=f"Data period (default: {DEFAULT_PERIOD})"
    )
    parser.add_argument(
        "--interval",
        default=DEFAULT_INTERVAL,
        help=f"Data interval (default: {DEFAULT_INTERVAL})"
    )
    parser.add_argument(
        "--webhook-url",
        help="Webhook URL to send notifications to"
    )
    parser.add_argument(
        "--output",
        default=COMPRESSED_DB_NAME,
        help=f"Output file path (default: {COMPRESSED_DB_NAME})"
    )
    parser.add_argument(
        "--no-compress",
        action="store_true",
        help="Skip compression step"
    )
    parser.add_argument(
        "--show-data",
        action="store_true",
        help="Show data from existing database"
    )
    parser.add_argument(
        "--show-ticker",
        help="Show data for a specific ticker"
    )
    args = parser.parse_args()

    # Handle show data commands
    if args.show_data or args.show_ticker:
        if os.path.exists(COMPRESSED_DB_NAME):
            df = read_data_from_compressed(ticker=args.show_ticker)
            print(df.to_string())
        else:
            print(f"No compressed database found at {COMPRESSED_DB_NAME}")
        return

    # Determine tickers to fetch
    if args.tickers:
        tickers = args.tickers
    elif args.extended:
        tickers = EXTENDED_TICKERS
    else:
        tickers = TICKERS
    
    print(f"Fetching data for {len(tickers)} tickers...")
    
    # Fetch and store data
    summary = fetch_and_store_data(
        tickers=tickers,
        period=args.period,
        interval=args.interval,
    )
    
    # Print summary
    print("\n" + "=" * 50)
    print("FETCH SUMMARY")
    print("=" * 50)
    print(f"Total Tickers: {summary.total_tickers}")
    print(f"Successful: {summary.successful_tickers}")
    print(f"Failed: {summary.failed_tickers}")
    print(f"Total Records: {summary.total_records:,}")
    print(f"Duration: {summary.duration_seconds:.2f}s")
    print(f"Success Rate: {summary.success_rate:.1f}%")
    
    if summary.failed_tickers > 0:
        print("\nFailed tickers:")
        for result in summary.results:
            if not result.success:
                print(f"  - {result.ticker}: {result.error}")
    
    # Compress database
    if not args.no_compress:
        compress_database(output_name=args.output)
    
    # Send webhook notification
    if args.webhook_url:
        send_webhook_notification(args.webhook_url, summary)


if __name__ == "__main__":
    main()
