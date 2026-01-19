#!/usr/bin/env python3
"""
YFinance Index Data Fetcher - 1 Minute Interval
Fetches 1-minute interval data for major market indices
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
import gzip
import os
from datetime import datetime, timedelta
import argparse

# Major market indices
DEFAULT_INDICES = [
    "^GSPC",    # S&P 500
    "^DJI",     # Dow Jones Industrial Average
    "^IXIC",    # NASDAQ Composite
    "^RUT",     # Russell 2000
    "^VIX",     # CBOE Volatility Index
    "^TNX",     # 10-Year Treasury Yield
    "^FTSE",    # FTSE 100
    "^GDAXI",   # DAX
    "^N225",    # Nikkei 225
    "^HSI"      # Hang Seng Index
]

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))
DB_NAME = "index_1m.json"
COMPRESSED_NAME = "index_1m.dat"


def calculate_sma(data, window=20):
    """Calculate Simple Moving Average"""
    return data['Close'].rolling(window=window).mean()


def calculate_ema(data, window=20):
    """Calculate Exponential Moving Average"""
    return data['Close'].ewm(span=window, adjust=False).mean()


def calculate_rsi(data, window=14):
    """Calculate Relative Strength Index"""
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=window).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=window).mean()
    rs = gain / loss
    return 100 - (100 / (1 + rs))


def calculate_macd(data, fast=12, slow=26, signal=9):
    """Calculate MACD indicator"""
    ema_fast = data['Close'].ewm(span=fast, adjust=False).mean()
    ema_slow = data['Close'].ewm(span=slow, adjust=False).mean()
    macd_line = ema_fast - ema_slow
    signal_line = macd_line.ewm(span=signal, adjust=False).mean()
    histogram = macd_line - signal_line
    return macd_line, signal_line, histogram


def calculate_bollinger_bands(data, window=20, num_std=2):
    """Calculate Bollinger Bands"""
    sma = data['Close'].rolling(window=window).mean()
    std = data['Close'].rolling(window=window).std()
    upper = sma + (std * num_std)
    lower = sma - (std * num_std)
    return upper, sma, lower


def calculate_stochastic(data, k_window=14, d_window=3):
    """Calculate Stochastic Oscillator"""
    low_min = data['Low'].rolling(window=k_window).min()
    high_max = data['High'].rolling(window=k_window).max()
    k = 100 * ((data['Close'] - low_min) / (high_max - low_min))
    d = k.rolling(window=d_window).mean()
    return k, d


def calculate_volatility(data, window=20):
    """Calculate rolling volatility"""
    returns = data['Close'].pct_change()
    return returns.rolling(window=window).std() * np.sqrt(252 * 390)  # Annualized intraday volatility


def fetch_and_analyze(index_symbol, period="1d", interval="1m"):
    """Fetch index data and perform technical analysis"""
    print(f"Fetching data for {index_symbol}...")

    try:
        ticker = yf.Ticker(index_symbol)
        data = ticker.history(period=period, interval=interval)

        if data.empty:
            print(f"No data available for {index_symbol}")
            return None

        data.reset_index(inplace=True)

        # Handle both datetime and date column names
        if 'Datetime' in data.columns:
            data.rename(columns={'Datetime': 'Date'}, inplace=True)

        data['Date'] = data['Date'].astype(str)

        # Calculate technical indicators
        data['SMA_20'] = calculate_sma(data, 20)
        data['SMA_50'] = calculate_sma(data, 50)
        data['EMA_12'] = calculate_ema(data, 12)
        data['EMA_26'] = calculate_ema(data, 26)
        data['RSI'] = calculate_rsi(data)

        macd, signal, hist = calculate_macd(data)
        data['MACD'] = macd
        data['MACD_Signal'] = signal
        data['MACD_Hist'] = hist

        bb_upper, bb_middle, bb_lower = calculate_bollinger_bands(data)
        data['BB_Upper'] = bb_upper
        data['BB_Middle'] = bb_middle
        data['BB_Lower'] = bb_lower

        stoch_k, stoch_d = calculate_stochastic(data)
        data['Stoch_K'] = stoch_k
        data['Stoch_D'] = stoch_d

        data['Volatility'] = calculate_volatility(data)

        # Replace NaN with None for JSON serialization
        data = data.fillna(0)

        # Calculate summary statistics
        latest = data.iloc[-1]
        summary = {
            'current_price': float(latest['Close']),
            'open': float(latest['Open']),
            'high': float(data['High'].max()),
            'low': float(data['Low'].min()),
            'volume': int(data['Volume'].sum()),
            'change': float(latest['Close'] - data.iloc[0]['Open']),
            'change_pct': float((latest['Close'] - data.iloc[0]['Open']) / data.iloc[0]['Open'] * 100),
            'volatility': float(latest['Volatility']),
            'rsi': float(latest['RSI']),
            'macd': float(latest['MACD']),
            'data_points': len(data)
        }

        return {
            'symbol': index_symbol,
            'data': data.to_dict('records'),
            'summary': summary,
            'last_update': datetime.now().isoformat()
        }

    except Exception as e:
        print(f"Error fetching {index_symbol}: {e}")
        return None


def main(indices=None, period="1d", interval="1m"):
    """Main function to fetch all indices"""
    if indices is None:
        indices = DEFAULT_INDICES

    all_data = {}

    for index_symbol in indices:
        result = fetch_and_analyze(index_symbol, period, interval)
        if result:
            all_data[index_symbol] = result

    # Save as JSON
    output_path = os.path.join(OUTPUT_DIR, DB_NAME)
    with open(output_path, 'w') as f:
        json.dump(all_data, f)

    # Compress
    compressed_path = os.path.join(OUTPUT_DIR, COMPRESSED_NAME)
    with open(output_path, 'rb') as f_in:
        with gzip.open(compressed_path, 'wb') as f_out:
            f_out.write(f_in.read())

    print(f"\nData saved to {output_path}")
    print(f"Compressed data saved to {compressed_path}")
    print(f"\nTotal indices processed: {len(all_data)}")

    return all_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch YFinance 1-minute index data")
    parser.add_argument("--indices", nargs="+", help="List of index symbols to fetch")
    parser.add_argument("--period", default="1d", help="Time period (default: 1d)")
    parser.add_argument("--interval", default="1m", help="Data interval (default: 1m)")
    args = parser.parse_args()

    indices = args.indices if args.indices else DEFAULT_INDICES
    main(indices, args.period, args.interval)
