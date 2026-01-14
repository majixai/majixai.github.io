"""
Calculate the standard deviation of S&P 500 using yfinance.

This script fetches weekly S&P 500 data for the past 10 years
and calculates the standard deviation of the closing prices.
"""

import yfinance as yf
import numpy as np
import argparse


def fetch_sp500_weekly_data(period="10y", interval="1wk"):
    """
    Fetch S&P 500 weekly data for the specified period.

    Args:
        period: Time period to fetch (default: "10y" for 10 years)
        interval: Data interval (default: "1wk" for weekly)

    Returns:
        pandas.DataFrame: Historical price data
    """
    ticker = "^GSPC"  # S&P 500 index ticker
    sp500 = yf.Ticker(ticker)
    data = sp500.history(period=period, interval=interval)
    return data


def calculate_stdev(data, column="Close"):
    """
    Calculate the standard deviation of the specified column.

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate stdev for (default: "Close")

    Returns:
        float: Standard deviation of the specified column

    Raises:
        ValueError: If data is empty or column doesn't exist
    """
    if data.empty:
        raise ValueError("No data available to calculate standard deviation")
    if column not in data.columns:
        raise ValueError(f"Column '{column}' not found in data. Available columns: {list(data.columns)}")
    return np.std(data[column], ddof=1)  # Sample standard deviation


def main():
    """Main function to calculate and display S&P 500 standard deviation."""
    parser = argparse.ArgumentParser(
        description="Calculate S&P 500 weekly standard deviation for the past 10 years."
    )
    parser.add_argument(
        "--period",
        default="10y",
        help="Time period for data (default: 10y)",
    )
    parser.add_argument(
        "--interval",
        default="1wk",
        help="Data interval (default: 1wk for weekly)",
    )
    args = parser.parse_args()

    print(f"Fetching S&P 500 data (period={args.period}, interval={args.interval})...")
    data = fetch_sp500_weekly_data(period=args.period, interval=args.interval)

    if data.empty:
        print("Error: No data retrieved from yfinance")
        return

    print(f"Data points retrieved: {len(data)}")
    print(f"Date range: {data.index.min()} to {data.index.max()}")

    stdev = calculate_stdev(data)
    print(f"\nS&P 500 Weekly Close Price Standard Deviation: {stdev:.2f}")

    # Additional statistics
    mean_price = np.mean(data["Close"])
    print(f"Mean Close Price: {mean_price:.2f}")
    print(f"Coefficient of Variation: {(stdev / mean_price) * 100:.2f}%")


if __name__ == "__main__":
    main()
