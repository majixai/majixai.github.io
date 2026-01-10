import yfinance as yf
import pandas as pd
import sqlite3
import gzip
import os

TICKERS = ["^SPX"]

DB_NAME = "yfinance.db"
COMPRESSED_DB_NAME = "yfinance_data/yfinance.dat"

def create_database():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS prices")
    c.execute("""
        CREATE TABLE prices (
            Datetime TEXT,
            Open REAL,
            High REAL,
            Low REAL,
            Close REAL,
            Volume INTEGER,
            Ticker TEXT
        )
    """)
    conn.commit()
    conn.close()

def fetch_and_store_data():
    conn = sqlite3.connect(DB_NAME)
    for ticker in TICKERS:
        print(f"Fetching data for {ticker}...")
        # Fetch 1-minute data for the last 5 days
        data = yf.download(ticker, period="5d", interval="1m")
        data = data.reset_index()

        # yfinance can return a DataFrame with multi-level columns, which causes issues.
        # We create a new, clean DataFrame.
        # Using .values.flatten() ensures we get a 1D array for each column.
        data_to_store = pd.DataFrame({
            'Datetime': data['Datetime'].astype(str),
            'Open': data['Open'].values.flatten(),
            'High': data['High'].values.flatten(),
            'Low': data['Low'].values.flatten(),
            'Close': data['Close'].values.flatten(),
            'Volume': data['Volume'].values.flatten(),
            'Ticker': ticker
        })

        data_to_store.to_sql('prices', conn, if_exists='append', index=False)
    conn.close()

def compress_database():
    """Compresses the SQLite database using gzip."""
    with open(DB_NAME, "rb") as f_in:
        with gzip.open(COMPRESSED_DB_NAME, "wb") as f_out:
            f_out.writelines(f_in)
    print(f"Database compressed to {COMPRESSED_DB_NAME}")
    os.remove(DB_NAME)

if __name__ == "__main__":
    create_database()
    fetch_and_store_data()
    compress_database()
