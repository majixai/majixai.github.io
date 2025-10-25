import requests
from bs4 import BeautifulSoup
import re
import sqlite3
import gzip
import json
import sys
from datetime import datetime

# Expanded list of 100 tickers (S&P 100 components and other major stocks)
TICKERS = [
    {'ticker': 'AAPL', 'name': 'Apple Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'MSFT', 'name': 'Microsoft Corporation', 'exchange': 'NASDAQ'},
    {'ticker': 'GOOGL', 'name': 'Alphabet Inc. (Class A)', 'exchange': 'NASDAQ'},
    {'ticker': 'AMZN', 'name': 'Amazon.com, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'NVDA', 'name': 'NVIDIA Corporation', 'exchange': 'NASDAQ'},
    {'ticker': 'TSLA', 'name': 'Tesla, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'META', 'name': 'Meta Platforms, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'BRK-B', 'name': 'Berkshire Hathaway Inc.', 'exchange': 'NYSE'},
    {'ticker': 'JPM', 'name': 'JPMorgan Chase & Co.', 'exchange': 'NYSE'},
    {'ticker': 'JNJ', 'name': 'Johnson & Johnson', 'exchange': 'NYSE'},
    {'ticker': 'V', 'name': 'Visa Inc.', 'exchange': 'NYSE'},
    {'ticker': 'PG', 'name': 'Procter & Gamble Co.', 'exchange': 'NYSE'},
    {'ticker': 'UNH', 'name': 'UnitedHealth Group Inc.', 'exchange': 'NYSE'},
    {'ticker': 'MA', 'name': 'Mastercard Incorporated', 'exchange': 'NYSE'},
    {'ticker': 'HD', 'name': 'The Home Depot, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'BAC', 'name': 'Bank of America Corp', 'exchange': 'NYSE'},
    {'ticker': 'PFE', 'name': 'Pfizer Inc.', 'exchange': 'NYSE'},
    {'ticker': 'DIS', 'name': 'The Walt Disney Company', 'exchange': 'NYSE'},
    {'ticker': 'ADBE', 'name': 'Adobe Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'CRM', 'name': 'Salesforce, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'NFLX', 'name': 'Netflix, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'KO', 'name': 'The Coca-Cola Company', 'exchange': 'NYSE'},
    {'ticker': 'WMT', 'name': 'Walmart Inc.', 'exchange': 'NYSE'},
    {'ticker': 'PEP', 'name': 'PepsiCo, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'XOM', 'name': 'Exxon Mobil Corporation', 'exchange': 'NYSE'},
    {'ticker': 'CVX', 'name': 'Chevron Corporation', 'exchange': 'NYSE'},
    {'ticker': 'T', 'name': 'AT&T Inc.', 'exchange': 'NYSE'},
    {'ticker': 'CSCO', 'name': 'Cisco Systems, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'ORCL', 'name': 'Oracle Corporation', 'exchange': 'NYSE'},
    {'ticker': 'INTC', 'name': 'Intel Corporation', 'exchange': 'NASDAQ'},
    {'ticker': 'ABBV', 'name': 'AbbVie Inc.', 'exchange': 'NYSE'},
    {'ticker': 'MCD', 'name': 'McDonald\'s Corporation', 'exchange': 'NYSE'},
    {'ticker': 'COST', 'name': 'Costco Wholesale Corporation', 'exchange': 'NASDAQ'},
    {'ticker': 'TMO', 'name': 'Thermo Fisher Scientific Inc.', 'exchange': 'NYSE'},
    {'ticker': 'AVGO', 'name': 'Broadcom Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'QCOM', 'name': 'QUALCOMM Incorporated', 'exchange': 'NASDAQ'},
    {'ticker': 'ACN', 'name': 'Accenture plc', 'exchange': 'NYSE'},
    {'ticker': 'AMD', 'name': 'Advanced Micro Devices, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'CAT', 'name': 'Caterpillar Inc.', 'exchange': 'NYSE'},
    {'ticker': 'GS', 'name': 'The Goldman Sachs Group, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'IBM', 'name': 'International Business Machines Corp.', 'exchange': 'NYSE'},
    {'ticker': 'UBER', 'name': 'Uber Technologies, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'BA', 'name': 'The Boeing Company', 'exchange': 'NYSE'},
    {'ticker': 'GE', 'name': 'General Electric Company', 'exchange': 'NYSE'},
    {'ticker': 'SBUX', 'name': 'Starbucks Corporation', 'exchange': 'NASDAQ'},
    {'ticker': 'NKE', 'name': 'NIKE, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'LOW', 'name': 'Lowe\'s Companies, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'RTX', 'name': 'RTX Corporation', 'exchange': 'NYSE'},
    {'ticker': 'BLK', 'name': 'BlackRock, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'UPS', 'name': 'United Parcel Service, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'MS', 'name': 'Morgan Stanley', 'exchange': 'NYSE'},
    {'ticker': 'HON', 'name': 'Honeywell International Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'C', 'name': 'Citigroup Inc.', 'exchange': 'NYSE'},
    {'ticker': 'SPGI', 'name': 'S&P Global Inc.', 'exchange': 'NYSE'},
    {'ticker': 'AMGN', 'name': 'Amgen Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'GILD', 'name': 'Gilead Sciences, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'AMT', 'name': 'American Tower Corporation', 'exchange': 'NYSE'},
    {'ticker': 'AXP', 'name': 'American Express Company', 'exchange': 'NYSE'},
    {'ticker': 'DE', 'name': 'Deere & Company', 'exchange': 'NYSE'},
    {'ticker': 'LMT', 'name': 'Lockheed Martin Corporation', 'exchange': 'NYSE'},
    {'ticker': 'PLD', 'name': 'Prologis, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'SYK', 'name': 'Stryker Corporation', 'exchange': 'NYSE'},
    {'ticker': 'TGT', 'name': 'Target Corporation', 'exchange': 'NYSE'},
    {'ticker': 'TJX', 'name': 'The TJX Companies, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'USB', 'name': 'U.S. Bancorp', 'exchange': 'NYSE'},
    {'ticker': 'WFC', 'name': 'Wells Fargo & Company', 'exchange': 'NYSE'},
    {'ticker': 'ZTS', 'name': 'Zoetis Inc.', 'exchange': 'NYSE'},
    {'ticker': 'MMM', 'name': '3M Company', 'exchange': 'NYSE'},
    {'ticker': 'ABT', 'name': 'Abbott Laboratories', 'exchange': 'NYSE'},
    {'ticker': 'BMY', 'name': 'Bristol Myers Squibb', 'exchange': 'NYSE'},
    {'ticker': 'COP', 'name': 'ConocoPhillips', 'exchange': 'NYSE'},
    {'ticker': 'DUK', 'name': 'Duke Energy Corporation', 'exchange': 'NYSE'},
    {'ticker': 'FDX', 'name': 'FedEx Corporation', 'exchange': 'NYSE'},
    {'ticker': 'GM', 'name': 'General Motors Company', 'exchange': 'NYSE'},
    {'ticker': 'MO', 'name': 'Altria Group, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'MRK', 'name': 'Merck & Co., Inc.', 'exchange': 'NYSE'},
    {'ticker': 'NEE', 'name': 'NextEra Energy, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'PNC', 'name': 'The PNC Financial Services Group, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'SO', 'name': 'The Southern Company', 'exchange': 'NYSE'},
    {'ticker': 'VZ', 'name': 'Verizon Communications Inc.', 'exchange': 'NYSE'},
    {'ticker': 'ANTM', 'name': 'Anthem, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'BKNG', 'name': 'Booking Holdings Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'CB', 'name': 'Chubb Limited', 'exchange': 'NYSE'},
    {'ticker': 'CI', 'name': 'Cigna Corporation', 'exchange': 'NYSE'},
    {'ticker': 'CL', 'name': 'Colgate-Palmolive Company', 'exchange': 'NYSE'},
    {'ticker': 'CMCSA', 'name': 'Comcast Corporation', 'exchange': 'NASDAQ'},
    {'ticker': 'DHR', 'name': 'Danaher Corporation', 'exchange': 'NYSE'},
    {'ticker': 'EMR', 'name': 'Emerson Electric Co.', 'exchange': 'NYSE'},
    {'ticker': 'EXC', 'name': 'Exelon Corporation', 'exchange': 'NASDAQ'},
    {'ticker': 'F', 'name': 'Ford Motor Company', 'exchange': 'NYSE'},
    {'ticker': 'GD', 'name': 'General Dynamics Corporation', 'exchange': 'NYSE'},
    {'ticker': 'HCA', 'name': 'HCA Healthcare, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'ISRG', 'name': 'Intuitive Surgical, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'KHC', 'name': 'The Kraft Heinz Company', 'exchange': 'NASDAQ'},
    {'ticker': 'KMI', 'name': 'Kinder Morgan, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'MDLZ', 'name': 'Mondelez International, Inc.', 'exchange': 'NASDAQ'},
    {'ticker': 'MET', 'name': 'MetLife, Inc.', 'exchange': 'NYSE'},
    {'ticker': 'NOW', 'name': 'ServiceNow, Inc.', 'exchange': 'NYSE'},
]

DB_FILE = 'finance.db'
COMPRESSED_DB_FILE = 'finance.db.gz'
CONFIG_FILE = 'jscript/config.json'
BASE_URL = "https://www.google.com/finance/quote/"
HEADERS = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'}

def load_config():
    """Loads the configuration from the config.json file."""
    try:
        with open(CONFIG_FILE, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Error: Configuration file '{CONFIG_FILE}' not found.")
        sys.exit(1)
    except json.JSONDecodeError:
        print(f"Error: Invalid JSON in configuration file '{CONFIG_FILE}'.")
        sys.exit(1)

def log(message, level='normal'):
    """Prints a message if its level is at or below the configured log level."""
    if CONFIG['log_level'] == 'verbose' or level == 'normal':
        print(message)

def setup_database():
    """Sets up the SQLite database and creates the prices table if it doesn't exist."""
    log("Setting up database...", 'verbose')
    with sqlite3.connect(DB_FILE) as conn:
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS prices (
                id INTEGER PRIMARY KEY,
                ticker TEXT NOT NULL,
                name TEXT NOT NULL,
                price TEXT NOT NULL,
                scraped_at TIMESTAMP NOT NULL
            )
        ''')
        conn.commit()
    log("Database setup complete.", 'verbose')

def construct_url(ticker, exchange):
    """Constructs the full Google Finance URL for a given stock ticker."""
    return f"{BASE_URL}{ticker}:{exchange}"

def scrape_price(url):
    """Scrapes the price from a given Google Finance URL."""
    log(f"Scraping URL: {url}", 'verbose')
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        price_div = soup.find("div", class_=re.compile(r"^YMlKec fxKbKc$"))
        if price_div:
            price = price_div.get_text(strip=True)
            log(f"  -> Success, found price: {price}", 'verbose')
            return price
        log("  -> Price element not found", 'verbose')
        return "N/A"
    except requests.exceptions.RequestException as e:
        log(f"  -> Fetch Error: {e}", 'verbose')
        return "Fetch Error"
    except Exception as e:
        log(f"  -> Parse Error: {e}", 'verbose')
        return "Parse Error"

def insert_price(conn, ticker, name, price):
    """Inserts a new price record into the database."""
    scraped_at = datetime.now()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO prices (ticker, name, price, scraped_at) VALUES (?, ?, ?, ?)",
                   (ticker, name, price, scraped_at))

def display_latest_data(conn):
    """Queries and displays the most recent data for each ticker in a table format."""
    print(f"\n{'Ticker':<8} {'Name':<40} {'Price':<15} {'Scraped At':<25}")
    print("-" * 88)
    cursor = conn.cursor()
    cursor.execute('''
        SELECT ticker, name, price, scraped_at
        FROM prices p
        WHERE p.id = (SELECT MAX(id) FROM prices WHERE ticker = p.ticker)
        ORDER BY ticker
    ''')
    for row in cursor.fetchall():
        print(f"{row[0]:<8} {row[1]:<40} {row[2]:<15} {row[3]:<25}")

def compress_database():
    """Compresses the SQLite database file using gzip."""
    log(f"Compressing database to {COMPRESSED_DB_FILE}", 'verbose')
    with open(DB_FILE, 'rb') as f_in, gzip.open(COMPRESSED_DB_FILE, 'wb') as f_out:
        f_out.writelines(f_in)
    log("Compression complete.", 'normal')

def main():
    """Main function to run the scraping, database, and display logic."""
    global CONFIG
    CONFIG = load_config()

    if not CONFIG.get('enabled', False):
        print("Scraper is disabled in the configuration. Exiting.")
        sys.exit(0)

    log("Scraper started.", 'normal')
    setup_database()
    with sqlite3.connect(DB_FILE) as conn:
        for stock in TICKERS:
            url = construct_url(stock['ticker'], stock['exchange'])
            price = scrape_price(url)
            log(f"  -> Storing: {stock['name']}, Price: {price}", 'verbose')
            insert_price(conn, stock['ticker'], stock['name'], price)
        conn.commit()

    log("Scraping complete. Displaying latest data.", 'normal')
    with sqlite3.connect(DB_FILE) as conn:
        display_latest_data(conn)

    compress_database()
    log("Scraper finished.", 'normal')

if __name__ == "__main__":
    main()
