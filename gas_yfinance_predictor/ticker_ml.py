#!/usr/bin/env python3
"""
TensorFlow-based machine learning predictor for ticker data.
Integrates with R for statistical analysis and Cython for performance.
"""

import os
os.environ['TF_CPP_MIN_LOG_LEVEL'] = '2'

import numpy as np
import pandas as pd
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers, models, callbacks
import sqlite3
from datetime import datetime, timedelta
import logging
from typing import Tuple, List, Optional
import subprocess
import json

# Try to import Cython processor
try:
    from data_processor import TickerDataProcessor
    CYTHON_AVAILABLE = True
except ImportError:
    CYTHON_AVAILABLE = False
    logging.warning("Cython data_processor not available, using pure Python")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TensorFlowTickerPredictor:
    """Advanced ticker prediction using TensorFlow with R statistical integration."""
    
    def __init__(self, db_path='dbs/ticker_data_1m.db', sequence_length=60):
        self.db_path = db_path
        self.sequence_length = sequence_length
        self.model = None
        self.scaler_min = None
        self.scaler_max = None
        
        # Initialize Cython processor if available
        if CYTHON_AVAILABLE:
            self.processor = TickerDataProcessor()
            logger.info("Cython processor initialized")
        else:
            self.processor = None
    
    def fetch_ticker_data(self, ticker: str, limit: int = 10000) -> pd.DataFrame:
        """Fetch ticker data from database."""
        conn = sqlite3.connect(self.db_path)
        query = f"""
            SELECT datetime, open, high, low, close, volume
            FROM ticker_data_1m
            WHERE ticker = ?
            ORDER BY datetime DESC
            LIMIT ?
        """
        df = pd.read_sql_query(query, conn, params=(ticker, limit))
        conn.close()
        
        if not df.empty:
            df['datetime'] = pd.to_datetime(df['datetime'])
            df = df.sort_values('datetime')
            df.set_index('datetime', inplace=True)
        
        return df
    
    def prepare_sequences(self, data: np.ndarray) -> Tuple[np.ndarray, np.ndarray]:
        """Prepare sequences for LSTM training."""
        X, y = [], []
        
        for i in range(len(data) - self.sequence_length):
            X.append(data[i:i + self.sequence_length])
            y.append(data[i + self.sequence_length, 3])  # Predict close price
        
        return np.array(X), np.array(y)
    
    def normalize_data(self, data: np.ndarray) -> np.ndarray:
        """Normalize data using Cython if available."""
        if CYTHON_AVAILABLE and self.processor:
            # Use Cython for fast normalization
            self.scaler_min = np.min(data, axis=0)
            self.scaler_max = np.max(data, axis=0)
            
            normalized = np.zeros_like(data)
            for i in range(data.shape[1]):
                if self.scaler_max[i] - self.scaler_min[i] != 0:
                    normalized[:, i] = (data[:, i] - self.scaler_min[i]) / (self.scaler_max[i] - self.scaler_min[i])
            return normalized
        else:
            # Fallback to standard normalization
            self.scaler_min = np.min(data, axis=0)
            self.scaler_max = np.max(data, axis=0)
            return (data - self.scaler_min) / (self.scaler_max - self.scaler_min + 1e-8)
    
    def build_lstm_model(self, input_shape: Tuple) -> keras.Model:
        """Build LSTM model with TensorFlow."""
        model = models.Sequential([
            layers.LSTM(128, return_sequences=True, input_shape=input_shape),
            layers.Dropout(0.2),
            layers.LSTM(64, return_sequences=True),
            layers.Dropout(0.2),
            layers.LSTM(32),
            layers.Dropout(0.2),
            layers.Dense(16, activation='relu'),
            layers.Dense(1)
        ])
        
        model.compile(
            optimizer=keras.optimizers.Adam(learning_rate=0.001),
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def build_cnn_lstm_model(self, input_shape: Tuple) -> keras.Model:
        """Build CNN-LSTM hybrid model for better pattern recognition."""
        model = models.Sequential([
            layers.Conv1D(filters=64, kernel_size=3, activation='relu', input_shape=input_shape),
            layers.MaxPooling1D(pool_size=2),
            layers.Conv1D(filters=32, kernel_size=3, activation='relu'),
            layers.MaxPooling1D(pool_size=2),
            layers.LSTM(50, return_sequences=True),
            layers.LSTM(50),
            layers.Dropout(0.2),
            layers.Dense(25, activation='relu'),
            layers.Dense(1)
        ])
        
        model.compile(
            optimizer='adam',
            loss='mse',
            metrics=['mae']
        )
        
        return model
    
    def train_model(self, ticker: str, epochs: int = 50, batch_size: int = 32):
        """Train the model on ticker data."""
        logger.info(f"Training model for {ticker}")
        
        # Fetch data
        df = self.fetch_ticker_data(ticker, limit=10000)
        if df.empty:
            logger.error(f"No data found for {ticker}")
            return None
        
        # Prepare features
        data = df[['open', 'high', 'low', 'close', 'volume']].values
        data_normalized = self.normalize_data(data)
        
        # Create sequences
        X, y = self.prepare_sequences(data_normalized)
        
        # Split data
        split = int(0.8 * len(X))
        X_train, X_test = X[:split], X[split:]
        y_train, y_test = y[:split], y[split:]
        
        # Build model
        self.model = self.build_lstm_model((X_train.shape[1], X_train.shape[2]))
        
        # Callbacks
        early_stop = callbacks.EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
        reduce_lr = callbacks.ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-6)
        
        # Train
        history = self.model.fit(
            X_train, y_train,
            validation_data=(X_test, y_test),
            epochs=epochs,
            batch_size=batch_size,
            callbacks=[early_stop, reduce_lr],
            verbose=1
        )
        
        logger.info(f"Training completed for {ticker}")
        return history
    
    def predict_next_price(self, ticker: str, periods: int = 1) -> List[float]:
        """Predict next price(s) using trained model."""
        if self.model is None:
            logger.error("Model not trained")
            return []
        
        # Fetch latest data
        df = self.fetch_ticker_data(ticker, limit=self.sequence_length + 100)
        if len(df) < self.sequence_length:
            logger.error(f"Insufficient data for {ticker}")
            return []
        
        # Prepare data
        data = df[['open', 'high', 'low', 'close', 'volume']].values[-self.sequence_length:]
        data_normalized = (data - self.scaler_min) / (self.scaler_max - self.scaler_min + 1e-8)
        
        predictions = []
        current_sequence = data_normalized.copy()
        
        for _ in range(periods):
            X = current_sequence.reshape(1, self.sequence_length, -1)
            pred = self.model.predict(X, verbose=0)[0][0]
            predictions.append(pred)
            
            # Update sequence for next prediction
            current_sequence = np.roll(current_sequence, -1, axis=0)
            current_sequence[-1, 3] = pred  # Update close price
        
        # Denormalize predictions
        predictions = np.array(predictions) * (self.scaler_max[3] - self.scaler_min[3]) + self.scaler_min[3]
        
        return predictions.tolist()
    
    def run_r_statistical_analysis(self, ticker: str) -> dict:
        """Run R statistical analysis on ticker data."""
        try:
            # Create R script for statistical analysis
            r_script = f"""
library(forecast)
library(tseries)
library(jsonlite)

# Read data from SQLite
library(RSQLite)
conn <- dbConnect(SQLite(), "{self.db_path}")
df <- dbGetQuery(conn, "SELECT datetime, close FROM ticker_data_1m WHERE ticker = '{ticker}' ORDER BY datetime LIMIT 1000")
dbDisconnect(conn)

# Convert to time series
ts_data <- ts(df$close)

# Statistical tests
adf_test <- adf.test(ts_data, alternative = "stationary")
acf_result <- acf(ts_data, plot = FALSE)
pacf_result <- pacf(ts_data, plot = FALSE)

# ARIMA model
arima_model <- auto.arima(ts_data)
forecast_result <- forecast(arima_model, h = 10)

# Results as JSON
results <- list(
    ticker = "{ticker}",
    adf_statistic = adf_test$statistic,
    adf_pvalue = adf_test$p.value,
    arima_order = arima_model$arma[1:3],
    forecast = as.numeric(forecast_result$mean),
    confidence_80 = list(
        lower = as.numeric(forecast_result$lower[,1]),
        upper = as.numeric(forecast_result$upper[,1])
    )
)

cat(toJSON(results, auto_unbox = TRUE))
"""
            
            # Write R script to temp file
            with open('/tmp/ticker_analysis.R', 'w') as f:
                f.write(r_script)
            
            # Execute R script
            result = subprocess.run(
                ['Rscript', '/tmp/ticker_analysis.R'],
                capture_output=True,
                text=True,
                timeout=30
            )
            
            if result.returncode == 0:
                return json.loads(result.stdout)
            else:
                logger.error(f"R analysis failed: {result.stderr}")
                return {}
                
        except Exception as e:
            logger.error(f"R analysis error: {str(e)}")
            return {}
    
    def save_model(self, ticker: str, filepath: str = 'models/'):
        """Save trained model."""
        os.makedirs(filepath, exist_ok=True)
        model_path = os.path.join(filepath, f'{ticker}_model.h5')
        self.model.save(model_path)
        
        # Save scaler parameters
        scaler_path = os.path.join(filepath, f'{ticker}_scaler.npz')
        np.savez(scaler_path, min=self.scaler_min, max=self.scaler_max)
        
        logger.info(f"Model saved: {model_path}")
    
    def load_model(self, ticker: str, filepath: str = 'models/'):
        """Load pre-trained model."""
        model_path = os.path.join(filepath, f'{ticker}_model.h5')
        scaler_path = os.path.join(filepath, f'{ticker}_scaler.npz')
        
        if os.path.exists(model_path) and os.path.exists(scaler_path):
            self.model = keras.models.load_model(model_path)
            scaler_data = np.load(scaler_path)
            self.scaler_min = scaler_data['min']
            self.scaler_max = scaler_data['max']
            logger.info(f"Model loaded: {model_path}")
            return True
        
        return False


if __name__ == '__main__':
    # Example usage
    predictor = TensorFlowTickerPredictor()
    
    # Train on AAPL
    predictor.train_model('AAPL', epochs=30)
    
    # Predict next prices
    predictions = predictor.predict_next_price('AAPL', periods=5)
    print(f"Next 5 price predictions: {predictions}")
    
    # R statistical analysis
    r_results = predictor.run_r_statistical_analysis('AAPL')
    print(f"R Analysis: {r_results}")
    
    # Save model
    predictor.save_model('AAPL')
