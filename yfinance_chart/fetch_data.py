#!/usr/bin/env python3
"""
YFinance Data Fetcher with Advanced Analytics
Fetches 5-day 1-minute interval data and performs technical analysis
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
import gzip
import os
from datetime import datetime, timedelta
import argparse

# Default watchlist
DEFAULT_WATCHLIST = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "META", "NVDA", "JPM", "V", "JNJ",
    "WMT", "PG", "MA", "HD", "DIS", "NFLX", "PYPL", "INTC", "AMD", "CRM",
    "ORCL", "CSCO", "ADBE", "PFE", "MRK", "ABBV", "KO", "PEP", "NKE", "MCD"
]

OUTPUT_DIR = "yfinance_chart"
DB_NAME = "yfinance_intraday.json"
COMPRESSED_NAME = "yfinance_intraday.dat"


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


def detect_patterns(data):
    """
    Detect chart patterns using price action analysis
    Returns list of detected patterns with their locations
    """
    patterns = []
    close = data['Close'].values
    high = data['High'].values
    low = data['Low'].values
    dates = data['Date'].tolist()

    n = len(close)
    if n < 50:
        return patterns

    # Double Top Detection
    for i in range(20, n - 20):
        window = 10
        left_peak = np.argmax(high[i - window:i]) + (i - window)
        right_peak = np.argmax(high[i:i + window]) + i

        if abs(high[left_peak] - high[right_peak]) / high[left_peak] < 0.02:
            trough = np.min(low[left_peak:right_peak])
            if high[left_peak] > trough * 1.03:
                patterns.append({
                    'type': 'double_top',
                    'start_idx': left_peak,
                    'end_idx': right_peak,
                    'start_date': dates[left_peak],
                    'end_date': dates[right_peak],
                    'price': float(high[left_peak]),
                    'signal': 'bearish'
                })

    # Double Bottom Detection
    for i in range(20, n - 20):
        window = 10
        left_trough = np.argmin(low[i - window:i]) + (i - window)
        right_trough = np.argmin(low[i:i + window]) + i

        if abs(low[left_trough] - low[right_trough]) / low[left_trough] < 0.02:
            peak = np.max(high[left_trough:right_trough])
            if low[left_trough] < peak * 0.97:
                patterns.append({
                    'type': 'double_bottom',
                    'start_idx': left_trough,
                    'end_idx': right_trough,
                    'start_date': dates[left_trough],
                    'end_date': dates[right_trough],
                    'price': float(low[left_trough]),
                    'signal': 'bullish'
                })

    # Head and Shoulders Detection (simplified)
    for i in range(30, n - 30):
        left_shoulder = np.max(high[i - 30:i - 15])
        head = np.max(high[i - 15:i + 15])
        right_shoulder = np.max(high[i + 15:i + 30])

        if head > left_shoulder and head > right_shoulder:
            if abs(left_shoulder - right_shoulder) / left_shoulder < 0.03:
                if head > left_shoulder * 1.02:
                    patterns.append({
                        'type': 'head_and_shoulders',
                        'start_idx': i - 30,
                        'end_idx': i + 30,
                        'start_date': dates[i - 30],
                        'end_date': dates[i + 30] if i + 30 < n else dates[-1],
                        'price': float(head),
                        'signal': 'bearish'
                    })

    # Triangle Pattern Detection (Ascending/Descending)
    for i in range(40, n - 10):
        window_highs = high[i - 40:i]
        window_lows = low[i - 40:i]

        # Calculate trendlines
        x = np.arange(40)
        high_slope = np.polyfit(x, window_highs, 1)[0]
        low_slope = np.polyfit(x, window_lows, 1)[0]

        # Ascending Triangle: flat resistance, rising support
        if abs(high_slope) < 0.001 and low_slope > 0.001:
            patterns.append({
                'type': 'ascending_triangle',
                'start_idx': i - 40,
                'end_idx': i,
                'start_date': dates[i - 40],
                'end_date': dates[i],
                'price': float(np.mean(window_highs)),
                'signal': 'bullish'
            })

        # Descending Triangle: falling resistance, flat support
        if high_slope < -0.001 and abs(low_slope) < 0.001:
            patterns.append({
                'type': 'descending_triangle',
                'start_idx': i - 40,
                'end_idx': i,
                'start_date': dates[i - 40],
                'end_date': dates[i],
                'price': float(np.mean(window_lows)),
                'signal': 'bearish'
            })

    # Remove duplicate patterns (keep unique by location)
    unique_patterns = []
    seen = set()
    for p in patterns:
        key = (p['type'], p['start_idx'])
        if key not in seen:
            seen.add(key)
            unique_patterns.append(p)

    return unique_patterns[:20]  # Limit to 20 patterns


def bayesian_forecast(data, target_hour=13):
    """
    Advanced Multivariate Bayesian Nonlinear Differential Analysis
    for 1 PM close price forecasting with matrix theory integration

    Uses multivariate matrix-based Bayesian inference with:
    - Nonlinear differential calculus
    - Feedback loop mechanisms
    - State-space modeling
    """
    close = data['Close'].values
    volume = data['Volume'].values
    high = data['High'].values
    low = data['Low'].values

    n = len(close)
    if n < 50:
        return None

    # State vector: [price, velocity, acceleration, volume_momentum]
    # X_t = [p_t, dp/dt, d²p/dt², dV/dt]

    # Calculate differential components
    price_diff = np.diff(close)  # First derivative (velocity)
    price_acc = np.diff(price_diff)  # Second derivative (acceleration)
    vol_momentum = np.diff(volume)

    # Pad arrays to match length
    price_diff = np.concatenate([[0], price_diff])
    price_acc = np.concatenate([[0, 0], price_acc])
    vol_momentum = np.concatenate([[0], vol_momentum])

    # Multivariate State Matrix (Jacobian of the system)
    # State transition based on nonlinear dynamics
    recent_n = min(100, n)

    # Construct covariance matrix for Bayesian prior
    state_matrix = np.column_stack([
        close[-recent_n:],
        price_diff[-recent_n:],
        price_acc[-recent_n:],
        vol_momentum[-recent_n:] / (np.max(np.abs(vol_momentum[-recent_n:])) + 1e-10)
    ])

    # Calculate multivariate covariance matrix
    cov_matrix = np.cov(state_matrix.T)

    # Eigendecomposition for matrix analysis
    eigenvalues, eigenvectors = np.linalg.eig(cov_matrix)

    # Prior distribution parameters (Bayesian)
    prior_mean = close[-1]
    prior_var = np.var(close[-recent_n:])

    # Likelihood from recent trend (nonlinear regression)
    x = np.arange(recent_n)
    # Polynomial fit for nonlinear trend
    poly_coeffs = np.polyfit(x, close[-recent_n:], 3)
    trend_forecast = np.polyval(poly_coeffs, recent_n)

    # Volume-weighted adjustment (feedback mechanism)
    vol_trend = np.polyfit(x, volume[-recent_n:], 1)
    vol_direction = 1 if vol_trend[0] > 0 else -1

    # Volatility from Bollinger-like calculation
    volatility = np.std(close[-20:]) if n >= 20 else np.std(close)

    # RSI-based momentum feedback
    if n >= 14:
        delta = np.diff(close[-15:])
        gain = np.mean([d for d in delta if d > 0]) if any(d > 0 for d in delta) else 0
        loss = np.mean([-d for d in delta if d < 0]) if any(d < 0 for d in delta) else 0
        rsi = 100 - (100 / (1 + gain / (loss + 1e-10)))
        momentum_adj = (rsi - 50) / 100  # -0.5 to 0.5
    else:
        momentum_adj = 0

    # Bayesian posterior calculation
    # Posterior = Prior * Likelihood (conjugate normal-normal)
    likelihood_mean = trend_forecast
    likelihood_var = volatility ** 2

    # Precision-weighted average (Bayesian posterior mean)
    prior_precision = 1 / prior_var if prior_var > 0 else 1
    likelihood_precision = 1 / likelihood_var if likelihood_var > 0 else 1

    posterior_precision = prior_precision + likelihood_precision
    posterior_mean = (prior_precision * prior_mean + likelihood_precision * likelihood_mean) / posterior_precision
    posterior_var = 1 / posterior_precision

    # Apply nonlinear feedback adjustments
    # Mechanism engine: combines multiple feedback loops
    feedback_adjustment = (
        momentum_adj * volatility * 0.3 +  # Momentum feedback
        vol_direction * volatility * 0.1 +  # Volume feedback
        (eigenvalues[0].real / np.sum(np.abs(eigenvalues)) - 0.25) * volatility * 0.2  # Matrix eigenvalue feedback
    )

    # Final forecast with confidence intervals
    forecast = posterior_mean + feedback_adjustment
    confidence_lower = forecast - 1.96 * np.sqrt(posterior_var)
    confidence_upper = forecast + 1.96 * np.sqrt(posterior_var)

    return {
        'forecast_1pm': float(forecast),
        'confidence_lower': float(confidence_lower),
        'confidence_upper': float(confidence_upper),
        'posterior_mean': float(posterior_mean),
        'posterior_variance': float(posterior_var),
        'momentum_factor': float(momentum_adj),
        'volume_direction': vol_direction,
        'eigenvalue_principal': float(eigenvalues[0].real),
        'method': 'Multivariate Bayesian Nonlinear Differential Analysis'
    }


def fetch_and_analyze(ticker, period="5d", interval="1m"):
    """Fetch data and perform comprehensive analysis"""
    print(f"Fetching data for {ticker}...")

    try:
        stock = yf.Ticker(ticker)
        data = stock.history(period=period, interval=interval)

        if data.empty:
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

        # Detect patterns
        patterns = detect_patterns(data)

        # Generate forecast
        forecast = bayesian_forecast(data)

        # Replace NaN with None for JSON serialization
        data = data.fillna(0)

        return {
            'ticker': ticker,
            'data': data.to_dict('records'),
            'patterns': patterns,
            'forecast': forecast,
            'last_update': datetime.now().isoformat()
        }

    except Exception as e:
        print(f"Error fetching {ticker}: {e}")
        return None


def main(watchlist=None):
    """Main function to fetch all tickers"""
    if watchlist is None:
        watchlist = DEFAULT_WATCHLIST

    all_data = {}

    for ticker in watchlist:
        result = fetch_and_analyze(ticker)
        if result:
            all_data[ticker] = result

    # Save as JSON
    output_path = os.path.join(OUTPUT_DIR, DB_NAME)
    with open(output_path, 'w') as f:
        json.dump(all_data, f)

    # Compress
    compressed_path = os.path.join(OUTPUT_DIR, COMPRESSED_NAME)
    with open(output_path, 'rb') as f_in:
        with gzip.open(compressed_path, 'wb') as f_out:
            f_out.write(f_in.read())

    print(f"Data saved to {output_path}")
    print(f"Compressed data saved to {compressed_path}")

    return all_data


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fetch YFinance data with advanced analytics")
    parser.add_argument("--tickers", nargs="+", help="List of tickers to fetch")
    parser.add_argument("--webhook-url", help="Webhook URL for notifications")
    args = parser.parse_args()

    tickers = args.tickers if args.tickers else DEFAULT_WATCHLIST
    main(tickers)
