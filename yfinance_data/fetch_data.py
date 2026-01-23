import yfinance as yf
import pandas as pd
import sqlite3
import gzip
import os
import argparse
import requests
import json
import logging
import sys
from datetime import datetime

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    stream=sys.stdout
)
logger = logging.getLogger(__name__)

# Load tickers from file or use default
def load_tickers():
    ticker_file = 'yfinance_data/ticker_list.txt'
    if os.path.exists(ticker_file):
        logger.info(f'Loading tickers from {ticker_file}...')
        with open(ticker_file, 'r') as f:
            tickers = [line.strip() for line in f if line.strip()]
        logger.info(f'✓ Loaded {len(tickers)} tickers from file')
        return tickers
    else:
        logger.warning(f'Ticker file not found, using default list')
        return [
            "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "JPM", "V", "JNJ", "WMT", "PG"
        ]

TICKERS = load_tickers()

DB_NAME = "yfinance.db"
COMPRESSED_DB_NAME = "yfinance_data/yfinance.dat"

def create_database():
    logger.info('='*60)
    logger.info('CREATING DATABASE')
    logger.info('='*60)
    logger.info(f'Database name: {DB_NAME}')
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS prices")
    logger.info('✓ Dropped existing prices table')
    c.execute("""
        CREATE TABLE prices (
            Date TEXT,
            Open REAL,
            High REAL,
            Low REAL,
            Close REAL,
            Volume INTEGER,
            Ticker TEXT
        )
    """)
    logger.info('✓ Created new prices table')
    conn.commit()
    conn.close()
    logger.info('✓ Database created successfully')

def fetch_and_store_data():
    logger.info('='*60)
    logger.info('FETCHING AND STORING DATA')
    logger.info('='*60)
    logger.info(f'Total tickers to fetch: {len(TICKERS)}')
    logger.info(f'Started at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    logger.info('')
    logger.info('Progress Legend:')
    logger.info('  ✓ = Success')
    logger.info('  ⚠ = No data available')
    logger.info('  ✗ = Error occurred')
    logger.info('')
    
    conn = sqlite3.connect(DB_NAME)
    successful = 0
    failed = 0
    failed_tickers = []
    start_time = datetime.now()
    
    for i, ticker in enumerate(TICKERS, 1):
        # Calculate progress
        progress_pct = (i / len(TICKERS)) * 100
        elapsed = (datetime.now() - start_time).total_seconds()
        avg_time_per_ticker = elapsed / i if i > 0 else 0
        remaining_tickers = len(TICKERS) - i
        estimated_remaining = avg_time_per_ticker * remaining_tickers
        
        try:
            logger.info(f'[{i:4d}/{len(TICKERS)}] ({progress_pct:5.1f}%) Fetching {ticker:8s}...')
            data = yf.download(ticker, period="1y", interval="1d", progress=False)
            
            if data.empty:
                logger.info(f'  ⚠ No data available')
                failed += 1
                failed_tickers.append(ticker)
                continue
                
            data.reset_index(inplace=True)
            data['Ticker'] = ticker
            data['Date'] = data['Date'].astype(str)

            data_to_store = pd.DataFrame()
            data_to_store['Date'] = data['Date']
            data_to_store['Open'] = data['Open']
            data_to_store['High'] = data['High']
            data_to_store['Low'] = data['Low']
            data_to_store['Close'] = data['Close']
            data_to_store['Volume'] = data['Volume']
            data_to_store['Ticker'] = data['Ticker']

            data_to_store.to_sql('prices', conn, if_exists='append', index=False)
            logger.info(f'  ✓ Stored {len(data_to_store)} rows')
            successful += 1
            
            # Detailed progress every 50 tickers
            if i % 50 == 0:
                logger.info('')
                logger.info('-' * 60)
                logger.info(f'📊 PROGRESS UPDATE: {i}/{len(TICKERS)} tickers processed')
                logger.info(f'   Success: {successful} | Failed: {failed}')
                logger.info(f'   Elapsed: {int(elapsed)}s | Avg: {avg_time_per_ticker:.2f}s/ticker')
                logger.info(f'   Estimated remaining: {int(estimated_remaining)}s ({int(estimated_remaining/60)}m {int(estimated_remaining%60)}s)')
                logger.info('-' * 60)
                logger.info('')
                
        except Exception as e:
            logger.info(f'  ✗ Error: {str(e)[:50]}')
            failed += 1
            failed_tickers.append(ticker)
    
    conn.close()
    
    total_time = (datetime.now() - start_time).total_seconds()
    
    logger.info('')
    logger.info('='*60)
    logger.info('FETCH SUMMARY')
    logger.info('='*60)
    logger.info(f'Total tickers: {len(TICKERS)}')
    logger.info(f'✓ Successful: {successful} ({successful/len(TICKERS)*100:.1f}%)')
    logger.info(f'✗ Failed: {failed} ({failed/len(TICKERS)*100:.1f}%)')
    logger.info(f'Total time: {int(total_time)}s ({int(total_time/60)}m {int(total_time%60)}s)')
    logger.info(f'Average: {total_time/len(TICKERS):.2f}s per ticker')
    if failed_tickers:
        logger.info('')
        logger.info(f'Failed tickers ({len(failed_tickers)}):')
        for i in range(0, len(failed_tickers), 10):
            logger.info(f'  {", ".join(failed_tickers[i:i+10])}')
    logger.info(f'Completed at: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')

def compress_database():
    """Compresses the SQLite database using gzip."""
    logger.info('='*60)
    logger.info('COMPRESSING DATABASE')
    logger.info('='*60)
    
    if not os.path.exists(DB_NAME):
        logger.error(f'✗ Database file {DB_NAME} not found!')
        return
    
    original_size = os.path.getsize(DB_NAME)
    logger.info(f'Original database size: {original_size:,} bytes ({original_size/1024/1024:.2f} MB)')
    
    logger.info(f'Compressing to {COMPRESSED_DB_NAME}...')
    with open(DB_NAME, "rb") as f_in:
        with gzip.open(COMPRESSED_DB_NAME, "wb") as f_out:
            f_out.writelines(f_in)
    
    compressed_size = os.path.getsize(COMPRESSED_DB_NAME)
    compression_ratio = (1 - compressed_size/original_size) * 100
    logger.info(f'✓ Compressed database size: {compressed_size:,} bytes ({compressed_size/1024/1024:.2f} MB)')
    logger.info(f'✓ Compression ratio: {compression_ratio:.1f}%')
    logger.info(f'✓ Database compressed to {COMPRESSED_DB_NAME}')
    
    logger.info(f'Removing uncompressed database {DB_NAME}...')
    os.remove(DB_NAME)
    logger.info('✓ Uncompressed database removed')

def send_webhook_notification(url):
    """Sends a POST request to the specified webhook URL."""
    if not url:
        logger.info('No webhook URL specified, skipping notification')
        return
    
    logger.info('='*60)
    logger.info('SENDING WEBHOOK NOTIFICATION')
    logger.info('='*60)
    logger.info(f'Webhook URL: {url}')
    
    try:
        payload = {
            "content": f"Yfinance data update complete. {len(TICKERS)} tickers processed.",
            "username": "Yfinance Bot",
        }
        headers = {"Content-Type": "application/json"}
        response = requests.post(url, data=json.dumps(payload), headers=headers)
        response.raise_for_status()
        logger.info(f"✓ Successfully sent webhook notification")
    except requests.exceptions.RequestException as e:
        logger.error(f"✗ Failed to send webhook notification: {e}")


if __name__ == "__main__":
    logger.info('='*60)
    logger.info('YFINANCE DATA FETCHER')
    logger.info('='*60)
    logger.info(f'Start time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
    logger.info(f'Number of tickers: {len(TICKERS)}')
    
    parser = argparse.ArgumentParser(description="Fetch yfinance data and optionally send a webhook.")
    parser.add_argument("--webhook-url", help="The webhook URL to send a notification to.")
    args = parser.parse_args()

    create_database()
    fetch_and_store_data()
    compress_database()

    if args.webhook_url:
        send_webhook_notification(args.webhook_url)
    
    logger.info('='*60)
    logger.info('ALL OPERATIONS COMPLETED SUCCESSFULLY')
    logger.info('='*60)
    logger.info(f'End time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}')
