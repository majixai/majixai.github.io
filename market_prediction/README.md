# Advanced Market Prediction Engine

[![Market Prediction](https://github.com/majixai/majixai.github.io/actions/workflows/market_prediction.yml/badge.svg)](https://github.com/majixai/majixai.github.io/actions/workflows/market_prediction.yml)

A sophisticated market prediction system utilizing advanced quantitative finance methodologies including Monte Carlo simulations, Black-Scholes-Merton (BSM) model, and technical analysis indicators.

## 🚀 Features

- **Real-time Predictions**: Automated predictions every minute via GitHub Actions webhook
- **Real Data Inputs**: Uses pre-fetched yfinance artifacts (`data/*/*.dat` and `yfinance_data/yfinance.dat`) plus `scrape/finance.db.gz` for latest scraped prices
- **Monte Carlo Simulation**: 1000+ price path simulations using Geometric Brownian Motion (GBM)
- **Black-Scholes-Merton Model**: Options-implied volatility and Greek calculations
- **Technical Indicators**: RSI, MACD, Bollinger Bands analysis
- **EWMA Volatility**: Exponentially weighted volatility estimation
- **Interactive Dashboard**: 3 dynamic charts with real-time visualization

## 📊 Charts

The system generates exactly **3 charts**:

1. **Monte Carlo Price Projection**: Confidence intervals (5th-95th percentile) with mean trajectory
2. **Price Distribution Histogram**: Final price probability distribution
3. **Greeks & Technical Dashboard**: Real-time indicator gauges (RSI, Delta, BB Position)

## 🔬 Quantitative Methodology

### Geometric Brownian Motion (GBM)

```
dS = μS dt + σS dW
```

Solved analytically:
```
S(t) = S₀ × exp[(μ - σ²/2)t + σ√t × Z]
```

### Black-Scholes-Merton Framework

```
∂V/∂t + ½σ²S²(∂²V/∂S²) + rS(∂V/∂S) - rV = 0
```

Greeks calculated:
- **Delta (Δ)**: Price sensitivity
- **Gamma (Γ)**: Delta sensitivity (convexity)
- **Theta (Θ)**: Time decay
- **Vega (ν)**: Volatility sensitivity
- **Rho (ρ)**: Interest rate sensitivity

### EWMA Volatility

```
σ²ₜ = λσ²ₜ₋₁ + (1-λ)r²ₜ
```

## ⚙️ Usage

### Manual Trigger (Webhook)

Go to Actions → Market Prediction Webhook → Run workflow

Inputs:
- `ticker`: Stock symbol (SPY, QQQ, DIA, IWM)
- `forecast_minutes`: Prediction horizon (default: 60)
- `simulations`: Monte Carlo paths (default: 1000)

### Local Execution

```bash
cd market_prediction
pip install -r requirements.txt

# Run with defaults
python market_predictor.py

# Run with custom parameters
TICKER=QQQ SIMULATIONS=2000 FORECAST_MINUTES=120 python market_predictor.py
```

## 📁 Files

| File | Description |
|------|-------------|
| `market_predictor.py` | Main prediction engine |
| `index.html` | Interactive web dashboard |
| `requirements.txt` | Python dependencies |
| `market_prediction_output.png` | Latest prediction chart |
| `latest_prediction.json` | Latest prediction data |

## 🔄 Automated Schedule

The GitHub Action runs:
- Every minute (cron: `* * * * *`)
- On push to `market_prediction/` directory
- On manual workflow dispatch (webhook)

## 📈 Output

The prediction generates:
- PNG chart with 3 visualizations
- JSON file with detailed metrics
- Data source metadata (which yfinance/scrape sources were used)
- Actionable signal guidance in `prediction.actions`
- Optional webhook notification

## 📜 License

MIT License - See repository root for details.
