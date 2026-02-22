# S&P 500 Closing Price Projection Engine

A comprehensive S&P 500 closing price projection system that runs every minute via GitHub Actions to provide real-time probability-based market projections.

## Features

- **Every-Minute Execution**: Runs via GitHub Actions cron schedule every minute
- **Next Close Calculation**: Automatically determines the next available S&P 500 close time
- **Probability Analysis**: Provides likelihood percentages for various closing price ranges
- **Hourly Projections**: Generates hour-by-hour projections from now until market close
- **Minute-by-Minute Snapshots**: Per-minute projection with immediate next-minute probability
- **Multi-Source Data Integration**: Uses all available finance directory data in the repository
- **Live Data Fetching**: Fetches real-time data from Yahoo Finance and Google Finance
- **Monte Carlo Simulation**: GBM-based stochastic modeling with 5,000+ paths
- **Technical Indicators**: RSI, MACD, Bollinger Bands analysis
- **Black-Scholes Greeks**: ATM option pricing and sensitivity analysis

## Output Files

| File | Description |
|------|-------------|
| `latest_projection.json` | Full projection data with probabilities and hourly projections |
| `sp_closing_projection_output.png` | 3-panel visualization dashboard |

## Data Sources

The engine integrates data from multiple sources:

1. **Yahoo Finance API** - Live S&P 500 (SPY) prices and intraday data
2. **Google Finance** - Fallback price data
3. **yfinance_data/** - Historical compressed data files
4. **market_prediction/** - Latest prediction results
5. **dji_1pm_close/** - DJI prediction correlations
6. **dji_monte_carlo/** - Monte Carlo simulation history

## Quantitative Methods

- **Geometric Brownian Motion (GBM)**: `dS = μS dt + σS dW`
- **EWMA Volatility**: Exponentially weighted moving average with λ=0.94
- **Black-Scholes-Merton**: Options pricing and implied volatility
- **Monte Carlo Simulation**: 5,000 paths with confidence intervals
- **Technical Analysis**: RSI(14), MACD(12,26,9), Bollinger Bands(20,2)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SIMULATIONS` | `5000` | Number of Monte Carlo simulation paths |
| `WEBHOOK_URL` | _(none)_ | Optional webhook URL for notifications |
| `DATA_DIR` | `..` | Path to repository root for loading historical data |

## Manual Trigger

The workflow can be triggered manually from the Actions tab with a configurable number of simulations.

## JSON Output Structure

```json
{
  "ticker": "SPY (S&P 500 Proxy)",
  "timestamp": "2026-02-22T12:30:00+00:00",
  "current_price": 595.25,
  "market_state": {
    "is_open": true,
    "minutes_to_close": 210,
    "next_close_time": "2026-02-22 16:00:00 ET"
  },
  "closing_projection": {
    "projected_close": 595.50,
    "probability_above_current": 52.3,
    "probability_below_current": 47.7,
    "confidence_intervals": {
      "50%": [594.10, 596.85],
      "80%": [593.20, 597.75],
      "90%": [592.50, 598.40]
    }
  },
  "minute_projection": {
    "projected_next_minute": 595.26,
    "prob_up_next_minute": 50.8
  },
  "hourly_projections": [
    {
      "hour_label": "+1h",
      "projected_price": 595.35,
      "probability_up": 51.2,
      "probability_down": 48.8
    }
  ],
  "signal": "NEUTRAL",
  "confidence": 25.0
}
```
