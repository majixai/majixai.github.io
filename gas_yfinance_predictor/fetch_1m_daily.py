#!/usr/bin/env python3
"""
Daily 1-minute data fetcher - optimized with Cython, C extensions, and concurrent processing.
Runs at 5 PM PST daily via cron/systemd to update 1-minute data for all tickers.
"""

import os
import sys
import sqlite3
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import logging
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import ctypes
import signal

# Try to import compiled modules
try:
    from data_processor import TickerDataProcessor
    CYTHON_AVAILABLE = True
except ImportError:
    CYTHON_AVAILABLE = False

# Try to load C library
try:
    c_lib = ctypes.CDLL('./ticker_analyzer.so')
    C_LIB_AVAILABLE = True
except OSError:
    C_LIB_AVAILABLE = False

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class DailyTickerUpdater:
    """Daily 1-minute data updater with multi-language optimization."""
    
    def __init__(self, data_file='DATA.txt', db_dir='dbs', max_workers=20):
        self.data_file = data_file
        self.db_dir = db_dir
        self.max_workers = max_workers
        self.tickers = []
        self.db_path = os.path.join(db_dir, 'ticker_data_1m.db')
        self.db_lock = threading.Lock()
        self.shutdown_flag = threading.Event()
        
        # Initialize Cython processor
        if CYTHON_AVAILABLE:
            self.processor = TickerDataProcessor()
            logger.info("Cython processor loaded")
        else:
            self.processor = None
            logger.warning("Cython processor not available")
        
        # Setup signal handlers
        signal.signal(signal.SIGTERM, self.signal_handler)
        signal.signal(signal.SIGINT, self.signal_handler)
        
        Path(self.db_dir).mkdir(parents=True, exist_ok=True)
    
    def signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully."""
        logger.info(f"Received signal {signum}, shutting down...")
        self.shutdown_flag.set()
    
    def load_tickers(self):
        """Load tickers from DATA.txt."""
        logger.info(f"Loading tickers from {self.data_file}")
        try:
            with open(self.data_file, 'r') as f:
                self.tickers = [
                    line.strip() 
                    for line in f 
                    if line.strip() and 
                    not ' ' in line.strip() and
                    line.strip().replace('.', '').replace('-', '').isalnum()
                ]
            # Remove duplicates
            self.tickers = list(dict.fromkeys(self.tickers))
            logger.info(f"Loaded {len(self.tickers)} unique tickers")
        except FileNotFoundError:
            logger.error(f"File {self.data_file} not found")
            raise
    
    def fetch_1m_data(self, ticker):
        """Fetch 1-minute data for last 7 days for a single ticker."""
        if self.shutdown_flag.is_set():
            return None
        
        try:
            stock = yf.Ticker(ticker)
            df = stock.history(period='7d', interval='1m')
            
            if not df.empty:
                return (ticker, df, True)
            else:
                logger.warning(f"No data for {ticker}")
                return (ticker, None, False)
                
        except Exception as e:
            logger.error(f"Error fetching {ticker}: {str(e)}")
            return (ticker, None, False)
    
    def store_data(self, ticker, df):
        """Store data in database with thread safety."""
        if df is None or df.empty:
            return False
        
        try:
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
            
            # Thread-safe database operation
            with self.db_lock:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                # Delete old data for this ticker (keep only last 7 days)
                cutoff_date = (datetime.now() - timedelta(days=7)).strftime('%Y-%m-%d %H:%M:%S')
                cursor.execute(
                    "DELETE FROM ticker_data_1m WHERE ticker = ? AND datetime < ?",
                    (ticker, cutoff_date)
                )
                
                # Insert new data
                cursor.executemany('''
                    INSERT OR REPLACE INTO ticker_data_1m 
                    (ticker, datetime, open, high, low, close, volume, adj_close)
                    VALUES (:ticker, :datetime, :open, :high, :low, :close, :volume, :adj_close)
                ''', data_to_insert)
                
                conn.commit()
                conn.close()
            
            logger.info(f"Updated {len(data_to_insert)} records for {ticker}")
            return True
            
        except Exception as e:
            logger.error(f"Error storing {ticker}: {str(e)}")
            return False
    
    def update_all_tickers(self):
        """Update all tickers concurrently."""
        start_time = datetime.now()
        logger.info(f"Starting daily update at {start_time}")
        logger.info(f"Processing {len(self.tickers)} tickers with {self.max_workers} workers")
        
        stats = {'success': 0, 'failed': 0, 'total_records': 0}
        completed = 0
        
        with ThreadPoolExecutor(max_workers=self.max_workers) as executor:
            # Submit all tasks
            futures = {
                executor.submit(self.fetch_1m_data, ticker): ticker 
                for ticker in self.tickers
            }
            
            # Process results
            for future in as_completed(futures):
                if self.shutdown_flag.is_set():
                    logger.warning("Shutdown requested, cancelling remaining tasks")
                    break
                
                ticker = futures[future]
                try:
                    result = future.result()
                    if result:
                        tick, df, success = result
                        if success and df is not None:
                            if self.store_data(tick, df):
                                stats['success'] += 1
                                stats['total_records'] += len(df)
                            else:
                                stats['failed'] += 1
                        else:
                            stats['failed'] += 1
                    
                    completed += 1
                    
                    # Progress update every 20 tickers
                    if completed % 20 == 0:
                        elapsed = (datetime.now() - start_time).total_seconds()
                        rate = completed / elapsed if elapsed > 0 else 0
                        eta = (len(self.tickers) - completed) / rate if rate > 0 else 0
                        
                        logger.info(
                            f"Progress: {completed}/{len(self.tickers)} "
                            f"({completed/len(self.tickers)*100:.1f}%) | "
                            f"Rate: {rate:.2f} tickers/sec | ETA: {eta/60:.1f} min"
                        )
                
                except Exception as e:
                    logger.error(f"Error processing {ticker}: {str(e)}")
                    stats['failed'] += 1
                    completed += 1
        
        # Final statistics
        elapsed_total = (datetime.now() - start_time).total_seconds()
        logger.info("="*60)
        logger.info("Daily Update Complete")
        logger.info("="*60)
        logger.info(f"Total time: {elapsed_total/60:.2f} minutes")
        logger.info(f"Success: {stats['success']}")
        logger.info(f"Failed: {stats['failed']}")
        logger.info(f"Total records: {stats['total_records']:,}")
        logger.info(f"Average rate: {len(self.tickers)/elapsed_total:.2f} tickers/sec")
        logger.info("="*60)
        
        return stats
    
    def vacuum_database(self):
        """Vacuum database to reclaim space."""
        logger.info("Vacuuming database...")
        try:
            conn = sqlite3.connect(self.db_path)
            conn.execute("VACUUM")
            conn.close()
            
            size_mb = os.path.getsize(self.db_path) / (1024 * 1024)
            logger.info(f"Database size after vacuum: {size_mb:.2f} MB")
        except Exception as e:
            logger.error(f"Vacuum failed: {str(e)}")


def main():
    """Main execution."""
    logger.info("="*60)
    logger.info("Daily 1-Minute Data Updater Started")
    logger.info(f"Timestamp: {datetime.now()}")
    logger.info(f"Cython available: {CYTHON_AVAILABLE}")
    logger.info(f"C library available: {C_LIB_AVAILABLE}")
    logger.info("="*60)
    
    updater = DailyTickerUpdater(max_workers=20)
    
    try:
        # Load tickers
        updater.load_tickers()
        
        # Update all tickers
        stats = updater.update_all_tickers()
        
        # Vacuum database
        updater.vacuum_database()
        
        # Exit with appropriate code
        if stats['failed'] == 0:
            logger.info("All tickers updated successfully")
            sys.exit(0)
        elif stats['success'] > 0:
            logger.warning(f"Partial success: {stats['failed']} failures")
            sys.exit(1)
        else:
            logger.error("All ticker updates failed")
            sys.exit(2)
            
    except Exception as e:
        logger.error(f"Fatal error: {str(e)}", exc_info=True)
        sys.exit(3)


if __name__ == '__main__':
    main()
