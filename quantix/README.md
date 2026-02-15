# Quantix

A quantitative finance library providing tools for portfolio management, market data analysis, risk calculations, and financial computations.

## Directory Structure

```
quantix/
├── models/                  # Data models
│   ├── __init__.py
│   ├── market_model.py     # Market data handling
│   └── portfolio_model.py  # Portfolio management
├── views/                   # View components
│   ├── __init__.py
│   └── dashboard_view.py   # Dashboard rendering
├── controllers/             # Controllers (MVC pattern)
│   ├── __init__.py
│   ├── market_controller.py    # Market data operations
│   └── portfolio_controller.py # Portfolio operations
├── services/                # Business logic services
│   ├── __init__.py
│   ├── calculation_service.py  # Financial calculations
│   └── risk_service.py         # Risk management
├── utils/                   # Utility modules
│   ├── __init__.py
│   ├── formatters.py       # Data formatting utilities
│   └── validators.py       # Data validation utilities
├── tests/                   # Unit tests
│   ├── __init__.py
│   ├── test_models.py      # Model tests
│   └── test_services.py    # Service tests
├── index.html              # Main HTML entry point
└── README.md               # This file
```

## Features

### Models
- **MarketModel**: Handles market data storage and retrieval with caching
- **PortfolioModel**: Manages portfolio holdings and transaction history

### Controllers
- **MarketController**: Orchestrates market data operations
- **PortfolioController**: Manages portfolio operations including add/remove positions

### Services
- **CalculationService**: Financial calculations including:
  - Simple and logarithmic returns
  - Mean, variance, standard deviation
  - Sharpe ratio
  - Portfolio return
- **RiskService**: Risk management calculations including:
  - Value at Risk (VaR)
  - Conditional VaR (CVaR / Expected Shortfall)
  - Maximum Drawdown
  - Beta

### Utils
- **Formatters**: Currency, percentage, and number formatting
- **Validators**: Symbol, quantity, price, and date range validation

## Usage

```python
from models import MarketModel, PortfolioModel
from controllers import MarketController, PortfolioController
from services import CalculationService, RiskService

# Create a portfolio
portfolio = PortfolioModel(portfolio_id="my_portfolio")
portfolio.add_holding("AAPL", 100)
portfolio.add_holding("GOOGL", 50)

# Calculate returns
prices = [100, 110, 105, 115]
returns = CalculationService.calculate_returns(prices)

# Calculate risk metrics
var = RiskService.calculate_var(returns, confidence_level=0.95, portfolio_value=100000)
```

## Running Tests

```bash
cd quantix
python -m pytest tests/
```

Or run individual test files:

```bash
python -m pytest tests/test_models.py
python -m pytest tests/test_services.py
```
