"""
YFinance Data Backend with GenAI Predictions
Flask API Server
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import json
import gzip
import base64
import os
from functools import lru_cache
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

# Configuration
DATA_DIR = os.environ.get('DATA_DIR', './data')
os.makedirs(DATA_DIR, exist_ok=True)

@app.route('/health', methods=['GET'])
def health():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/fetch', methods=['POST'])
def fetch_ticker_data():
    """Fetch yfinance data for a ticker"""
    try:
        data = request.get_json()
        ticker = data.get('ticker', '').upper()
        period = data.get('period', '1mo')
        interval = data.get('interval', '1d')
        
        if not ticker:
            return jsonify({
                'status': 'error',
                'message': 'Ticker symbol is required'
            }), 400
        
        logger.info(f"Fetching data for {ticker} - period: {period}, interval: {interval}")
        
        # Fetch data from yfinance
        stock = yf.Ticker(ticker)
        hist = stock.history(period=period, interval=interval)
        
        if hist.empty:
            return jsonify({
                'status': 'error',
                'message': f'No data found for ticker {ticker}'
            }), 404
        
        # Get current info
        info = {}
        try:
            info = stock.info
        except Exception as e:
            logger.warning(f"Could not fetch info for {ticker}: {str(e)}")
        
        # Prepare response data
        response_data = {
            'ticker': ticker,
            'period': period,
            'interval': interval,
            'current_price': float(hist['Close'].iloc[-1]) if len(hist) > 0 else None,
            'volume': int(hist['Volume'].iloc[-1]) if len(hist) > 0 else None,
            'high': float(hist['High'].iloc[-1]) if len(hist) > 0 else None,
            'low': float(hist['Low'].iloc[-1]) if len(hist) > 0 else None,
            'open': float(hist['Open'].iloc[-1]) if len(hist) > 0 else None,
            'data_points': len(hist),
            'history': {
                'dates': hist.index.strftime('%Y-%m-%d %H:%M:%S').tolist(),
                'open': hist['Open'].tolist(),
                'high': hist['High'].tolist(),
                'low': hist['Low'].tolist(),
                'close': hist['Close'].tolist(),
                'volume': hist['Volume'].tolist()
            },
            'info': {
                'longName': info.get('longName', ticker),
                'symbol': info.get('symbol', ticker),
                'currency': info.get('currency', 'USD'),
                'marketCap': info.get('marketCap'),
                'previousClose': info.get('previousClose')
            },
            'timestamp': datetime.now().isoformat()
        }
        
        # Save to local cache
        save_compressed_data(ticker, response_data)
        
        return jsonify({
            'status': 'success',
            'data': response_data
        })
        
    except Exception as e:
        logger.error(f"Error fetching data: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/predict', methods=['POST'])
def predict_price():
    """Generate price prediction using GenAI"""
    try:
        data = request.get_json()
        ticker = data.get('ticker', '').upper()
        historical_data = data.get('data')
        
        if not ticker:
            return jsonify({
                'status': 'error',
                'message': 'Ticker symbol is required'
            }), 400
        
        logger.info(f"Generating prediction for {ticker}")
        
        # If no historical data provided, fetch it
        if not historical_data:
            stock = yf.Ticker(ticker)
            hist = stock.history(period='3mo', interval='1d')
            prices = hist['Close'].tolist()
        else:
            prices = historical_data.get('history', {}).get('close', [])
        
        if not prices or len(prices) < 10:
            return jsonify({
                'status': 'error',
                'message': 'Insufficient historical data for prediction'
            }), 400
        
        # Generate prediction
        prediction_result = generate_ai_prediction(ticker, prices)
        
        return jsonify({
            'status': 'success',
            **prediction_result
        })
        
    except Exception as e:
        logger.error(f"Error generating prediction: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

@app.route('/api/generate_report', methods=['POST'])
def generate_report():
    """Generate comprehensive report for multiple tickers"""
    try:
        data = request.get_json()
        tickers = data.get('tickers', [])
        
        if not tickers:
            return jsonify({
                'status': 'error',
                'message': 'No tickers provided'
            }), 400
        
        logger.info(f"Generating report for {len(tickers)} tickers")
        
        report_data = []
        
        for ticker in tickers:
            try:
                # Fetch data
                stock = yf.Ticker(ticker)
                hist = stock.history(period='1mo', interval='1d')
                
                if hist.empty:
                    continue
                
                current_price = float(hist['Close'].iloc[-1])
                prices = hist['Close'].tolist()
                
                # Get prediction
                prediction = generate_ai_prediction(ticker, prices)
                
                # Calculate change
                predicted_price = prediction.get('predicted_price', current_price)
                change_percent = ((predicted_price - current_price) / current_price) * 100
                
                report_data.append({
                    'ticker': ticker,
                    'current_price': round(current_price, 2),
                    'predicted_price': round(predicted_price, 2),
                    'change_percent': round(change_percent, 2),
                    'recommendation': prediction.get('recommendation', 'HOLD'),
                    'confidence': prediction.get('confidence', 'N/A')
                })
                
            except Exception as e:
                logger.error(f"Error processing {ticker}: {str(e)}")
                continue
        
        return jsonify({
            'status': 'success',
            'report_data': report_data,
            'generated_at': datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error generating report: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

def generate_ai_prediction(ticker, prices):
    """
    Generate AI-powered price prediction
    Uses multiple algorithms for better accuracy
    """
    try:
        prices_array = np.array(prices)
        
        # Calculate technical indicators
        sma_20 = calculate_sma(prices_array, 20)
        sma_50 = calculate_sma(prices_array, 50)
        rsi = calculate_rsi(prices_array)
        volatility = calculate_volatility(prices_array)
        
        # Moving average prediction
        ma_trend = sma_20 - sma_50
        
        # Linear regression prediction
        X = np.arange(len(prices_array)).reshape(-1, 1)
        y = prices_array
        
        # Simple linear regression
        n = len(X)
        x_mean = X.mean()
        y_mean = y.mean()
        
        numerator = np.sum((X.flatten() - x_mean) * (y - y_mean))
        denominator = np.sum((X.flatten() - x_mean) ** 2)
        
        slope = numerator / denominator
        intercept = y_mean - slope * x_mean
        
        # Predict next value
        next_x = len(prices_array)
        linear_prediction = slope * next_x + intercept
        
        # Combine predictions with weights
        current_price = prices_array[-1]
        momentum_prediction = current_price + (prices_array[-1] - prices_array[-5]) * 0.3
        
        # Weighted average of predictions
        predicted_price = (
            linear_prediction * 0.4 +
            momentum_prediction * 0.3 +
            current_price * 0.3
        )
        
        # Adjust based on RSI
        if rsi > 70:  # Overbought
            predicted_price *= 0.98
        elif rsi < 30:  # Oversold
            predicted_price *= 1.02
        
        # Calculate confidence based on volatility
        confidence_score = max(0, min(100, 100 - (volatility * 10)))
        
        # Determine recommendation
        change_percent = ((predicted_price - current_price) / current_price) * 100
        
        if change_percent > 3:
            recommendation = 'BUY'
        elif change_percent < -3:
            recommendation = 'SELL'
        else:
            recommendation = 'HOLD'
        
        return {
            'ticker': ticker,
            'predicted_price': round(float(predicted_price), 2),
            'current_price': round(float(current_price), 2),
            'change_percent': round(change_percent, 2),
            'confidence': f"{round(confidence_score)}%",
            'recommendation': recommendation,
            'indicators': {
                'sma_20': round(float(sma_20), 2),
                'sma_50': round(float(sma_50), 2),
                'rsi': round(float(rsi), 2),
                'volatility': round(float(volatility), 4)
            }
        }
        
    except Exception as e:
        logger.error(f"Error in AI prediction: {str(e)}")
        # Fallback to simple prediction
        current_price = prices[-1]
        return {
            'ticker': ticker,
            'predicted_price': round(current_price, 2),
            'current_price': round(current_price, 2),
            'change_percent': 0.0,
            'confidence': '50%',
            'recommendation': 'HOLD',
            'indicators': {}
        }

def calculate_sma(prices, period):
    """Calculate Simple Moving Average"""
    if len(prices) < period:
        return prices[-1]
    return np.mean(prices[-period:])

def calculate_rsi(prices, period=14):
    """Calculate Relative Strength Index"""
    if len(prices) < period + 1:
        return 50.0
    
    deltas = np.diff(prices)
    gains = np.where(deltas > 0, deltas, 0)
    losses = np.where(deltas < 0, -deltas, 0)
    
    avg_gain = np.mean(gains[-period:])
    avg_loss = np.mean(losses[-period:])
    
    if avg_loss == 0:
        return 100.0
    
    rs = avg_gain / avg_loss
    rsi = 100 - (100 / (1 + rs))
    
    return rsi

def calculate_volatility(prices, period=20):
    """Calculate price volatility"""
    if len(prices) < period:
        period = len(prices)
    
    returns = np.diff(prices[-period:]) / prices[-period:-1]
    volatility = np.std(returns)
    
    return volatility

def save_compressed_data(ticker, data):
    """Save compressed data to local storage"""
    try:
        filename = f"{ticker}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json.gz"
        filepath = os.path.join(DATA_DIR, filename)
        
        json_str = json.dumps(data)
        compressed = gzip.compress(json_str.encode('utf-8'))
        
        with open(filepath, 'wb') as f:
            f.write(compressed)
        
        logger.info(f"Saved compressed data to {filepath}")
        
    except Exception as e:
        logger.error(f"Error saving compressed data: {str(e)}")

def load_compressed_data(ticker):
    """Load most recent compressed data for ticker"""
    try:
        files = [f for f in os.listdir(DATA_DIR) if f.startswith(ticker) and f.endswith('.json.gz')]
        
        if not files:
            return None
        
        # Get most recent file
        files.sort(reverse=True)
        filepath = os.path.join(DATA_DIR, files[0])
        
        with open(filepath, 'rb') as f:
            compressed = f.read()
            decompressed = gzip.decompress(compressed)
            data = json.loads(decompressed.decode('utf-8'))
        
        return data
        
    except Exception as e:
        logger.error(f"Error loading compressed data: {str(e)}")
        return None

@app.route('/api/cache/<ticker>', methods=['GET'])
def get_cached_data(ticker):
    """Get cached data for a ticker"""
    try:
        data = load_compressed_data(ticker.upper())
        
        if data:
            return jsonify({
                'status': 'success',
                'data': data
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'No cached data found'
            }), 404
            
    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)
