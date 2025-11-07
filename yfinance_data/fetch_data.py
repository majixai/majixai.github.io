import yfinance as yf
import pandas as pd
import sqlite3
import gzip
import os

TICKERS = [
    "AAPL", "MSFT", "GOOGL", "AMZN", "TSLA", "JPM", "V", "JNJ", "WMT", "PG"
]

DB_NAME = "yfinance.db"
COMPRESSED_DB_NAME = "yfinance_data/yfinance.dat"

def create_database():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DROP TABLE IF EXISTS prices")
    c.execute("""
        CREATE TABLE prices (
            Date TEXT,
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
        data = yf.download(ticker, period="1y", interval="1d")
        data.reset_index(inplace=True)
        data['Ticker'] = ticker

        data['Date'] = data['Date'].astype(str)

        data_to_store = pd.DataFrame()
        data_to_store['Date'] = data['Date']
        data_to_store['Open'] = data['Open']
        data_to_store['High'] = data['High']
        data_to_store['Low'] = data['Low']
        data_to_store['Close'] = data['Close']
        data_to_store['Volume'] = data['Volume']
        data_to_store['Ticker'] = data['Ticker']

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
