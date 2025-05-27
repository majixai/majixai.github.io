import sqlite3
import yfinance as yf

# List of tickers
tickers = [
    "AAPL", "TSLA", "AMZN", "MSFT", "NVDA", "GOOGL", "META", "NFLX", "JPM", "V", "BAC",
    "AMD", "PYPL", "DIS", "T", "PFE", "COST", "INTC", "KO", "TGT", "NKE", "SPY", "BA",
    "BABA", "XOM", "WMT", "GE", "CSCO", "VZ", "JNJ", "CVX", "PLTR", "SQ", "SHOP", "SBUX",
    "SOFI", "HOOD", "RBLX", "SNAP", "AMD", "UBER", "FDX", "ABBV", "ETSY", "MRNA", "LMT",
    "GM", "F", "RIVN", "LCID", "CCL", "DAL", "UAL", "AAL", "TSM", "SONY", "ET", "NOK",
    "MRO", "COIN", "RIVN", "SIRI", "SOFI", "RIOT", "CPRX", "PYPL", "TGT", "VWO", "SPYG",
    "NOK", "ROKU", "HOOD", "VIAC", "ATVI", "BIDU", "DOCU", "ZM", "PINS", "TLRY", "WBA",
    "VIAC", "MGM", "NFLX", "NIO", "C", "GS", "WFC", "ADBE", "PEP", "UNH", "CARR", "FUBO",
    "HCA", "TWTR", "BILI", "SIRI", "VIAC", "FUBO", "RKT"
]

# Create/connect to SQLite database
conn = sqlite3.connect('index.db')
cursor = conn.cursor()

# Create table
cursor.execute('''
    CREATE TABLE IF NOT EXISTS StockData (
        Ticker TEXT,
        Date TEXT,
        Open REAL,
        High REAL,
        Low REAL,
        Close REAL,
        Volume INTEGER
    )
''')

# Fetch data for each ticker
for ticker in tickers:
    print(f"Fetching data for {ticker}")
    stock_data = yf.download(ticker, period="1d", interval="1d")
    if not stock_data.empty:
        for date, row in stock_data.iterrows():
            cursor.execute('''
                INSERT INTO StockData (Ticker, Date, Open, High, Low, Close, Volume)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            ''', (ticker, date, row['Open'], row['High'], row['Low'], row['Close'], row['Volume']))

# Commit changes and close connection
conn.commit()
conn.close()
print("Data successfully written to index.db")
