#!/usr/bin/env python3
"""
GenAI-Powered Market Forecasting Engine
Provides advanced forecasting for DOW and S&P 500 with pattern recognition,
technical analysis, and AI-driven predictions.
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
from scipy import stats
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestRegressor
import warnings
warnings.filterwarnings('ignore')


class MarketForecaster:
    """Advanced market forecasting engine with pattern recognition"""
    
    def __init__(self, symbol):
        self.symbol = symbol
        self.ticker = yf.Ticker(symbol)
        self.data = None
        self.forecast_time = None
        
    def fetch_historical_data(self, period="5d", interval="1m"):
        """Fetch comprehensive historical data"""
        print(f"Fetching historical data for {self.symbol}...")
        self.data = self.ticker.history(period=period, interval=interval)
        if self.data.empty:
            raise ValueError(f"No data available for {self.symbol}")
        return self.data
    
    def calculate_advanced_indicators(self):
        """Calculate comprehensive technical indicators"""
        if self.data is None or self.data.empty:
            return {}
        
        df = self.data.copy()
        
        # Moving Averages
        df['SMA_9'] = df['Close'].rolling(window=9).mean()
        df['SMA_20'] = df['Close'].rolling(window=20).mean()
        df['SMA_50'] = df['Close'].rolling(window=50).mean()
        df['SMA_200'] = df['Close'].rolling(window=200).mean()
        df['EMA_9'] = df['Close'].ewm(span=9, adjust=False).mean()
        df['EMA_12'] = df['Close'].ewm(span=12, adjust=False).mean()
        df['EMA_26'] = df['Close'].ewm(span=26, adjust=False).mean()
        df['EMA_50'] = df['Close'].ewm(span=50, adjust=False).mean()
        
        # MACD
        df['MACD'] = df['EMA_12'] - df['EMA_26']
        df['MACD_Signal'] = df['MACD'].ewm(span=9, adjust=False).mean()
        df['MACD_Histogram'] = df['MACD'] - df['MACD_Signal']
        
        # RSI
        delta = df['Close'].diff()
        gain = (delta.where(delta > 0, 0)).rolling(window=14).mean()
        loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
        rs = gain / loss
        df['RSI'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands
        df['BB_Middle'] = df['Close'].rolling(window=20).mean()
        df['BB_Std'] = df['Close'].rolling(window=20).std()
        df['BB_Upper'] = df['BB_Middle'] + (df['BB_Std'] * 2)
        df['BB_Lower'] = df['BB_Middle'] - (df['BB_Std'] * 2)
        df['BB_Width'] = (df['BB_Upper'] - df['BB_Lower']) / df['BB_Middle'] * 100
        
        # Stochastic Oscillator
        low_min = df['Low'].rolling(window=14).min()
        high_max = df['High'].rolling(window=14).max()
        df['Stochastic_K'] = 100 * ((df['Close'] - low_min) / (high_max - low_min))
        df['Stochastic_D'] = df['Stochastic_K'].rolling(window=3).mean()
        
        # ATR (Average True Range)
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        df['ATR'] = true_range.rolling(14).mean()
        
        # Volume indicators
        df['Volume_SMA'] = df['Volume'].rolling(window=20).mean()
        df['Volume_Ratio'] = df['Volume'] / df['Volume_SMA']
        
        # Price Rate of Change
        df['ROC'] = ((df['Close'] - df['Close'].shift(12)) / df['Close'].shift(12)) * 100
        
        # Williams %R
        df['Williams_R'] = -100 * ((high_max - df['Close']) / (high_max - low_min))
        
        # CCI (Commodity Channel Index)
        tp = (df['High'] + df['Low'] + df['Close']) / 3
        df['CCI'] = (tp - tp.rolling(20).mean()) / (0.015 * tp.rolling(20).std())
        
        # OBV (On-Balance Volume)
        df['OBV'] = (np.sign(df['Close'].diff()) * df['Volume']).fillna(0).cumsum()
        
        # Momentum
        df['Momentum'] = df['Close'].diff(10)
        
        self.data = df
        return df
    
    def detect_patterns(self):
        """Detect chart patterns using advanced algorithms"""
        if self.data is None or len(self.data) < 50:
            return {}
        
        patterns = {
            'head_and_shoulders': self._detect_head_and_shoulders(),
            'double_top': self._detect_double_top(),
            'double_bottom': self._detect_double_bottom(),
            'triangle': self._detect_triangle(),
            'flag': self._detect_flag(),
            'wedge': self._detect_wedge(),
            'cup_and_handle': self._detect_cup_and_handle(),
            'channels': self._detect_channels(),
            'fibonacci_levels': self._calculate_fibonacci_levels(),
            'support_resistance': self._find_support_resistance(),
        }
        
        return patterns
    
    def _detect_head_and_shoulders(self):
        """Detect head and shoulders pattern"""
        prices = self.data['Close'].values[-100:]
        
        if len(prices) < 60:
            return {'detected': False}
        
        # Find local maxima
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(prices, distance=10)
        
        if len(peaks) >= 3:
            last_three = peaks[-3:]
            heights = prices[last_three]
            
            # Head should be higher than both shoulders
            if heights[1] > heights[0] and heights[1] > heights[2]:
                # Shoulders should be relatively equal
                shoulder_diff = abs(heights[0] - heights[2]) / heights[1]
                if shoulder_diff < 0.05:  # 5% tolerance
                    return {
                        'detected': True,
                        'type': 'bearish',
                        'confidence': 0.75,
                        'neckline': float(np.mean([prices[last_three[0]], prices[last_three[2]]])),
                        'target': float(prices[last_three[1]] - (heights[1] - np.mean([heights[0], heights[2]])))
                    }
        
        return {'detected': False}
    
    def _detect_double_top(self):
        """Detect double top pattern"""
        prices = self.data['Close'].values[-80:]
        
        from scipy.signal import find_peaks
        peaks, properties = find_peaks(prices, distance=15, prominence=prices.std() * 0.5)
        
        if len(peaks) >= 2:
            last_two = peaks[-2:]
            heights = prices[last_two]
            
            # Peaks should be similar height
            if abs(heights[0] - heights[1]) / heights[0] < 0.02:  # 2% tolerance
                valley_idx = np.argmin(prices[last_two[0]:last_two[1]]) + last_two[0]
                return {
                    'detected': True,
                    'type': 'bearish',
                    'confidence': 0.70,
                    'resistance': float(np.mean(heights)),
                    'support': float(prices[valley_idx]),
                    'target': float(prices[valley_idx] - (np.mean(heights) - prices[valley_idx]))
                }
        
        return {'detected': False}
    
    def _detect_double_bottom(self):
        """Detect double bottom pattern"""
        prices = self.data['Close'].values[-80:]
        
        from scipy.signal import find_peaks
        troughs, properties = find_peaks(-prices, distance=15, prominence=prices.std() * 0.5)
        
        if len(troughs) >= 2:
            last_two = troughs[-2:]
            depths = prices[last_two]
            
            # Troughs should be similar depth
            if abs(depths[0] - depths[1]) / depths[0] < 0.02:  # 2% tolerance
                peak_idx = np.argmax(prices[last_two[0]:last_two[1]]) + last_two[0]
                return {
                    'detected': True,
                    'type': 'bullish',
                    'confidence': 0.70,
                    'support': float(np.mean(depths)),
                    'resistance': float(prices[peak_idx]),
                    'target': float(prices[peak_idx] + (prices[peak_idx] - np.mean(depths)))
                }
        
        return {'detected': False}
    
    def _detect_triangle(self):
        """Detect triangle patterns"""
        prices = self.data['Close'].values[-100:]
        
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(prices, distance=10)
        troughs, _ = find_peaks(-prices, distance=10)
        
        if len(peaks) >= 3 and len(troughs) >= 3:
            # Fit trend lines
            peak_prices = prices[peaks[-3:]]
            trough_prices = prices[troughs[-3:]]
            
            # Calculate slopes
            peak_slope = np.polyfit(range(len(peak_prices)), peak_prices, 1)[0]
            trough_slope = np.polyfit(range(len(trough_prices)), trough_prices, 1)[0]
            
            # Ascending triangle
            if abs(peak_slope) < 0.1 and trough_slope > 0.1:
                return {
                    'detected': True,
                    'type': 'ascending',
                    'pattern_type': 'bullish',
                    'confidence': 0.65,
                    'upper_bound': float(np.mean(peak_prices)),
                    'lower_slope': float(trough_slope)
                }
            
            # Descending triangle
            if abs(trough_slope) < 0.1 and peak_slope < -0.1:
                return {
                    'detected': True,
                    'type': 'descending',
                    'pattern_type': 'bearish',
                    'confidence': 0.65,
                    'lower_bound': float(np.mean(trough_prices)),
                    'upper_slope': float(peak_slope)
                }
            
            # Symmetrical triangle
            if peak_slope < 0 and trough_slope > 0:
                return {
                    'detected': True,
                    'type': 'symmetrical',
                    'pattern_type': 'neutral',
                    'confidence': 0.60,
                    'apex_price': float((peak_prices[-1] + trough_prices[-1]) / 2)
                }
        
        return {'detected': False}
    
    def _detect_flag(self):
        """Detect flag pattern"""
        prices = self.data['Close'].values[-60:]
        
        if len(prices) < 40:
            return {'detected': False}
        
        # Strong move (pole)
        pole = prices[:20]
        flag_body = prices[20:]
        
        pole_change = (pole[-1] - pole[0]) / pole[0]
        
        # Check for strong initial move
        if abs(pole_change) > 0.03:  # 3% move
            # Flag consolidation
            flag_slope = np.polyfit(range(len(flag_body)), flag_body, 1)[0]
            
            # Bullish flag (uptrend pole, slight downward flag)
            if pole_change > 0 and flag_slope < 0:
                return {
                    'detected': True,
                    'type': 'bullish',
                    'confidence': 0.60,
                    'pole_gain': float(pole_change),
                    'target': float(flag_body[-1] * (1 + abs(pole_change)))
                }
            
            # Bearish flag (downtrend pole, slight upward flag)
            if pole_change < 0 and flag_slope > 0:
                return {
                    'detected': True,
                    'type': 'bearish',
                    'confidence': 0.60,
                    'pole_loss': float(pole_change),
                    'target': float(flag_body[-1] * (1 + pole_change))
                }
        
        return {'detected': False}
    
    def _detect_wedge(self):
        """Detect wedge patterns"""
        prices = self.data['Close'].values[-100:]
        
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(prices, distance=10)
        troughs, _ = find_peaks(-prices, distance=10)
        
        if len(peaks) >= 3 and len(troughs) >= 3:
            peak_prices = prices[peaks[-3:]]
            trough_prices = prices[troughs[-3:]]
            
            peak_slope = np.polyfit(range(len(peak_prices)), peak_prices, 1)[0]
            trough_slope = np.polyfit(range(len(trough_prices)), trough_prices, 1)[0]
            
            # Rising wedge (both slopes positive, bearish)
            if peak_slope > 0 and trough_slope > 0 and trough_slope > peak_slope * 0.5:
                return {
                    'detected': True,
                    'type': 'rising',
                    'pattern_type': 'bearish',
                    'confidence': 0.65
                }
            
            # Falling wedge (both slopes negative, bullish)
            if peak_slope < 0 and trough_slope < 0 and trough_slope < peak_slope * 0.5:
                return {
                    'detected': True,
                    'type': 'falling',
                    'pattern_type': 'bullish',
                    'confidence': 0.65
                }
        
        return {'detected': False}
    
    def _detect_cup_and_handle(self):
        """Detect cup and handle pattern"""
        prices = self.data['Close'].values[-120:]
        
        if len(prices) < 100:
            return {'detected': False}
        
        # Cup formation (U-shape)
        cup = prices[:80]
        handle = prices[80:]
        
        # Check for U-shape in cup
        cup_mid = len(cup) // 2
        if cup[0] > cup[cup_mid] and cup[-1] > cup[cup_mid]:
            # Check if sides are at similar levels
            if abs(cup[0] - cup[-1]) / cup[0] < 0.05:
                # Handle should be smaller consolidation
                handle_depth = (max(handle) - min(handle)) / max(handle)
                if handle_depth < 0.15:  # Shallow handle
                    return {
                        'detected': True,
                        'type': 'bullish',
                        'confidence': 0.70,
                        'cup_bottom': float(cup[cup_mid]),
                        'rim': float(cup[-1]),
                        'target': float(cup[-1] + (cup[-1] - cup[cup_mid]))
                    }
        
        return {'detected': False}
    
    def _detect_channels(self):
        """Detect price channels"""
        prices = self.data['Close'].values[-100:]
        
        from scipy.signal import find_peaks
        peaks, _ = find_peaks(prices, distance=10)
        troughs, _ = find_peaks(-prices, distance=10)
        
        if len(peaks) >= 3 and len(troughs) >= 3:
            peak_prices = prices[peaks[-3:]]
            trough_prices = prices[troughs[-3:]]
            
            # Fit trend lines
            peak_fit = np.polyfit(peaks[-3:], peak_prices, 1)
            trough_fit = np.polyfit(troughs[-3:], trough_prices, 1)
            
            # Check if slopes are similar (parallel channel)
            slope_diff = abs(peak_fit[0] - trough_fit[0])
            if slope_diff < 0.5:
                channel_width = abs(np.mean(peak_prices) - np.mean(trough_prices))
                current_price = prices[-1]
                
                # Calculate position in channel
                upper_line = peak_fit[0] * len(prices) + peak_fit[1]
                lower_line = trough_fit[0] * len(prices) + trough_fit[1]
                position = (current_price - lower_line) / (upper_line - lower_line)
                
                return {
                    'detected': True,
                    'type': 'ascending' if peak_fit[0] > 0 else 'descending' if peak_fit[0] < 0 else 'horizontal',
                    'upper_channel': float(upper_line),
                    'lower_channel': float(lower_line),
                    'channel_width': float(channel_width),
                    'position_in_channel': float(position),
                    'slope': float(peak_fit[0])
                }
        
        return {'detected': False}
    
    def _calculate_fibonacci_levels(self):
        """Calculate Fibonacci retracement levels"""
        prices = self.data['Close'].values[-100:]
        
        high = np.max(prices)
        low = np.min(prices)
        diff = high - low
        
        return {
            'detected': True,
            'high': float(high),
            'low': float(low),
            'level_0': float(high),
            'level_236': float(high - 0.236 * diff),
            'level_382': float(high - 0.382 * diff),
            'level_500': float(high - 0.500 * diff),
            'level_618': float(high - 0.618 * diff),
            'level_786': float(high - 0.786 * diff),
            'level_100': float(low),
            'extension_1272': float(high + 0.272 * diff),
            'extension_1618': float(high + 0.618 * diff)
        }
    
    def _find_support_resistance(self):
        """Find key support and resistance levels"""
        prices = self.data['Close'].values[-200:]
        
        from scipy.signal import find_peaks
        
        # Find significant peaks and troughs
        peaks, peak_props = find_peaks(prices, distance=10, prominence=prices.std() * 0.5)
        troughs, trough_props = find_peaks(-prices, distance=10, prominence=prices.std() * 0.5)
        
        # Get resistance levels (peaks)
        resistance_prices = prices[peaks]
        resistance_levels = []
        for price in resistance_prices:
            # Group similar prices
            similar = [r for r in resistance_levels if abs(r - price) / price < 0.01]
            if not similar:
                resistance_levels.append(float(price))
        
        # Get support levels (troughs)
        support_prices = prices[troughs]
        support_levels = []
        for price in support_prices:
            # Group similar prices
            similar = [s for s in support_levels if abs(s - price) / price < 0.01]
            if not similar:
                support_levels.append(float(price))
        
        current_price = float(prices[-1])
        
        # Find nearest levels
        resistance_above = [r for r in resistance_levels if r > current_price]
        support_below = [s for s in support_levels if s < current_price]
        
        return {
            'detected': True,
            'current_price': current_price,
            'nearest_resistance': sorted(resistance_above)[:3] if resistance_above else [],
            'nearest_support': sorted(support_below, reverse=True)[:3] if support_below else [],
            'all_resistance': sorted(resistance_levels, reverse=True),
            'all_support': sorted(support_levels, reverse=True)
        }
    
    def generate_ml_forecast(self, periods_ahead=30):
        """Generate machine learning-based forecast"""
        if self.data is None or len(self.data) < 100:
            return {}
        
        df = self.data.copy()
        df = df.dropna()
        
        # Feature engineering
        features = []
        for i in range(1, 11):
            df[f'lag_{i}'] = df['Close'].shift(i)
            features.append(f'lag_{i}')
        
        df['hour'] = pd.to_datetime(df.index).hour
        df['minute'] = pd.to_datetime(df.index).minute
        df['day_of_week'] = pd.to_datetime(df.index).dayofweek
        
        feature_cols = features + ['hour', 'minute', 'day_of_week', 'Volume', 
                                    'RSI', 'MACD', 'Stochastic_K', 'ATR']
        feature_cols = [col for col in feature_cols if col in df.columns]
        
        df = df.dropna()
        
        if len(df) < 50:
            return {}
        
        X = df[feature_cols].values
        y = df['Close'].values
        
        # Train on most recent data
        train_size = len(X) - periods_ahead
        if train_size < 30:
            return {}
        
        X_train = X[:train_size]
        y_train = y[:train_size]
        
        # Multiple models ensemble
        models = []
        
        # Linear regression
        lr_model = LinearRegression()
        lr_model.fit(X_train, y_train)
        models.append(('linear', lr_model))
        
        # Random Forest
        rf_model = RandomForestRegressor(n_estimators=50, max_depth=10, random_state=42)
        rf_model.fit(X_train, y_train)
        models.append(('random_forest', rf_model))
        
        # Generate predictions
        last_X = X[-1:]
        predictions = []
        
        for model_name, model in models:
            pred = model.predict(last_X)[0]
            predictions.append(pred)
        
        # Ensemble average
        ensemble_prediction = np.mean(predictions)
        prediction_std = np.std(predictions)
        
        # Calculate confidence intervals
        confidence_95_upper = ensemble_prediction + (1.96 * prediction_std)
        confidence_95_lower = ensemble_prediction - (1.96 * prediction_std)
        confidence_68_upper = ensemble_prediction + prediction_std
        confidence_68_lower = ensemble_prediction - prediction_std
        
        return {
            'predicted_price': float(ensemble_prediction),
            'confidence_95_upper': float(confidence_95_upper),
            'confidence_95_lower': float(confidence_95_lower),
            'confidence_68_upper': float(confidence_68_upper),
            'confidence_68_lower': float(confidence_68_lower),
            'models_agreement': float(1 - (prediction_std / ensemble_prediction)),
            'individual_predictions': {
                'linear_regression': float(predictions[0]),
                'random_forest': float(predictions[1])
            }
        }
    
    def generate_comprehensive_forecast(self, target_time="Monday 1 PM"):
        """Generate comprehensive forecast with all analyses"""
        print(f"\n{'='*80}")
        print(f"GENERATING COMPREHENSIVE FORECAST FOR {self.symbol}")
        print(f"Target Time: {target_time}")
        print(f"{'='*80}\n")
        
        # Fetch and analyze data
        self.fetch_historical_data(period="5d", interval="1m")
        self.calculate_advanced_indicators()
        
        # Current market state
        current = self.data.iloc[-1]
        
        # Technical analysis
        indicators = {
            'current_price': float(current['Close']),
            'sma_9': float(current['SMA_9']) if not pd.isna(current['SMA_9']) else None,
            'sma_20': float(current['SMA_20']) if not pd.isna(current['SMA_20']) else None,
            'sma_50': float(current['SMA_50']) if not pd.isna(current['SMA_50']) else None,
            'ema_12': float(current['EMA_12']) if not pd.isna(current['EMA_12']) else None,
            'ema_26': float(current['EMA_26']) if not pd.isna(current['EMA_26']) else None,
            'rsi': float(current['RSI']) if not pd.isna(current['RSI']) else None,
            'macd': float(current['MACD']) if not pd.isna(current['MACD']) else None,
            'macd_signal': float(current['MACD_Signal']) if not pd.isna(current['MACD_Signal']) else None,
            'macd_histogram': float(current['MACD_Histogram']) if not pd.isna(current['MACD_Histogram']) else None,
            'bb_upper': float(current['BB_Upper']) if not pd.isna(current['BB_Upper']) else None,
            'bb_middle': float(current['BB_Middle']) if not pd.isna(current['BB_Middle']) else None,
            'bb_lower': float(current['BB_Lower']) if not pd.isna(current['BB_Lower']) else None,
            'stochastic_k': float(current['Stochastic_K']) if not pd.isna(current['Stochastic_K']) else None,
            'stochastic_d': float(current['Stochastic_D']) if not pd.isna(current['Stochastic_D']) else None,
            'atr': float(current['ATR']) if not pd.isna(current['ATR']) else None,
            'volume_ratio': float(current['Volume_Ratio']) if not pd.isna(current['Volume_Ratio']) else None,
            'roc': float(current['ROC']) if not pd.isna(current['ROC']) else None,
            'williams_r': float(current['Williams_R']) if not pd.isna(current['Williams_R']) else None,
            'cci': float(current['CCI']) if not pd.isna(current['CCI']) else None,
        }
        
        # Pattern detection
        patterns = self.detect_patterns()
        
        # ML forecast
        ml_forecast = self.generate_ml_forecast(periods_ahead=30)
        
        # Sentiment analysis based on indicators
        sentiment = self._calculate_market_sentiment(indicators, patterns)
        
        # Price targets
        targets = self._calculate_price_targets(indicators, patterns, ml_forecast)
        
        forecast = {
            'symbol': self.symbol,
            'timestamp': datetime.now().isoformat(),
            'target_time': target_time,
            'current_market_state': indicators,
            'patterns_detected': patterns,
            'ml_forecast': ml_forecast,
            'market_sentiment': sentiment,
            'price_targets': targets,
            'trading_signals': self._generate_trading_signals(indicators, patterns, sentiment),
            'risk_assessment': self._assess_risk(indicators, patterns),
            'forecast_narrative': self._generate_narrative(indicators, patterns, ml_forecast, sentiment, targets)
        }
        
        return forecast
    
    def _calculate_market_sentiment(self, indicators, patterns):
        """Calculate overall market sentiment"""
        bullish_score = 0
        bearish_score = 0
        neutral_score = 0
        
        # RSI analysis
        rsi = indicators.get('rsi')
        if rsi:
            if rsi < 30:
                bullish_score += 2  # Oversold
            elif rsi > 70:
                bearish_score += 2  # Overbought
            elif 40 <= rsi <= 60:
                neutral_score += 1
        
        # MACD analysis
        macd_hist = indicators.get('macd_histogram')
        if macd_hist:
            if macd_hist > 0:
                bullish_score += 1
            else:
                bearish_score += 1
        
        # Moving average crossovers
        price = indicators.get('current_price')
        sma_20 = indicators.get('sma_20')
        sma_50 = indicators.get('sma_50')
        
        if price and sma_20:
            if price > sma_20:
                bullish_score += 1
            else:
                bearish_score += 1
        
        if price and sma_50:
            if price > sma_50:
                bullish_score += 1
            else:
                bearish_score += 1
        
        # Stochastic
        stoch_k = indicators.get('stochastic_k')
        if stoch_k:
            if stoch_k < 20:
                bullish_score += 1
            elif stoch_k > 80:
                bearish_score += 1
        
        # Pattern analysis
        for pattern_name, pattern_data in patterns.items():
            if isinstance(pattern_data, dict) and pattern_data.get('detected'):
                pattern_type = pattern_data.get('pattern_type') or pattern_data.get('type')
                confidence = pattern_data.get('confidence', 0.5)
                
                if pattern_type == 'bullish':
                    bullish_score += 2 * confidence
                elif pattern_type == 'bearish':
                    bearish_score += 2 * confidence
        
        total = bullish_score + bearish_score + neutral_score
        if total == 0:
            total = 1
        
        sentiment_score = (bullish_score - bearish_score) / total
        
        if sentiment_score > 0.3:
            sentiment = 'STRONGLY_BULLISH'
        elif sentiment_score > 0.1:
            sentiment = 'BULLISH'
        elif sentiment_score > -0.1:
            sentiment = 'NEUTRAL'
        elif sentiment_score > -0.3:
            sentiment = 'BEARISH'
        else:
            sentiment = 'STRONGLY_BEARISH'
        
        return {
            'overall': sentiment,
            'score': float(sentiment_score),
            'bullish_factors': int(bullish_score),
            'bearish_factors': int(bearish_score),
            'neutral_factors': int(neutral_score),
            'confidence': float(abs(sentiment_score))
        }
    
    def _calculate_price_targets(self, indicators, patterns, ml_forecast):
        """Calculate price targets based on multiple factors"""
        current_price = indicators.get('current_price', 0)
        atr = indicators.get('atr', current_price * 0.01)
        
        targets = {
            'current': float(current_price),
            'short_term': {},
            'medium_term': {},
            'long_term': {}
        }
        
        # ML-based target
        if ml_forecast:
            targets['ml_prediction'] = {
                'target': ml_forecast.get('predicted_price'),
                'upper_95': ml_forecast.get('confidence_95_upper'),
                'lower_95': ml_forecast.get('confidence_95_lower'),
                'confidence': ml_forecast.get('models_agreement')
            }
        
        # ATR-based targets
        targets['short_term']['resistance'] = float(current_price + atr)
        targets['short_term']['support'] = float(current_price - atr)
        targets['medium_term']['resistance'] = float(current_price + (atr * 2))
        targets['medium_term']['support'] = float(current_price - (atr * 2))
        targets['long_term']['resistance'] = float(current_price + (atr * 3))
        targets['long_term']['support'] = float(current_price - (atr * 3))
        
        # Pattern-based targets
        pattern_targets = []
        for pattern_name, pattern_data in patterns.items():
            if isinstance(pattern_data, dict) and pattern_data.get('detected'):
                if 'target' in pattern_data:
                    pattern_targets.append(pattern_data['target'])
        
        if pattern_targets:
            targets['pattern_based'] = {
                'targets': pattern_targets,
                'average': float(np.mean(pattern_targets))
            }
        
        # Fibonacci targets
        fib = patterns.get('fibonacci_levels', {})
        if fib.get('detected'):
            targets['fibonacci'] = {
                'level_236': fib.get('level_236'),
                'level_382': fib.get('level_382'),
                'level_500': fib.get('level_500'),
                'level_618': fib.get('level_618'),
                'extension_1272': fib.get('extension_1272'),
                'extension_1618': fib.get('extension_1618')
            }
        
        return targets
    
    def _generate_trading_signals(self, indicators, patterns, sentiment):
        """Generate specific trading signals"""
        signals = []
        
        # Strong buy signals
        if sentiment['overall'] in ['STRONGLY_BULLISH', 'BULLISH']:
            signals.append({
                'type': 'BUY',
                'strength': 'STRONG' if sentiment['overall'] == 'STRONGLY_BULLISH' else 'MODERATE',
                'reason': 'Bullish sentiment supported by technical indicators',
                'confidence': sentiment['confidence']
            })
        
        # Strong sell signals
        if sentiment['overall'] in ['STRONGLY_BEARISH', 'BEARISH']:
            signals.append({
                'type': 'SELL',
                'strength': 'STRONG' if sentiment['overall'] == 'STRONGLY_BEARISH' else 'MODERATE',
                'reason': 'Bearish sentiment indicated by technical analysis',
                'confidence': sentiment['confidence']
            })
        
        # RSI signals
        rsi = indicators.get('rsi')
        if rsi:
            if rsi < 30:
                signals.append({
                    'type': 'BUY',
                    'strength': 'MODERATE',
                    'reason': f'RSI oversold at {rsi:.2f}',
                    'confidence': 0.7
                })
            elif rsi > 70:
                signals.append({
                    'type': 'SELL',
                    'strength': 'MODERATE',
                    'reason': f'RSI overbought at {rsi:.2f}',
                    'confidence': 0.7
                })
        
        # MACD signals
        macd_hist = indicators.get('macd_histogram')
        if macd_hist:
            if macd_hist > 0 and indicators.get('macd', 0) > indicators.get('macd_signal', 0):
                signals.append({
                    'type': 'BUY',
                    'strength': 'MODERATE',
                    'reason': 'MACD bullish crossover',
                    'confidence': 0.65
                })
            elif macd_hist < 0 and indicators.get('macd', 0) < indicators.get('macd_signal', 0):
                signals.append({
                    'type': 'SELL',
                    'strength': 'MODERATE',
                    'reason': 'MACD bearish crossover',
                    'confidence': 0.65
                })
        
        return signals
    
    def _assess_risk(self, indicators, patterns):
        """Assess market risk levels"""
        risk_factors = []
        risk_score = 0
        
        # Volatility risk
        atr = indicators.get('atr', 0)
        price = indicators.get('current_price', 1)
        atr_percent = (atr / price) * 100
        
        if atr_percent > 2:
            risk_factors.append('High volatility detected')
            risk_score += 2
        elif atr_percent > 1:
            risk_factors.append('Moderate volatility')
            risk_score += 1
        
        # RSI extremes
        rsi = indicators.get('rsi')
        if rsi:
            if rsi > 80 or rsi < 20:
                risk_factors.append('RSI at extreme levels')
                risk_score += 1
        
        # Bollinger Band width
        bb_upper = indicators.get('bb_upper')
        bb_lower = indicators.get('bb_lower')
        if bb_upper and bb_lower and price:
            bb_width = ((bb_upper - bb_lower) / price) * 100
            if bb_width > 5:
                risk_factors.append('Wide Bollinger Bands indicate high volatility')
                risk_score += 1
        
        # Volume analysis
        vol_ratio = indicators.get('volume_ratio')
        if vol_ratio:
            if vol_ratio < 0.5:
                risk_factors.append('Low volume may indicate weak conviction')
                risk_score += 1
            elif vol_ratio > 2:
                risk_factors.append('High volume may indicate increased volatility')
                risk_score += 1
        
        if risk_score == 0:
            risk_level = 'LOW'
        elif risk_score <= 2:
            risk_level = 'MODERATE'
        elif risk_score <= 4:
            risk_level = 'HIGH'
        else:
            risk_level = 'VERY_HIGH'
        
        return {
            'level': risk_level,
            'score': risk_score,
            'factors': risk_factors
        }
    
    def _generate_narrative(self, indicators, patterns, ml_forecast, sentiment, targets):
        """Generate human-readable forecast narrative"""
        current_price = indicators.get('current_price', 0)
        symbol_name = "S&P 500" if self.symbol == "^GSPC" else "Dow Jones Industrial Average"
        
        narrative = []
        
        # Opening statement
        narrative.append(f"**{symbol_name} ({self.symbol}) - Comprehensive Forecast Analysis**")
        narrative.append(f"\nCurrent Price: ${current_price:,.2f}")
        narrative.append(f"Market Sentiment: {sentiment['overall']} (Confidence: {sentiment['confidence']:.1%})")
        
        # Technical overview
        narrative.append(f"\n**Technical Analysis Summary:**")
        rsi = indicators.get('rsi')
        if rsi:
            rsi_state = 'oversold' if rsi < 30 else 'overbought' if rsi > 70 else 'neutral'
            narrative.append(f"- RSI: {rsi:.2f} ({rsi_state})")
        
        macd_hist = indicators.get('macd_histogram')
        if macd_hist:
            macd_state = 'bullish' if macd_hist > 0 else 'bearish'
            narrative.append(f"- MACD: {macd_state} momentum")
        
        # Moving averages
        sma_20 = indicators.get('sma_20')
        if sma_20:
            ma_position = 'above' if current_price > sma_20 else 'below'
            narrative.append(f"- Price is {ma_position} 20-period SMA (${sma_20:,.2f})")
        
        # Pattern analysis
        narrative.append(f"\n**Pattern Recognition:**")
        detected_patterns = [name for name, data in patterns.items() 
                           if isinstance(data, dict) and data.get('detected')]
        
        if detected_patterns:
            for pattern_name in detected_patterns:
                pattern_data = patterns[pattern_name]
                pattern_type = pattern_data.get('pattern_type') or pattern_data.get('type', 'N/A')
                confidence = pattern_data.get('confidence', 0)
                narrative.append(f"- {pattern_name.replace('_', ' ').title()}: {pattern_type} "
                               f"(Confidence: {confidence:.1%})")
        else:
            narrative.append("- No significant patterns detected at this time")
        
        # ML Forecast
        if ml_forecast:
            ml_price = ml_forecast.get('predicted_price')
            if ml_price:
                change = ((ml_price - current_price) / current_price) * 100
                direction = 'increase' if change > 0 else 'decrease'
                narrative.append(f"\n**Machine Learning Forecast:**")
                narrative.append(f"- Predicted Monday 1 PM close: ${ml_price:,.2f} ({change:+.2f}%)")
                narrative.append(f"- 95% Confidence Range: ${ml_forecast['confidence_95_lower']:,.2f} - "
                               f"${ml_forecast['confidence_95_upper']:,.2f}")
                narrative.append(f"- Models show {ml_forecast['models_agreement']:.1%} agreement")
        
        # Price targets
        narrative.append(f"\n**Key Price Levels:**")
        if 'fibonacci' in targets:
            fib = targets['fibonacci']
            narrative.append(f"- Fibonacci Resistance: ${fib.get('extension_1272', 0):,.2f}")
            narrative.append(f"- Fibonacci Support: ${fib.get('level_618', 0):,.2f}")
        
        sr = patterns.get('support_resistance', {})
        if sr.get('detected'):
            nearest_res = sr.get('nearest_resistance', [])
            nearest_sup = sr.get('nearest_support', [])
            if nearest_res:
                narrative.append(f"- Nearest Resistance: ${nearest_res[0]:,.2f}")
            if nearest_sup:
                narrative.append(f"- Nearest Support: ${nearest_sup[0]:,.2f}")
        
        # Risk assessment
        narrative.append(f"\n**Risk Assessment:**")
        risk = targets.get('risk_assessment', {})
        narrative.append(f"- Risk Level: {risk.get('level', 'UNKNOWN')}")
        
        return "\n".join(narrative)


def generate_option_strategies(forecast_data):
    """Generate complex option trading strategies based on forecast"""
    
    symbol = forecast_data['symbol']
    current_price = forecast_data['current_market_state']['current_price']
    sentiment = forecast_data['market_sentiment']['overall']
    ml_forecast = forecast_data.get('ml_forecast', {})
    predicted_price = ml_forecast.get('predicted_price', current_price)
    
    strategies = []
    
    # Strategy 1: Iron Condor (Neutral to slightly bullish/bearish)
    if sentiment in ['NEUTRAL', 'BULLISH', 'BEARISH']:
        atr = forecast_data['current_market_state'].get('atr', current_price * 0.02)
        
        strategies.append({
            'name': 'Iron Condor',
            'type': 'NEUTRAL_INCOME',
            'complexity': 'ADVANCED',
            'description': 'Profit from low volatility by selling both call and put spreads',
            'legs': [
                {'action': 'SELL', 'type': 'PUT', 'strike': current_price - atr, 'quantity': 1},
                {'action': 'BUY', 'type': 'PUT', 'strike': current_price - (atr * 1.5), 'quantity': 1},
                {'action': 'SELL', 'type': 'CALL', 'strike': current_price + atr, 'quantity': 1},
                {'action': 'BUY', 'type': 'CALL', 'strike': current_price + (atr * 1.5), 'quantity': 1}
            ],
            'max_profit': 'Net credit received',
            'max_loss': 'Width of spread minus credit',
            'breakeven': f'${(current_price - atr):,.2f} and ${(current_price + atr):,.2f}',
            'ideal_scenario': f'Price stays between ${(current_price - atr):,.2f} and ${(current_price + atr):,.2f}',
            'risk_level': 'MODERATE',
            'capital_required': 'MODERATE'
        })
    
    # Strategy 2: Bull Call Spread (Bullish)
    if sentiment in ['BULLISH', 'STRONGLY_BULLISH']:
        move_expected = abs(predicted_price - current_price)
        
        strategies.append({
            'name': 'Bull Call Spread',
            'type': 'BULLISH_DIRECTIONAL',
            'complexity': 'INTERMEDIATE',
            'description': 'Limited risk bullish strategy expecting moderate upward movement',
            'legs': [
                {'action': 'BUY', 'type': 'CALL', 'strike': current_price, 'quantity': 1},
                {'action': 'SELL', 'type': 'CALL', 'strike': current_price + move_expected, 'quantity': 1}
            ],
            'max_profit': f'${move_expected:,.2f} minus net debit',
            'max_loss': 'Net debit paid',
            'breakeven': f'${(current_price + move_expected * 0.3):,.2f}',
            'ideal_scenario': f'Price rises to ${(current_price + move_expected):,.2f} or higher',
            'risk_level': 'MODERATE',
            'capital_required': 'MODERATE',
            'probability_of_profit': '65%'
        })
    
    # Strategy 3: Bear Put Spread (Bearish)
    if sentiment in ['BEARISH', 'STRONGLY_BEARISH']:
        move_expected = abs(predicted_price - current_price)
        
        strategies.append({
            'name': 'Bear Put Spread',
            'type': 'BEARISH_DIRECTIONAL',
            'complexity': 'INTERMEDIATE',
            'description': 'Limited risk bearish strategy expecting moderate downward movement',
            'legs': [
                {'action': 'BUY', 'type': 'PUT', 'strike': current_price, 'quantity': 1},
                {'action': 'SELL', 'type': 'PUT', 'strike': current_price - move_expected, 'quantity': 1}
            ],
            'max_profit': f'${move_expected:,.2f} minus net debit',
            'max_loss': 'Net debit paid',
            'breakeven': f'${(current_price - move_expected * 0.3):,.2f}',
            'ideal_scenario': f'Price falls to ${(current_price - move_expected):,.2f} or lower',
            'risk_level': 'MODERATE',
            'capital_required': 'MODERATE',
            'probability_of_profit': '65%'
        })
    
    # Strategy 4: Long Straddle (High volatility expected)
    atr_percent = (forecast_data['current_market_state'].get('atr', 0) / current_price) * 100
    if atr_percent > 1.5:
        strategies.append({
            'name': 'Long Straddle',
            'type': 'VOLATILITY_EXPANSION',
            'complexity': 'INTERMEDIATE',
            'description': 'Profit from large move in either direction',
            'legs': [
                {'action': 'BUY', 'type': 'CALL', 'strike': current_price, 'quantity': 1},
                {'action': 'BUY', 'type': 'PUT', 'strike': current_price, 'quantity': 1}
            ],
            'max_profit': 'Unlimited (upside) / Substantial (downside)',
            'max_loss': 'Total premium paid',
            'breakeven': 'Strike +/- total premium paid',
            'ideal_scenario': 'Large price movement in either direction',
            'risk_level': 'HIGH',
            'capital_required': 'HIGH',
            'vega_exposure': 'POSITIVE (benefits from volatility increase)'
        })
    
    # Strategy 5: Butterfly Spread (Low volatility expected)
    if sentiment == 'NEUTRAL' and atr_percent < 1:
        atr = forecast_data['current_market_state'].get('atr', current_price * 0.01)
        
        strategies.append({
            'name': 'Call Butterfly Spread',
            'type': 'NEUTRAL_PRECISION',
            'complexity': 'ADVANCED',
            'description': 'Maximum profit if price stays at middle strike',
            'legs': [
                {'action': 'BUY', 'type': 'CALL', 'strike': current_price - atr, 'quantity': 1},
                {'action': 'SELL', 'type': 'CALL', 'strike': current_price, 'quantity': 2},
                {'action': 'BUY', 'type': 'CALL', 'strike': current_price + atr, 'quantity': 1}
            ],
            'max_profit': f'${atr:,.2f} minus net debit',
            'max_loss': 'Net debit paid',
            'breakeven': f'${(current_price - atr * 0.5):,.2f} and ${(current_price + atr * 0.5):,.2f}',
            'ideal_scenario': f'Price closes exactly at ${current_price:,.2f}',
            'risk_level': 'LOW',
            'capital_required': 'LOW',
            'probability_of_profit': '55%'
        })
    
    # Strategy 6: Calendar Spread (Volatility play)
    strategies.append({
        'name': 'Calendar Spread',
        'type': 'TIME_DECAY',
        'complexity': 'ADVANCED',
        'description': 'Profit from time decay differential between near and far-term options',
        'legs': [
            {'action': 'SELL', 'type': 'CALL', 'strike': current_price, 'quantity': 1, 'expiry': 'Near-term'},
            {'action': 'BUY', 'type': 'CALL', 'strike': current_price, 'quantity': 1, 'expiry': 'Far-term'}
        ],
        'max_profit': 'Limited to spread value at near-term expiration',
        'max_loss': 'Net debit paid',
        'ideal_scenario': f'Price stays near ${current_price:,.2f} until near-term expiration',
        'risk_level': 'MODERATE',
        'capital_required': 'MODERATE',
        'theta_exposure': 'POSITIVE (benefits from time decay)'
    })
    
    # Strategy 7: Ratio Spread (Bullish with income)
    if sentiment in ['BULLISH', 'STRONGLY_BULLISH']:
        atr = forecast_data['current_market_state'].get('atr', current_price * 0.02)
        
        strategies.append({
            'name': 'Call Ratio Spread',
            'type': 'BULLISH_INCOME',
            'complexity': 'EXPERT',
            'description': 'Bullish strategy with additional short calls for income',
            'legs': [
                {'action': 'BUY', 'type': 'CALL', 'strike': current_price, 'quantity': 1},
                {'action': 'SELL', 'type': 'CALL', 'strike': current_price + atr, 'quantity': 2}
            ],
            'max_profit': f'At strike ${(current_price + atr):,.2f}',
            'max_loss': 'Unlimited above upper breakeven',
            'breakeven': f'${(current_price + atr * 2):,.2f} (upper)',
            'ideal_scenario': f'Price rises to ${(current_price + atr):,.2f} but not beyond',
            'risk_level': 'HIGH',
            'capital_required': 'MODERATE',
            'warning': 'Unlimited risk above upper breakeven - requires active management'
        })
    
    # Strategy 8: Diagonal Spread (Directional with time advantage)
    if sentiment in ['BULLISH', 'STRONGLY_BULLISH']:
        move_expected = abs(predicted_price - current_price)
        
        strategies.append({
            'name': 'Diagonal Call Spread',
            'type': 'BULLISH_TIME_ADVANTAGE',
            'complexity': 'EXPERT',
            'description': 'Combines vertical and calendar spread characteristics',
            'legs': [
                {'action': 'BUY', 'type': 'CALL', 'strike': current_price, 'quantity': 1, 'expiry': 'Far-term'},
                {'action': 'SELL', 'type': 'CALL', 'strike': current_price + move_expected, 'quantity': 1, 'expiry': 'Near-term'}
            ],
            'max_profit': 'Variable based on far-term option value at near-term expiration',
            'max_loss': 'Net debit paid',
            'ideal_scenario': 'Gradual upward movement with short-term consolidation',
            'risk_level': 'MODERATE',
            'capital_required': 'MODERATE',
            'flexibility': 'Can roll short option for additional income'
        })
    
    return {
        'symbol': symbol,
        'current_price': current_price,
        'predicted_price': predicted_price,
        'sentiment': sentiment,
        'recommended_strategies': strategies,
        'general_guidance': {
            'risk_management': [
                'Never risk more than 2-5% of portfolio on any single trade',
                'Always define maximum loss before entering position',
                'Consider implied volatility levels before establishing positions',
                'Monitor positions daily and adjust as market conditions change'
            ],
            'position_sizing': [
                'Start with smaller positions to test strategies',
                'Scale into positions as confidence increases',
                'Maintain adequate margin for potential adjustments'
            ],
            'timing_considerations': [
                'Avoid holding overnight unless strategy requires it',
                'Be aware of upcoming economic events',
                'Consider time decay (theta) in option selection',
                'Monitor liquidity in option chains'
            ]
        }
    }


def get_next_trading_day_1pm():
    """Calculate the next 1 PM close time"""
    now = datetime.now()
    
    # Market hours: 9:30 AM - 4:00 PM ET
    # We're forecasting 1:00 PM close
    target_hour = 13  # 1 PM
    target_minute = 0
    
    # Start with today
    next_close = now.replace(hour=target_hour, minute=target_minute, second=0, microsecond=0)
    
    # If it's already past 1 PM today, or it's after market close, move to next day
    if now.hour >= 13 or now.hour >= 16:
        next_close += timedelta(days=1)
    
    # Skip weekends
    while next_close.weekday() >= 5:  # 5 = Saturday, 6 = Sunday
        next_close += timedelta(days=1)
    
    return next_close


def format_target_time():
    """Format the target time string"""
    target = get_next_trading_day_1pm()
    day_name = target.strftime('%A')
    date_str = target.strftime('%B %d, %Y')
    time_str = target.strftime('%I:%M %p')
    return f"{day_name}, {date_str} at {time_str}"


def main():
    """Main execution function"""
    target_time_str = format_target_time()
    target_dt = get_next_trading_day_1pm()
    
    print("\n" + "="*80)
    print("GENAI MARKET FORECASTING ENGINE")
    print("DOW JONES & S&P 500 ANALYSIS")
    print("="*80)
    print(f"\nTarget: {target_time_str}")
    print(f"Current: {datetime.now().strftime('%A, %B %d, %Y at %I:%M %p')}")
    print(f"Hours until target: {((target_dt - datetime.now()).total_seconds() / 3600):.1f}")
    print("="*80 + "\n")
    
    indices = {
        '^GSPC': 'S&P 500',
        '^DJI': 'Dow Jones Industrial Average'
    }
    
    all_forecasts = {}
    
    for symbol, name in indices.items():
        print(f"\n{'='*80}")
        print(f"Processing {name} ({symbol})")
        print(f"{'='*80}\n")
        
        try:
            forecaster = MarketForecaster(symbol)
            forecast = forecaster.generate_comprehensive_forecast(target_time=target_time_str)
            
            # Generate option strategies
            options = generate_option_strategies(forecast)
            forecast['option_strategies'] = options
            
            all_forecasts[symbol] = forecast
            
            # Print summary
            print(f"\n{forecast['forecast_narrative']}")
            print(f"\n{'='*80}\n")
            
        except Exception as e:
            print(f"Error processing {symbol}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # Save forecasts
    output_file = 'forecast_monday_1pm.json'
    with open(output_file, 'w') as f:
        json.dump(all_forecasts, f, indent=2)
    
    print(f"\nForecasts saved to {output_file}")
    print("\n" + "="*80)
    print("FORECAST GENERATION COMPLETE")
    print("="*80 + "\n")
    
    return all_forecasts


if __name__ == "__main__":
    main()
