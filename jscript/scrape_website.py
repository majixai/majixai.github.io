import requests
from bs4 import BeautifulSoup
import re

# List of financial instruments to scrape
FINANCIAL_INSTRUMENTS = [
    {'name': 'S&P 500', 'type': 'index', 'ticker': '.INX', 'exchange': 'INDEXSP'},
    {'name': 'Dow Jones Industrial Average', 'type': 'index', 'ticker': '.DJI', 'exchange': 'INDEXDJX'},
    {'name': 'Apple Inc.', 'type': 'stock', 'ticker': 'AAPL', 'exchange': 'NASDAQ'},
    {'name': 'Alphabet Inc. (Google)', 'type': 'stock', 'ticker': 'GOOGL', 'exchange': 'NASDAQ'},
    {'name': 'Bitcoin', 'type': 'crypto', 'base': 'BTC', 'quote': 'USD'},
    {'name': 'Ethereum', 'type': 'crypto', 'base': 'ETH', 'quote': 'USD'},
]

BASE_URL = "https://www.google.com/finance/quote/"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

def construct_url(instrument):
    """Constructs the full Google Finance URL for a given instrument."""
    instrument_type = instrument.get('type')
    if instrument_type in ['stock', 'index']:
        return f"{BASE_URL}{instrument.get('ticker')}:{instrument.get('exchange')}"
    elif instrument_type == 'crypto':
        return f"{BASE_URL}{instrument.get('base')}-{instrument.get('quote')}"
    return None

def scrape_price(url):
    """Scrapes the price from a given Google Finance URL."""
    try:
        response = requests.get(url, headers=HEADERS)
        response.raise_for_status()
        soup = BeautifulSoup(response.content, "html.parser")
        # The price is in a div with a specific, and often changing, class.
        # This selector targets the most likely element.
        price_div = soup.find("div", class_=re.compile(r"^YMlKec fxKbKc$"))
        if price_div:
            return price_div.get_text(strip=True)
        return "Price element not found"
    except requests.exceptions.RequestException as e:
        return f"Error fetching URL: {e}"
    except Exception as e:
        return f"An error occurred: {e}"

def main():
    """
    Loops through financial instruments, constructs their URLs, and scrapes the current price.
    """
    print("--- Scraping Financial Data from Google Finance ---")
    for instrument in FINANCIAL_INSTRUMENTS:
        url = construct_url(instrument)
        if url:
            price = scrape_price(url)
            print(f"{instrument['name']} ({url}): {price}")
        else:
            print(f"Could not generate URL for {instrument['name']}")
    print("-------------------------------------------------")

if __name__ == "__main__":
    main()
