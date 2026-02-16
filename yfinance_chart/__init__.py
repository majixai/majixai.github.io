"""yfinance_chart package.

This package provides comprehensive financial data analysis, visualization,
and pattern detection capabilities using Yahoo Finance data. The package
includes support for technical analysis, machine learning predictions,
and advanced charting features.

Key Features:
    - Real-time and historical stock data fetching via yfinance
    - Technical indicator calculations (SMA, EMA, RSI, MACD, Bollinger Bands)
    - Chart pattern detection (Double Top/Bottom, Head and Shoulders, Triangles)
    - Bayesian forecasting with multivariate differential analysis
    - Lightweight chart visualization with pattern overlays
    - MVC-based web application for interactive data exploration
    - Git-style two-level datastore for efficient data storage

Modules:
    fetch_data: Core data fetching and technical analysis
    lightweight_pattern_chart: Pattern detection and chart rendering
    github_datastore_pipeline: Two-level datastore pipeline
    mvc_app: Flask-based MVC web application

Usage:
    from yfinance_chart import fetch_data
    from yfinance_chart.lightweight_pattern_chart import fetch_ohlcv
    from yfinance_chart.mvc_app import create_app

Version History:
    1.0.0: Initial release with basic charting
    1.1.0: Added pattern detection algorithms
    1.2.0: Integrated Bayesian forecasting
    1.3.0: Added MVC web application
    1.4.0: Enhanced calculus-based pattern scoring
    1.5.0: Two-level datastore pipeline
    2.0.0: Major refactoring with tripled functionality

Author: Majixai Development Team
License: MIT
"""

__version__ = "2.0.0"
__author__ = "Majixai Development Team"
__license__ = "MIT"

# Package-level constants for configuration
DEFAULT_TICKER = "SPY"
DEFAULT_PERIOD = "6mo"
DEFAULT_INTERVAL = "1d"
DEFAULT_MAX_PATTERNS = 60
DEFAULT_MIN_SCORE = 0.18
DEFAULT_PROJECTION_HORIZON = 24

# Technical analysis defaults
DEFAULT_SMA_WINDOWS = [10, 20, 50, 100, 200]
DEFAULT_EMA_WINDOWS = [12, 26, 50]
DEFAULT_RSI_PERIOD = 14
DEFAULT_MACD_FAST = 12
DEFAULT_MACD_SLOW = 26
DEFAULT_MACD_SIGNAL = 9
DEFAULT_BB_WINDOW = 20
DEFAULT_BB_STD = 2
DEFAULT_STOCH_K_PERIOD = 14
DEFAULT_STOCH_D_PERIOD = 3

# Pattern detection thresholds
PATTERN_TOLERANCE_PCT = 0.02
PATTERN_MIN_BARS = 20
PATTERN_MAX_BARS = 100
VOLUME_CONFIRMATION_THRESHOLD = 1.5

# Cache settings
CACHE_TTL_SECONDS = 45
MAX_CACHE_ENTRIES = 100

# Supported intervals and periods
SUPPORTED_INTERVALS = [
    "1m", "2m", "5m", "15m", "30m", "60m", "90m",
    "1h", "1d", "5d", "1wk", "1mo", "3mo"
]
SUPPORTED_PERIODS = [
    "1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y", "10y", "ytd", "max"
]

# Export key functions and classes
__all__ = [
    "DEFAULT_TICKER",
    "DEFAULT_PERIOD", 
    "DEFAULT_INTERVAL",
    "DEFAULT_MAX_PATTERNS",
    "DEFAULT_MIN_SCORE",
    "DEFAULT_PROJECTION_HORIZON",
    "DEFAULT_SMA_WINDOWS",
    "DEFAULT_EMA_WINDOWS",
    "DEFAULT_RSI_PERIOD",
    "DEFAULT_MACD_FAST",
    "DEFAULT_MACD_SLOW",
    "DEFAULT_MACD_SIGNAL",
    "DEFAULT_BB_WINDOW",
    "DEFAULT_BB_STD",
    "DEFAULT_STOCH_K_PERIOD",
    "DEFAULT_STOCH_D_PERIOD",
    "PATTERN_TOLERANCE_PCT",
    "PATTERN_MIN_BARS",
    "PATTERN_MAX_BARS",
    "VOLUME_CONFIRMATION_THRESHOLD",
    "CACHE_TTL_SECONDS",
    "MAX_CACHE_ENTRIES",
    "SUPPORTED_INTERVALS",
    "SUPPORTED_PERIODS",
    "__version__",
    "__author__",
    "__license__",
]
