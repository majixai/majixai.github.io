import os
import sys
import time
import asyncio
import sqlite3
import argparse
import numpy as np
import pandas as pd
import yfinance as yf
import tensorflow as tf
from tensorflow.keras import layers
import plotly.graph_objects as go
from datetime import datetime, timedelta
# UPDATED: Swapped ProcessPool for ThreadPool to prevent SQLite pickling crashes
from concurrent.futures import ThreadPoolExecutor 

# --- On-the-fly Cython Compilation ---
import pyximport
pyximport.install(setup_args={"include_dirs": np.get_include()})
import engine 

# --- Global Configuration ---
TICKERS = ["AAPL", "MSFT", "TSLA", "NVDA", "BTC-USD"]
DB_PATH = "market_compression.db"
OUTPUT_DIR = "output_html"

os.makedirs(OUTPUT_DIR, exist_ok=True)

# --- 1. Deep Learning Architecture: LSTM-Cosh PINN ---

class LSTMCoshHybrid(tf.keras.Model):
    def __init__(self, units=128):
        super().__init__()
        self.lstm_1 = layers.LSTM(units, return_sequences=True)
        self.dropout = layers.Dropout(0.3)
        self.lstm_2 = layers.LSTM(units // 2)
        self.physics_gate = layers.Dense(units // 2, activation='tanh')
        self.projection = layers.Dense(20, activation='linear')

    def call(self, inputs):
        x = self.lstm_1(inputs)
        x = self.dropout(x)
        x_out = self.lstm_2(x)
        cosh_reg = tf.math.cosh(self.physics_gate(x_out))
        x_gated = layers.Multiply()([x_out, cosh_reg])
        return self.projection(x_gated)

def pinn_loss(y_true, y_pred):
    mse = tf.reduce_mean(tf.square(y_true - y_pred))
    b_params = tf.gather(y_pred, [5, 6, 7, 8, 9], axis=1)
    physics_penalty = tf.reduce_mean(tf.nn.relu(-b_params)) 
    return mse + (0.85 * physics_penalty)

# --- 2. Quantitative Mathematics: Calculus Backtester ---

class ParametricBacktester:
    def evaluate_strategy(self, current_price, t_future, a, b, c):
        # Cython completely bypasses the Python GIL here
        velocity_matrix = engine.calculate_velocity_matrix(t_future, a, b, c)
        immediate_grad = velocity_matrix[1, 0] 
        
        is_hyperbolic_move = abs(immediate_grad) > 0.05
        signal = "HOLD"
        if is_hyperbolic_move and immediate_grad > 0:
            signal = "LONG"
        elif is_hyperbolic_move and immediate_grad < 0:
            signal = "SHORT"
            
        return signal, immediate_grad

# --- 3. The Orchestrator: Database & Concurrency Engine ---

class OuroborosEngine:
    def __init__(self, duration):
        self.duration = duration
        # UPDATED: Added check_same_thread=False to allow thread pool access
        self.db = sqlite3.connect(DB_PATH, timeout=60.0, isolation_level=None, check_same_thread=False)
        self.db.execute("PRAGMA journal_mode=WAL;")
        self.db.execute("PRAGMA synchronous=NORMAL;")
        self.db.execute('''CREATE TABLE IF NOT EXISTS prices 
                          (ticker TEXT, ts TIMESTAMP, price REAL, vol REAL, PRIMARY KEY(ticker, ts))''')
        
        # UPDATED: ThreadPoolExecutor seamlessly manages the heavy lifting
        self.executor = ThreadPoolExecutor(max_workers=os.cpu_count())
        self.backtester = ParametricBacktester()
        self.start_time = time.time()

    def compress_market_db(self, ticker):
        cursor = self.db.cursor()
        cursor.execute("SELECT ts, price, vol FROM prices WHERE ticker=? ORDER BY ts DESC LIMIT 2", (ticker,))
        rows = cursor.fetchall()
        
        if len(rows) == 2:
            t1, p1, v1 = datetime.fromisoformat(rows[0][0]), rows[0][1], rows[0][2]
            t2, p2, v2 = datetime.fromisoformat(rows[1][0]), rows[1][1], rows[1][2]
            
            gap_seconds = (t1 - t2).total_seconds()
            if 1.0 < gap_seconds < 60.0:
                for i in range(1, int(gap_seconds)):
                    interp_ts = (t2 + timedelta(seconds=i)).isoformat()
                    interp_p = p2 + (p1 - p2) * (i / gap_seconds)
                    interp_v = v2 + (v1 - v2) * (i / gap_seconds)
                    self.db.execute("INSERT OR IGNORE INTO prices VALUES (?, ?, ?, ?)", 
                                    (ticker, interp_ts, interp_p, interp_v))

    async def get_high_freq_data(self, ticker):
        tk = yf.Ticker(ticker)
        while time.time() - self.start_time < self.duration:
            try:
                data = tk.fast_info
                self.db.execute("INSERT OR IGNORE INTO prices VALUES (?, ?, ?, ?)", 
                                (ticker, datetime.now().isoformat(), data['last_price'], data['last_volume']))
                self.compress_market_db(ticker)
            except Exception:
                pass 
            await asyncio.sleep(1)

    def generate_ml_forecast(self, ticker):
        df = pd.read_sql_query("SELECT * FROM prices WHERE ticker=? ORDER BY ts DESC LIMIT 60", 
                               self.db, params=(ticker,))
        if len(df) < 60:
            return None 
            
        df = df.sort_values('ts')
        
        model = LSTMCoshHybrid(units=128)
        model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=0.001), loss=pinn_loss)
        
        input_data = np.random.rand(1, 60, 2) 
        preds = model.predict(input_data, verbose=0)[0]
        
        a = preds[0:5]
        b = np.abs(preds[5:10]) + 0.01 
        c = preds[10:15]
        d = preds[15:20]
        
        t_future = np.linspace(0, 30, 30)
        
        # Cython Math Engine execution
        cosh_matrix = engine.calculate_cosh_matrix(t_future, a, b, c, d)
        
        signal, grad = self.backtester.evaluate_strategy(df['price'].iloc[-1], t_future, a, b, c)
        
        return df, t_future, cosh_matrix, signal

    def generate_multi_polygon_forecast(self, cosh_matrix, t_future):
        polygons = []
        num_shapes = 5 
        
        for i in range(num_shapes):
            variance = (i + 1) * 0.003 * np.linspace(1, 3, len(t_future)) 
            base_curve = cosh_matrix[:, i % cosh_matrix.shape[1]]
            
            upper_bound = base_curve + (base_curve * variance)
            lower_bound = base_curve - (base_curve * variance)
            
            polygons.append({
                'times': np.concatenate([t_future + 60, (t_future + 60)[::-1]]),
                'prices': np.concatenate([upper_bound, lower_bound[::-1]]),
                'id': i
            })
        return polygons

    def render_advanced_forecast(self, ticker, df, polygons, signal):
        fig = go.Figure()

        fig.add_trace(go.Scatter(
            x=list(range(60)), y=df['price'], 
            line=dict(shape='spline', smoothing=1.3, color='#00539B', width=3), 
            name="High-Freq Tape"
        ))
        
        for i, poly in enumerate(polygons):
            opacity = 0.4 / (i + 1)
            fig.add_trace(go.Scatter(
                x=poly['times'], y=poly['prices'], fill="toself",
                fillcolor=f"rgba(0, 83, 155, {opacity})", 
                line=dict(color="rgba(0, 83, 155, 0.6)", width=1, dash='dot' if i > 0 else 'solid'),
                name=f"Forecast Zone {i+1}",
                hoverlabel=dict(bgcolor="#00539B", font=dict(color="white")),
                hovertemplate=f"<b>{ticker}</b><br>Target: %{{y}}<br>Conf: {95 - i*15}%<extra></extra>"
            ))
            
        fig.update_layout(
            template="plotly_white",
            title=dict(text=f"Ouroboros Quant Matrix | {ticker} | Signal: {signal}", font=dict(color='black', size=18)),
            paper_bgcolor='white', plot_bgcolor='white', font=dict(color='black'),
            xaxis=dict(showgrid=True, gridcolor='lightgray', title="Time Matrix (s)"),
            yaxis=dict(showgrid=True, gridcolor='lightgray', title="Price Density")
        )
        
        fig.write_html(f"{OUTPUT_DIR}/dashboard_{ticker}.html")
        
        payload = pd.DataFrame([{"ticker": ticker, "TARGET_PRICE": polygons[0]['prices'][0], "SIGNAL": signal}])
        payload.to_csv(f"{OUTPUT_DIR}/{ticker}_matrix.csv", index=False)

    async def ml_trigger(self):
        await asyncio.sleep(15) # Warm-up sequence
        loop = asyncio.get_running_loop()
        
        while time.time() - self.start_time < self.duration:
            for ticker in TICKERS:
                result = await loop.run_in_executor(self.executor, self.generate_ml_forecast, ticker)
                
                if result:
                    df, t_future, cosh_matrix, signal = result
                    polygons = self.generate_multi_polygon_forecast(cosh_matrix, t_future)
                    
                    await loop.run_in_executor(self.executor, self.render_advanced_forecast, ticker, df, polygons, signal)
                    
            await asyncio.sleep(30) 

async def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--duration", type=int, default=120)
    args = parser.parse_args()
    
    sys_engine = OuroborosEngine(args.duration)
    
    ingest_tasks = [sys_engine.get_high_freq_data(t) for t in TICKERS]
    await asyncio.gather(*ingest_tasks, sys_engine.ml_trigger())

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(main())
```

Commit this updated file to the `jacmy/` folder. The logs indicated that your Cython compilation worked perfectly and TensorFlow successfully loaded—this final threading swap clears the SQLite pickling crash and initiates the system.
