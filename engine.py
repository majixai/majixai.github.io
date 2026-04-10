import asyncio
import os
import sys
import logging
import datetime
import json
import gzip
import base64
import requests
import cython 
import numpy as np
import pandas as pd
import yfinance as yf
import tensorflow as tf
from scipy.stats import norm
import cv2

# ==========================================
# 1. INSTITUTIONAL CONFIGURATION
# ==========================================
class EngineConfig:
    TICKER = "BTC-USD"  
    LOOKBACK_DAYS = "2y" 
    INTERVAL = "1d"
    FEATURE_WINDOW = 60
    PREDICTION_HORIZON = 5
    OUTPUT_FILE = "BTC_ML_RESULTS.csv"
    USE_EXTENDED_HOURS = True
    LOG_LEVEL = logging.INFO

def setup_logger():
    logger = logging.getLogger("Titan_Cython_Core")
    logger.setLevel(EngineConfig.LOG_LEVEL)
    formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
    ch = logging.StreamHandler(sys.stdout)
    ch.setFormatter(formatter)
    if not logger.handlers:
        logger.addHandler(ch)
    return logger

log = setup_logger()

# ==========================================
# 2. GIT-AS-A-DATABASE ENGINE
# ==========================================
class GitDatabaseEngine:
    """
    Handles versioned object commits using Gzip compression for .dat files.
    """
    def __init__(self, repo="majixai/majixai.github.io"):
        self.token = os.environ.get("GITHUB_TOKEN", "")
        if not self.token:
            log.warning(
                "GITHUB_TOKEN is not set — GitDatabaseEngine requests will be unauthenticated "
                "and subject to stricter rate limits."
            )
        self.repo = repo
        self.base_url = f"https://api.github.com/repos/{self.repo}/contents"
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json"
        }

    def _get_blob_info(self, path):
        url = f"{self.base_url}/{path}"
        response = requests.get(url, headers=self.headers)
        if response.status_code == 200:
            return response.json()
        elif response.status_code == 404:
            return None
        else:
            response.raise_for_status()

    async def _get_blob_info_async(self, path):
        """Async wrapper for _get_blob_info using a thread pool."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._get_blob_info, path)

    def commit_record(self, file_path, data_dict, commit_message="Ledger update: Versioned object commit"):
        if not file_path.endswith('.dat'):
            file_path += '.dat'

        # Mandatory file compression (on-the-fly Gzip)
        json_data = json.dumps(data_dict).encode('utf-8')
        compressed_payload = gzip.compress(json_data)
        
        # GitHub API requires base64 encoded payload
        encoded_content = base64.b64encode(compressed_payload).decode('utf-8')

        file_info = self._get_blob_info(file_path)
        sha = file_info['sha'] if file_info else None

        payload = {
            "message": commit_message,
            "content": encoded_content
        }
        if sha:
            payload["sha"] = sha

        url = f"{self.base_url}/{file_path}"
        response = requests.put(url, headers=self.headers, json=payload)
        response.raise_for_status()
        
        action = "Updated" if sha else "Created"
        log.info(f"Database Transaction Successful: {action} {file_path}")
        return response.json()

    async def commit_record_async(self, file_path, data_dict, commit_message="Ledger update: Versioned object commit"):
        """Async version of commit_record — I/O runs in a thread pool."""
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, self.commit_record, file_path, data_dict, commit_message
        )

# ==========================================
# 3. DATA INGESTION
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
# 4. CYTHONIZED MATHEMATICAL CORE
# ==========================================
@cython.cfunc
@cython.returns(cython.double)
@cython.locals(prior=cython.double, likelihood=cython.double, entropy_weight=cython.double)
def fast_bayesian_fusion(prior, likelihood, entropy_weight):
    return (prior * entropy_weight) + (likelihood * (1.0 - entropy_weight))

class QuantitativeCore:
    @staticmethod
    def bayesian_arctrigonometric_differential(price_series, feature_matrix, raw_probability):
        log.info("Executing Cython-Accelerated Multivariate Calculus...")
        velocity = np.gradient(price_series)
        trend_angle = np.arctan(velocity[-1])
        angle_normalized = float((trend_angle + (np.pi/2)) / np.pi) 
        
        cov_matrix = np.cov(feature_matrix, rowvar=False)
        eigenvalues, _ = np.linalg.eigh(cov_matrix)
        
        dominant_eigen = float(np.max(eigenvalues))
        entropy_weight = float(np.clip(1.0 / np.log1p(dominant_eigen), 0.1, 0.9))
        
        prior = float(raw_probability)
        likelihood = angle_normalized
        
        posterior = fast_bayesian_fusion(prior, likelihood, entropy_weight)
        return np.clip(posterior, 0.01, 0.99)

    @staticmethod
    def synthetic_options_analysis(df):
        log.info("Processing Synthetic Options Greeks...")
        df['Returns'] = np.log(df['Close'] / df['Close'].shift(1))
        df['HV'] = df['Returns'].rolling(window=20).std() * np.sqrt(365) 
        
        latest_price = df['Close'].iloc[-1]
        latest_hv = df['HV'].iloc[-1]
        
        r = 0.05
        t = 5 / 365
        
        d1 = (np.log(latest_price / latest_price) + (r + 0.5 * latest_hv**2) * t) / (latest_hv * np.sqrt(t))
        synthetic_gamma = norm.pdf(d1) / (latest_price * latest_hv * np.sqrt(t))
        
        return latest_hv, synthetic_gamma

# ==========================================
# 5. DEEP LEARNING CORE
# ==========================================
class NeuralCore:
    """
    LSTM-based neural inference engine.

    Builds a two-layer LSTM → Dropout → Dense → Sigmoid model using
    TensorFlow/Keras and runs a deterministic forward pass over the most
    recent *sequence_length* rows of the feature matrix.

    Falls back to a numpy sigmoid approximation when TensorFlow is unavailable,
    so the pipeline always produces a valid probability in [0, 1].
    """

    def __init__(self, sequence_length: int, num_features: int) -> None:
        self.sequence_length = sequence_length
        self.num_features = num_features
        self._model = None
        self._tf = self._load_tf()

    @staticmethod
    def _load_tf():
        try:
            import tensorflow as tf  # noqa: PLC0415
            return tf
        except ImportError:
            log.warning("TensorFlow unavailable — NeuralCore will use numpy fallback.")
            return None

    def _build_model(self):
        """Build LSTM(64) → Dropout → LSTM(32) → Dropout → Dense(16) → Dense(1, sigmoid)."""
        tf = self._tf
        if tf is None:
            return None
        tf.random.set_seed(42)
        l2 = tf.keras.regularizers.l2(1e-4)
        model = tf.keras.Sequential([
            tf.keras.layers.InputLayer(shape=(self.sequence_length, self.num_features)),
            tf.keras.layers.LSTM(64, return_sequences=True,
                                 kernel_regularizer=l2, recurrent_regularizer=l2),
            tf.keras.layers.Dropout(0.2, seed=42),
            tf.keras.layers.LSTM(32, kernel_regularizer=l2, recurrent_regularizer=l2),
            tf.keras.layers.Dropout(0.2, seed=42),
            tf.keras.layers.Dense(16, activation="tanh"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ], name="titan_neural_core")
        log.info(
            "[NeuralCore] Built LSTM model — seq_len=%d  features=%d  params=%d",
            self.sequence_length, self.num_features, model.count_params(),
        )
        return model

    def infer_probability(self, matrix: np.ndarray) -> float:
        """
        Forward pass through the LSTM neural network.

        Normalises each feature column to [0, 1], takes the last
        *sequence_length* rows as the input window, and returns the
        sigmoid-activated output as a directional probability in [0, 1]:
          > 0.60 → bullish,  < 0.40 → bearish,  otherwise neutral.

        Parameters
        ----------
        matrix : ndarray  shape (N, num_features)

        Returns
        -------
        float  probability in [0, 1]
        """
        if self._model is None:
            self._model = self._build_model()

        n = len(matrix)
        if n < self.sequence_length:
            pad = np.zeros((self.sequence_length - n, matrix.shape[1]))
            matrix = np.vstack([pad, matrix])

        # Per-column min-max normalisation to [0, 1]
        col_min = matrix.min(axis=0)
        col_max = matrix.max(axis=0)
        col_range = np.maximum(col_max - col_min, 1e-10)
        norm = (matrix - col_min) / col_range

        last_seq = norm[-self.sequence_length:].astype(np.float32)

        if self._model is not None and self._tf is not None:
            x = last_seq[np.newaxis, ...]          # (1, seq_len, features)
            prob = float(self._model(x, training=False).numpy()[0, 0])
            log.info("[NeuralCore] LSTM inference — probability=%.4f", prob)
            return float(np.clip(prob, 0.01, 0.99))

        # Numpy fallback: weighted-mean of last window → scaled sigmoid
        weights = np.linspace(0.5, 1.0, last_seq.shape[0])  # recency weighting
        weighted_mean = (last_seq * weights[:, None]).sum(axis=0) / weights.sum()
        feature_weights = np.array([0.40, 0.30, 0.20, 0.10])[:self.num_features]
        feature_weights /= feature_weights.sum()
        signal = float(np.tanh(weighted_mean @ feature_weights) * 3.0)
        prob = float(1.0 / (1.0 + np.exp(-signal)))
        log.info("[NeuralCore] Numpy fallback inference — probability=%.4f", prob)
        return float(np.clip(prob, 0.01, 0.99))

# ==========================================
# 6. ORCHESTRATION
# ==========================================
def main():
    log.info("=== INITIALIZING CYTHON TITAN ENGINE ===")
    
    now_pdt = datetime.datetime.utcnow() - datetime.timedelta(hours=7)
    is_weekend = now_pdt.weekday() >= 5 
    forecast_horizon = 5 if is_weekend else 1

    client = DataClient(EngineConfig.TICKER, EngineConfig.LOOKBACK_DAYS, EngineConfig.INTERVAL, EngineConfig.USE_EXTENDED_HOURS)
    df = client.fetch_data()

    latest_close = float(df['Close'].iloc[-1])
    latest_date = df.index[-1].strftime('%Y-%m-%d')
    price_series = df['Close'].values.astype(np.float64)

    df['SMA_20'] = df['Close'].rolling(20).mean()
    df['RSI'] = df['Close'].diff().where(lambda x: x > 0, 0).rolling(14).mean() / abs(df['Close'].diff()).rolling(14).mean()
    matrix = df[['Close', 'Volume', 'SMA_20', 'RSI']].dropna().values.astype(np.float64)

    neural_core = NeuralCore(EngineConfig.FEATURE_WINDOW, matrix.shape[1])
    raw_tensor_prob = neural_core.infer_probability(matrix)

    final_probability = QuantitativeCore.bayesian_arctrigonometric_differential(
        price_series=price_series, 
        feature_matrix=matrix[-60:], 
        raw_probability=raw_tensor_prob
    )

    implied_vol, atm_gamma = QuantitativeCore.synthetic_options_analysis(df)
    
    gamma_squash = 1.0 - np.clip(atm_gamma * 100, 0, 0.5) 
    time_scale = np.sqrt(5) if is_weekend else 1.0
    
    expected_move = (latest_close * implied_vol * np.sqrt(1/365)) * time_scale * gamma_squash
    proj_high = latest_close + expected_move
    proj_low = latest_close - expected_move

    signal = 1 if final_probability > 0.60 else (-1 if final_probability < 0.40 else 0)

    # 1. Export CSV for TradingView Pine Seed
    pd.DataFrame({
        'Date': [latest_date],
        'Open': [signal],
        'High': [proj_high],
        'Low':  [proj_low],
        'Close': [final_probability],
        'Volume': [forecast_horizon]
    }).to_csv(EngineConfig.OUTPUT_FILE, index=False)

    log.info(f"Target High: {proj_high:.2f} | Target Low: {proj_low:.2f}")

    # 2. Export Telemetry to Git-as-a-Database (.dat Gzip payload)
    db = GitDatabaseEngine()
    telemetry_payload = {
        "timestamp": datetime.datetime.utcnow().isoformat() + "Z",
        "ticker": EngineConfig.TICKER,
        "spot_price": latest_close,
        "signal": signal,
        "probability": final_probability,
        "projection_high": proj_high,
        "projection_low": proj_low,
        "gamma_squash_applied": gamma_squash,
        "horizon_days": forecast_horizon
    }
    
    db.commit_record(
        file_path="database/telemetry/titan_latest.dat",
        data_dict=telemetry_payload,
        commit_message=f"Titan Engine Telemetry: {EngineConfig.TICKER} @ {latest_close:.2f}"
    )

    log.info("=== CYTHON ENGINE COMPLETE ===")

if __name__ == "__main__":
    main()
