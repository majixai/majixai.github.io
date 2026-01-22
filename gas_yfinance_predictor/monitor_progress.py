#!/usr/bin/env python3
"""
Monitor the progress of yfinance data collection.
"""

import sqlite3
import os
from datetime import datetime

def check_database_progress():
    """Check the progress of data collection in databases."""
    
    db_dir = 'dbs'
    databases = [
        ('ticker_data_1m.db', 'ticker_data_1m', '1-minute (7 days)'),
        ('ticker_data_1h.db', 'ticker_data_1h', '1-hour (10 days)'),
        ('ticker_data_1d.db', 'ticker_data_1d', '1-day (2 years)')
    ]
    
    print("="*70)
    print(f"Data Collection Progress - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*70)
    
    for db_file, table_name, description in databases:
        db_path = os.path.join(db_dir, db_file)
        
        if not os.path.exists(db_path):
            print(f"\n{description}:")
            print(f"  Database not found: {db_path}")
            continue
        
        try:
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            
            # Get unique ticker count
            cursor.execute(f"SELECT COUNT(DISTINCT ticker) FROM {table_name}")
            unique_tickers = cursor.fetchone()[0]
            
            # Get total record count
            cursor.execute(f"SELECT COUNT(*) FROM {table_name}")
            total_records = cursor.fetchone()[0]
            
            # Get date range
            cursor.execute(f"SELECT MIN(datetime), MAX(datetime) FROM {table_name}")
            min_date, max_date = cursor.fetchone()
            
            # Get last 5 tickers processed
            cursor.execute(f"""
                SELECT DISTINCT ticker 
                FROM {table_name} 
                ORDER BY created_at DESC 
                LIMIT 5
            """)
            recent_tickers = [row[0] for row in cursor.fetchall()]
            
            # Get file size
            size_mb = os.path.getsize(db_path) / (1024 * 1024)
            
            conn.close()
            
            print(f"\n{description}:")
            print(f"  Database: {db_path}")
            print(f"  File size: {size_mb:.2f} MB")
            print(f"  Unique tickers: {unique_tickers}/343")
            print(f"  Total records: {total_records:,}")
            print(f"  Date range: {min_date} to {max_date}")
            print(f"  Recent tickers: {', '.join(recent_tickers)}")
            print(f"  Progress: {(unique_tickers/343)*100:.1f}%")
            
        except Exception as e:
            print(f"\n{description}:")
            print(f"  Error: {str(e)}")
    
    print("\n" + "="*70)

if __name__ == '__main__':
    check_database_progress()
