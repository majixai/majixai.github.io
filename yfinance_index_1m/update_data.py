#!/usr/bin/env python3
"""
Enhanced YFinance Data Fetcher with Auto-Update
Fetches market data for multiple indices and updates the dashboard
"""

import yfinance as yf
import json
import pickle
import gzip
from datetime import datetime, timedelta
import pandas as pd
import numpy as np

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

def calculate_technical_indicators(df):
    """Calculate various technical indicators"""
    
    # Simple Moving Averages
    df['SMA_20'] = df['Close'].rolling(window=20).mean()
    df['SMA_50'] = df['Close'].rolling(window=50).mean()
    
    # Exponential Moving Averages
    df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
    df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
    
    # RSI (Relative Strength Index)
    delta = df['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    df['RSI'] = 100 - (100 / (1 + rs))
    
    # MACD
    df['MACD'] = df['EMA_12'] - df['EMA_26']
    df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
    df['MACD_Hist'] = df['MACD'] - df['MACD_Signal']
    
    # Bollinger Bands
    df['BB_Middle'] = df['Close'].rolling(window=20).mean()
    bb_std = df['Close'].rolling(window=20).std()
    df['BB_Upper'] = df['BB_Middle'] + (bb_std * 2)
    df['BB_Lower'] = df['BB_Middle'] - (bb_std * 2)
    
    # Stochastic Oscillator
    low_14 = df['Low'].rolling(window=14).min()
    high_14 = df['High'].rolling(window=14).max()
    df['Stoch_K'] = 100 * ((df['Close'] - low_14) / (high_14 - low_14))
    df['Stoch_D'] = df['Stoch_K'].rolling(window=3).mean()
    
    # Volatility (20-day)
    df['Volatility'] = df['Close'].pct_change().rolling(window=20).std()
    
    return df

def fetch_index_data(symbol, period='1d', interval='1m'):
    """Fetch data for a single index"""
    try:
        print(f"Fetching {symbol} ({INDICES.get(symbol, 'Unknown')})...")
        ticker = yf.Ticker(symbol)
        df = ticker.history(period=period, interval=interval)
        
        if df.empty:
            print(f"  ⚠️  No data available for {symbol}")
            return None
        
        # Reset index to make Date a column
        df = df.reset_index()
        
        # Calculate technical indicators
        df = calculate_technical_indicators(df)
        
        # Convert to dict for JSON serialization
        data_dict = df.to_dict('records')
        
        # Convert Timestamp objects to strings
        for record in data_dict:
            if isinstance(record.get('Date'), pd.Timestamp):
                record['Date'] = record['Date'].strftime('%Y-%m-%d %H:%M:%S%z')
            # Replace NaN with None for JSON
            for key, value in record.items():
                if pd.isna(value):
                    record[key] = None
        
        # Calculate summary statistics
        summary = {
            'current_price': float(df['Close'].iloc[-1]),
            'open': float(df['Open'].iloc[0]),
            'high': float(df['High'].max()),
            'low': float(df['Low'].min()),
            'volume': int(df['Volume'].sum()),
            'change': float(df['Close'].iloc[-1] - df['Open'].iloc[0]),
            'change_pct': float((df['Close'].iloc[-1] - df['Open'].iloc[0]) / df['Open'].iloc[0] * 100),
            'volatility': float(df['Volatility'].iloc[-1]) if not pd.isna(df['Volatility'].iloc[-1]) else 0,
            'rsi': float(df['RSI'].iloc[-1]) if not pd.isna(df['RSI'].iloc[-1]) else 50,
            'macd': float(df['MACD'].iloc[-1]) if not pd.isna(df['MACD'].iloc[-1]) else 0,
            'data_points': len(df)
        }
        
        result = {
            'data': data_dict,
            'summary': summary,
            'last_update': datetime.now().isoformat()
        }
        
        print(f"  ✓ Fetched {len(data_dict)} data points for {symbol}")
        print(f"    Price: ${summary['current_price']:.2f} ({summary['change_pct']:+.2f}%)")
        
        return result
        
    except Exception as e:
        print(f"  ✗ Error fetching {symbol}: {str(e)}")
        return None

def update_all_data(output_file='index_1m.json', period='1d', interval='1m'):
    """Fetch and update data for all indices"""
    print("=" * 60)
    print("YFinance Data Fetcher - Multi-Index Update")
    print("=" * 60)
    print(f"Period: {period} | Interval: {interval}")
    print(f"Indices to fetch: {len(INDICES)}")
    print()
    
    all_data = {}
    successful = 0
    failed = 0
    
    for symbol in INDICES.keys():
        result = fetch_index_data(symbol, period, interval)
        if result:
            all_data[symbol] = result
            successful += 1
        else:
            failed += 1
        print()
    
    # Save to JSON
    with open(output_file, 'w') as f:
        json.dump(all_data, f, indent=2)
    
    # Also save compressed version
    with gzip.open(output_file.replace('.json', '.dat'), 'wb') as f:
        f.write(json.dumps(all_data).encode('utf-8'))
    
    print("=" * 60)
    print(f"Update Complete!")
    print(f"Success: {successful} | Failed: {failed}")
    print(f"Data saved to: {output_file}")
    print(f"Compressed saved to: {output_file.replace('.json', '.dat')}")
    print("=" * 60)
    
    return all_data

def fetch_single_index(symbol, output_file=None):
    """Fetch data for a single index"""
    if symbol not in INDICES:
        print(f"Unknown symbol: {symbol}")
        print(f"Available symbols: {', '.join(INDICES.keys())}")
        return None
    
    result = fetch_index_data(symbol)
    
    if result and output_file:
        with open(output_file, 'w') as f:
            json.dump({symbol: result}, f, indent=2)
        print(f"\nData saved to: {output_file}")
    
    return result

if __name__ == "__main__":
    import sys
    
    # Check command line arguments
    if len(sys.argv) > 1:
        symbol = sys.argv[1].upper()
        if not symbol.startswith('^'):
            symbol = '^' + symbol
        
        output = sys.argv[2] if len(sys.argv) > 2 else f"{symbol.replace('^', '')}_data.json"
        fetch_single_index(symbol, output)
    else:
        # Update all indices
        update_all_data()
