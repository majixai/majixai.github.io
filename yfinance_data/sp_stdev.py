"""
Advanced Statistical Analysis for S&P 500 using yfinance.

This script fetches S&P 500 data and performs comprehensive statistical analysis
including standard deviation, variance, skewness, kurtosis, and other metrics.
It supports various time periods, intervals, and multiple statistical methods.

Features:
    - Standard deviation calculation (sample and population)
    - Rolling statistics with configurable windows
    - Variance analysis
    - Skewness and kurtosis calculations
    - Distribution normality tests
    - Historical volatility calculations
    - Value at Risk (VaR) estimates
    - Sharpe ratio approximation
"""

import yfinance as yf
import numpy as np
import pandas as pd
import argparse
from typing import Optional, Tuple, Dict, Any
from dataclasses import dataclass
from datetime import datetime


# Common market indices
MARKET_INDICES = {
    "sp500": "^GSPC",
    "dow": "^DJI",
    "nasdaq": "^IXIC",
    "russell2000": "^RUT",
    "vix": "^VIX",
}

# Default configuration
DEFAULT_PERIOD = "10y"
DEFAULT_INTERVAL = "1wk"
DEFAULT_COLUMN = "Close"
RISK_FREE_RATE = 0.05  # Assumed annual risk-free rate


@dataclass
class StatisticalSummary:
    """Container for statistical analysis results."""
    
    ticker: str
    period: str
    interval: str
    data_points: int
    date_range: Tuple[str, str]
    
    # Central tendency
    mean: float
    median: float
    mode: Optional[float]
    
    # Dispersion
    std_population: float
    std_sample: float
    variance: float
    coefficient_of_variation: float
    range_value: float
    iqr: float
    
    # Shape
    skewness: float
    kurtosis: float
    
    # Risk metrics
    var_95: float
    var_99: float
    expected_shortfall_95: float
    max_drawdown: float
    
    # Performance
    total_return: float
    annualized_return: float
    sharpe_ratio: float
    sortino_ratio: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert summary to dictionary."""
        return {
            "ticker": self.ticker,
            "period": self.period,
            "interval": self.interval,
            "data_points": self.data_points,
            "date_range": self.date_range,
            "mean": self.mean,
            "median": self.median,
            "mode": self.mode,
            "std_population": self.std_population,
            "std_sample": self.std_sample,
            "variance": self.variance,
            "coefficient_of_variation": self.coefficient_of_variation,
            "range": self.range_value,
            "iqr": self.iqr,
            "skewness": self.skewness,
            "kurtosis": self.kurtosis,
            "var_95": self.var_95,
            "var_99": self.var_99,
            "expected_shortfall_95": self.expected_shortfall_95,
            "max_drawdown": self.max_drawdown,
            "total_return": self.total_return,
            "annualized_return": self.annualized_return,
            "sharpe_ratio": self.sharpe_ratio,
            "sortino_ratio": self.sortino_ratio,
        }
    
    def print_report(self) -> None:
        """Print a formatted statistical report."""
        print("\n" + "=" * 60)
        print(f"STATISTICAL ANALYSIS: {self.ticker}")
        print("=" * 60)
        print(f"Period: {self.period}, Interval: {self.interval}")
        print(f"Data Points: {self.data_points}")
        print(f"Date Range: {self.date_range[0]} to {self.date_range[1]}")
        
        print("\n--- Central Tendency ---")
        print(f"Mean:   {self.mean:,.2f}")
        print(f"Median: {self.median:,.2f}")
        if self.mode is not None:
            print(f"Mode:   {self.mode:,.2f}")
        
        print("\n--- Dispersion ---")
        print(f"Standard Deviation (Sample):     {self.std_sample:,.2f}")
        print(f"Standard Deviation (Population): {self.std_population:,.2f}")
        print(f"Variance:                        {self.variance:,.2f}")
        print(f"Coefficient of Variation:        {self.coefficient_of_variation:.2%}")
        print(f"Range:                           {self.range_value:,.2f}")
        print(f"Interquartile Range (IQR):       {self.iqr:,.2f}")
        
        print("\n--- Distribution Shape ---")
        print(f"Skewness: {self.skewness:,.4f}")
        skew_interp = "symmetric" if abs(self.skewness) < 0.5 else ("right-skewed" if self.skewness > 0 else "left-skewed")
        print(f"  Interpretation: {skew_interp}")
        print(f"Kurtosis: {self.kurtosis:,.4f}")
        kurt_interp = "normal (mesokurtic)" if abs(self.kurtosis) < 0.5 else ("heavy-tailed (leptokurtic)" if self.kurtosis > 0 else "light-tailed (platykurtic)")
        print(f"  Interpretation: {kurt_interp}")
        
        print("\n--- Risk Metrics ---")
        print(f"Value at Risk (95%): {self.var_95:,.2f}")
        print(f"Value at Risk (99%): {self.var_99:,.2f}")
        print(f"Expected Shortfall (95%): {self.expected_shortfall_95:,.2f}")
        print(f"Maximum Drawdown: {self.max_drawdown:.2%}")
        
        print("\n--- Performance ---")
        print(f"Total Return: {self.total_return:.2%}")
        print(f"Annualized Return: {self.annualized_return:.2%}")
        print(f"Sharpe Ratio: {self.sharpe_ratio:.4f}")
        print(f"Sortino Ratio: {self.sortino_ratio:.4f}")
        
        print("=" * 60)


def fetch_sp500_weekly_data(period: str = DEFAULT_PERIOD, interval: str = DEFAULT_INTERVAL) -> pd.DataFrame:
    """
    Fetch S&P 500 data for the specified period and interval.

    Args:
        period: Time period to fetch (default: "10y" for 10 years)
        interval: Data interval (default: "1wk" for weekly)

    Returns:
        pandas.DataFrame: Historical price data
    """
    ticker = MARKET_INDICES["sp500"]
    sp500 = yf.Ticker(ticker)
    data = sp500.history(period=period, interval=interval)
    return data


def fetch_index_data(
    index_name: str = "sp500",
    period: str = DEFAULT_PERIOD,
    interval: str = DEFAULT_INTERVAL
) -> pd.DataFrame:
    """
    Fetch data for a specified market index.

    Args:
        index_name: Name of the index (sp500, dow, nasdaq, russell2000, vix)
        period: Time period to fetch
        interval: Data interval

    Returns:
        pandas.DataFrame: Historical price data
        
    Raises:
        ValueError: If index name is not recognized
    """
    if index_name.lower() not in MARKET_INDICES:
        raise ValueError(f"Unknown index: {index_name}. Available: {list(MARKET_INDICES.keys())}")
    
    ticker = MARKET_INDICES[index_name.lower()]
    index = yf.Ticker(ticker)
    data = index.history(period=period, interval=interval)
    return data


def calculate_stdev(data: pd.DataFrame, column: str = DEFAULT_COLUMN, ddof: int = 1) -> float:
    """
    Calculate the standard deviation of the specified column.

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate stdev for (default: "Close")
        ddof: Delta degrees of freedom (0=population, 1=sample)

    Returns:
        float: Standard deviation of the specified column

    Raises:
        ValueError: If data is empty or column doesn't exist
    """
    if data.empty:
        raise ValueError("No data available to calculate standard deviation")
    if column not in data.columns:
        raise ValueError(f"Column '{column}' not found in data. Available columns: {list(data.columns)}")
    return float(np.std(data[column], ddof=ddof))


def calculate_variance(data: pd.DataFrame, column: str = DEFAULT_COLUMN, ddof: int = 1) -> float:
    """
    Calculate the variance of the specified column.

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate variance for
        ddof: Delta degrees of freedom

    Returns:
        float: Variance of the specified column
    """
    if data.empty:
        raise ValueError("No data available to calculate variance")
    return float(np.var(data[column], ddof=ddof))


def calculate_skewness(data: pd.DataFrame, column: str = DEFAULT_COLUMN) -> float:
    """
    Calculate the skewness of the specified column.

    Skewness measures the asymmetry of the distribution:
    - Positive skew: Tail on the right side is longer
    - Negative skew: Tail on the left side is longer
    - Zero: Symmetric distribution

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate skewness for

    Returns:
        float: Skewness of the specified column
    """
    if data.empty:
        raise ValueError("No data available to calculate skewness")
    return float(data[column].skew())


def calculate_kurtosis(data: pd.DataFrame, column: str = DEFAULT_COLUMN) -> float:
    """
    Calculate the excess kurtosis of the specified column.

    Kurtosis measures the "tailedness" of the distribution:
    - Positive (leptokurtic): Heavy tails, more outliers
    - Negative (platykurtic): Light tails, fewer outliers
    - Zero (mesokurtic): Normal distribution-like tails

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate kurtosis for

    Returns:
        float: Excess kurtosis of the specified column
    """
    if data.empty:
        raise ValueError("No data available to calculate kurtosis")
    return float(data[column].kurtosis())


def calculate_rolling_statistics(
    data: pd.DataFrame,
    column: str = DEFAULT_COLUMN,
    window: int = 20
) -> pd.DataFrame:
    """
    Calculate rolling statistics for the specified column.

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate stats for
        window: Rolling window size

    Returns:
        DataFrame with rolling mean, std, min, max
    """
    if data.empty:
        raise ValueError("No data available for rolling statistics")
    
    series = data[column]
    return pd.DataFrame({
        "rolling_mean": series.rolling(window=window).mean(),
        "rolling_std": series.rolling(window=window).std(),
        "rolling_min": series.rolling(window=window).min(),
        "rolling_max": series.rolling(window=window).max(),
        "rolling_median": series.rolling(window=window).median(),
    })


def calculate_returns(data: pd.DataFrame, column: str = DEFAULT_COLUMN) -> pd.Series:
    """
    Calculate percentage returns for the specified column.

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate returns for

    Returns:
        Series with percentage returns
    """
    return data[column].pct_change().dropna()


def calculate_var(returns: pd.Series, confidence_level: float = 0.95) -> float:
    """
    Calculate Value at Risk at the specified confidence level.

    Args:
        returns: Series of returns
        confidence_level: Confidence level (default: 0.95)

    Returns:
        VaR value (negative number indicating potential loss)
    """
    return float(np.percentile(returns, (1 - confidence_level) * 100))


def calculate_expected_shortfall(returns: pd.Series, confidence_level: float = 0.95) -> float:
    """
    Calculate Expected Shortfall (Conditional VaR) at the specified confidence level.

    Args:
        returns: Series of returns
        confidence_level: Confidence level (default: 0.95)

    Returns:
        Expected shortfall value
    """
    var = calculate_var(returns, confidence_level)
    return float(returns[returns <= var].mean())


def calculate_max_drawdown(data: pd.DataFrame, column: str = DEFAULT_COLUMN) -> float:
    """
    Calculate the maximum drawdown for the specified column.

    Args:
        data: pandas DataFrame with price data
        column: Column name to calculate max drawdown for

    Returns:
        Maximum drawdown as a negative percentage
    """
    prices = data[column]
    peak = prices.expanding(min_periods=1).max()
    drawdown = (prices - peak) / peak
    return float(drawdown.min())


def calculate_sharpe_ratio(
    returns: pd.Series,
    risk_free_rate: float = RISK_FREE_RATE,
    periods_per_year: int = 52
) -> float:
    """
    Calculate the Sharpe ratio.

    Args:
        returns: Series of returns
        risk_free_rate: Annual risk-free rate
        periods_per_year: Number of periods per year (52 for weekly, 252 for daily)

    Returns:
        Sharpe ratio
    """
    excess_returns = returns.mean() - (risk_free_rate / periods_per_year)
    std = returns.std()
    if std == 0:
        return 0.0
    return float((excess_returns / std) * np.sqrt(periods_per_year))


def calculate_sortino_ratio(
    returns: pd.Series,
    risk_free_rate: float = RISK_FREE_RATE,
    periods_per_year: int = 52
) -> float:
    """
    Calculate the Sortino ratio (similar to Sharpe but uses downside deviation).

    Args:
        returns: Series of returns
        risk_free_rate: Annual risk-free rate
        periods_per_year: Number of periods per year

    Returns:
        Sortino ratio
    """
    excess_returns = returns.mean() - (risk_free_rate / periods_per_year)
    downside_returns = returns[returns < 0]
    downside_std = downside_returns.std() if len(downside_returns) > 0 else 0
    if downside_std == 0:
        return 0.0
    return float((excess_returns / downside_std) * np.sqrt(periods_per_year))


def comprehensive_analysis(
    data: pd.DataFrame,
    ticker: str = "^GSPC",
    period: str = DEFAULT_PERIOD,
    interval: str = DEFAULT_INTERVAL,
    column: str = DEFAULT_COLUMN
) -> StatisticalSummary:
    """
    Perform comprehensive statistical analysis on the data.

    Args:
        data: pandas DataFrame with price data
        ticker: Ticker symbol for reporting
        period: Time period for reporting
        interval: Interval for reporting
        column: Column to analyze

    Returns:
        StatisticalSummary containing all statistical metrics
    """
    if data.empty:
        raise ValueError("No data available for analysis")
    
    prices = data[column]
    returns = calculate_returns(data, column)
    
    # Calculate mode (most common value when rounded)
    try:
        mode_value = float(prices.mode().iloc[0]) if not prices.mode().empty else None
    except:
        mode_value = None
    
    # Annualized return calculation
    total_return = (prices.iloc[-1] / prices.iloc[0]) - 1
    years = len(data) / 52  # Approximate years based on weekly data
    annualized_return = (1 + total_return) ** (1 / max(years, 0.001)) - 1
    
    return StatisticalSummary(
        ticker=ticker,
        period=period,
        interval=interval,
        data_points=len(data),
        date_range=(str(data.index.min().date()), str(data.index.max().date())),
        
        mean=float(np.mean(prices)),
        median=float(np.median(prices)),
        mode=mode_value,
        
        std_population=float(np.std(prices, ddof=0)),
        std_sample=float(np.std(prices, ddof=1)),
        variance=float(np.var(prices, ddof=1)),
        coefficient_of_variation=float(np.std(prices, ddof=1) / np.mean(prices)),
        range_value=float(prices.max() - prices.min()),
        iqr=float(np.percentile(prices, 75) - np.percentile(prices, 25)),
        
        skewness=float(prices.skew()),
        kurtosis=float(prices.kurtosis()),
        
        var_95=calculate_var(returns, 0.95) * prices.iloc[-1],
        var_99=calculate_var(returns, 0.99) * prices.iloc[-1],
        expected_shortfall_95=calculate_expected_shortfall(returns, 0.95) * prices.iloc[-1],
        max_drawdown=calculate_max_drawdown(data, column),
        
        total_return=float(total_return),
        annualized_return=float(annualized_return),
        sharpe_ratio=calculate_sharpe_ratio(returns),
        sortino_ratio=calculate_sortino_ratio(returns),
    )


def main():
    """Main function to calculate and display S&P 500 standard deviation."""
    parser = argparse.ArgumentParser(
        description="Calculate S&P 500 weekly standard deviation and other statistics."
    )
    parser.add_argument(
        "--period",
        default=DEFAULT_PERIOD,
        help=f"Time period for data (default: {DEFAULT_PERIOD})",
    )
    parser.add_argument(
        "--interval",
        default=DEFAULT_INTERVAL,
        help=f"Data interval (default: {DEFAULT_INTERVAL} for weekly)",
    )
    parser.add_argument(
        "--index",
        default="sp500",
        choices=list(MARKET_INDICES.keys()),
        help="Market index to analyze (default: sp500)",
    )
    parser.add_argument(
        "--full-report",
        action="store_true",
        help="Display full comprehensive statistical report",
    )
    parser.add_argument(
        "--rolling-window",
        type=int,
        default=20,
        help="Window size for rolling statistics (default: 20)",
    )
    args = parser.parse_args()

    ticker = MARKET_INDICES[args.index]
    print(f"Fetching {args.index.upper()} data (period={args.period}, interval={args.interval})...")
    data = fetch_index_data(index_name=args.index, period=args.period, interval=args.interval)

    if data.empty:
        print("Error: No data retrieved from yfinance")
        return

    print(f"Data points retrieved: {len(data)}")
    print(f"Date range: {data.index.min()} to {data.index.max()}")

    if args.full_report:
        summary = comprehensive_analysis(
            data=data,
            ticker=ticker,
            period=args.period,
            interval=args.interval
        )
        summary.print_report()
    else:
        stdev = calculate_stdev(data)
        print(f"\n{args.index.upper()} {args.interval.upper()} Close Price Standard Deviation: {stdev:.2f}")

        # Additional basic statistics
        mean_price = np.mean(data["Close"])
        print(f"Mean Close Price: {mean_price:.2f}")
        print(f"Coefficient of Variation: {(stdev / mean_price) * 100:.2f}%")


if __name__ == "__main__":
    main()
