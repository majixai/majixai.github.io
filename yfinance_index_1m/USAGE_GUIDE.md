# YFinance Application - Summary & Usage Guide

## 📊 Overview

The YFinance application is a comprehensive market data analytics platform with three main components:

### Available Applications:

1. **yfinance_index_1m/** - Advanced real-time index tracking with 1-minute data
2. **yfinance_data/** - Stock data fetcher and analyzer
3. **yfinance_chart/** - Basic charting and visualization

## 🎯 Current Status - Stored Data

### Market Indices Tracked (yfinance_index_1m)

Based on the latest data snapshot:

#### 📈 Major US Indices
- **^DJI (Dow Jones)**: $49,358.19 (-$108.51, -0.22%)
  - 390 data points | RSI: 54.37 | MACD: -1.05
  
- **^GSPC (S&P 500)**: $6,939.46 (-$21.08, -0.30%)
  - 390 data points | RSI: 40.88 | MACD: -1.03
  
- **^IXIC (NASDAQ)**: $23,514.42 (-$120.17, -0.51%)
  - 390 data points | RSI: 38.34 | MACD: -4.75

### Additional Indices Available:
- Russell 2000 (^RUT)
- VIX (^VIX)
- 10-Year Treasury (^TNX)
- FTSE 100 (^FTSE)
- DAX (^GDAXI)
- Nikkei 225 (^N225)
- Hang Seng (^HSI)

## 🚀 Key Features

### 1. Real-Time Data Fetching
- 1-minute interval data for major indices
- Multiple timeframe support (1m, 5m, 15m, 1h, 1d)
- Automatic technical indicator calculation

### 2. Technical Indicators
- **Moving Averages**: SMA (20, 50), EMA (12, 26)
- **Momentum**: RSI (14), MACD, Stochastic Oscillator
- **Volatility**: Bollinger Bands, ATR
- **Volume**: OBV, Volume analysis

### 3. Machine Learning Features
- GenAI-powered forecasting
- Pattern recognition (Head & Shoulders, Double Tops/Bottoms, etc.)
- ML predictions with confidence intervals
- Advanced visualizations

### 4. Interactive Dashboard
- Real-time market overview
- Mini charts for each index
- Color-coded change indicators
- Responsive design

## 📁 Files Created/Enhanced

### New Files:
1. **dashboard.html** - Interactive market data dashboard
2. **update_data.py** - Enhanced data fetcher for all indices
3. **view_data.py** - CLI data viewer with formatted output

### Data Files:
- **index_1m.json** - 1-minute data for all tracked indices
- **multi_timeframe.json** - Multiple timeframe data
- **multi_timeframe_ml.json** - ML-enhanced predictions

## 🔧 Usage Instructions

### View Dashboard (Web Interface)
```bash
cd /workspaces/majixai.github.io/yfinance_index_1m
python3 -m http.server 8080
```
Then open: http://localhost:8080/dashboard.html

### Update Market Data
```bash
# Update all indices
python3 update_data.py

# Update specific index
python3 update_data.py DJI

# Existing multi-timeframe fetcher
python3 fetch_multi_timeframe.py
```

### View Data (CLI)
```bash
# View summary of all indices
python3 view_data.py

# View detailed data for specific index
python3 view_data.py ^DJI
python3 view_data.py GSPC
```

### Generate Forecasts
```bash
# Generate AI forecasts
python3 genai_forecaster.py

# ML predictions
python3 ml_predictor.py

# Visualizations
python3 enhanced_visualizer.py
```

## 📊 Available Visualizations

1. **Basic Charts** - Line, candlestick, area
2. **Technical Indicators** - Overlaid on price charts
3. **Forecast Charts** - ML predictions with confidence bands
4. **3D Visualizations** - Advanced correlation analysis

## 🔄 Automation Options

### Cron Job (Auto-update every 5 minutes)
```bash
*/5 * * * * cd /workspaces/majixai.github.io/yfinance_index_1m && python3 update_data.py >> update.log 2>&1
```

### Watch Mode (Continuous updates)
```bash
watch -n 300 'cd /workspaces/majixai.github.io/yfinance_index_1m && python3 update_data.py'
```

## 🎨 Dashboard Features

### Current Display:
- Live price updates
- Change indicators (▲/▼ with colors)
- Volume in human-readable format (B/M/K)
- Technical indicators (RSI, MACD, Volatility)
- Mini trend charts
- Last update timestamp

### Interactive Elements:
- Click refresh to update data
- Responsive grid layout
- Hover effects on cards
- Auto-adapts to screen size

## 📈 Technical Indicators Explained

### RSI (Relative Strength Index)
- Range: 0-100
- >70: Overbought
- <30: Oversold
- Current values show market momentum

### MACD (Moving Average Convergence Divergence)
- Positive: Bullish momentum
- Negative: Bearish momentum
- Shows trend strength

### Volatility
- Percentage showing price fluctuation
- Higher = more volatile
- Lower = more stable

## 🔍 Data Structure

```json
{
  "^GSPC": {
    "data": [
      {
        "Date": "2026-01-17 09:30:00",
        "Open": 6960.54,
        "High": 6967.30,
        "Low": 6925.09,
        "Close": 6939.46,
        "Volume": 2590574441,
        "RSI": 40.88,
        "MACD": -1.03,
        "...": "additional indicators"
      }
    ],
    "summary": {
      "current_price": 6939.46,
      "change": -21.08,
      "change_pct": -0.30,
      "...": "more stats"
    },
    "last_update": "2026-01-17T08:40:08"
  }
}
```

## 🌐 Access Points

1. **Dashboard**: `/yfinance_index_1m/dashboard.html`
2. **Main App**: `/yfinance_index_1m/index.html`
3. **Forecasts**: `/yfinance_index_1m/forecast.html`

## 📝 Next Steps

### Potential Enhancements:
1. Real-time WebSocket updates
2. Alert system for price thresholds
3. Portfolio tracking
4. Options chain analysis
5. News integration
6. Social sentiment analysis

### Maintenance:
- Data files update automatically with fetch scripts
- Dashboard refreshes on button click
- All data stored in JSON format for easy access

## 💡 Tips

1. **Data Freshness**: Market data updates during trading hours only
2. **Performance**: Dashboard loads data client-side for fast updates
3. **Storage**: JSON files are human-readable and easy to parse
4. **Extensibility**: Add new indices by updating INDICES dict in update_data.py

## 📞 Quick Reference

| Task | Command |
|------|---------|
| Start Dashboard | `python3 -m http.server 8080` |
| Update Data | `python3 update_data.py` |
| View Data | `python3 view_data.py` |
| Generate Forecast | `python3 genai_forecaster.py` |

---

**Last Updated**: January 19, 2026
**Data Source**: Yahoo Finance via yfinance library
**Update Frequency**: On-demand or via cron/scheduler
