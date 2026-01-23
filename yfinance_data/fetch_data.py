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
    
    conn = sqlite3.connect(DB_NAME)
    successful = 0
    failed = 0
    failed_tickers = []
    
    for i, ticker in enumerate(TICKERS, 1):
        try:
            logger.info(f'[{i}/{len(TICKERS)}] Fetching {ticker}...')
            data = yf.download(ticker, period="1y", interval="1d", progress=False)
            
            if data.empty:
                logger.warning(f'  ⚠ No data returned for {ticker}')
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
            logger.info(f'  ✓ Stored {len(data_to_store)} rows for {ticker}')
            successful += 1
            
            # Log progress every 50 tickers
            if i % 50 == 0:
                logger.info(f'Progress: {i}/{len(TICKERS)} ({i/len(TICKERS)*100:.1f}%) - Success: {successful}, Failed: {failed}')
                
        except Exception as e:
            logger.error(f'  ✗ Error fetching {ticker}: {str(e)}')
            failed += 1
            failed_tickers.append(ticker)
    
    conn.close()
    
    logger.info('='*60)
    logger.info('FETCH SUMMARY')
    logger.info('='*60)
    logger.info(f'Total tickers: {len(TICKERS)}')
    logger.info(f'Successful: {successful}')
    logger.info(f'Failed: {failed}')
    if failed_tickers:
        logger.info(f'Failed tickers: {", ".join(failed_tickers[:20])}{"..." if len(failed_tickers) > 20 else ""}')
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
