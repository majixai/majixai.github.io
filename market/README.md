# Market

A market data visualization and analysis module for fetching, displaying, and analyzing stock market data from Google Finance.

## Directory Structure

```
market/
├── models/                      # Data models
│   ├── index.js
│   ├── data_model.js           # Market data storage
│   └── chart_model.js          # Chart data and configuration
├── controllers/                 # Controllers (MVC pattern)
│   ├── index.js
│   ├── data_controller.js      # Data operations
│   └── chart_controller.js     # Chart operations
├── services/                    # Business logic services
│   ├── index.js
│   ├── market_service.js       # Market data fetching
│   └── analytics_service.js    # Technical analysis calculations
├── utils/                       # Utility modules
│   ├── index.js
│   ├── formatters.js           # Data formatting utilities
│   └── validators.js           # Data validation utilities
├── script/                      # Legacy scripts
│   ├── main.js
│   ├── Chart.js
│   ├── ErrorHandling.js
│   ├── Market.js
│   └── menuSystem.js
├── style/                       # Stylesheets
│   └── main.css
├── templates/                   # HTML templates
│   └── main.html
├── index.html                   # Main entry point
└── README.md                    # This file
```

## Features

### Models
- **DataModel**: Handles market data caching and retrieval
- **ChartModel**: Manages chart data and configuration for Chart.js

### Controllers
- **DataController**: Orchestrates data fetching and caching
- **ChartController**: Manages chart rendering and updates

### Services
- **MarketService**: Fetches market data from external sources
- **AnalyticsService**: Technical analysis calculations including:
  - Simple Moving Average (SMA)
  - Exponential Moving Average (EMA)
  - Relative Strength Index (RSI)
  - Bollinger Bands
  - Momentum
  - Volatility

### Utils
- **Formatters**: Currency, percentage, and number formatting
- **Validators**: Symbol, price, and data validation

## Usage

```javascript
import { DataController, ChartController } from './controllers/index.js';
import { MarketService, AnalyticsService } from './services/index.js';
import { Formatters, Validators } from './utils/index.js';

// Fetch and display market data
const dataController = new DataController();
const chartController = new ChartController();

// Validate symbol
if (Validators.isValidSymbol('AAPL')) {
    const service = new MarketService();
    const quote = await service.fetchQuote('AAPL');
    
    // Format and display
    console.log(Formatters.formatCurrency(quote.price));
}

// Calculate technical indicators
const prices = [100, 105, 103, 107, 110, 108, 112, 115];
const sma = AnalyticsService.calculateSMA(prices, 5);
const rsi = AnalyticsService.calculateRSI(prices);
```

## Dependencies

- Chart.js for chart rendering
- jQuery for DOM manipulation
- W3.CSS for styling
