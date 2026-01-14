# YFinance Interactive Chart

An advanced interactive charting application for stock analysis with 5-day 1-minute interval data.

## Features

### 📊 Charting
- **Candlestick Charts** with Plotly.js for smooth interactivity
- **Zoom, Pan, and Draw** directly on the chart
- **Multiple timeframes** visualization

### 📈 Technical Indicators
- **Moving Averages**: SMA (20, 50) and EMA (12, 26)
- **Bollinger Bands**: Standard deviation-based price channels
- **RSI (14)**: Relative Strength Index oscillator
- **MACD (12, 26, 9)**: Moving Average Convergence Divergence
- **Stochastic Oscillator**: Momentum indicator

### 🔍 Pattern Recognition
- **Double Top/Bottom**: Reversal patterns
- **Head and Shoulders**: Classic reversal formation
- **Ascending/Descending Triangles**: Continuation patterns
- Visual annotations on chart for detected patterns

### 🎯 1PM Close Forecast
Uses **Multivariate Bayesian Nonlinear Differential Analysis** including:
- State-space modeling with matrix eigendecomposition
- Nonlinear polynomial regression
- RSI-based momentum feedback
- Volume-weighted adjustments
- 95% confidence intervals

### 🔄 Feedback Loop Engine
Real-time aggregation of multiple analysis signals:
- Momentum feedback loop
- Volume direction feedback
- Matrix eigenvalue stability
- Pattern recognition feedback
- Aggregate BUY/SELL/HOLD signal

### 🔎 Searchable Watchlist
- Auto-complete ticker search
- Click-to-load from watchlist grid
- 30 pre-configured popular tickers

## Usage

### Browser (Static HTML)
1. Open `index.html` in a web browser
2. The app will load demo data automatically
3. Click on any ticker in the watchlist or search

### With Live Data (Python Backend)
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Fetch live data:
   ```bash
   python fetch_data.py
   ```

3. Open `index.html` in a browser to view the charts

### Custom Tickers
```bash
python fetch_data.py --tickers AAPL MSFT GOOGL
```

## Technical Details

### Bayesian Forecast Method
The forecast uses a multivariate state-space model:
- **State Vector**: `[price, velocity, acceleration, volume_momentum]`
- **Covariance Matrix**: Computed from recent price dynamics
- **Eigendecomposition**: For matrix stability analysis
- **Posterior Distribution**: Conjugate normal-normal Bayesian update
- **Feedback Adjustments**: Nonlinear corrections from multiple signals

### Pattern Detection Algorithm
- Double Top/Bottom: Price peak/trough comparison within tolerance
- Head and Shoulders: Three-peak detection with symmetric shoulders
- Triangles: Trendline slope analysis for convergence patterns

## Files

- `index.html` - Main application HTML
- `script.js` - Chart logic, indicators, pattern detection, forecast
- `style.css` - Responsive styling
- `fetch_data.py` - Python backend for yfinance data
- `requirements.txt` - Python dependencies

## Dependencies

### JavaScript (CDN)
- Plotly.js 2.27.0 - Charting library
- Pako 2.0.4 - Compression/decompression

### Python
- yfinance - Yahoo Finance data API
- pandas - Data manipulation
- numpy - Numerical computing
- requests - HTTP client

## License

MIT License - Free to use and modify.
