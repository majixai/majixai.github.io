#!/usr/bin/env python3
"""
YFinance Background Data Updater
Designed to run in GitHub Actions or locally
Handles errors gracefully and creates backups
"""

import yfinance as yf
import json
import pickle
import gzip
import os
import sys
from datetime import datetime, timedelta
from pathlib import Path
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('logs/update.log', mode='a')
    ]
)
logger = logging.getLogger(__name__)

# List of indices to track
INDICES = {
    '^GSPC': 'S&P 500',
    '^DJI': 'Dow Jones',
    '^IXIC': 'NASDAQ',
    '^RUT': 'Russell 2000',
    '^VIX': 'VIX',
    '^TNX': '10-Year Treasury',
    '^FTSE': 'FTSE 100',
    '^GDAXI': 'DAX',
    '^N225': 'Nikkei 225',
    '^HSI': 'Hang Seng'
}

class YFinanceUpdater:
    def __init__(self, output_dir='./'):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        # Create subdirectories
        (self.output_dir / 'data').mkdir(exist_ok=True)
        (self.output_dir / 'logs').mkdir(exist_ok=True)
        (self.output_dir / 'backups').mkdir(exist_ok=True)
        
        self.stats = {
            'success': 0,
            'failed': 0,
            'skipped': 0,
            'errors': []
        }
    
    def backup_existing_data(self, filename):
        """Create a backup of existing data file"""
        filepath = self.output_dir / filename
        if filepath.exists():
            backup_name = f"{filename}.backup.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
            backup_path = self.output_dir / 'backups' / backup_name
            
            try:
                import shutil
                shutil.copy2(filepath, backup_path)
                logger.info(f"Created backup: {backup_name}")
                
                # Keep only last 5 backups
                backups = sorted((self.output_dir / 'backups').glob(f"{filename}.backup.*"))
                for old_backup in backups[:-5]:
                    old_backup.unlink()
                    logger.debug(f"Deleted old backup: {old_backup.name}")
            except Exception as e:
                logger.warning(f"Failed to create backup: {e}")
    
    def fetch_with_retry(self, ticker_symbol, max_retries=3):
        """Fetch data with retry logic"""
        for attempt in range(max_retries):
            try:
                ticker = yf.Ticker(ticker_symbol)
                
                # Get different time periods
                data_1m = ticker.history(period='1d', interval='1m')
                data_5m = ticker.history(period='5d', interval='5m')
                data_1h = ticker.history(period='1mo', interval='1h')
                data_1d = ticker.history(period='1y', interval='1d')
                
                # Get current info
                info = ticker.info
                
                return {
                    '1m': data_1m,
                    '5m': data_5m,
                    '1h': data_1h,
                    '1d': data_1d,
                    'info': info
                }
            except Exception as e:
                logger.warning(f"Attempt {attempt + 1}/{max_retries} failed for {ticker_symbol}: {e}")
                if attempt < max_retries - 1:
                    import time
                    time.sleep(2 ** attempt)  # Exponential backoff
                else:
                    raise
        return None
    
    def process_dataframe(self, df):
        """Process DataFrame for JSON serialization"""
        if df is None or df.empty:
            return None
        
        # Reset index to make Date a column
        df = df.reset_index()
        
        # Convert to dict
        data_dict = df.to_dict('records')
        
        # Convert Timestamps and handle NaN
        for record in data_dict:
            for key, value in list(record.items()):
                if hasattr(value, 'strftime'):  # Timestamp
                    record[key] = value.strftime('%Y-%m-%d %H:%M:%S%z')
                elif isinstance(value, float):
                    import math
                    if math.isnan(value) or math.isinf(value):
                        record[key] = None
        
        return data_dict
    
    def calculate_summary(self, data_1d):
        """Calculate summary statistics"""
        if data_1d is None or data_1d.empty:
            return None
        
        try:
            current_price = float(data_1d['Close'].iloc[-1])
            open_price = float(data_1d['Open'].iloc[0])
            high_price = float(data_1d['High'].max())
            low_price = float(data_1d['Low'].min())
            volume = int(data_1d['Volume'].sum())
            
            change = current_price - open_price
            change_pct = (change / open_price * 100) if open_price != 0 else 0
            
            return {
                'current_price': current_price,
                'open': open_price,
                'high': high_price,
                'low': low_price,
                'volume': volume,
                'change': change,
                'change_pct': change_pct,
                'last_update': datetime.now().isoformat()
            }
        except Exception as e:
            logger.error(f"Error calculating summary: {e}")
            return None
    
    def fetch_index_data(self, symbol, name):
        """Fetch data for a single index"""
        logger.info(f"Fetching {name} ({symbol})...")
        
        try:
            data = self.fetch_with_retry(symbol)
            
            if data is None:
                self.stats['failed'] += 1
                self.stats['errors'].append(f"{symbol}: No data returned")
                return None
            
            # Process each timeframe
            result = {
                'symbol': symbol,
                'name': name,
                'timeframes': {}
            }
            
            for timeframe, df in data.items():
                if timeframe == 'info':
                    result['info'] = data['info']
                    continue
                
                processed = self.process_dataframe(df)
                if processed:
                    result['timeframes'][timeframe] = processed
            
            # Add summary
            result['summary'] = self.calculate_summary(data.get('1d'))
            result['last_update'] = datetime.now().isoformat()
            
            logger.info(f"  ✓ Successfully fetched {name}")
            if result['summary']:
                logger.info(f"    Price: ${result['summary']['current_price']:.2f} "
                          f"({result['summary']['change_pct']:+.2f}%)")
            
            self.stats['success'] += 1
            return result
            
        except Exception as e:
            logger.error(f"  ✗ Error fetching {symbol}: {str(e)}")
            self.stats['failed'] += 1
            self.stats['errors'].append(f"{symbol}: {str(e)}")
            return None
    
    def update_all_indices(self):
        """Fetch and update all indices"""
        logger.info("=" * 70)
        logger.info("YFinance Background Data Updater - Starting")
        logger.info("=" * 70)
        logger.info(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info(f"Indices to fetch: {len(INDICES)}")
        logger.info("")
        
        # Backup existing data
        self.backup_existing_data('index_1m.json')
        
        all_data = {}
        
        for symbol, name in INDICES.items():
            result = self.fetch_index_data(symbol, name)
            if result:
                all_data[symbol] = result
            logger.info("")
        
        # Save to JSON
        output_file = self.output_dir / 'index_1m.json'
        try:
            with open(output_file, 'w') as f:
                json.dump(all_data, f, indent=2)
            logger.info(f"✓ Saved JSON: {output_file}")
        except Exception as e:
            logger.error(f"✗ Failed to save JSON: {e}")
        
        # Save compressed version (.dat)
        dat_file = self.output_dir / 'index_1m.dat'
        try:
            with gzip.open(dat_file, 'wb') as f:
                f.write(json.dumps(all_data).encode('utf-8'))
            logger.info(f"✓ Saved compressed: {dat_file}")
        except Exception as e:
            logger.error(f"✗ Failed to save compressed: {e}")
        
        # Save metadata
        metadata = {
            'last_update': datetime.now().isoformat(),
            'indices_count': len(INDICES),
            'successful': self.stats['success'],
            'failed': self.stats['failed'],
            'errors': self.stats['errors']
        }
        
        metadata_file = self.output_dir / 'logs' / 'metadata.json'
        try:
            with open(metadata_file, 'w') as f:
                json.dump(metadata, f, indent=2)
            logger.info(f"✓ Saved metadata: {metadata_file}")
        except Exception as e:
            logger.error(f"✗ Failed to save metadata: {e}")
        
        # Print summary
        logger.info("")
        logger.info("=" * 70)
        logger.info("Update Complete!")
        logger.info(f"  Success: {self.stats['success']}")
        logger.info(f"  Failed: {self.stats['failed']}")
        logger.info(f"  Skipped: {self.stats['skipped']}")
        
        if self.stats['errors']:
            logger.warning("  Errors:")
            for error in self.stats['errors']:
                logger.warning(f"    - {error}")
        
        logger.info("=" * 70)
        
        return all_data

def main():
    """Main entry point"""
    import argparse
    
    parser = argparse.ArgumentParser(description='YFinance Background Data Updater')
    parser.add_argument('--output-dir', default='./', help='Output directory for data files')
    parser.add_argument('--single', help='Fetch single index (e.g., ^GSPC)')
    args = parser.parse_args()
    
    updater = YFinanceUpdater(output_dir=args.output_dir)
    
    if args.single:
        symbol = args.single.upper()
        if not symbol.startswith('^'):
            symbol = '^' + symbol
        
        if symbol in INDICES:
            result = updater.fetch_index_data(symbol, INDICES[symbol])
            if result:
                output_file = updater.output_dir / f"{symbol.replace('^', '')}_data.json"
                with open(output_file, 'w') as f:
                    json.dump({symbol: result}, f, indent=2)
                logger.info(f"Saved to: {output_file}")
        else:
            logger.error(f"Unknown symbol: {symbol}")
            logger.info(f"Available: {', '.join(INDICES.keys())}")
            sys.exit(1)
    else:
        updater.update_all_indices()

if __name__ == "__main__":
    main()
