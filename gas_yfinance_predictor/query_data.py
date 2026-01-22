#!/usr/bin/env python3
"""
Query yfinance data from compressed databases.
"""

import sqlite3
import pandas as pd
import os
from datetime import datetime


class YFinanceDataQuery:
    """Query yfinance data from databases."""
    
    def __init__(self, db_dir='dbs'):
        self.db_dir = db_dir
        self.db_1m = os.path.join(db_dir, 'ticker_data_1m.db')
        self.db_1h = os.path.join(db_dir, 'ticker_data_1h.db')
        self.db_1d = os.path.join(db_dir, 'ticker_data_1d.db')
    
    def get_1m_data(self, ticker):
        """Get 1-minute data for a ticker."""
        conn = sqlite3.connect(self.db_1m)
        query = """
            SELECT datetime, open, high, low, close, volume, adj_close
            FROM ticker_data_1m
            WHERE ticker = ?
            ORDER BY datetime ASC
        """
        df = pd.read_sql_query(query, conn, params=(ticker,))
        conn.close()
        
        if not df.empty:
            df['datetime'] = pd.to_datetime(df['datetime'])
            df.set_index('datetime', inplace=True)
        
        return df
    
    def get_1h_data(self, ticker):
        """Get 1-hour data for a ticker."""
        conn = sqlite3.connect(self.db_1h)
        query = """
            SELECT datetime, open, high, low, close, volume, adj_close
            FROM ticker_data_1h
            WHERE ticker = ?
            ORDER BY datetime ASC
        """
        df = pd.read_sql_query(query, conn, params=(ticker,))
        conn.close()
        
        if not df.empty:
            df['datetime'] = pd.to_datetime(df['datetime'])
            df.set_index('datetime', inplace=True)
        
        return df
    
    def get_1d_data(self, ticker):
        """Get 1-day data for a ticker."""
        conn = sqlite3.connect(self.db_1d)
        query = """
            SELECT datetime, open, high, low, close, volume, adj_close
            FROM ticker_data_1d
            WHERE ticker = ?
            ORDER BY datetime ASC
        """
        df = pd.read_sql_query(query, conn, params=(ticker,))
        conn.close()
        
        if not df.empty:
            df['datetime'] = pd.to_datetime(df['datetime'])
            df.set_index('datetime', inplace=True)
        
        return df
    
    def get_all_tickers(self, interval='1d'):
        """Get list of all available tickers for a specific interval."""
        if interval == '1m':
            db_path = self.db_1m
            table = 'ticker_data_1m'
        elif interval == '1h':
            db_path = self.db_1h
            table = 'ticker_data_1h'
        else:
            db_path = self.db_1d
            table = 'ticker_data_1d'
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        cursor.execute(f"SELECT DISTINCT ticker FROM {table} ORDER BY ticker")
        tickers = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return tickers
    
    def get_latest_price(self, ticker, interval='1d'):
        """Get the latest price for a ticker."""
        if interval == '1m':
            db_path = self.db_1m
            table = 'ticker_data_1m'
        elif interval == '1h':
            db_path = self.db_1h
            table = 'ticker_data_1h'
        else:
            db_path = self.db_1d
            table = 'ticker_data_1d'
        
        conn = sqlite3.connect(db_path)
        query = f"""
            SELECT datetime, close, volume
            FROM {table}
            WHERE ticker = ?
            ORDER BY datetime DESC
            LIMIT 1
        """
        cursor = conn.cursor()
        cursor.execute(query, (ticker,))
        result = cursor.fetchone()
        conn.close()
        
        if result:
            return {
                'datetime': result[0],
                'close': result[1],
                'volume': result[2]
            }
        return None
    
    def get_price_change(self, ticker, interval='1d'):
        """Get price change percentage for a ticker."""
        df = self.get_1d_data(ticker)
        
        if len(df) >= 2:
            latest_close = df['close'].iloc[-1]
            previous_close = df['close'].iloc[-2]
            change = ((latest_close - previous_close) / previous_close) * 100
            
            return {
                'ticker': ticker,
                'latest_close': latest_close,
                'previous_close': previous_close,
                'change_percent': change,
                'datetime': df.index[-1]
            }
        
        return None
    
    def get_multiple_tickers_data(self, tickers, interval='1d'):
        """Get data for multiple tickers."""
        if interval == '1m':
            db_path = self.db_1m
            table = 'ticker_data_1m'
        elif interval == '1h':
            db_path = self.db_1h
            table = 'ticker_data_1h'
        else:
            db_path = self.db_1d
            table = 'ticker_data_1d'
        
        conn = sqlite3.connect(db_path)
        
        # Create placeholder string for SQL IN clause
        placeholders = ','.join(['?' for _ in tickers])
        query = f"""
            SELECT ticker, datetime, open, high, low, close, volume, adj_close
            FROM {table}
            WHERE ticker IN ({placeholders})
            ORDER BY ticker, datetime ASC
        """
        
        df = pd.read_sql_query(query, conn, params=tickers)
        conn.close()
        
        if not df.empty:
            df['datetime'] = pd.to_datetime(df['datetime'])
        
        return df


# Example usage
if __name__ == '__main__':
    query = YFinanceDataQuery()
    
    print("Available tickers (1d):")
    tickers = query.get_all_tickers('1d')
    print(f"Total: {len(tickers)}")
    print(f"Sample: {tickers[:10]}")
    
    # Example: Get data for AAPL
    if 'AAPL' in tickers:
        print("\n" + "="*60)
        print("AAPL - 1 Day Data (Last 10 rows):")
        print("="*60)
        df = query.get_1d_data('AAPL')
        print(df.tail(10))
        
        print("\n" + "="*60)
        print("AAPL - Latest Price:")
        print("="*60)
        latest = query.get_latest_price('AAPL', '1d')
        print(latest)
        
        print("\n" + "="*60)
        print("AAPL - Price Change:")
        print("="*60)
        change = query.get_price_change('AAPL')
        print(change)
