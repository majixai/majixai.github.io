#!/usr/bin/env python3
"""
Fetch yfinance data for all tickers with multiple intervals and store in compressed databases.
- 1 minute intervals for 7 days
- 1 hour intervals for 10 days
- 1 day intervals for 2 years

Uses async, parallel, and concurrent processing for faster data collection.
"""

import yfinance as yf
import sqlite3
import pandas as pd
from datetime import datetime, timedelta
import os
import logging
from pathlib import Path
import time
import asyncio
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading
from queue import Queue

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class YFinanceDataCollector:
    """Collect and store yfinance data in compressed SQLite databases with concurrent processing."""
    
    def __init__(self, data_file='DATA.txt', db_dir='dbs', max_workers=10):
        self.data_file = data_file
        self.db_dir = db_dir
        self.tickers = []
        self.max_workers = max_workers
        
        # Create database directory if it doesn't exist
        Path(self.db_dir).mkdir(parents=True, exist_ok=True)
        
        # Database paths
        self.db_1m = os.path.join(self.db_dir, 'ticker_data_1m.db')
        self.db_1h = os.path.join(self.db_dir, 'ticker_data_1h.db')
        self.db_1d = os.path.join(self.db_dir, 'ticker_data_1d.db')
        
        # Thread locks for database operations
        self.db_locks = {
            self.db_1m: threading.Lock(),
            self.db_1h: threading.Lock(),
            self.db_1d: threading.Lock()
        }
        
    def load_tickers(self):
        """Load tickers from DATA.txt file."""
        logger.info(f"Loading tickers from {self.data_file}")
        try:
            with open(self.data_file, 'r') as f:
                # Filter out invalid tickers (company names, etc.)
                self.tickers = [
                    line.strip() 
                    for line in f 
                    if line.strip() and 
                    not ' ' in line.strip() and  # Skip company names with spaces
                    line.strip().replace('.', '').replace('-', '').isalnum()
                ]
            # Remove duplicates while preserving order
            seen = set()
            unique_tickers = []
            for ticker in self.tickers:
                if ticker not in seen:
                    seen.add(ticker)
                    unique_tickers.append(ticker)
            self.tickers = unique_tickers
            logger.info(f"Loaded {len(self.tickers)} unique tickers")
        except FileNotFoundError:
            logger.error(f"File {self.data_file} not found")
            raise
    
    def init_database(self, db_path, table_name):
        """Initialize SQLite database with compression."""
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Create table
        cursor.execute(f'''
            CREATE TABLE IF NOT EXISTS {table_name} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                datetime TEXT NOT NULL,
                open REAL,
                high REAL,
                low REAL,
                close REAL,
                volume INTEGER,
                adj_close REAL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(ticker, datetime)
            )
        ''')
        
        # Create indexes for faster queries
        cursor.execute(f'''
            CREATE INDEX IF NOT EXISTS idx_{table_name}_ticker 
            ON {table_name}(ticker)
        ''')
        
        cursor.execute(f'''
            CREATE INDEX IF NOT EXISTS idx_{table_name}_datetime 
            ON {table_name}(datetime)
        ''')
        
        cursor.execute(f'''
            CREATE INDEX IF NOT EXISTS idx_{table_name}_ticker_datetime 
            ON {table_name}(ticker, datetime)
        ''')
        
        conn.commit()
        conn.close()
        logger.info(f"Initialized database: {db_path}")
    
    def store_data(self, df, ticker, db_path, table_name):
        """Store dataframe in SQLite database with thread safety."""
        if df is None or df.empty:
            logger.warning(f"No data to store for {ticker}")
            return False
        
        try:
            # Prepare data for insertion
            data_to_insert = []
            for idx, row in df.iterrows():
                data_to_insert.append({
                    'ticker': ticker,
                    'datetime': idx.strftime('%Y-%m-%d %H:%M:%S'),
                    'open': float(row['Open']) if pd.notna(row['Open']) else None,
                    'high': float(row['High']) if pd.notna(row['High']) else None,
                    'low': float(row['Low']) if pd.notna(row['Low']) else None,
                    'close': float(row['Close']) if pd.notna(row['Close']) else None,
                    'volume': int(row['Volume']) if pd.notna(row['Volume']) else None,
                    'adj_close': float(row['Adj Close']) if 'Adj Close' in row and pd.notna(row['Adj Close']) else None
                })
            
            # Use lock for thread-safe database operations
            with self.db_locks[db_path]:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                cursor.executemany(f'''
                    INSERT OR REPLACE INTO {table_name} 
                    (ticker, datetime, open, high, low, close, volume, adj_close)
                    VALUES (:ticker, :datetime, :open, :high, :low, :close, :volume, :adj_close)
                ''', data_to_insert)
                conn.commit()
                conn.close()
            
            logger.info(f"Stored {len(data_to_insert)} records for {ticker} in {table_name}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing data for {ticker}: {str(e)}")
            return False
    
    def fetch_and_store_1m(self, ticker):
        """Fetch 1-minute data for 7 days."""
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period='7d', interval='1m')
            
            if not df.empty:
                self.store_data(df, ticker, self.db_1m, 'ticker_data_1m')
                return ('1m', ticker, True, len(df))
            else:
                logger.warning(f"No 1m data returned for {ticker}")
                return ('1m', ticker, False, 0)
                
        except Exception as e:
            logger.error(f"Error fetching 1m data for {ticker}: {str(e)}")
            return ('1m', ticker, False, 0)
    
    def fetch_and_store_1h(self, ticker):
        """Fetch 1-hour data for 10 days."""
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period='10d', interval='1h')
            
            if not df.empty:
                self.store_data(df, ticker, self.db_1h, 'ticker_data_1h')
                return ('1h', ticker, True, len(df))
            else:
                logger.warning(f"No 1h data returned for {ticker}")
                return ('1h', ticker, False, 0)
                
        except Exception as e:
            logger.error(f"Error fetching 1h data for {ticker}: {str(e)}")
            return ('1h', ticker, False, 0)
    
    def fetch_and_store_1d(self, ticker):
        """Fetch 1-day data for 2 years."""
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period='2y', interval='1d')
            
            if not df.empty:
                self.store_data(df, ticker, self.db_1d, 'ticker_data_1d')
                return ('1d', ticker, True, len(df))
            else:
                logger.warning(f"No 1d data returned for {ticker}")
                return ('1d', ticker, False, 0)
                
        except Exception as e:
            logger.error(f"Error fetching 1d data for {ticker}: {str(e)}")
            return ('1d', ticker, False, 0)
    
    def fetch_all_intervals_for_ticker(self, ticker):
        """Fetch all intervals for a single ticker."""
        results = []
        logger.info(f"Processing {ticker}")
        
        # Fetch all three intervals for this ticker
        results.append(self.fetch_and_store_1m(ticker))
        time.sleep(0.1)  # Small delay between intervals
        
        results.append(self.fetch_and_store_1h(ticker))
        time.sleep(0.1)
        
        results.append(self.fetch_and_store_1d(ticker))
        
        return results
    
    def process_all_tickers(self):
        """Process all tickers concurrently using ThreadPoolExecutor."""
        # Initialize databases
        self.init_database(self.db_1m, 'ticker_data_1m')
        self.init_database(self.db_1h, 'ticker_data_1h')
        self.init_database(self.db_1d, 'ticker_data_1d')
        
        total_tickers = len(self.tickers)
        logger.info(f"Processing {total_tickers} tickers with {self.max_workers} concurrent workers")
        
        stats = {
            '1m': {'success': 0, 'failed': 0, 'records': 0},
            '1h': {'success': 0, 'failed': 0, 'records': 0},
            '1d': {'success': 0, 'failed': 0, 'records': 0}
        }
        
        completed = 0
        start_time = time.time()
        
        # Use ThreadPoolExecutor for concurrent processing
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all ticker tasks
            future_to_ticker = {
                executor.submit(self.fetch_all_intervals_for_ticker, ticker): ticker 
                for ticker in self.tickers
            }
            
            # Process completed futures
            for future in as_completed(future_to_ticker):
                ticker = future_to_ticker[future]
                try:
                    results = future.result()
                    
                    # Update statistics
                    for interval, tick, success, record_count in results:
                        if success:
                            stats[interval]['success'] += 1
                            stats[interval]['records'] += record_count
                        else:
                            stats[interval]['failed'] += 1
                    
                    completed += 1
                    
                    # Progress update every 10 tickers
                    if completed % 10 == 0 or completed == total_tickers:
                        elapsed = time.time() - start_time
                        rate = completed / elapsed if elapsed > 0 else 0
                        eta = (total_tickers - completed) / rate if rate > 0 else 0
                        
                        logger.info(f"Progress: {completed}/{total_tickers} ({completed/total_tickers*100:.1f}%) | "
                                  f"Rate: {rate:.2f} tickers/sec | ETA: {eta/60:.1f} min")
                
                except Exception as e:
                    logger.error(f"Error processing {ticker}: {str(e)}")
                    completed += 1
        
        # Print summary
        elapsed_total = time.time() - start_time
        logger.info(f"\n{'='*60}")
        logger.info("Processing Complete - Summary:")
        logger.info(f"{'='*60}")
        logger.info(f"Total tickers processed: {total_tickers}")
        logger.info(f"Total time: {elapsed_total/60:.2f} minutes")
        logger.info(f"Average rate: {total_tickers/elapsed_total:.2f} tickers/sec")
        logger.info(f"\n1-minute data (7 days):")
        logger.info(f"  Success: {stats['1m']['success']}")
        logger.info(f"  Failed:  {stats['1m']['failed']}")
        logger.info(f"  Records: {stats['1m']['records']:,}")
        logger.info(f"\n1-hour data (10 days):")
        logger.info(f"  Success: {stats['1h']['success']}")
        logger.info(f"  Failed:  {stats['1h']['failed']}")
        logger.info(f"  Records: {stats['1h']['records']:,}")
        logger.info(f"\n1-day data (2 years):")
        logger.info(f"  Success: {stats['1d']['success']}")
        logger.info(f"  Failed:  {stats['1d']['failed']}")
        logger.info(f"  Records: {stats['1d']['records']:,}")
        logger.info(f"\nDatabase files:")
        logger.info(f"  {self.db_1m}")
        logger.info(f"  {self.db_1h}")
        logger.info(f"  {self.db_1d}")
        
        # Run VACUUM to compress databases
        self.compress_databases()
    
    def compress_databases(self):
        """Compress databases using VACUUM."""
        logger.info("\nCompressing databases...")
        
        for db_path in [self.db_1m, self.db_1h, self.db_1d]:
            try:
                conn = sqlite3.connect(db_path)
                conn.execute("VACUUM")
                conn.close()
                
                # Get file size
                size_mb = os.path.getsize(db_path) / (1024 * 1024)
                logger.info(f"Compressed {db_path}: {size_mb:.2f} MB")
            except Exception as e:
                logger.error(f"Error compressing {db_path}: {str(e)}")
    
    def get_database_stats(self):
        """Get statistics about the databases."""
        logger.info("\n" + "="*60)
        logger.info("Database Statistics:")
        logger.info("="*60)
        
        for db_path, table_name in [
            (self.db_1m, 'ticker_data_1m'),
            (self.db_1h, 'ticker_data_1h'),
            (self.db_1d, 'ticker_data_1d')
        ]:
            try:
                conn = sqlite3.connect(db_path)
                cursor = conn.cursor()
                
                # Get row count
                cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
                row_count = cursor.fetchone()[0]
                
                # Get unique tickers
                cursor.execute(f"SELECT COUNT(DISTINCT ticker) FROM {table_name}")
                unique_tickers = cursor.fetchone()[0]
                
                # Get date range
                cursor.execute(f"SELECT MIN(datetime), MAX(datetime) FROM {table_name}")
                min_date, max_date = cursor.fetchone()
                
                # Get file size
                size_mb = os.path.getsize(db_path) / (1024 * 1024)
                
                conn.close()
                
                logger.info(f"\n{table_name}:")
                logger.info(f"  File: {db_path}")
                logger.info(f"  Size: {size_mb:.2f} MB")
                logger.info(f"  Total records: {row_count:,}")
                logger.info(f"  Unique tickers: {unique_tickers}")
                logger.info(f"  Date range: {min_date} to {max_date}")
                
            except Exception as e:
                logger.error(f"Error getting stats for {db_path}: {str(e)}")


def main():
    """Main execution function."""
    # Increase max_workers for faster processing (default: 10)
    # Adjust based on your system and API rate limits
    collector = YFinanceDataCollector(max_workers=20)
    
    # Load tickers
    collector.load_tickers()
    
    # Process all tickers concurrently
    collector.process_all_tickers()
    
    # Show final statistics
    collector.get_database_stats()


if __name__ == '__main__':
    main()
