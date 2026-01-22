"""
Advanced GenAI Prediction Module
Enhanced prediction algorithms with multiple models
"""

import numpy as np
from typing import Dict, List, Tuple
import logging

logger = logging.getLogger(__name__)

class PredictionEngine:
    """
    Advanced prediction engine using ensemble methods
    """
    
    def __init__(self):
        self.models = [
            self._linear_regression,
            self._exponential_smoothing,
            self._momentum_based,
            self._mean_reversion
        ]
        self.weights = [0.3, 0.25, 0.25, 0.2]  # Ensemble weights
    
    def predict(self, prices: List[float], ticker: str = None) -> Dict:
        """
        Generate ensemble prediction from multiple models
        """
        try:
            prices_array = np.array(prices)
            current_price = prices_array[-1]
            
            # Get predictions from all models
            predictions = []
            for model in self.models:
                pred = model(prices_array)
                predictions.append(pred)
            
            # Weighted ensemble
            ensemble_prediction = np.average(predictions, weights=self.weights)
            
            # Calculate technical indicators
            indicators = self._calculate_indicators(prices_array)
            
            # Adjust prediction based on indicators
            adjusted_prediction = self._adjust_with_indicators(
                ensemble_prediction, 
                current_price, 
                indicators
            )
            
            # Calculate confidence
            confidence = self._calculate_confidence(predictions, indicators)
            
            # Generate recommendation
            recommendation = self._generate_recommendation(
                current_price, 
                adjusted_prediction, 
                indicators
            )
            
            return {
                'ticker': ticker,
                'predicted_price': round(float(adjusted_prediction), 2),
                'current_price': round(float(current_price), 2),
                'change_percent': round(
                    ((adjusted_prediction - current_price) / current_price) * 100, 
                    2
                ),
                'confidence': f"{round(confidence)}%",
                'recommendation': recommendation,
                'indicators': indicators,
                'model_predictions': {
                    'linear': round(float(predictions[0]), 2),
                    'exponential': round(float(predictions[1]), 2),
                    'momentum': round(float(predictions[2]), 2),
                    'mean_reversion': round(float(predictions[3]), 2),
                    'ensemble': round(float(ensemble_prediction), 2)
                }
            }
            
        except Exception as e:
            logger.error(f"Prediction error: {str(e)}")
            raise
    
    def _linear_regression(self, prices: np.ndarray) -> float:
        """Linear regression forecast"""
        X = np.arange(len(prices)).reshape(-1, 1)
        y = prices
        
        # Simple linear regression
        n = len(X)
        x_mean = X.mean()
        y_mean = y.mean()
        
        numerator = np.sum((X.flatten() - x_mean) * (y - y_mean))
        denominator = np.sum((X.flatten() - x_mean) ** 2)
        
        if denominator == 0:
            return prices[-1]
        
        slope = numerator / denominator
        intercept = y_mean - slope * x_mean
        
        # Predict next value
        next_x = len(prices)
        prediction = slope * next_x + intercept
        
        return prediction
    
    def _exponential_smoothing(self, prices: np.ndarray, alpha: float = 0.3) -> float:
        """Exponential smoothing forecast"""
        if len(prices) < 2:
            return prices[-1]
        
        # Double exponential smoothing
        level = prices[0]
        trend = prices[1] - prices[0]
        
        for price in prices[1:]:
            prev_level = level
            level = alpha * price + (1 - alpha) * (level + trend)
            trend = alpha * (level - prev_level) + (1 - alpha) * trend
        
        # Forecast one period ahead
        forecast = level + trend
        
        return forecast
    
    def _momentum_based(self, prices: np.ndarray, periods: int = 5) -> float:
        """Momentum-based forecast"""
        if len(prices) < periods:
            periods = len(prices)
        
        current_price = prices[-1]
        past_price = prices[-periods]
        
        momentum = current_price - past_price
        forecast = current_price + (momentum / periods)
        
        return forecast
    
    def _mean_reversion(self, prices: np.ndarray, window: int = 20) -> float:
        """Mean reversion forecast"""
        if len(prices) < window:
            window = len(prices)
        
        mean = np.mean(prices[-window:])
        current_price = prices[-1]
        
        # Assume partial reversion to mean
        reversion_speed = 0.3
        forecast = current_price + reversion_speed * (mean - current_price)
        
        return forecast
    
    def _calculate_indicators(self, prices: np.ndarray) -> Dict:
        """Calculate technical indicators"""
        indicators = {}
        
        # Simple Moving Averages
        indicators['sma_20'] = self._sma(prices, 20)
        indicators['sma_50'] = self._sma(prices, 50)
        indicators['sma_200'] = self._sma(prices, 200)
        
        # RSI
        indicators['rsi'] = self._rsi(prices, 14)
        
        # Volatility
        indicators['volatility'] = self._volatility(prices, 20)
        
        # MACD
        macd, signal = self._macd(prices)
        indicators['macd'] = macd
        indicators['macd_signal'] = signal
        
        # Bollinger Bands
        bb_upper, bb_lower = self._bollinger_bands(prices)
        indicators['bb_upper'] = bb_upper
        indicators['bb_lower'] = bb_lower
        
        # Support and Resistance
        indicators['support'] = self._find_support(prices)
        indicators['resistance'] = self._find_resistance(prices)
        
        return {k: round(float(v), 2) if v is not None else None 
                for k, v in indicators.items()}
    
    def _sma(self, prices: np.ndarray, period: int) -> float:
        """Simple Moving Average"""
        if len(prices) < period:
            return prices[-1] if len(prices) > 0 else None
        return np.mean(prices[-period:])
    
    def _rsi(self, prices: np.ndarray, period: int = 14) -> float:
        """Relative Strength Index"""
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
    
    def _volatility(self, prices: np.ndarray, period: int = 20) -> float:
        """Price volatility (standard deviation of returns)"""
        if len(prices) < period + 1:
            period = len(prices) - 1
        
        if period <= 0:
            return 0.0
        
        returns = np.diff(prices[-period-1:]) / prices[-period-1:-1]
        volatility = np.std(returns)
        
        return volatility
    
    def _macd(self, prices: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> Tuple[float, float]:
        """MACD indicator"""
        if len(prices) < slow:
            return 0.0, 0.0
        
        # Calculate EMAs
        ema_fast = self._ema(prices, fast)
        ema_slow = self._ema(prices, slow)
        
        macd_line = ema_fast - ema_slow
        
        # Signal line (simplified)
        signal_line = macd_line * 0.9  # Simplified
        
        return macd_line, signal_line
    
    def _ema(self, prices: np.ndarray, period: int) -> float:
        """Exponential Moving Average"""
        if len(prices) < period:
            return np.mean(prices)
        
        multiplier = 2 / (period + 1)
        ema = prices[0]
        
        for price in prices[1:]:
            ema = (price - ema) * multiplier + ema
        
        return ema
    
    def _bollinger_bands(self, prices: np.ndarray, period: int = 20, std_dev: int = 2) -> Tuple[float, float]:
        """Bollinger Bands"""
        if len(prices) < period:
            period = len(prices)
        
        sma = np.mean(prices[-period:])
        std = np.std(prices[-period:])
        
        upper = sma + (std_dev * std)
        lower = sma - (std_dev * std)
        
        return upper, lower
    
    def _find_support(self, prices: np.ndarray, window: int = 20) -> float:
        """Find support level"""
        if len(prices) < window:
            window = len(prices)
        
        recent_prices = prices[-window:]
        support = np.min(recent_prices)
        
        return support
    
    def _find_resistance(self, prices: np.ndarray, window: int = 20) -> float:
        """Find resistance level"""
        if len(prices) < window:
            window = len(prices)
        
        recent_prices = prices[-window:]
        resistance = np.max(recent_prices)
        
        return resistance
    
    def _adjust_with_indicators(self, prediction: float, current_price: float, indicators: Dict) -> float:
        """Adjust prediction based on technical indicators"""
        adjusted = prediction
        
        # RSI adjustment
        rsi = indicators.get('rsi', 50)
        if rsi > 70:  # Overbought
            adjusted *= 0.98
        elif rsi < 30:  # Oversold
            adjusted *= 1.02
        
        # MACD adjustment
        macd = indicators.get('macd', 0)
        signal = indicators.get('macd_signal', 0)
        if macd > signal:  # Bullish
            adjusted *= 1.01
        elif macd < signal:  # Bearish
            adjusted *= 0.99
        
        # Bollinger Bands adjustment
        bb_upper = indicators.get('bb_upper')
        bb_lower = indicators.get('bb_lower')
        if bb_upper and bb_lower:
            if current_price > bb_upper:  # Price above upper band
                adjusted *= 0.99
            elif current_price < bb_lower:  # Price below lower band
                adjusted *= 1.01
        
        return adjusted
    
    def _calculate_confidence(self, predictions: List[float], indicators: Dict) -> float:
        """Calculate prediction confidence"""
        # Variance between models
        variance = np.var(predictions)
        max_variance = 100.0
        variance_score = max(0, 100 - (variance / max_variance * 100))
        
        # Volatility factor
        volatility = indicators.get('volatility', 0)
        volatility_score = max(0, 100 - (volatility * 1000))
        
        # RSI factor (extreme values reduce confidence)
        rsi = indicators.get('rsi', 50)
        rsi_distance = abs(50 - rsi)
        rsi_score = max(0, 100 - (rsi_distance * 2))
        
        # Combined confidence
        confidence = (variance_score * 0.4 + volatility_score * 0.4 + rsi_score * 0.2)
        
        return min(100, max(0, confidence))
    
    def _generate_recommendation(self, current_price: float, predicted_price: float, indicators: Dict) -> str:
        """Generate trading recommendation"""
        change_percent = ((predicted_price - current_price) / current_price) * 100
        rsi = indicators.get('rsi', 50)
        macd = indicators.get('macd', 0)
        signal = indicators.get('macd_signal', 0)
        
        # Strong signals
        if change_percent > 5 and rsi < 70 and macd > signal:
            return 'STRONG BUY'
        elif change_percent < -5 and rsi > 30 and macd < signal:
            return 'STRONG SELL'
        
        # Moderate signals
        elif change_percent > 2 and rsi < 60:
            return 'BUY'
        elif change_percent < -2 and rsi > 40:
            return 'SELL'
        
        # Default
        else:
            return 'HOLD'


# Global prediction engine instance
prediction_engine = PredictionEngine()


def get_prediction(ticker: str, prices: List[float]) -> Dict:
    """
    Get prediction for a ticker
    Convenience function to use the global prediction engine
    """
    return prediction_engine.predict(prices, ticker)
