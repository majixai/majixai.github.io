# Stock

A collection of stock ticker pages and reusable components for displaying stock market data.

## Directory Structure

```
stock/
├── common/                         # Shared components
│   ├── index.js
│   ├── ticker_card.js             # Stock information card component
│   ├── stock_chart.js             # Price chart component
│   └── price_display.js           # Real-time price display component
├── utils/                          # Utility functions
│   ├── index.js
│   ├── stock_formatters.js        # Price, volume, date formatting
│   └── stock_calculations.js      # Financial calculations (returns, RSI, SMA, etc.)
├── services/                       # Data services
│   ├── index.js
│   ├── stock_data_service.js      # Stock data fetching with caching
│   └── quote_service.js           # Real-time quote subscription service
├── tickers/                        # Ticker pages index
│   └── index.html
├── aapl/                          # Individual stock pages
├── amzn/
├── tsla/
├── meta/
├── ... (other ticker directories)
├── index.html                      # Main stock page
├── menu.html                       # Navigation menu
└── README.md                       # This file
```

## Components

### Common Components

#### TickerCard
Displays comprehensive stock information in a card format:
- Symbol and company name
- Current price with change indicators
- OHLV data (Open, High, Low, Volume)

```javascript
import { TickerCard } from './common/index.js';

const card = new TickerCard('#container', 'AAPL');
card.setData({
    name: 'Apple Inc.',
    price: 175.50,
    change: 2.30,
    changePercent: 0.0133,
    open: 173.20,
    high: 176.00,
    low: 172.80,
    volume: 65000000
});
card.render();
```

#### StockChart
Interactive price chart component:
- Line/area charts
- Auto-coloring based on price trend
- Volume overlay support

```javascript
import { StockChart } from './common/index.js';

const chart = new StockChart('#chart-container');
chart.init(Chart); // Pass Chart.js instance
chart.setData(priceData);
```

#### PriceDisplay
Real-time price display with animations:
- Live price updates
- Change indicators
- Animation on price tick

### Services

#### StockDataService
Fetches and caches stock data:
- Automatic caching with configurable timeout
- Multiple symbol fetching
- Historical data support

#### QuoteService
Real-time quote subscription:
- Subscribe/unsubscribe to symbol updates
- Polling-based updates
- Multiple subscriber support

### Utils

#### StockFormatters
- `formatPrice()` - Currency formatting
- `formatChange()` - Price change with sign
- `formatVolume()` - Volume with K/M/B suffixes
- `formatMarketCap()` - Market cap formatting
- `formatDate()` / `formatTime()` - Date/time formatting
- `formatPE()` / `formatDividendYield()` - Financial ratios

#### StockCalculations
- `percentageChange()` - Calculate % change
- `simpleReturns()` - Calculate returns array
- `standardDeviation()` - Volatility calculation
- `cagr()` - Compound Annual Growth Rate
- `rsi()` - Relative Strength Index
- `sma()` / `ema()` - Moving averages
- `vwap()` - Volume Weighted Average Price
- `beta()` - Beta against benchmark

## Usage

```javascript
import { TickerCard, StockChart, PriceDisplay } from './common/index.js';
import { StockDataService, QuoteService } from './services/index.js';
import { StockFormatters, StockCalculations } from './utils/index.js';

// Fetch stock data
const dataService = new StockDataService();
const data = await dataService.fetchStockData('AAPL');

// Subscribe to real-time updates
const quoteService = new QuoteService({ pollingInterval: 5000 });
const subId = quoteService.subscribe('AAPL', (quote) => {
    console.log('New quote:', quote);
});

// Calculate technical indicators
const prices = [100, 105, 103, 107, 110, 108, 112, 115];
const rsi = StockCalculations.rsi(prices);
const sma20 = StockCalculations.sma(prices, 20);

// Format for display
console.log(StockFormatters.formatPrice(175.50)); // $175.50
console.log(StockFormatters.formatVolume(65000000)); // 65.00M
```

## Available Ticker Pages

- AAPL (Apple Inc.)
- AMZN (Amazon.com Inc.)
- TSLA (Tesla Inc.)
- META (Meta Platforms Inc.)
- AMOD
- ATCH
- BRDG
- CYD
- GOEV
- MLGO
- PEPG
- QVCGB
- STEC
- YYAI

Each ticker page displays detailed information about the respective stock.
