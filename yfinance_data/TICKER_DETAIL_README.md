# Ticker Detail Analysis System

## Overview
Advanced mathematical and financial analysis system for individual stock tickers with 10 AI-powered analysis modules.

## Features

### 1. Price Projection Analysis
- **Monte Carlo Simulation**: 1000-path simulation for 30-day price projection
- **Confidence Intervals**: 95% upper and lower bounds
- **Metrics**: Target price, expected change, volatility (σ)

### 2. Options BSM (Black-Scholes-Merton)
- **Options Pricing**: Call and Put options using Black-Scholes-Merton model
- **Greeks Calculation**: Delta (Δ), Gamma (Γ), Vega (ν), Theta (Θ)
- **Strike Price Range**: 80% to 120% of current price
- **Formula Display**: Complete BSM formula with variables

### 3. Chart Patterns
- **Pattern Detection**: Head & Shoulders, Double Top/Bottom, Triangles
- **Candlestick Visualization**: Full OHLC data display
- **Confidence Scoring**: Pattern reliability percentage

### 4. Technical Indicators
- **Moving Averages**: SMA(20), SMA(50), EMA(12)
- **Oscillators**: RSI(14), MACD, Stochastic
- **Volatility**: Bollinger Bands (20, 2)
- **Momentum**: ROC, OBV (On-Balance Volume)

### 5. Differential Calculus Analysis
- **First Derivative**: dP/dt (velocity, rate of change)
- **Second Derivative**: d²P/dt² (acceleration)
- **Third Derivative**: d³P/dt³ (jerk, momentum change rate)
- **Applications**: Trend acceleration, momentum analysis

### 6. Integral Calculus Analysis
- **Cumulative Returns**: ∫ returns dt
- **VWAP**: Volume-Weighted Average Price
- **Area Under Curve**: Trapezoidal integration
- **Total Volume**: Cumulative volume analysis

### 7. Arctrigonometric Analysis
- **Phase Analysis**: arctan(P) transformation
- **Cyclical Patterns**: arcsin and arccos functions
- **Phase Shift Detection**: Rate of phase change
- **Trend Position**: Bullish/bearish phase identification

### 8. Multivariate Matrix Analysis
- **Covariance Matrix**: Feature relationships
- **Correlation Matrix**: Interactive heatmap
- **PCA**: Principal Component Analysis
- **Eigenvalue Decomposition**: Variance explained by components

### 9. Risk Metrics
- **Value at Risk (VaR)**: 95% confidence level
- **Conditional VaR (CVaR)**: Expected shortfall
- **Sharpe Ratio**: Risk-adjusted returns
- **Maximum Drawdown**: Largest peak-to-trough decline
- **Beta**: Market correlation

### 10. Momentum Signals
- **RSI**: Relative Strength Index (14-period)
- **ROC**: Rate of Change (12-period)
- **Stochastic**: %K and %D oscillators
- **OBV**: On-Balance Volume trend
- **Trading Signals**: BUY/SELL/NEUTRAL recommendations

## Usage

### Access Detail Page
1. **From Main List**: Click on the **ticker symbol** (first column) to open detail page
2. **From URL**: Direct access via `ticker_detail.html?ticker=AAPL`

### Navigate Analyses
1. **Toggle Sections**: Click any of the 10 analysis buttons to show/hide
2. **Multiple Active**: Keep multiple sections open simultaneously
3. **Real-time Calculation**: Analyses run on-demand when first opened
4. **Interactive Charts**: Plotly.js charts with zoom, pan, hover tooltips

### Button Behaviors
- **Blue/Active**: Analysis is visible and loaded
- **Gray/Inactive**: Analysis is hidden
- **Loading Spinner**: Appears during calculations
- **Status Messages**: Shows analysis progress (🔄 Analyzing... → ✅ Complete)

## Technical Architecture

### Frontend Stack
- **Plotly.js**: Advanced charting and visualization
- **Math.js**: Mathematical operations library
- **Vanilla JavaScript**: No framework dependencies
- **CSS Grid/Flexbox**: Responsive layout

### Mathematical Libraries
- **Black-Scholes-Merton**: Options pricing model
- **Monte Carlo**: Stochastic simulation
- **Normal Distribution**: CDF and PDF calculations
- **Matrix Operations**: Covariance, correlation, eigenvalues
- **Calculus**: Numerical differentiation and integration

### Data Flow
1. URL parameter parsing (`?ticker=AAPL`)
2. Sample data generation (252 trading days)
3. On-demand analysis execution
4. Chart rendering with Plotly.js
5. Metrics calculation and display

### Sample Data Generation
- **Period**: 252 trading days (1 year)
- **Data Points**: Open, High, Low, Close, Volume
- **Volatility**: 1.5% daily standard deviation
- **Drift**: Random walk with mean reversion

## Mathematical Formulas

### Black-Scholes-Merton
```
Call Price: C = S₀N(d₁) - Ke⁻ʳᵗN(d₂)
Put Price: P = Ke⁻ʳᵗN(-d₂) - S₀N(-d₁)

where:
d₁ = [ln(S₀/K) + (r + σ²/2)t] / (σ√t)
d₂ = d₁ - σ√t
```

### Value at Risk (VaR)
```
VaR₉₅ = μ - 1.645σ
CVaR₉₅ = E[R | R ≤ VaR₉₅]
```

### Derivatives
```
First Derivative: dP/dt = lim(h→0) [P(t+h) - P(t)] / h
Second Derivative: d²P/dt² = d/dt(dP/dt)
Third Derivative: d³P/dt³ = d/dt(d²P/dt²)
```

### Integral (Trapezoidal Rule)
```
∫ᵃᵇ f(x)dx ≈ (b-a)/2n × [f(x₀) + 2f(x₁) + ... + 2f(xₙ₋₁) + f(xₙ)]
```

### Correlation
```
ρ(X,Y) = Cov(X,Y) / (σₓ × σᵧ)
```

## File Structure
```
yfinance_data/
├── ticker_detail.html       # Main detail page HTML
├── detail_style.css         # Comprehensive styling
├── detail_script.js         # All analysis logic (1000+ lines)
├── script.js                # Main list page (updated with links)
└── TICKER_DETAIL_README.md  # This file
```

## Browser Compatibility
- **Chrome/Edge**: Full support
- **Firefox**: Full support
- **Safari**: Full support
- **Mobile**: Responsive design, touch-friendly

## Performance
- **Initial Load**: < 2 seconds
- **Analysis Execution**: 1-2 seconds per module
- **Chart Rendering**: < 500ms
- **Data Generation**: Instant (client-side)

## Future Enhancements
1. **Real Data Integration**: Connect to actual yfinance database
2. **Custom Date Ranges**: User-selectable time periods
3. **Export Features**: Download charts and reports as PDF/PNG
4. **Comparison Mode**: Side-by-side ticker comparison
5. **Alerts**: Price/indicator threshold notifications
6. **Backtesting**: Historical strategy simulation
7. **Machine Learning**: LSTM price prediction
8. **Real-time Updates**: WebSocket streaming data

## Known Limitations
- Sample data used for demonstration
- 252 trading days fixed period
- Simplified eigenvalue calculation
- No persistence of analysis results
- Client-side only (no backend storage)

## Contributing
To add new analysis modules:
1. Add button in HTML (`ticker_detail.html`)
2. Add section structure
3. Add styling in `detail_style.css`
4. Implement analysis function in `detail_script.js`
5. Add case in `runAnalysis()` switch statement
6. Update this README

## License
Part of majixai.github.io project

## Author
MajixAI Team

## Version
1.0.0 - Initial Release (January 2025)
