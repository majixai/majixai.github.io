#!/usr/bin/env python3
"""
Enhanced GenAI Forecasting Engine with Advanced Machine Learning
Adds deep learning models, ensemble methods, and sophisticated pattern analysis
"""

import yfinance as yf
import pandas as pd
import numpy as np
import json
from datetime import datetime, timedelta
from scipy import stats, signal
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, AdaBoostRegressor
from sklearn.linear_model import Ridge, Lasso, ElasticNet
from sklearn.svm import SVR
from sklearn.neural_network import MLPRegressor
from sklearn.preprocessing import StandardScaler, RobustScaler
from sklearn.model_selection import TimeSeriesSplit
import warnings
warnings.filterwarnings('ignore')


class EnhancedMarketForecaster:
    """Advanced forecasting engine with multiple ML models and deep analysis"""
    
    def __init__(self, symbol):
        self.symbol = symbol
        self.ticker = yf.Ticker(symbol)
        self.data = None
        self.forecast_time = None
        self.models = {}
        
    def fetch_extended_data(self, period="5d", interval="1m"):
        """Fetch comprehensive historical data"""
        print(f"Fetching extended data for {self.symbol}...")
        self.data = self.ticker.history(period=period, interval=interval)
        if self.data.empty:
            raise ValueError(f"No data available for {self.symbol}")
        return self.data
    
    def calculate_advanced_features(self):
        """Calculate 50+ advanced technical features"""
        if self.data is None or self.data.empty:
            return {}
        
        df = self.data.copy()
        
        # Price-based features
        df['Returns'] = df['Close'].pct_change()
        df['Log_Returns'] = np.log(df['Close'] / df['Close'].shift(1))
        df['Price_ROC_5'] = ((df['Close'] - df['Close'].shift(5)) / df['Close'].shift(5)) * 100
        df['Price_ROC_10'] = ((df['Close'] - df['Close'].shift(10)) / df['Close'].shift(10)) * 100
        df['Price_ROC_20'] = ((df['Close'] - df['Close'].shift(20)) / df['Close'].shift(20)) * 100
        
        # Moving Averages (Extended)
        for period in [5, 9, 12, 20, 26, 50, 100, 200]:
            df[f'SMA_{period}'] = df['Close'].rolling(window=period).mean()
            df[f'EMA_{period}'] = df['Close'].ewm(span=period, adjust=False).mean()
            df[f'Distance_SMA_{period}'] = ((df['Close'] - df[f'SMA_{period}']) / df[f'SMA_{period}']) * 100
        
        # MACD Variants
        df['MACD_12_26'] = df['EMA_12'] - df['EMA_26']
        df['MACD_Signal_12_26'] = df['MACD_12_26'].ewm(span=9, adjust=False).mean()
        df['MACD_Hist_12_26'] = df['MACD_12_26'] - df['MACD_Signal_12_26']
        
        # Fast MACD
        df['MACD_5_13'] = df['EMA_5'] - df['EMA_9']
        df['MACD_Signal_5_13'] = df['MACD_5_13'].ewm(span=9, adjust=False).mean()
        
        # RSI Variants
        for period in [9, 14, 21]:
            delta = df['Close'].diff()
            gain = (delta.where(delta > 0, 0)).rolling(window=period).mean()
            loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
            rs = gain / loss
            df[f'RSI_{period}'] = 100 - (100 / (1 + rs))
        
        # Bollinger Bands (Multiple Periods)
        for period in [10, 20, 50]:
            sma = df['Close'].rolling(window=period).mean()
            std = df['Close'].rolling(window=period).std()
            df[f'BB_Upper_{period}'] = sma + (std * 2)
            df[f'BB_Lower_{period}'] = sma - (std * 2)
            df[f'BB_Width_{period}'] = ((df[f'BB_Upper_{period}'] - df[f'BB_Lower_{period}']) / sma) * 100
            df[f'BB_Position_{period}'] = ((df['Close'] - df[f'BB_Lower_{period}']) / 
                                           (df[f'BB_Upper_{period}'] - df[f'BB_Lower_{period}']))
        
        # Stochastic Oscillator Variants
        for k_period in [5, 14, 21]:
            low_min = df['Low'].rolling(window=k_period).min()
            high_max = df['High'].rolling(window=k_period).max()
            df[f'Stoch_K_{k_period}'] = 100 * ((df['Close'] - low_min) / (high_max - low_min))
            df[f'Stoch_D_{k_period}'] = df[f'Stoch_K_{k_period}'].rolling(window=3).mean()
        
        # ATR and Volatility Measures
        high_low = df['High'] - df['Low']
        high_close = np.abs(df['High'] - df['Close'].shift())
        low_close = np.abs(df['Low'] - df['Close'].shift())
        ranges = pd.concat([high_low, high_close, low_close], axis=1)
        true_range = np.max(ranges, axis=1)
        
        for period in [7, 14, 21]:
            df[f'ATR_{period}'] = true_range.rolling(period).mean()
            df[f'ATR_Pct_{period}'] = (df[f'ATR_{period}'] / df['Close']) * 100
        
        # Historical Volatility
        for period in [10, 20, 50]:
            df[f'HV_{period}'] = df['Returns'].rolling(period).std() * np.sqrt(252 * 390) * 100
        
        # Volume Indicators (Advanced)
        for period in [10, 20, 50]:
            df[f'Volume_SMA_{period}'] = df['Volume'].rolling(window=period).mean()
            df[f'Volume_Ratio_{period}'] = df['Volume'] / df[f'Volume_SMA_{period}']
        
        # On-Balance Volume
        df['OBV'] = (np.sign(df['Close'].diff()) * df['Volume']).fillna(0).cumsum()
        df['OBV_EMA'] = df['OBV'].ewm(span=20, adjust=False).mean()
        
        # Accumulation/Distribution
        clv = ((df['Close'] - df['Low']) - (df['High'] - df['Close'])) / (df['High'] - df['Low'])
        clv = clv.fillna(0)
        df['AD'] = (clv * df['Volume']).cumsum()
        
        # Money Flow Index
        typical_price = (df['High'] + df['Low'] + df['Close']) / 3
        money_flow = typical_price * df['Volume']
        
        for period in [14, 21]:
            positive_flow = money_flow.where(typical_price > typical_price.shift(1), 0).rolling(period).sum()
            negative_flow = money_flow.where(typical_price < typical_price.shift(1), 0).rolling(period).sum()
            mfi_ratio = positive_flow / negative_flow
            df[f'MFI_{period}'] = 100 - (100 / (1 + mfi_ratio))
        
        # Williams %R Variants
        for period in [14, 21]:
            high_max = df['High'].rolling(window=period).max()
            low_min = df['Low'].rolling(window=period).min()
            df[f'Williams_R_{period}'] = -100 * ((high_max - df['Close']) / (high_max - low_min))
        
        # CCI Variants
        for period in [14, 20, 50]:
            tp = (df['High'] + df['Low'] + df['Close']) / 3
            df[f'CCI_{period}'] = (tp - tp.rolling(period).mean()) / (0.015 * tp.rolling(period).std())
        
        # Momentum
        for period in [5, 10, 20]:
            df[f'Momentum_{period}'] = df['Close'].diff(period)
        
        # Ultimate Oscillator
        bp = df['Close'] - df[['Low', 'Close']].shift(1).min(axis=1)
        tr = df[['High', 'Close']].shift(1).max(axis=1) - df[['Low', 'Close']].shift(1).min(axis=1)
        
        avg7 = bp.rolling(7).sum() / tr.rolling(7).sum()
        avg14 = bp.rolling(14).sum() / tr.rolling(14).sum()
        avg28 = bp.rolling(28).sum() / tr.rolling(28).sum()
        
        df['Ultimate_Osc'] = 100 * ((4 * avg7 + 2 * avg14 + avg28) / 7)
        
        # Aroon Indicator
        for period in [14, 25]:
            aroon_up = df['High'].rolling(period + 1).apply(lambda x: x.argmax()) / period * 100
            aroon_down = df['Low'].rolling(period + 1).apply(lambda x: x.argmin()) / period * 100
            df[f'Aroon_Up_{period}'] = aroon_up
            df[f'Aroon_Down_{period}'] = aroon_down
            df[f'Aroon_Osc_{period}'] = aroon_up - aroon_down
        
        # Keltner Channels
        for period in [10, 20]:
            typical_price = (df['High'] + df['Low'] + df['Close']) / 3
            ema = typical_price.ewm(span=period, adjust=False).mean()
            df[f'Keltner_Upper_{period}'] = ema + (2 * df[f'ATR_{14}'])
            df[f'Keltner_Lower_{period}'] = ema - (2 * df[f'ATR_{14}'])
        
        # Parabolic SAR (simplified)
        df['PSAR'] = df['Close'].ewm(span=20, adjust=False).mean()
        
        # Fractal Dimension
        def hurst_exponent(ts, max_lag=20):
            lags = range(2, max_lag)
            tau = [np.std(np.subtract(ts[lag:], ts[:-lag])) for lag in lags]
            return np.polyfit(np.log(lags), np.log(tau), 1)[0]
        
        df['Hurst'] = df['Close'].rolling(window=100).apply(lambda x: hurst_exponent(x.values) if len(x) >= 20 else np.nan)
        
        # Chande Momentum Oscillator
        for period in [9, 14]:
            mom = df['Close'].diff()
            sum_up = mom.where(mom > 0, 0).rolling(period).sum()
            sum_down = mom.where(mom < 0, 0).abs().rolling(period).sum()
            df[f'CMO_{period}'] = 100 * ((sum_up - sum_down) / (sum_up + sum_down))
        
        # Detrended Price Oscillator
        for period in [20, 50]:
            displacement = period // 2 + 1
            df[f'DPO_{period}'] = df['Close'].shift(displacement) - df[f'SMA_{period}']
        
        # Time-based features
        df['Hour'] = pd.to_datetime(df.index).hour
        df['Minute'] = pd.to_datetime(df.index).minute
        df['DayOfWeek'] = pd.to_datetime(df.index).dayofweek
        df['Hour_Sin'] = np.sin(2 * np.pi * df['Hour'] / 24)
        df['Hour_Cos'] = np.cos(2 * np.pi * df['Hour'] / 24)
        
        self.data = df
        return df
    
    def generate_ensemble_forecast(self, periods_ahead=30):
        """Generate forecast using ensemble of 10+ ML models"""
        if self.data is None or len(self.data) < 200:
            return {}
        
        df = self.data.copy()
        df = df.dropna()
        
        if len(df) < 100:
            return {}
        
        # Prepare features
        feature_cols = [col for col in df.columns if any(keyword in col for keyword in 
                       ['SMA', 'EMA', 'RSI', 'MACD', 'BB_', 'Stoch', 'ATR', 'Volume_Ratio',
                        'Williams', 'CCI', 'Momentum', 'MFI', 'Aroon', 'CMO', 'Hour_', 
                        'Ultimate', 'Hurst', 'HV_', 'OBV'])]
        
        feature_cols = [col for col in feature_cols if col in df.columns][:50]  # Limit to top 50 features
        
        df_features = df[feature_cols].fillna(method='ffill').fillna(0)
        
        # Prepare target
        target = df['Close'].values
        
        # Train-test split
        train_size = len(df_features) - periods_ahead
        if train_size < 50:
            return {}
        
        X_train = df_features.iloc[:train_size].values
        y_train = target[:train_size]
        X_test = df_features.iloc[-1:].values
        
        # Scale features
        scaler = RobustScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Define ensemble of models
        models_config = {
            'Random Forest': RandomForestRegressor(n_estimators=100, max_depth=15, random_state=42, n_jobs=-1),
            'Gradient Boosting': GradientBoostingRegressor(n_estimators=100, max_depth=5, random_state=42),
            'AdaBoost': AdaBoostRegressor(n_estimators=50, random_state=42),
            'Ridge Regression': Ridge(alpha=1.0),
            'Lasso Regression': Lasso(alpha=0.1),
            'Elastic Net': ElasticNet(alpha=0.1, l1_ratio=0.5),
            'SVR (RBF)': SVR(kernel='rbf', C=100, gamma=0.001),
            'SVR (Linear)': SVR(kernel='linear', C=10),
            'MLP (Small)': MLPRegressor(hidden_layers=(50, 25), max_iter=500, random_state=42),
            'MLP (Large)': MLPRegressor(hidden_layers=(100, 50, 25), max_iter=500, random_state=42)
        }
        
        predictions = {}
        prediction_list = []
        
        print(f"\nTraining ensemble of {len(models_config)} models...")
        
        for model_name, model in models_config.items():
            try:
                # Train model
                model.fit(X_train_scaled, y_train)
                
                # Predict
                pred = model.predict(X_test_scaled)[0]
                predictions[model_name] = float(pred)
                prediction_list.append(pred)
                
                print(f"  ✓ {model_name}: ${pred:.2f}")
                
            except Exception as e:
                print(f"  ✗ {model_name}: Error - {str(e)}")
                continue
        
        if not prediction_list:
            return {}
        
        # Calculate ensemble statistics
        predictions_array = np.array(prediction_list)
        
        # Weighted average (give more weight to tree-based models)
        weights = [0.15, 0.15, 0.10, 0.08, 0.08, 0.08, 0.08, 0.06, 0.11, 0.11][:len(prediction_list)]
        weights = np.array(weights) / sum(weights)
        
        weighted_prediction = np.average(predictions_array, weights=weights)
        mean_prediction = np.mean(predictions_array)
        median_prediction = np.median(predictions_array)
        
        # Calculate uncertainty metrics
        std_prediction = np.std(predictions_array)
        iqr_prediction = np.percentile(predictions_array, 75) - np.percentile(predictions_array, 25)
        
        # Confidence intervals
        confidence_99_upper = mean_prediction + (2.576 * std_prediction)
        confidence_99_lower = mean_prediction - (2.576 * std_prediction)
        confidence_95_upper = mean_prediction + (1.96 * std_prediction)
        confidence_95_lower = mean_prediction - (1.96 * std_prediction)
        confidence_68_upper = mean_prediction + std_prediction
        confidence_68_lower = mean_prediction - std_prediction
        
        # Model agreement score (inverse of coefficient of variation)
        cv = std_prediction / mean_prediction if mean_prediction != 0 else 1
        agreement_score = max(0, min(1, 1 - cv))
        
        return {
            'predicted_price_weighted': float(weighted_prediction),
            'predicted_price_mean': float(mean_prediction),
            'predicted_price_median': float(median_prediction),
            'confidence_99_upper': float(confidence_99_upper),
            'confidence_99_lower': float(confidence_99_lower),
            'confidence_95_upper': float(confidence_95_upper),
            'confidence_95_lower': float(confidence_95_lower),
            'confidence_68_upper': float(confidence_68_upper),
            'confidence_68_lower': float(confidence_68_lower),
            'prediction_std': float(std_prediction),
            'prediction_iqr': float(iqr_prediction),
            'models_agreement': float(agreement_score),
            'model_predictions': predictions,
            'ensemble_size': len(prediction_list),
            'best_prediction': float(predictions_array[np.argmin(np.abs(predictions_array - median_prediction))]),
            'prediction_range': float(predictions_array.max() - predictions_array.min())
        }
    
    def generate_advanced_forecast(self, target_time):
        """Generate comprehensive forecast with enhanced ML"""
        print(f"\n{'='*80}")
        print(f"ENHANCED FORECASTING FOR {self.symbol}")
        print(f"Target Time: {target_time}")
        print(f"{'='*80}\n")
        
        # Fetch and analyze data
        self.fetch_extended_data(period="5d", interval="1m")
        self.calculate_advanced_features()
        
        # Generate enhanced ML forecast
        ml_forecast = self.generate_ensemble_forecast(periods_ahead=30)
        
        return ml_forecast


def enhance_existing_forecast(forecast_file='forecast_monday_1pm.json'):
    """Enhance existing forecast with advanced ML predictions"""
    
    print("\n" + "="*80)
    print("ENHANCING FORECASTS WITH ADVANCED ML")
    print("="*80 + "\n")
    
    # Load existing forecasts
    with open(forecast_file, 'r') as f:
        all_forecasts = json.load(f)
    
    for symbol, forecast in all_forecasts.items():
        try:
            print(f"\nEnhancing forecast for {symbol}...")
            
            forecaster = EnhancedMarketForecaster(symbol)
            enhanced_ml = forecaster.generate_advanced_forecast(forecast['target_time'])
            
            # Add to existing forecast
            forecast['enhanced_ml_forecast'] = enhanced_ml
            
            print(f"✓ Enhanced ML forecast added")
            print(f"  Weighted Prediction: ${enhanced_ml.get('predicted_price_weighted', 0):.2f}")
            print(f"  Model Agreement: {enhanced_ml.get('models_agreement', 0):.1%}")
            print(f"  Ensemble Size: {enhanced_ml.get('ensemble_size', 0)} models")
            
        except Exception as e:
            print(f"Error enhancing {symbol}: {str(e)}")
            import traceback
            traceback.print_exc()
    
    # Save enhanced forecasts
    with open(forecast_file, 'w') as f:
        json.dump(all_forecasts, f, indent=2)
    
    print("\n" + "="*80)
    print("FORECAST ENHANCEMENT COMPLETE")
    print("="*80 + "\n")


if __name__ == "__main__":
    enhance_existing_forecast()
