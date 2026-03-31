import yfinance as yf
import pandas as pd
import numpy as np
import tensorflow as tf

# Function to fetch stock data
def fetch_stock_data(stock_symbols):
    data = {}
    for symbol in stock_symbols:
        df = yf.download(symbol, interval='1m', period='1d')
        data[symbol] = df
    return data

# Function to calculate RSI
def calculate_rsi(data, period=14):
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    rsi = 100 - (100 / (1 + rs))
    return rsi

# Function to calculate MACD
def calculate_macd(data):
    exp1 = data['Close'].ewm(span=12, adjust=False).mean()
    exp2 = data['Close'].ewm(span=26, adjust=False).mean()
    macd = exp1 - exp2
    signal = macd.ewm(span=9, adjust=False).mean()
    return macd, signal

# Function to calculate Bollinger Bands
def calculate_bollinger_bands(data, window=20):
    rolling_mean = data['Close'].rolling(window=window).mean()
    rolling_std = data['Close'].rolling(window=window).std()
    upper_band = rolling_mean + (rolling_std * 2)
    lower_band = rolling_mean - (rolling_std * 2)
    return upper_band, lower_band

# Function to process data
def process_data(stock_symbols):
    data = fetch_stock_data(stock_symbols)
    
    features = pd.DataFrame()
    for symbol, df in data.items():
        df['RSI'] = calculate_rsi(df)
        df['MACD'], df['Signal'] = calculate_macd(df)
        df['Upper_band'], df['Lower_band'] = calculate_bollinger_bands(df)
        df['Volume_ratio'] = df['Volume'] / df['Volume'].rolling(window=14).mean()
        
        # Normalizing features
        normalized_df = (df - df.min()) / (df.max() - df.min())
        features = pd.concat([features, normalized_df], axis=0)
    
    return features

# Function to generate buy/sell signals
def generate_signals(data):
    data['Buy'] = np.where(
        (data['RSI'] < 30) & (data['Close'] < data['Lower_band']), 1,
        0
    )
    data['Sell'] = np.where(
        (data['RSI'] > 70) & (data['Close'] > data['Upper_band']), -1,
        0
    )
    return data

# Main execution
if __name__ == "__main__":
    stock_symbols = ['AAPL', 'MSFT', 'GOOGL', 'TSLA', 'NVDA']
    processed_data = process_data(stock_symbols)
    final_data = generate_signals(processed_data)
    final_data.to_csv('pine_ml_data.csv', index=False)
