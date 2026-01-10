"""
Data Model for yfinance data storage and retrieval.
Handles database operations and data compression to .dat files.
"""
import sqlite3
import gzip
import os
import logging
from datetime import datetime
from typing import List, Dict, Optional, Any

import yfinance as yf
import pandas as pd

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DataModel:
    """Model class for fetching and storing yfinance data."""

    def __init__(self, db_name: str = "yfinance.db", data_dir: str = "yfinance_data"):
        """
        Initialize the DataModel.

        Args:
            db_name: Name of the SQLite database file.
            data_dir: Directory to store compressed .dat files.
        """
        self.db_name = db_name
        self.data_dir = data_dir
        self.conn: Optional[sqlite3.Connection] = None

    def create_database(self) -> None:
        """Create or reset the SQLite database with the prices table."""
        self.conn = sqlite3.connect(self.db_name)
        cursor = self.conn.cursor()
        cursor.execute("DROP TABLE IF EXISTS prices")
        cursor.execute("""
            CREATE TABLE prices (
                Date TEXT,
                Open REAL,
                High REAL,
                Low REAL,
                Close REAL,
                Volume INTEGER,
                Ticker TEXT,
                FetchedAt TEXT
            )
        """)
        self.conn.commit()
        logger.info(f"Database '{self.db_name}' created/reset successfully.")

    def fetch_ticker_data(
        self,
        ticker: str,
        period: str = "1y",
        interval: str = "1d"
    ) -> Optional[pd.DataFrame]:
        """
        Fetch historical data for a single ticker.

        Args:
            ticker: Stock ticker symbol.
            period: Data period (e.g., '1y', '6mo', '1mo').
            interval: Data interval (e.g., '1d', '1h', '5m').

        Returns:
            DataFrame with price data or None if fetch fails.
        """
        try:
            logger.info(f"Fetching data for {ticker}...")
            data = yf.download(
                ticker,
                period=period,
                interval=interval,
                progress=False
            )
            if data.empty:
                logger.warning(f"No data returned for {ticker}")
                return None

            data.reset_index(inplace=True)
            data['Ticker'] = ticker
            data['FetchedAt'] = datetime.now().isoformat()

            # Handle column naming for multi-level columns from yfinance
            if isinstance(data.columns, pd.MultiIndex):
                data.columns = [col[0] if col[1] == '' else col[0] for col in data.columns]

            # Normalize column names
            data['Date'] = data['Date'].astype(str) if 'Date' in data.columns else data.index.astype(str)

            logger.info(f"Successfully fetched {len(data)} records for {ticker}")
            return data
        except Exception as e:
            logger.error(f"Error fetching data for {ticker}: {e}")
            return None

    def fetch_multiple_tickers(
        self,
        tickers: List[str],
        period: str = "1y",
        interval: str = "1d"
    ) -> Dict[str, pd.DataFrame]:
        """
        Fetch historical data for multiple tickers.

        Args:
            tickers: List of stock ticker symbols.
            period: Data period.
            interval: Data interval.

        Returns:
            Dictionary mapping ticker to its DataFrame.
        """
        results = {}
        successful = 0
        failed = 0

        for ticker in tickers:
            data = self.fetch_ticker_data(ticker, period, interval)
            if data is not None:
                results[ticker] = data
                successful += 1
            else:
                failed += 1

        logger.info(f"Fetch complete: {successful} successful, {failed} failed")
        return results

    def store_data(self, data: pd.DataFrame) -> None:
        """
        Store DataFrame data in the SQLite database.

        Args:
            data: DataFrame with price data.
        """
        if self.conn is None:
            self.conn = sqlite3.connect(self.db_name)

        data_to_store = pd.DataFrame()
        data_to_store['Date'] = data['Date']
        data_to_store['Open'] = data['Open'] if 'Open' in data.columns else None
        data_to_store['High'] = data['High'] if 'High' in data.columns else None
        data_to_store['Low'] = data['Low'] if 'Low' in data.columns else None
        data_to_store['Close'] = data['Close'] if 'Close' in data.columns else None
        data_to_store['Volume'] = data['Volume'] if 'Volume' in data.columns else None
        data_to_store['Ticker'] = data['Ticker']
        data_to_store['FetchedAt'] = data.get('FetchedAt', datetime.now().isoformat())

        data_to_store.to_sql('prices', self.conn, if_exists='append', index=False)
        logger.info(f"Stored {len(data_to_store)} records for {data['Ticker'].iloc[0]}")

    def store_multiple(self, data_dict: Dict[str, pd.DataFrame]) -> int:
        """
        Store data for multiple tickers.

        Args:
            data_dict: Dictionary mapping ticker to DataFrame.

        Returns:
            Number of tickers successfully stored.
        """
        stored = 0
        for ticker, data in data_dict.items():
            try:
                self.store_data(data)
                stored += 1
            except Exception as e:
                logger.error(f"Error storing data for {ticker}: {e}")
        return stored

    def compress_database(self, output_filename: Optional[str] = None) -> str:
        """
        Compress the SQLite database to a .dat file using gzip.

        Args:
            output_filename: Optional custom output filename.

        Returns:
            Path to the compressed file.
        """
        if self.conn:
            self.conn.close()
            self.conn = None

        if output_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_filename = f"yfinance_{timestamp}.dat"

        output_path = os.path.join(self.data_dir, output_filename)

        # Ensure directory exists
        os.makedirs(self.data_dir, exist_ok=True)

        with open(self.db_name, "rb") as f_in:
            with gzip.open(output_path, "wb") as f_out:
                f_out.writelines(f_in)

        logger.info(f"Database compressed to {output_path}")

        # Clean up the temporary database file
        if os.path.exists(self.db_name):
            os.remove(self.db_name)
            logger.info(f"Removed temporary database {self.db_name}")

        return output_path

    def compress_to_single_dat(self) -> str:
        """
        Compress database to the main yfinance.dat file (overwrite).

        Returns:
            Path to the compressed file.
        """
        return self.compress_database("yfinance.dat")

    def get_summary(self, data_dict: Dict[str, pd.DataFrame]) -> Dict[str, Any]:
        """
        Get summary statistics for fetched data.

        Args:
            data_dict: Dictionary mapping ticker to DataFrame.

        Returns:
            Dictionary with summary statistics.
        """
        total_records = sum(len(df) for df in data_dict.values())
        tickers_fetched = list(data_dict.keys())

        return {
            "total_tickers": len(tickers_fetched),
            "total_records": total_records,
            "tickers": tickers_fetched,
            "fetched_at": datetime.now().isoformat(),
        }

    def close(self) -> None:
        """Close the database connection."""
        if self.conn:
            self.conn.close()
            self.conn = None
