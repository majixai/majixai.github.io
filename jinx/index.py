import yfinance as yf

def main():
    # Fetch data for a specific stock
    ticker = "AAPL"
    stock = yf.Ticker(ticker)

    # Get historical market data
    hist = stock.history(period="1mo")

    # Print the historical data
    print(hist)

if __name__ == "__main__":
    main()
