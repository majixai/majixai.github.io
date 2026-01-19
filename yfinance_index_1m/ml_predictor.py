#!/usr/bin/env python3
"""
Advanced ML/AI Predictor for Market Analysis
Integrates with compressed database for intelligent forecasting
"""

import numpy as np
import pandas as pd
from typing import Dict, List, Tuple
import json
import gzip
from datetime import datetime, timedelta


class MarketMLPredictor:
    """
    Advanced ML predictor using statistical methods and pattern recognition
    No external ML libraries required - uses pure numpy/pandas
    """
    
    def __init__(self):
        self.trained_models = {}
        
    def calculate_momentum_indicators(self, data: pd.DataFrame) -> Dict:
        """Calculate momentum-based indicators"""
        close = data['Close'].values
        
        # Rate of Change
        roc_10 = ((close[-1] - close[-10]) / close[-10] * 100) if len(close) > 10 else 0
        roc_20 = ((close[-1] - close[-20]) / close[-20] * 100) if len(close) > 20 else 0
        
        # Williams %R
        high_max = data['High'].rolling(window=14).max().iloc[-1]
        low_min = data['Low'].rolling(window=14).min().iloc[-1]
        williams_r = ((high_max - close[-1]) / (high_max - low_min) * -100) if (high_max - low_min) != 0 else 0
        
        # Commodity Channel Index (CCI)
        tp = (data['High'] + data['Low'] + data['Close']) / 3
        sma_tp = tp.rolling(window=20).mean()
        mad = tp.rolling(window=20).apply(lambda x: np.abs(x - x.mean()).mean())
        cci = ((tp - sma_tp) / (0.015 * mad)).iloc[-1] if mad.iloc[-1] != 0 else 0
        
        return {
            'roc_10': roc_10,
            'roc_20': roc_20,
            'williams_r': williams_r,
            'cci': cci
        }
    
    def detect_market_regime(self, data: pd.DataFrame) -> Dict:
        """Detect current market regime using statistical analysis"""
        returns = data['Close'].pct_change().dropna()
        
        # Volatility regime
        volatility = returns.std() * np.sqrt(252) * 100
        vol_regime = 'high' if volatility > 25 else 'low' if volatility < 15 else 'normal'
        
        # Trend strength using ADX approximation
        high_low = data['High'] - data['Low']
        high_close = np.abs(data['High'] - data['Close'].shift())
        low_close = np.abs(data['Low'] - data['Close'].shift())
        
        tr = pd.concat([high_low, high_close, low_close], axis=1).max(axis=1)
        atr = tr.rolling(window=14).mean()
        
        plus_dm = data['High'].diff()
        minus_dm = -data['Low'].diff()
        plus_dm[plus_dm < 0] = 0
        minus_dm[minus_dm < 0] = 0
        
        plus_di = 100 * (plus_dm.rolling(window=14).mean() / atr)
        minus_di = 100 * (minus_dm.rolling(window=14).mean() / atr)
        
        dx = 100 * np.abs(plus_di - minus_di) / (plus_di + minus_di)
        adx = dx.rolling(window=14).mean().iloc[-1]
        
        trend_strength = 'strong' if adx > 25 else 'weak' if adx < 20 else 'moderate'
        
        # Market phase detection
        sma_50 = data['Close'].rolling(window=50).mean()
        sma_200 = data['Close'].rolling(window=200).mean()
        
        if len(sma_50.dropna()) > 0 and len(sma_200.dropna()) > 0:
            if sma_50.iloc[-1] > sma_200.iloc[-1] and data['Close'].iloc[-1] > sma_50.iloc[-1]:
                phase = 'bull_market'
            elif sma_50.iloc[-1] < sma_200.iloc[-1] and data['Close'].iloc[-1] < sma_50.iloc[-1]:
                phase = 'bear_market'
            else:
                phase = 'transitional'
        else:
            phase = 'unknown'
        
        return {
            'volatility': float(volatility),
            'volatility_regime': vol_regime,
            'trend_strength': trend_strength,
            'adx': float(adx) if not np.isnan(adx) else 0,
            'market_phase': phase
        }
    
    def calculate_support_resistance_ml(self, data: pd.DataFrame, num_levels: int = 5) -> Dict:
        """ML-based support and resistance using clustering"""
        prices = pd.concat([data['High'], data['Low'], data['Close']]).values
        
        # Simple clustering using histogram
        hist, bins = np.histogram(prices, bins=50)
        
        # Find peaks in histogram (potential support/resistance)
        peaks = []
        for i in range(1, len(hist) - 1):
            if hist[i] > hist[i-1] and hist[i] > hist[i+1]:
                peaks.append((bins[i], hist[i]))
        
        # Sort by frequency and get top levels
        peaks.sort(key=lambda x: x[1], reverse=True)
        
        support_levels = []
        resistance_levels = []
        current_price = data['Close'].iloc[-1]
        
        for price, _ in peaks[:num_levels * 2]:
            if price < current_price:
                support_levels.append(float(price))
            else:
                resistance_levels.append(float(price))
        
        return {
            'support': sorted(support_levels, reverse=True)[:num_levels],
            'resistance': sorted(resistance_levels)[:num_levels],
            'current_price': float(current_price)
        }
    
    def predict_next_move(self, data: pd.DataFrame, timeframe: str) -> Dict:
        """Predict next price movement using multiple factors"""
        
        # Calculate all indicators
        momentum = self.calculate_momentum_indicators(data)
        regime = self.detect_market_regime(data)
        levels = self.calculate_support_resistance_ml(data)
        
        # Get recent price action
        recent_close = data['Close'].iloc[-5:].values
        recent_trend = (recent_close[-1] - recent_close[0]) / recent_close[0] * 100
        
        # RSI
        delta = data['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        rsi = (100 - (100 / (1 + rs))).iloc[-1]
        
        # MACD
        ema_12 = data['Close'].ewm(span=12, adjust=False).mean()
        ema_26 = data['Close'].ewm(span=26, adjust=False).mean()
        macd = ema_12 - ema_26
        signal = macd.ewm(span=9, adjust=False).mean()
        macd_hist = macd - signal
        macd_trend = 'bullish' if macd_hist.iloc[-1] > 0 else 'bearish'
        
        # Scoring system
        bullish_score = 0
        bearish_score = 0
        
        # RSI scoring
        if rsi < 30:
            bullish_score += 3
        elif rsi > 70:
            bearish_score += 3
        elif rsi < 40:
            bullish_score += 1
        elif rsi > 60:
            bearish_score += 1
        
        # MACD scoring
        if macd_trend == 'bullish':
            bullish_score += 2
        else:
            bearish_score += 2
        
        # Trend scoring
        if recent_trend > 2:
            bullish_score += 2
        elif recent_trend < -2:
            bearish_score += 2
        
        # Momentum scoring
        if momentum['roc_10'] > 0:
            bullish_score += 1
        else:
            bearish_score += 1
        
        # Williams %R scoring
        if momentum['williams_r'] < -80:
            bullish_score += 2
        elif momentum['williams_r'] > -20:
            bearish_score += 2
        
        # Calculate prediction
        total_score = bullish_score + bearish_score
        bullish_prob = (bullish_score / total_score * 100) if total_score > 0 else 50
        bearish_prob = (bearish_score / total_score * 100) if total_score > 0 else 50
        
        # Determine prediction
        if bullish_prob > 60:
            prediction = 'bullish'
            confidence = bullish_prob
        elif bearish_prob > 60:
            prediction = 'bearish'
            confidence = bearish_prob
        else:
            prediction = 'neutral'
            confidence = 50
        
        # Calculate targets
        current_price = float(data['Close'].iloc[-1])
        volatility = float(data['Close'].pct_change().std() * np.sqrt(252) * 100)
        
        # Price targets based on support/resistance and volatility
        if prediction == 'bullish':
            target = levels['resistance'][0] if levels['resistance'] else current_price * 1.02
            stop_loss = levels['support'][0] if levels['support'] else current_price * 0.98
        elif prediction == 'bearish':
            target = levels['support'][0] if levels['support'] else current_price * 0.98
            stop_loss = levels['resistance'][0] if levels['resistance'] else current_price * 1.02
        else:
            target = current_price
            stop_loss = current_price * 0.99
        
        return {
            'prediction': prediction,
            'confidence': float(confidence),
            'timeframe': timeframe,
            'current_price': current_price,
            'target_price': float(target),
            'stop_loss': float(stop_loss),
            'bullish_score': bullish_score,
            'bearish_score': bearish_score,
            'indicators': {
                'rsi': float(rsi),
                'macd_trend': macd_trend,
                'recent_trend_pct': float(recent_trend),
                **momentum
            },
            'market_regime': regime,
            'support_resistance': levels,
            'analysis_time': datetime.now().isoformat()
        }
    
    def generate_trading_signals(self, data: pd.DataFrame) -> Dict:
        """Generate actionable trading signals"""
        
        prediction = self.predict_next_move(data, '1d')
        
        signals = []
        
        # Entry signals
        if prediction['prediction'] == 'bullish' and prediction['confidence'] > 70:
            signals.append({
                'type': 'BUY',
                'strength': 'STRONG',
                'entry': prediction['current_price'],
                'target': prediction['target_price'],
                'stop_loss': prediction['stop_loss'],
                'risk_reward': abs(prediction['target_price'] - prediction['current_price']) / 
                              abs(prediction['current_price'] - prediction['stop_loss'])
            })
        elif prediction['prediction'] == 'bullish' and prediction['confidence'] > 55:
            signals.append({
                'type': 'BUY',
                'strength': 'MODERATE',
                'entry': prediction['current_price'],
                'target': prediction['target_price'],
                'stop_loss': prediction['stop_loss']
            })
        elif prediction['prediction'] == 'bearish' and prediction['confidence'] > 70:
            signals.append({
                'type': 'SELL',
                'strength': 'STRONG',
                'entry': prediction['current_price'],
                'target': prediction['target_price'],
                'stop_loss': prediction['stop_loss'],
                'risk_reward': abs(prediction['target_price'] - prediction['current_price']) / 
                              abs(prediction['current_price'] - prediction['stop_loss'])
            })
        elif prediction['prediction'] == 'bearish' and prediction['confidence'] > 55:
            signals.append({
                'type': 'SELL',
                'strength': 'MODERATE',
                'entry': prediction['current_price'],
                'target': prediction['target_price'],
                'stop_loss': prediction['stop_loss']
            })
        else:
            signals.append({
                'type': 'HOLD',
                'strength': 'NEUTRAL',
                'reason': 'Market conditions unclear'
            })
        
        return {
            'signals': signals,
            'prediction': prediction,
            'timestamp': datetime.now().isoformat()
        }


def integrate_ml_with_compressed_db(db_path: str) -> Dict:
    """Integrate ML predictions with compressed database"""
    
    print("Loading compressed database...")
    with gzip.open(db_path, 'rb') as f:
        data = json.loads(f.read().decode('utf-8'))
    
    predictor = MarketMLPredictor()
    
    print("Generating ML predictions for all symbols...")
    
    for symbol in data.keys():
        if symbol.startswith('_'):
            continue
        
        print(f"Processing {symbol}...")
        
        if 'timeframes' in data[symbol]:
            # Add ML predictions for multiple timeframes
            data[symbol]['ml_predictions'] = {}
            
            for timeframe, tf_data in data[symbol]['timeframes'].items():
                if tf_data['data']:
                    df = pd.DataFrame(tf_data['data'])
                    
                    # Generate predictions
                    prediction = predictor.predict_next_move(df, timeframe)
                    trading_signals = predictor.generate_trading_signals(df)
                    
                    data[symbol]['ml_predictions'][timeframe] = {
                        'prediction': prediction,
                        'signals': trading_signals
                    }
            
            print(f"  ✓ Added ML predictions for {len(data[symbol]['ml_predictions'])} timeframes")
    
    # Save updated database
    output_path = db_path.replace('.dat', '_ml.dat')
    json_path = db_path.replace('.dat', '_ml.json')
    
    print("\nSaving ML-enhanced database...")
    
    # Save JSON
    with open(json_path, 'w') as f:
        json.dump(data, f, indent=2)
    
    # Compress
    with open(json_path, 'rb') as f_in:
        with gzip.open(output_path, 'wb') as f_out:
            f_out.write(f_in.read())
    
    # Calculate stats
    original_size = os.path.getsize(json_path)
    compressed_size = os.path.getsize(output_path)
    ratio = (1 - compressed_size/original_size) * 100
    
    print(f"\n{'='*60}")
    print(f"✓ ML-Enhanced database saved!")
    print(f"✓ JSON: {json_path}")
    print(f"✓ Compressed: {output_path}")
    print(f"✓ Original size: {original_size/1024/1024:.2f}MB")
    print(f"✓ Compressed size: {compressed_size/1024/1024:.2f}MB")
    print(f"✓ Compression ratio: {ratio:.1f}%")
    print(f"{'='*60}")
    
    return data


if __name__ == '__main__':
    import os
    
    db_path = os.path.join(os.path.dirname(__file__), 'multi_timeframe.dat')
    
    if os.path.exists(db_path):
        integrate_ml_with_compressed_db(db_path)
    else:
        print(f"Database not found: {db_path}")
        print("Please run fetch_multi_timeframe.py first")
