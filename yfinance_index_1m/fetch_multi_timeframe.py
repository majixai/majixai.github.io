#!/usr/bin/env python3
"""
Multi-Timeframe Data Fetcher with AI Options Analysis
Fetches data across multiple timeframes for comprehensive analysis
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
import gzip
import os
from datetime import datetime, timedelta
import argparse
from typing import Dict, List, Tuple

# Timeframes configuration
TIMEFRAMES = {
    '1m': {'period': '1d', 'interval': '1m'},
    '5m': {'period': '5d', 'interval': '5m'},
    '15m': {'period': '1mo', 'interval': '15m'},
    '30m': {'period': '1mo', 'interval': '30m'},
    '1h': {'period': '3mo', 'interval': '1h'},
    '4h': {'period': '6mo', 'interval': '1d'},  # Using daily for 4h approximation
    '1d': {'period': '1y', 'interval': '1d'},
    '1wk': {'period': '2y', 'interval': '1wk'},
    '1mo': {'period': '5y', 'interval': '1mo'}
}

DEFAULT_INDICES = [
    "^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX", "^TNX",
    "^FTSE", "^GDAXI", "^N225", "^HSI"
]

# Top stocks for watchlist
WATCHLIST_STOCKS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META",
    "TSLA", "BRK-B", "JPM", "V", "WMT", "MA", "PG", "DIS",
    "NFLX", "AMD", "INTC", "CSCO", "ADBE", "CRM"
]

OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))


def calculate_technical_indicators(data: pd.DataFrame) -> pd.DataFrame:
    """Calculate comprehensive technical indicators"""
    # Moving Averages
    data['SMA_20'] = data['Close'].rolling(window=20).mean()
    data['SMA_50'] = data['Close'].rolling(window=50).mean()
    data['SMA_200'] = data['Close'].rolling(window=200).mean()
    data['EMA_12'] = data['Close'].ewm(span=12, adjust=False).mean()
    data['EMA_26'] = data['Close'].ewm(span=26, adjust=False).mean()
    
    # RSI
    delta = data['Close'].diff()
    gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    data['RSI'] = 100 - (100 / (1 + rs))
    
    # MACD
    data['MACD'] = data['EMA_12'] - data['EMA_26']
    data['MACD_Signal'] = data['MACD'].ewm(span=9, adjust=False).mean()
    data['MACD_Hist'] = data['MACD'] - data['MACD_Signal']
    
    # Bollinger Bands
    sma = data['Close'].rolling(window=20).mean()
    std = data['Close'].rolling(window=20).std()
    data['BB_Upper'] = sma + (std * 2)
    data['BB_Middle'] = sma
    data['BB_Lower'] = sma - (std * 2)
    
    # Stochastic
    low_min = data['Low'].rolling(window=14).min()
    high_max = data['High'].rolling(window=14).max()
    data['Stoch_K'] = 100 * ((data['Close'] - low_min) / (high_max - low_min))
    data['Stoch_D'] = data['Stoch_K'].rolling(window=3).mean()
    
    # ATR (Average True Range)
    high_low = data['High'] - data['Low']
    high_close = np.abs(data['High'] - data['Close'].shift())
    low_close = np.abs(data['Low'] - data['Close'].shift())
    ranges = pd.concat([high_low, high_close, low_close], axis=1)
    true_range = ranges.max(axis=1)
    data['ATR'] = true_range.rolling(window=14).mean()
    
    # Volatility
    returns = data['Close'].pct_change()
    data['Volatility'] = returns.rolling(window=20).std() * np.sqrt(252) * 100
    
    return data.fillna(0)


def ai_analyze_options(data: pd.DataFrame, symbol: str) -> Dict:
    """
    AI-powered options analysis and suggestions
    Analyzes market conditions and suggests optimal option strategies
    """
    latest = data.iloc[-1]
    prev = data.iloc[-20] if len(data) > 20 else data.iloc[0]
    
    current_price = float(latest['Close'])
    rsi = float(latest['RSI'])
    macd = float(latest['MACD'])
    macd_signal = float(latest['MACD_Signal'])
    bb_position = (current_price - float(latest['BB_Lower'])) / (float(latest['BB_Upper']) - float(latest['BB_Lower']))
    volatility = float(latest['Volatility'])
    price_change_pct = ((current_price - float(prev['Close'])) / float(prev['Close'])) * 100
    
    # Trend detection
    sma_20 = float(latest['SMA_20'])
    sma_50 = float(latest['SMA_50'])
    
    trend = "neutral"
    if sma_20 > sma_50 and current_price > sma_20:
        trend = "bullish"
    elif sma_20 < sma_50 and current_price < sma_20:
        trend = "bearish"
    
    # Market conditions
    is_oversold = rsi < 30
    is_overbought = rsi > 70
    is_bullish_macd = macd > macd_signal
    is_high_volatility = volatility > 25
    
    suggestions = []
    
    # Strategy suggestions based on market conditions
    if trend == "bullish" and is_bullish_macd and not is_overbought:
        suggestions.append({
            "strategy": "Long Call",
            "confidence": 85,
            "reasoning": "Strong bullish trend with MACD confirmation",
            "strike": round(current_price * 1.02, 2),
            "expiry_days": 30,
            "expected_premium": round(current_price * 0.02, 2),
            "max_profit": "Unlimited",
            "max_loss": "Premium paid",
            "breakeven": round(current_price * 1.04, 2)
        })
        suggestions.append({
            "strategy": "Bull Call Spread",
            "confidence": 75,
            "reasoning": "Lower risk bullish play with defined risk",
            "strike_long": round(current_price * 0.98, 2),
            "strike_short": round(current_price * 1.05, 2),
            "expiry_days": 45,
            "net_debit": round(current_price * 0.015, 2),
            "max_profit": round(current_price * 0.055, 2),
            "max_loss": round(current_price * 0.015, 2)
        })
    
    elif trend == "bearish" and not is_bullish_macd and not is_oversold:
        suggestions.append({
            "strategy": "Long Put",
            "confidence": 80,
            "reasoning": "Bearish trend with MACD divergence",
            "strike": round(current_price * 0.98, 2),
            "expiry_days": 30,
            "expected_premium": round(current_price * 0.02, 2),
            "max_profit": "Strike - Premium",
            "max_loss": "Premium paid",
            "breakeven": round(current_price * 0.96, 2)
        })
        suggestions.append({
            "strategy": "Bear Put Spread",
            "confidence": 70,
            "reasoning": "Defined risk bearish strategy",
            "strike_long": round(current_price * 1.02, 2),
            "strike_short": round(current_price * 0.95, 2),
            "expiry_days": 45,
            "net_debit": round(current_price * 0.015, 2),
            "max_profit": round(current_price * 0.055, 2)
        })
    
    elif is_high_volatility:
        suggestions.append({
            "strategy": "Iron Condor",
            "confidence": 75,
            "reasoning": "High volatility - collect premium in range-bound market",
            "strikes": {
                "put_short": round(current_price * 0.95, 2),
                "put_long": round(current_price * 0.92, 2),
                "call_short": round(current_price * 1.05, 2),
                "call_long": round(current_price * 1.08, 2)
            },
            "expiry_days": 30,
            "net_credit": round(current_price * 0.01, 2),
            "max_profit": round(current_price * 0.01, 2),
            "max_loss": round(current_price * 0.02, 2)
        })
        suggestions.append({
            "strategy": "Short Straddle (Advanced)",
            "confidence": 65,
            "reasoning": "Expect volatility contraction",
            "strike": round(current_price, 2),
            "expiry_days": 14,
            "premium_collected": round(current_price * 0.03, 2),
            "risk": "Unlimited",
            "warning": "High risk strategy - requires active management"
        })
    
    else:
        # Neutral market
        suggestions.append({
            "strategy": "Long Straddle",
            "confidence": 70,
            "reasoning": "Neutral market - prepare for breakout",
            "strike": round(current_price, 2),
            "expiry_days": 30,
            "premium_paid": round(current_price * 0.04, 2),
            "profitable_if": "Large move in either direction",
            "breakeven_range": [
                round(current_price * 0.96, 2),
                round(current_price * 1.04, 2)
            ]
        })
        suggestions.append({
            "strategy": "Butterfly Spread",
            "confidence": 65,
            "reasoning": "Low volatility neutral play",
            "strikes": {
                "lower": round(current_price * 0.97, 2),
                "middle": round(current_price, 2),
                "upper": round(current_price * 1.03, 2)
            },
            "expiry_days": 30,
            "net_debit": round(current_price * 0.005, 2),
            "max_profit": round(current_price * 0.025, 2)
        })
    
    return {
        "symbol": symbol,
        "current_price": current_price,
        "analysis_time": datetime.now().isoformat(),
        "market_conditions": {
            "trend": trend,
            "rsi": rsi,
            "rsi_state": "overbought" if is_overbought else "oversold" if is_oversold else "neutral",
            "volatility": volatility,
            "volatility_state": "high" if is_high_volatility else "normal",
            "macd_signal": "bullish" if is_bullish_macd else "bearish",
            "price_vs_bb": bb_position,
            "recent_change_pct": price_change_pct
        },
        "suggested_strategies": suggestions
    }


def fetch_watchlist_data() -> Dict:
    """Fetch real-time data for watchlist stocks"""
    watchlist = {}
    
    for ticker in WATCHLIST_STOCKS:
        try:
            stock = yf.Ticker(ticker)
            info = stock.info
            hist = stock.history(period='5d', interval='1d')
            
            if not hist.empty:
                latest = hist.iloc[-1]
                prev = hist.iloc[-2] if len(hist) > 1 else latest
                
                # Determine exchange
                exchange = info.get('exchange', 'NASDAQ')
                if exchange in ['NYQ', 'NYSE']:
                    exchange = 'NYSE'
                elif exchange in ['NMS', 'NGM']:
                    exchange = 'NASDAQ'
                
                watchlist[ticker] = {
                    "symbol": ticker,
                    "name": info.get('longName', ticker),
                    "exchange": exchange,
                    "google_finance_code": f"{ticker}:{exchange}",
                    "price": float(latest['Close']),
                    "change": float(latest['Close'] - prev['Close']),
                    "change_pct": float(((latest['Close'] - prev['Close']) / prev['Close']) * 100),
                    "volume": int(latest['Volume']),
                    "market_cap": info.get('marketCap', 0),
                    "pe_ratio": info.get('trailingPE', 0),
                    "last_update": datetime.now().isoformat()
                }
        except Exception as e:
            print(f"Error fetching {ticker}: {e}")
            continue
    
    return watchlist


def fetch_market_movers() -> Dict:
    """Fetch top gainers and losers"""
    try:
        # Using yfinance to get S&P 500 stocks
        sp500 = yf.Ticker("^GSPC")
        
        movers = {
            "premarket_gainers": [],
            "aftermarket_gainers": [],
            "top_gainers": [],
            "top_losers": [],
            "most_active": []
        }
        
        # Fetch some popular tickers for movers
        popular_tickers = ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", 
                          "AMD", "NFLX", "PYPL", "COIN", "ROKU", "SNAP", "UBER", 
                          "SQ", "SHOP", "ZM", "PLTR", "RBLX", "RIVN"]
        
        stocks_data = []
        for ticker in popular_tickers:
            try:
                stock = yf.Ticker(ticker)
                hist = stock.history(period='2d', interval='1d', prepost=True)
                
                if len(hist) >= 2:
                    regular_close = hist.iloc[-2]['Close']
                    latest = hist.iloc[-1]
                    
                    change_pct = ((latest['Close'] - regular_close) / regular_close) * 100
                    
                    stocks_data.append({
                        "symbol": ticker,
                        "price": float(latest['Close']),
                        "change_pct": float(change_pct),
                        "volume": int(latest['Volume'])
                    })
            except:
                continue
        
        # Sort by change percentage
        stocks_data.sort(key=lambda x: x['change_pct'], reverse=True)
        
        movers["top_gainers"] = stocks_data[:10]
        movers["top_losers"] = stocks_data[-10:]
        
        # Sort by volume
        stocks_data.sort(key=lambda x: x['volume'], reverse=True)
        movers["most_active"] = stocks_data[:10]
        
        movers["last_update"] = datetime.now().isoformat()
        
        return movers
    except Exception as e:
        print(f"Error fetching market movers: {e}")
        return {}


def fetch_multi_timeframe(symbol: str) -> Dict:
    """Fetch data across all timeframes for a symbol"""
    print(f"Fetching multi-timeframe data for {symbol}...")
    
    result = {
        "symbol": symbol,
        "timeframes": {},
        "last_update": datetime.now().isoformat()
    }
    
    for tf_name, tf_config in TIMEFRAMES.items():
        try:
            ticker = yf.Ticker(symbol)
            data = ticker.history(period=tf_config['period'], interval=tf_config['interval'])
            
            if data.empty:
                print(f"No data for {symbol} at {tf_name}")
                continue
            
            data.reset_index(inplace=True)
            if 'Datetime' in data.columns:
                data.rename(columns={'Datetime': 'Date'}, inplace=True)
            
            data['Date'] = data['Date'].astype(str)
            data = calculate_technical_indicators(data)
            
            latest = data.iloc[-1]
            first = data.iloc[0]
            
            result["timeframes"][tf_name] = {
                "data": data.to_dict('records'),
                "summary": {
                    "current_price": float(latest['Close']),
                    "open": float(first['Open']),
                    "high": float(data['High'].max()),
                    "low": float(data['Low'].min()),
                    "volume": int(data['Volume'].sum()),
                    "change": float(latest['Close'] - first['Open']),
                    "change_pct": float((latest['Close'] - first['Open']) / first['Open'] * 100),
                    "volatility": float(latest['Volatility']),
                    "rsi": float(latest['RSI']),
                    "macd": float(latest['MACD']),
                    "data_points": len(data)
                }
            }
            
            print(f"✓ {tf_name}: {len(data)} data points")
            
        except Exception as e:
            print(f"Error fetching {symbol} at {tf_name}: {e}")
            continue
    
    return result


def main():
    """Main function"""
    print("Starting Multi-Timeframe Data Fetch...")
    print("=" * 60)
    
    all_data = {}
    
    # Fetch indices with multi-timeframe data
    for symbol in DEFAULT_INDICES:
        data = fetch_multi_timeframe(symbol)
        if data["timeframes"]:
            all_data[symbol] = data
            
            # Generate AI options analysis using 1d timeframe
            if "1d" in data["timeframes"]:
                df = pd.DataFrame(data["timeframes"]["1d"]["data"])
                options_analysis = ai_analyze_options(df, symbol)
                all_data[symbol]["options_ai"] = options_analysis
    
    # Fetch watchlist data
    print("\nFetching watchlist data...")
    watchlist = fetch_watchlist_data()
    all_data["_watchlist"] = watchlist
    
    # Fetch market movers
    print("\nFetching market movers...")
    movers = fetch_market_movers()
    all_data["_movers"] = movers
    
    # Save as JSON
    output_path = os.path.join(OUTPUT_DIR, "multi_timeframe.json")
    with open(output_path, 'w') as f:
        json.dump(all_data, f, indent=2)
    
    # Compress
    compressed_path = os.path.join(OUTPUT_DIR, "multi_timeframe.dat")
    with open(output_path, 'rb') as f_in:
        with gzip.open(compressed_path, 'wb') as f_out:
            f_out.write(f_in.read())
    
    print(f"\n{'=' * 60}")
    print(f"✓ Data saved to {output_path}")
    print(f"✓ Compressed data saved to {compressed_path}")
    print(f"✓ Total indices: {len([k for k in all_data.keys() if not k.startswith('_')])}")
    print(f"✓ Watchlist stocks: {len(watchlist)}")
    print(f"✓ Market movers tracked: {len(movers.get('top_gainers', []))}")
    print("=" * 60)


if __name__ == "__main__":
    main()
