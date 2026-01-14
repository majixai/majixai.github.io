# DJI Monte Carlo Intraday Simulation

A Monte Carlo simulation for DJI (Dow Jones Industrial Average) intraday price projections using Geometric Brownian Motion (GBM).

## Overview

This simulation uses the Monte Carlo method to project potential price paths for the DJI index over a given intraday period. The model applies Geometric Brownian Motion (GBM) to simulate thousands of potential price trajectories.

## Features

- **5000 Simulations**: Generates 5000 potential price paths
- **GBM Model**: Uses Geometric Brownian Motion for realistic price dynamics
- **Statistical Analysis**: Provides percentile-based confidence intervals
- **Visualization**: Creates a comprehensive dashboard with:
  - Intraday projection with confidence bands
  - Final price distribution histogram
  - Statistical summary panel

## Configuration Parameters

All parameters can be configured via environment variables:

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `CURRENT_PRICE` | 52417.00 | Starting price for simulation |
| `MINUTES_REMAINING` | 207 | Trading minutes to simulate |
| `SIMULATIONS` | 5000 | Number of Monte Carlo paths |
| `SIGMA` | 0.14 | Annualized volatility (14%) |
| `MU` | 0.02 | Drift rate (2%) |
| `RANDOM_SEED` | 55 | Fixed seed for reproducibility (empty for true randomness) |

## Running Locally

```bash
# Install dependencies
pip install numpy matplotlib

# Run with default parameters
python monte_carlo_simulation.py

# Run with custom parameters
CURRENT_PRICE=53000.00 SIMULATIONS=10000 RANDOM_SEED="" python monte_carlo_simulation.py
```

## GitHub Actions

The simulation can be triggered automatically via GitHub Actions:
- **Manual dispatch**: Run workflow manually from Actions tab
- **Push trigger**: Automatically runs when changes are pushed to `dji_monte_carlo/` directory

## Output

The simulation generates:
1. `dji_simulation_output.png` - Visualization dashboard
2. Console output with statistical summary

## Dependencies

- numpy
- matplotlib
