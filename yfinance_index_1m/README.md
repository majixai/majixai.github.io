# YFinance Index 1-Minute Data with GenAI Forecasting

Advanced market forecasting system combining real-time data, technical analysis, pattern recognition, and machine learning to generate comprehensive forecasts for DOW and S&P 500 indices.

## 🌟 Key Features

### 🤖 GenAI-Powered Forecasting
- **Machine Learning Models**: Ensemble predictions using Linear Regression and Random Forest
- **Pattern Recognition**: Detects 10+ chart patterns including Head & Shoulders, Double Tops/Bottoms, Triangles, Flags, Wedges, Cup & Handle
- **Advanced Technical Analysis**: 20+ indicators including RSI, MACD, Bollinger Bands, Stochastic, Williams %R, CCI, ATR, OBV
- **Sentiment Analysis**: AI-driven market sentiment classification (Strongly Bullish to Strongly Bearish)
- **Price Targets**: Multi-timeframe support/resistance levels with Fibonacci retracements

### 📊 Complex Visualizations
- **Multi-Panel Charts**: 8 synchronized chart panels showing price action, volume, and all major indicators
- **Pattern Overlays**: Visual representations of detected patterns directly on price charts
- **Forecast Projections**: ML predictions with 95% confidence intervals
- **Publication-Quality**: High-resolution (300 DPI) charts suitable for professional analysis

### 💼 Option Strategy Recommendations
- **8 Complex Strategies**: Iron Condor, Bull/Bear Spreads, Straddles, Butterflies, Calendar Spreads, Ratio Spreads, Diagonal Spreads
- **Risk Analysis**: Complete risk/reward profiles for each strategy
- **Position Sizing**: Capital requirements and breakeven calculations
- **Greeks Analysis**: Exposure to theta, vega, and other option sensitivities

### 🎯 Focus Indices
- **S&P 500 (^GSPC)**: Primary large-cap benchmark
- **Dow Jones Industrial Average (^DJI)**: Blue-chip index

## 📦 Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Install Dependencies
```bash
pip install -r requirements.txt
```

### Required Packages
- yfinance >= 0.2.28 (Market data)
- pandas >= 2.0.0 (Data manipulation)
- numpy >= 1.24.0 (Numerical computing)
- matplotlib >= 3.7.0 (Visualization)
- scipy >= 1.10.0 (Scientific computing)
- scikit-learn >= 1.3.0 (Machine learning)

## 🚀 Usage

### Quick Start - Generate Monday 1 PM Forecast

```bash
# Generate comprehensive forecasts for DOW and S&P 500
python genai_forecaster.py

# Create visualization charts
python forecast_visualizer.py

# Open the interactive dashboard
# Open forecast.html in your browser
```

### Step-by-Step Workflow

#### 1. Generate Forecasts
```bash
python genai_forecaster.py
```

**What it does:**
- Fetches 5 days of 1-minute historical data
- Calculates 20+ technical indicators
- Detects chart patterns using advanced algorithms
- Generates ML-based price predictions with confidence intervals
- Analyzes market sentiment
- Calculates price targets and support/resistance levels
- Recommends complex option strategies
- Saves forecast to `forecast_monday_1pm.json`

**Output:** Comprehensive JSON file with all forecast data

#### 2. Create Visualizations
```bash
python forecast_visualizer.py
```

**What it does:**
- Loads forecast data from JSON
- Creates multi-panel technical analysis charts
- Adds pattern overlays and indicators
- Highlights support/resistance levels
- Shows ML forecast with confidence intervals
- Generates high-resolution PNG files
- Creates charts for both DOW and S&P 500

**Output:** 
- `forecast_GSPC_chart.png` (S&P 500)
- `forecast_DJI_chart.png` (Dow Jones)

#### 3. View Interactive Dashboard
Open `forecast.html` in your web browser for:
- Live sentiment indicators
- ML forecast display with confidence ranges
- Technical indicator dashboard
- Pattern detection results
- Price target visualization
- Risk assessment
- Detailed option strategy recommendations
- Comprehensive forecast narratives

### Original Data Fetcher (Legacy)

For basic index data without forecasting:

```bash
# Fetch data for specific indices
python fetch_data.py --indices ^GSPC ^DJI ^IXIC

# Custom period and interval
python fetch_data.py --period 5d --interval 1m

# View in basic dashboard
# Open index.html in browser
```

## 📈 Forecast Components

### Technical Indicators Analyzed

**Trend Indicators:**
- Simple Moving Averages (SMA 9, 20, 50, 200)
- Exponential Moving Averages (EMA 9, 12, 26, 50)

**Momentum Indicators:**
- RSI (Relative Strength Index)
- MACD (Moving Average Convergence Divergence)
- Stochastic Oscillator (%K and %D)
- Williams %R
- Rate of Change (ROC)
- Momentum

**Volatility Indicators:**
- Bollinger Bands (Upper, Middle, Lower)
- ATR (Average True Range)
- Bollinger Band Width

**Volume Indicators:**
- Volume SMA
- Volume Ratio
- OBV (On-Balance Volume)

**Other:**
- CCI (Commodity Channel Index)
- Fibonacci Retracements
- Support/Resistance Levels

### Chart Patterns Detected

**Reversal Patterns:**
- Head and Shoulders (Bearish)
- Double Top (Bearish)
- Double Bottom (Bullish)
- Cup and Handle (Bullish)

**Continuation Patterns:**
- Ascending Triangle (Bullish)
- Descending Triangle (Bearish)
- Symmetrical Triangle (Neutral)
- Bullish Flag
- Bearish Flag
- Rising Wedge (Bearish)
- Falling Wedge (Bullish)

**Channel Patterns:**
- Ascending Channel
- Descending Channel
- Horizontal Channel

### Machine Learning Models

**Ensemble Approach:**
1. **Linear Regression**: Captures linear trends and relationships
2. **Random Forest**: Captures non-linear patterns and interactions

**Features Used:**
- Price lags (1-10 periods)
- Time features (hour, minute, day of week)
- Volume
- Technical indicators (RSI, MACD, Stochastic, ATR)

**Output:**
- Point prediction (ensemble average)
- 95% confidence interval
- 68% confidence interval
- Individual model predictions
- Model agreement score

### Option Strategies

**1. Iron Condor** (Neutral Income)
- Sell OTM put spread + Sell OTM call spread
- Profits from low volatility
- Limited risk, limited reward
- Best for: Neutral markets with low expected movement

**2. Bull Call Spread** (Bullish Directional)
- Buy ATM call + Sell OTM call
- Limited risk bullish play
- Best for: Moderate bullish outlook

**3. Bear Put Spread** (Bearish Directional)
- Buy ATM put + Sell OTM put
- Limited risk bearish play
- Best for: Moderate bearish outlook

**4. Long Straddle** (Volatility Expansion)
- Buy ATM call + Buy ATM put
- Profits from large move in either direction
- Best for: High volatility expected

**5. Butterfly Spread** (Neutral Precision)
- Buy 1 ITM call + Sell 2 ATM calls + Buy 1 OTM call
- Maximum profit at middle strike
- Best for: Expected price pinning

**6. Calendar Spread** (Time Decay)
- Sell near-term option + Buy far-term option (same strike)
- Profits from time decay differential
- Best for: Neutral outlook with volatility play

**7. Ratio Spread** (Bullish with Income)
- Buy fewer ATM options + Sell more OTM options
- Income generation with directional bias
- **Warning**: Unlimited risk - requires active management

**8. Diagonal Spread** (Directional with Time)
- Buy far-term option + Sell near-term option (different strikes)
- Combines directional and time advantages
- Best for: Gradual directional movement

## 📊 Output Files

| File | Description |
|------|-------------|
| `forecast_monday_1pm.json` | Complete forecast data for both indices |
| `forecast_GSPC_chart.png` | S&P 500 comprehensive analysis chart |
| `forecast_DJI_chart.png` | Dow Jones comprehensive analysis chart |
| `forecast.html` | Interactive dashboard (open in browser) |

## 🎨 Chart Components

The comprehensive analysis charts include:

**Panel 1: Price Action** (Top, Full Width)
- OHLC candlesticks
- Moving averages (SMA 20, 50, EMA 12, 26)
- Bollinger Bands
- Pattern overlays (triangles, flags, etc.)
- Support/resistance levels
- Fibonacci retracement levels
- ML forecast point with confidence interval

**Panel 2: Volume Analysis**
- Volume bars (colored by direction)
- Volume moving average
- Volume ratio analysis

**Panel 3: RSI**
- RSI line
- Overbought (70) and oversold (30) zones
- Current value annotation

**Panel 4: MACD**
- MACD line
- Signal line
- Histogram

**Panel 5: Stochastic Oscillator**
- %K and %D lines
- Overbought/oversold zones

**Panel 6: Bollinger %B**
- Position within Bollinger Bands
- Band breach indicators

**Panel 7: Williams %R and CCI**
- Dual-axis indicator panel
- Extreme level indicators

**Panel 8: Option Strategies**
- Visual summary of top 3 strategies
- Risk/reward profiles

## ⚙️ Configuration

### Customize Forecast Target

Edit `genai_forecaster.py`:
```python
# Change target time
forecast = forecaster.generate_comprehensive_forecast(
    target_time="Monday 1 PM"  # Modify as needed
)
```

### Adjust ML Model Parameters

```python
# In MarketForecaster.generate_ml_forecast()
rf_model = RandomForestRegressor(
    n_estimators=50,  # Increase for more trees
    max_depth=10,     # Adjust tree depth
    random_state=42
)
```

### Modify Pattern Detection Sensitivity

```python
# In pattern detection methods
# Adjust tolerance values
if abs(heights[0] - heights[1]) / heights[0] < 0.02:  # 2% tolerance
    # Increase for less sensitive, decrease for more sensitive
```

## 🔍 Forecast Interpretation Guide

### Sentiment Scores

- **Strongly Bullish** (>0.3): Strong upward bias, multiple bullish signals
- **Bullish** (0.1 to 0.3): Moderate upward bias
- **Neutral** (-0.1 to 0.1): No clear directional bias
- **Bearish** (-0.3 to -0.1): Moderate downward bias
- **Strongly Bearish** (<-0.3): Strong downward bias, multiple bearish signals

### Confidence Interpretation

- **>80%**: High confidence, strong signal agreement
- **60-80%**: Moderate confidence, majority agreement
- **40-60%**: Low confidence, mixed signals
- **<40%**: Very low confidence, conflicting signals

### Risk Levels

- **LOW**: Normal market conditions, standard volatility
- **MODERATE**: Elevated volatility or some concerning factors
- **HIGH**: High volatility, multiple risk factors present
- **VERY HIGH**: Extreme conditions, high uncertainty

## 📝 Data Files (Legacy)

- `index_1m.json` - Uncompressed JSON data
- `index_1m.dat` - Compressed data (gzip) used by the web interface

## Technical Details

### Intervals Supported
- `1m` - 1 minute (default)
- `2m` - 2 minutes
- `5m` - 5 minutes
- `15m` - 15 minutes
- `30m` - 30 minutes
- `60m` - 1 hour
- `90m` - 90 minutes
- `1h` - 1 hour
- `1d` - 1 day
- `5d` - 5 days
- `1wk` - 1 week
- `1mo` - 1 month
- `3mo` - 3 months

### Period Limits
Note: Yahoo Finance limits intraday data:
- 1-minute data: Last 7 days only
- 2-minute data: Last 60 days
- 5-minute data: Last 60 days

## Files

### Legacy Files

- `fetch_data.py` - Python script to fetch and process data
- `index.html` - Basic web interface
- `style.css` - Styling
- `script.js` - Chart logic and data visualization
- `requirements.txt` - Python dependencies

### New Forecast System Files

- `genai_forecaster.py` - Main forecast engine with ML and pattern recognition
- `forecast_visualizer.py` - Advanced chart generation system
- `forecast.html` - Interactive forecast dashboard
- `forecast_monday_1pm.json` - Generated forecast data
- `forecast_GSPC_chart.png` - S&P 500 analysis chart
- `forecast_DJI_chart.png` - Dow Jones analysis chart

## 🛠️ Troubleshooting

### "No data available for symbol"
**Issue**: Yahoo Finance API may be temporarily unavailable or the market is closed.

**Solutions:**
- Try again in a few minutes
- Check your internet connection
- Verify the symbol is correct
- Note: Only 7 trading days of 1-minute data are available from Yahoo Finance

### "Import Error" or "Module Not Found"
**Issue**: Missing dependencies.

**Solution:**
```bash
pip install -r requirements.txt --upgrade
```

### Charts not displaying
**Issue**: Chart images not found in HTML dashboard.

**Solution:**
1. Ensure you've run the visualizer: `python forecast_visualizer.py`
2. Check that PNG files are in the same directory as `forecast.html`
3. Verify file permissions

### JSON file not found
**Issue**: Dashboard can't load forecast data.

**Solution:**
1. Run the forecaster first: `python genai_forecaster.py`
2. Check that `forecast_monday_1pm.json` exists
3. Ensure files are in the same directory

## ⚠️ Important Disclaimers

### Financial Advisory Disclaimer
This forecast system is provided for **educational and informational purposes only**. It should not be considered as financial, investment, or trading advice. 

**Key Points:**
- Past performance does not guarantee future results
- All trading involves substantial risk of loss
- Options trading is especially risky and not suitable for all investors
- Machine learning predictions are probabilistic, not deterministic
- Always consult with a qualified financial advisor before making investment decisions
- Never invest more than you can afford to lose

### Data Accuracy
- Historical data is sourced from Yahoo Finance (yfinance library)
- Real-time data may have delays (typically 15-20 minutes)
- Pattern detection and ML predictions are based on historical patterns
- Market conditions can change rapidly, making forecasts obsolete

### Technical Limitations
- ML models are trained on limited historical data
- Pattern detection uses heuristic algorithms with inherent limitations
- Confidence intervals represent statistical uncertainty, not guaranteed ranges
- Option strategy recommendations assume ideal market conditions

## 📚 Additional Resources

### Learning Resources
- [Technical Analysis Basics](https://www.investopedia.com/terms/t/technicalanalysis.asp)
- [Options Trading Guide](https://www.investopedia.com/options-basics-tutorial-4583012)
- [Machine Learning in Finance](https://www.investopedia.com/terms/m/machine-learning.asp)
- [Chart Patterns Reference](https://www.investopedia.com/articles/technical/112601.asp)

### API Documentation
- [yfinance Documentation](https://pypi.org/project/yfinance/)
- [scikit-learn Documentation](https://scikit-learn.org/)
- [matplotlib Documentation](https://matplotlib.org/)

## 🤝 Contributing

Contributions are welcome! Areas for improvement:
- Additional ML models (LSTM, GRU, Transformers)
- More chart patterns
- Real-time data streaming
- Backtesting framework
- Portfolio optimization
- News sentiment integration

## 📞 Support

For issues, questions, or suggestions:
1. Check the Troubleshooting section above
2. Review existing documentation
3. Open an issue on the repository

## 🔄 Version History

### v2.0 (Current) - GenAI Forecasting System
- Added machine learning price predictions
- Implemented advanced pattern recognition
- Created comprehensive visualization system
- Added 8 complex option strategies
- Built interactive forecast dashboard
- Enhanced technical indicator analysis
- Added market sentiment classification
- Implemented risk assessment framework

### v1.0 - Basic Data Fetcher
- Initial release with basic data fetching
- Simple chart visualization
- Basic technical indicators

## License

MIT License
