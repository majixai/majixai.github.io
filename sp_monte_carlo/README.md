# S&P 500 Monte Carlo Monday Close Simulation

A Monte Carlo simulation for S&P 500 (^GSPC) Monday projected close price using Geometric Brownian Motion (GBM).

## Overview

This simulation uses the Monte Carlo method to project potential closing prices for the S&P 500 index on Monday. The model applies Geometric Brownian Motion (GBM) to simulate thousands of potential price trajectories over a full trading day (390 minutes).

## Features

- **5000 Simulations**: Generates 5000 potential price paths
- **GBM Model**: Uses Geometric Brownian Motion for realistic price dynamics
- **Statistical Analysis**: Provides percentile-based confidence intervals
- **Visualization**: Creates a comprehensive dashboard with:
  - Monday close projection with confidence bands
  - Final price distribution histogram
  - Statistical summary panel

## Configuration Parameters

All parameters can be configured via environment variables:

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `CURRENT_PRICE` | 6025.00 | Starting price for simulation |
| `MINUTES_REMAINING` | 390 | Trading minutes to simulate (full day) |
| `SIMULATIONS` | 5000 | Number of Monte Carlo paths |
| `SIGMA` | 0.16 | Annualized volatility (16%) |
| `MU` | 0.03 | Drift rate (3%) |
| `RANDOM_SEED` | 42 | Fixed seed for reproducibility (empty for true randomness) |

## Running Locally

```bash
# Install dependencies
pip install numpy matplotlib

# Run with default parameters
python monte_carlo_simulation.py

# Run with custom parameters
CURRENT_PRICE=6100.00 SIMULATIONS=10000 RANDOM_SEED="" python monte_carlo_simulation.py
```

## Running Tests

```bash
cd sp_monte_carlo
python -m pytest test_monte_carlo_simulation.py -v
```

## GitHub Actions

The simulation can be triggered automatically via GitHub Actions:
- **Manual dispatch**: Run workflow manually from Actions tab
- **Push trigger**: Automatically runs when changes are pushed to `sp_monte_carlo/` directory

## Output

The simulation generates:
1. `sp_simulation_output.png` - Visualization dashboard
2. Console output with statistical summary

## Dependencies

- numpy
- matplotlib
