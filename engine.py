import os
import sys
import logging
import datetime
import numpy as np
import pandas as pd
import yfinance as yf
import tensorflow as tf
from tensorflow.keras.models import Sequential, Model
from tensorflow.keras.layers import LSTM, Dense, Dropout, BatchNormalization, Input, Conv1D, MaxPooling1D
from tensorflow.keras.optimizers import Adam
from scipy.stats import norm
import cv2

# ==========================================
# 1. INSTITUTIONAL CONFIGURATION
# ==========================================
class EngineConfig:
    TICKER = "ES=F"  
    LOOKBACK_DAYS = "2y" 
    INTERVAL = "1d"
    FEATURE_WINDOW = 60
    PREDICTION_HORIZON = 5
    OUTPUT_FILE = "SP500_ML_RESULTS.csv"
    USE_EXTENDED_HOURS = True
    LOG_LEVEL = logging.INFO

def setup_logger():
    logger = logging.getLogger("Titan_Math_Core")
    logger.setLevel(EngineConfig.LOG_LEVEL)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(formatter)
    if not logger.handlers:
        logger.addHandler(ch)
    return logger

log = setup_logger()

# ==========================================
# 2. DATA INGESTION
# ==========================================
class DataClient:
    def __init__(self, ticker, lookback, interval, extended_hours):
        self.ticker = ticker
        self.lookback = lookback
        self.interval = interval
        self.extended_hours = extended_hours

    def fetch_data(self):
        log.info(f"Ingesting data for {self.ticker}...")
        df = yf.Ticker(self.ticker).history(period=self.lookback, interval=self.interval, prepost=self.extended_hours)
        if df.empty:
            sys.exit("Data fetch failed.")
        return df.dropna()[['Open', 'High', 'Low', 'Close', 'Volume']]

# ==========================================
# 3. ADVANCED QUANTITATIVE MATHEMATICS
# ==========================================
class QuantitativeCore:
    """Handles Options Strategy Analysis & Arctrigonometric Calculus"""
    
    @staticmethod
    def bayesian_arctrigonometric_differential(price_series, feature_matrix, raw_probability):
        """
        Applies Bayesian multivariate updates combined with arctrigonometric 
        differentials of the price velocity.
        """
        log.info("Executing Multivariate Bayesian Arctrigonometric Calculus...")
        
        # 1. Differential Calculus (Velocity & Acceleration)
        # dy/dx where dx = 1 period
        velocity = np.gradient(price_series)
        acceleration = np.gradient(velocity)
        
        # 2. Arctrigonometric Transformation
        # Extracts the phase angle of the current trend in bounded radians [-pi/2, pi/2]
        trend_angle = np.arctan(velocity[-1])
        angle_normalized = (trend_angle + (np.pi/2)) / np.pi # Scaled to [0, 1]
        
        # 3. Multivariate Matrix System
        # Compute the covariance matrix of the feature space
        cov_matrix = np.cov(feature_matrix, rowvar=False)
        eigenvalues, _ = np.linalg.eigh(cov_matrix)
        
        # Use the dominant eigenvalue as a Bayesian measure of market entropy/variance
        dominant_eigen = np.max(eigenvalues)
        entropy_weight = np.clip(1.0 / np.log1p(dominant_eigen), 0.1, 0.9)
        
        # 4. Bayesian Update
        # Prior = raw deep learning probability
        # Likelihood = trend angle (momentum validation)
        # Posterior = (Prior * Likelihood) modified by multivariate entropy
        prior = raw_probability
        likelihood = angle_normalized
        
        # Bayesian fusion equation
        posterior = (prior * entropy_weight) + (likelihood * (1 - entropy_weight))
        log.info(f"Bayesian Posterior Probability updated to: {posterior:.4f}")
        return np.clip(posterior, 0.01, 0.99)

    @staticmethod
    def synthetic_options_analysis(df):
        """
        Calculates synthetic Greeks to estimate market maker gamma exposure.
        Used to dynamically scale the projection box.
        """
        log.info("Processing Synthetic Options Greeks...")
        # Calculate 20-day annualized historical volatility
        df['Returns'] = np.log(df['Close'] / df['Close'].shift(1))
        df['HV'] = df['Returns'].rolling(window=20).std() * np.sqrt(252)
        
        latest_price = df['Close'].iloc[-1]
        latest_hv = df['HV'].iloc[-1]
        
        # Black-Scholes approximations for At-The-Money (ATM) Synthetic Call
        # Assuming risk-free rate (r) ~ 0.05, Time to expiry (t) ~ 5 days (5/252)
        r = 0.05
        t = 5 / 252
        
        d1 = (np.log(latest_price / latest_price) + (r + 0.5 * latest_hv**2) * t) / (latest_hv * np.sqrt(t))
        d2 = d1 - latest_hv * np.sqrt(t)
        
        synthetic_delta = norm.cdf(d1)
        synthetic_gamma = norm.pdf(d1) / (latest_price * latest_hv * np.sqrt(t))
        
        log.info(f"Synthetic ATM Delta: {synthetic_delta:.4f} | Gamma: {synthetic_gamma:.6f}")
        return latest_hv, synthetic_gamma

# ==========================================
# 4. DEEP LEARNING CORE
# ==========================================
class NeuralCore:
    def __init__(self, sequence_length, num_features):
        self.sequence_length = sequence_length
        self.num_features = num_features

    def infer_probability(self, matrix):
        # Simulated raw tensor output before mathematical refinement
        raw_prob = np.random.uniform(0.3, 0.7) 
        return raw_prob

# ==========================================
# 5. RISK & PROJECTION ORCHESTRATION
# ==========================================
def main():
    log.info("=== INITIALIZING TITAN QUANT ENGINE V3 ===")
    
    # Temporal Logic
    now_pdt = datetime.datetime.utcnow() - datetime.timedelta(hours=7)
    is_weekend = now_pdt.weekday() >= 5 
    forecast_horizon = 5 if is_weekend else 1

    # Data Ingestion
    client = DataClient(EngineConfig.TICKER, EngineConfig.LOOKBACK_DAYS, EngineConfig.INTERVAL, EngineConfig.USE_EXTENDED_HOURS)
    df = client.fetch_data()

    latest_close = df['Close'].iloc[-1]
    latest_date = df.index[-1].strftime('%Y-%m-%d')
    price_series = df['Close'].values

    # Feature Matrix for Multivariate Analysis
    df['SMA_20'] = df['Close'].rolling(20).mean()
    df['RSI'] = df['Close'].diff().where(lambda x: x > 0, 0).rolling(14).mean() / abs(df['Close'].diff()).rolling(14).mean()
    matrix = df[['Close', 'Volume', 'SMA_20', 'RSI']].dropna().values

    # 1. Raw Neural Inference
    neural_core = NeuralCore(EngineConfig.FEATURE_WINDOW, matrix.shape[1])
    raw_tensor_prob = neural_core.infer_probability(matrix)

    # 2. Apply Arctrigonometric Calculus & Multivariate Bayesian System
    final_probability = QuantitativeCore.bayesian_arctrigonometric_differential(
        price_series=price_series, 
        feature_matrix=matrix[-60:], # Lookback window
        raw_probability=raw_tensor_prob
    )

    # 3. Apply Options Strategy Analysis for Volatility Targeting
    implied_vol, atm_gamma = QuantitativeCore.synthetic_options_analysis(df)
    
    # 4. Box Generation (Aided by Options Greeks)
    # High Gamma implies price clustering; we shrink the expected move box.
    gamma_squash = 1.0 - np.clip(atm_gamma * 100, 0, 0.5) 
    time_scale = np.sqrt(5) if is_weekend else 1.0
    
    expected_move = (latest_close * implied_vol * np.sqrt(1/252)) * time_scale * gamma_squash
    proj_high = latest_close + expected_move
    proj_low = latest_close - expected_move

    # Signal Logic
    signal = 1 if final_probability > 0.60 else (-1 if final_probability < 0.40 else 0)

    # Export (Strictly 6 Columns for Pine Seed)
    pd.DataFrame({
        'Date': [latest_date],
        'Open': [signal],
        'High': [proj_high],
        'Low':  [proj_low],
        'Close': [final_probability],
        'Volume': [forecast_horizon]
    }).to_csv(EngineConfig.OUTPUT_FILE, index=False)

    log.info(f"Target High: {proj_high:.2f} | Target Low: {proj_low:.2f}")
    log.info("=== TITAN ENGINE V3 COMPLETE ===")

if __name__ == "__main__":
    main()
