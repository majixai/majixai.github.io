#!/usr/bin/env python3
"""
Advanced Price Action Prediction Service
Predicts percentage change and time estimates using ML models
Runs at 1 AM, 6 AM, and 5 PM daily with GitHub Actions integration
"""

import os
import sys
import sqlite3
import json
import logging
import requests
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
import numpy as np
from pathlib import Path
import threading
import signal

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class PredictionService:
    """Advanced ML-based price prediction service"""
    
    def __init__(self, db_dir: str = "dbs", predictions_db: str = "predictions.db"):
        self.db_dir = Path(db_dir)
        self.predictions_db = self.db_dir / predictions_db
        self.data_db_1m = self.db_dir / "ticker_data_1m.db"
        self.data_db_1h = self.db_dir / "ticker_data_1h.db"
        self.data_db_1d = self.db_dir / "ticker_data_1d.db"
        
        # Webhook configuration
        self.webhook_url = os.getenv('PREDICTION_WEBHOOK_URL', '')
        self.github_token = os.getenv('GITHUB_TOKEN', '')
        
        # Signal handling
        self.shutdown_flag = threading.Event()
        signal.signal(signal.SIGTERM, self._signal_handler)
        signal.signal(signal.SIGINT, self._signal_handler)
        
        self._init_predictions_db()
        
    def _signal_handler(self, signum, frame):
        """Handle shutdown signals gracefully"""
        logger.info(f"Received signal {signum}, shutting down gracefully...")
        self.shutdown_flag.set()
        
    def _init_predictions_db(self):
        """Initialize predictions database schema"""
        conn = sqlite3.connect(self.predictions_db)
        cursor = conn.cursor()
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS predictions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                prediction_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                current_price REAL,
                predicted_price REAL,
                predicted_change_pct REAL,
                confidence REAL,
                time_horizon_hours INTEGER,
                target_timestamp TIMESTAMP,
                model_type TEXT,
                features_used TEXT,
                actual_price REAL,
                actual_change_pct REAL,
                prediction_error REAL,
                status TEXT DEFAULT 'pending'
            )
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_predictions_ticker 
            ON predictions(ticker)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_predictions_time 
            ON predictions(prediction_time)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_predictions_status 
            ON predictions(status)
        """)
        
        # Prediction performance table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS prediction_performance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ticker TEXT NOT NULL,
                evaluation_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                predictions_evaluated INTEGER,
                avg_error REAL,
                rmse REAL,
                mae REAL,
                directional_accuracy REAL,
                model_type TEXT
            )
        """)
        
        conn.commit()
        conn.close()
        logger.info("Predictions database initialized")
        
    def get_latest_data(self, ticker: str, interval: str = "1m", 
                       limit: int = 100) -> List[Dict]:
        """Fetch latest data for a ticker from appropriate database"""
        db_map = {
            "1m": (self.data_db_1m, "ticker_data_1m", "datetime"),
            "1h": (self.data_db_1h, "ticker_data_1h", "datetime"),
            "1d": (self.data_db_1d, "ticker_data_1d", "datetime")
        }
        
        db_info = db_map.get(interval)
        if not db_info:
            logger.warning(f"Invalid interval: {interval}")
            return []
            
        db_path, table_name, time_col = db_info
        if not db_path.exists():
            logger.warning(f"Database not found for {interval}")
            return []
            
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        cursor.execute(f"""
            SELECT {time_col}, open, high, low, close, volume
            FROM {table_name}
            WHERE ticker = ?
            ORDER BY {time_col} DESC
            LIMIT ?
        """, (ticker, limit))
        
        rows = cursor.fetchall()
        conn.close()
        
        return [
            {
                'timestamp': row[0],
                'open': row[1],
                'high': row[2],
                'low': row[3],
                'close': row[4],
                'volume': row[5]
            }
            for row in reversed(rows)
        ]
        
    def calculate_technical_indicators(self, data: List[Dict]) -> Dict:
        """Calculate technical indicators from price data"""
        if not data:
            return {}
            
        closes = np.array([d['close'] for d in data])
        volumes = np.array([d['volume'] for d in data])
        
        # RSI
        rsi = self._calculate_rsi(closes, period=14)
        
        # Moving averages
        sma_20 = np.mean(closes[-20:]) if len(closes) >= 20 else np.mean(closes)
        sma_50 = np.mean(closes[-50:]) if len(closes) >= 50 else np.mean(closes)
        
        # Bollinger Bands
        bb_middle = sma_20
        bb_std = np.std(closes[-20:]) if len(closes) >= 20 else np.std(closes)
        bb_upper = bb_middle + (2 * bb_std)
        bb_lower = bb_middle - (2 * bb_std)
        
        # Volume indicators
        avg_volume = np.mean(volumes)
        volume_trend = volumes[-1] / avg_volume if avg_volume > 0 else 1.0
        
        # Momentum
        momentum = (closes[-1] - closes[-10]) / closes[-10] * 100 if len(closes) >= 10 else 0
        
        # Volatility
        volatility = np.std(closes[-20:]) / np.mean(closes[-20:]) * 100 if len(closes) >= 20 else 0
        
        return {
            'rsi': float(rsi),
            'sma_20': float(sma_20),
            'sma_50': float(sma_50),
            'bb_upper': float(bb_upper),
            'bb_middle': float(bb_middle),
            'bb_lower': float(bb_lower),
            'volume_trend': float(volume_trend),
            'momentum': float(momentum),
            'volatility': float(volatility),
            'current_price': float(closes[-1])
        }
        
    def _calculate_rsi(self, prices: np.ndarray, period: int = 14) -> float:
        """Calculate RSI indicator"""
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
        
        return float(rsi)
        
    def predict_price_action(self, ticker: str, 
                            time_horizon_hours: int = 24) -> Dict:
        """
        Predict price action for a ticker
        Returns: {
            'ticker': str,
            'current_price': float,
            'predicted_price': float,
            'predicted_change_pct': float,
            'confidence': float (0-1),
            'time_horizon_hours': int,
            'target_timestamp': datetime,
            'signals': dict
        }
        """
        # Get data from multiple timeframes
        data_1m = self.get_latest_data(ticker, "1m", limit=100)
        data_1h = self.get_latest_data(ticker, "1h", limit=50)
        data_1d = self.get_latest_data(ticker, "1d", limit=30)
        
        if not data_1m and not data_1h:
            logger.warning(f"No data available for {ticker}")
            return None
            
        # Use best available data
        primary_data = data_1m if data_1m else data_1h if data_1h else data_1d
        
        # Calculate indicators
        indicators = self.calculate_technical_indicators(primary_data)
        current_price = indicators.get('current_price', 0)
        
        if current_price == 0:
            return None
            
        # ML-based prediction using multiple models
        predictions = []
        confidences = []
        
        # Model 1: Momentum-based prediction
        momentum_pred, momentum_conf = self._momentum_model(indicators, time_horizon_hours)
        predictions.append(momentum_pred)
        confidences.append(momentum_conf)
        
        # Model 2: Mean reversion prediction
        reversion_pred, reversion_conf = self._mean_reversion_model(indicators, time_horizon_hours)
        predictions.append(reversion_pred)
        confidences.append(reversion_conf)
        
        # Model 3: Trend following prediction
        trend_pred, trend_conf = self._trend_following_model(indicators, primary_data, time_horizon_hours)
        predictions.append(trend_pred)
        confidences.append(trend_conf)
        
        # Model 4: Volatility-adjusted prediction
        vol_pred, vol_conf = self._volatility_model(indicators, time_horizon_hours)
        predictions.append(vol_pred)
        confidences.append(vol_conf)
        
        # Ensemble prediction (weighted by confidence)
        total_confidence = sum(confidences)
        if total_confidence > 0:
            weighted_pred = sum(p * c for p, c in zip(predictions, confidences)) / total_confidence
            avg_confidence = total_confidence / len(confidences)
        else:
            weighted_pred = np.mean(predictions)
            avg_confidence = 0.5
            
        predicted_price = current_price * (1 + weighted_pred / 100)
        target_timestamp = datetime.now() + timedelta(hours=time_horizon_hours)
        
        # Generate trading signals
        signals = self._generate_signals(indicators, weighted_pred)
        
        return {
            'ticker': ticker,
            'current_price': current_price,
            'predicted_price': predicted_price,
            'predicted_change_pct': weighted_pred,
            'confidence': avg_confidence,
            'time_horizon_hours': time_horizon_hours,
            'target_timestamp': target_timestamp,
            'signals': signals,
            'indicators': indicators
        }
        
    def _momentum_model(self, indicators: Dict, horizon_hours: int) -> Tuple[float, float]:
        """Momentum-based prediction model"""
        momentum = indicators.get('momentum', 0)
        rsi = indicators.get('rsi', 50)
        volume_trend = indicators.get('volume_trend', 1.0)
        
        # Adjust momentum for time horizon
        time_factor = horizon_hours / 24.0
        predicted_change = momentum * time_factor * 0.6
        
        # Adjust for RSI extremes
        if rsi > 70:
            predicted_change *= 0.7  # Overbought, reduce bullish prediction
        elif rsi < 30:
            predicted_change *= 1.3  # Oversold, enhance bullish prediction
            
        # Volume confirmation
        if volume_trend > 1.5:
            confidence = 0.75
        elif volume_trend > 1.0:
            confidence = 0.65
        else:
            confidence = 0.50
            
        return predicted_change, confidence
        
    def _mean_reversion_model(self, indicators: Dict, horizon_hours: int) -> Tuple[float, float]:
        """Mean reversion prediction model"""
        current_price = indicators.get('current_price', 0)
        sma_20 = indicators.get('sma_20', current_price)
        bb_upper = indicators.get('bb_upper', current_price)
        bb_lower = indicators.get('bb_lower', current_price)
        
        if current_price == 0:
            return 0.0, 0.0
            
        # Calculate distance from mean
        distance_from_mean = (current_price - sma_20) / sma_20 * 100
        
        # Predict reversion
        reversion_factor = -distance_from_mean * 0.5
        time_factor = min(horizon_hours / 24.0, 1.0)
        predicted_change = reversion_factor * time_factor
        
        # Confidence based on position in Bollinger Bands
        if current_price > bb_upper:
            confidence = 0.80  # High confidence in reversion
        elif current_price < bb_lower:
            confidence = 0.80
        elif abs(distance_from_mean) > 5:
            confidence = 0.65
        else:
            confidence = 0.45
            
        return predicted_change, confidence
        
    def _trend_following_model(self, indicators: Dict, 
                               data: List[Dict], horizon_hours: int) -> Tuple[float, float]:
        """Trend following prediction model"""
        if len(data) < 20:
            return 0.0, 0.3
            
        closes = np.array([d['close'] for d in data])
        
        # Calculate trend strength
        sma_20 = indicators.get('sma_20', closes[-1])
        sma_50 = indicators.get('sma_50', closes[-1])
        current_price = indicators.get('current_price', closes[-1])
        
        # Trend direction
        if sma_20 > sma_50:
            trend_direction = 1  # Uptrend
        else:
            trend_direction = -1  # Downtrend
            
        # Trend strength (rate of change)
        trend_strength = abs(sma_20 - sma_50) / sma_50 * 100
        
        # Linear regression for trend
        x = np.arange(len(closes[-20:]))
        y = closes[-20:]
        slope, _ = np.polyfit(x, y, 1)
        
        # Predicted change
        time_factor = horizon_hours / 24.0
        predicted_change = (slope / current_price) * 100 * time_factor * 20
        
        # Confidence based on trend consistency
        if trend_strength > 2:
            confidence = 0.75
        elif trend_strength > 1:
            confidence = 0.60
        else:
            confidence = 0.45
            
        return predicted_change, confidence
        
    def _volatility_model(self, indicators: Dict, horizon_hours: int) -> Tuple[float, float]:
        """Volatility-based prediction model"""
        volatility = indicators.get('volatility', 0)
        rsi = indicators.get('rsi', 50)
        
        # Predict range based on volatility
        time_factor = np.sqrt(horizon_hours / 24.0)
        expected_range = volatility * time_factor
        
        # Direction based on RSI
        if rsi > 50:
            predicted_change = expected_range * 0.5
        else:
            predicted_change = -expected_range * 0.5
            
        # Confidence inversely related to volatility
        if volatility < 2:
            confidence = 0.70
        elif volatility < 5:
            confidence = 0.55
        else:
            confidence = 0.40
            
        return predicted_change, confidence
        
    def _generate_signals(self, indicators: Dict, predicted_change: float) -> Dict:
        """Generate trading signals from indicators and prediction"""
        rsi = indicators.get('rsi', 50)
        current_price = indicators.get('current_price', 0)
        bb_upper = indicators.get('bb_upper', 0)
        bb_lower = indicators.get('bb_lower', 0)
        volume_trend = indicators.get('volume_trend', 1.0)
        
        signals = {
            'action': 'HOLD',
            'strength': 0,
            'reasons': []
        }
        
        score = 0
        
        # RSI signals
        if rsi < 30:
            score += 2
            signals['reasons'].append('RSI oversold')
        elif rsi < 40:
            score += 1
            signals['reasons'].append('RSI approaching oversold')
        elif rsi > 70:
            score -= 2
            signals['reasons'].append('RSI overbought')
        elif rsi > 60:
            score -= 1
            signals['reasons'].append('RSI approaching overbought')
            
        # Bollinger Band signals
        if bb_lower > 0 and current_price < bb_lower:
            score += 2
            signals['reasons'].append('Price below lower Bollinger Band')
        elif bb_upper > 0 and current_price > bb_upper:
            score -= 2
            signals['reasons'].append('Price above upper Bollinger Band')
            
        # Prediction signals
        if predicted_change > 3:
            score += 2
            signals['reasons'].append(f'Strong bullish prediction: +{predicted_change:.2f}%')
        elif predicted_change > 1:
            score += 1
            signals['reasons'].append(f'Bullish prediction: +{predicted_change:.2f}%')
        elif predicted_change < -3:
            score -= 2
            signals['reasons'].append(f'Strong bearish prediction: {predicted_change:.2f}%')
        elif predicted_change < -1:
            score -= 1
            signals['reasons'].append(f'Bearish prediction: {predicted_change:.2f}%')
            
        # Volume confirmation
        if volume_trend > 1.5:
            signals['reasons'].append('High volume confirmation')
        elif volume_trend < 0.7:
            signals['reasons'].append('Low volume warning')
            score = int(score * 0.7)
            
        # Determine action
        if score >= 3:
            signals['action'] = 'STRONG BUY'
            signals['strength'] = min(score, 5)
        elif score >= 1:
            signals['action'] = 'BUY'
            signals['strength'] = score
        elif score <= -3:
            signals['action'] = 'STRONG SELL'
            signals['strength'] = max(score, -5)
        elif score <= -1:
            signals['action'] = 'SELL'
            signals['strength'] = score
        else:
            signals['action'] = 'HOLD'
            signals['strength'] = 0
            
        return signals
        
    def save_prediction(self, prediction: Dict) -> int:
        """Save prediction to database"""
        conn = sqlite3.connect(self.predictions_db)
        cursor = conn.cursor()
        
        cursor.execute("""
            INSERT INTO predictions (
                ticker, current_price, predicted_price, predicted_change_pct,
                confidence, time_horizon_hours, target_timestamp, model_type,
                features_used
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            prediction['ticker'],
            prediction['current_price'],
            prediction['predicted_price'],
            prediction['predicted_change_pct'],
            prediction['confidence'],
            prediction['time_horizon_hours'],
            prediction['target_timestamp'].isoformat(),
            'ensemble',
            json.dumps(prediction.get('indicators', {}))
        ))
        
        prediction_id = cursor.lastrowid
        conn.commit()
        conn.close()
        
        return prediction_id
        
    def send_webhook_notification(self, predictions: List[Dict], 
                                  run_type: str = "scheduled"):
        """Send predictions via webhook"""
        if not self.webhook_url:
            logger.info("No webhook URL configured, skipping notification")
            return
            
        payload = {
            'timestamp': datetime.now().isoformat(),
            'run_type': run_type,
            'predictions_count': len(predictions),
            'predictions': predictions[:10],  # Top 10
            'summary': self._generate_summary(predictions)
        }
        
        try:
            response = requests.post(
                self.webhook_url,
                json=payload,
                headers={'Content-Type': 'application/json'},
                timeout=10
            )
            
            if response.status_code == 200:
                logger.info(f"Webhook notification sent successfully")
            else:
                logger.warning(f"Webhook returned status {response.status_code}")
                
        except Exception as e:
            logger.error(f"Failed to send webhook: {e}")
            
    def _generate_summary(self, predictions: List[Dict]) -> Dict:
        """Generate summary statistics for predictions"""
        if not predictions:
            return {}
            
        changes = [p['predicted_change_pct'] for p in predictions]
        confidences = [p['confidence'] for p in predictions]
        
        buy_signals = sum(1 for p in predictions 
                         if p['signals']['action'] in ['BUY', 'STRONG BUY'])
        sell_signals = sum(1 for p in predictions 
                          if p['signals']['action'] in ['SELL', 'STRONG SELL'])
        
        return {
            'avg_predicted_change': np.mean(changes),
            'max_predicted_gain': max(changes),
            'max_predicted_loss': min(changes),
            'avg_confidence': np.mean(confidences),
            'buy_signals': buy_signals,
            'sell_signals': sell_signals,
            'hold_signals': len(predictions) - buy_signals - sell_signals,
            'total_tickers': len(predictions)
        }
        
    def run_predictions(self, time_horizons: List[int] = [4, 12, 24]):
        """Run predictions for all tickers with multiple time horizons"""
        # Get list of tickers
        if not self.data_db_1m.exists():
            logger.error("Data database not found")
            return []
            
        conn = sqlite3.connect(self.data_db_1m)
        cursor = conn.cursor()
        cursor.execute("SELECT DISTINCT ticker FROM ticker_data_1m ORDER BY ticker")
        tickers = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        logger.info(f"Running predictions for {len(tickers)} tickers")
        
        all_predictions = []
        
        for ticker in tickers:
            if self.shutdown_flag.is_set():
                logger.info("Shutdown requested, stopping predictions")
                break
                
            try:
                for horizon in time_horizons:
                    prediction = self.predict_price_action(ticker, horizon)
                    
                    if prediction:
                        pred_id = self.save_prediction(prediction)
                        prediction['id'] = pred_id
                        all_predictions.append(prediction)
                        
                        logger.info(
                            f"{ticker}: {prediction['predicted_change_pct']:+.2f}% "
                            f"in {horizon}h (confidence: {prediction['confidence']:.2f}) "
                            f"- {prediction['signals']['action']}"
                        )
                        
            except Exception as e:
                logger.error(f"Error predicting {ticker}: {e}")
                
        # Send webhook notification
        self.send_webhook_notification(all_predictions, 
                                       run_type=f"scheduled_{datetime.now().hour}h")
        
        return all_predictions

def main():
    """Main entry point for prediction service"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Price Action Prediction Service')
    parser.add_argument('--horizons', nargs='+', type=int, default=[4, 12, 24],
                       help='Time horizons in hours (default: 4 12 24)')
    parser.add_argument('--ticker', type=str, help='Predict single ticker')
    parser.add_argument('--db-dir', type=str, default='dbs',
                       help='Database directory')
    
    args = parser.parse_args()
    
    service = PredictionService(db_dir=args.db_dir)
    
    if args.ticker:
        # Single ticker prediction
        for horizon in args.horizons:
            prediction = service.predict_price_action(args.ticker, horizon)
            if prediction:
                print(json.dumps(prediction, indent=2, default=str))
    else:
        # All tickers
        predictions = service.run_predictions(time_horizons=args.horizons)
        print(f"\nGenerated {len(predictions)} predictions")
        
        # Show top movers
        top_gainers = sorted(predictions, 
                           key=lambda x: x['predicted_change_pct'], 
                           reverse=True)[:5]
        top_losers = sorted(predictions, 
                          key=lambda x: x['predicted_change_pct'])[:5]
        
        print("\nTop 5 Predicted Gainers:")
        for p in top_gainers:
            print(f"  {p['ticker']}: +{p['predicted_change_pct']:.2f}% "
                  f"({p['time_horizon_hours']}h)")
        
        print("\nTop 5 Predicted Losers:")
        for p in top_losers:
            print(f"  {p['ticker']}: {p['predicted_change_pct']:.2f}% "
                  f"({p['time_horizon_hours']}h)")

if __name__ == '__main__':
    main()
