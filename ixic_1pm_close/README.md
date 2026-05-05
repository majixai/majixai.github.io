# IXIC 1 PM Close Prediction Engine

A comprehensive multi-method prediction system for the **NASDAQ Composite Index (^IXIC) 1 PM close price**, integrated with the repository-level shared infrastructure.

## Overview

This module is a full-featured copy of the `dji_1pm_close` engine, rewritten for `^IXIC` and extended to consume data and analytics from every major subsystem already present in the repository root:

| Subsystem | Role |
|-----------|------|
| `yfinance/ops.py` | `Router`, `ActionRegistry`, `DataStore` – live data fetch + SQLite persistence |
| `yfinance/zones.py` | Zone classification (expansion, consolidation, stochastic drift, Frenet curvature, Higuchi FD, differential form) → S/R boundaries |
| `yfinance_chart/` | Active pattern overlays: OU reversion, GBM vol cluster, geodesic SR, Higuchi regime, exterior-derivative spike, harmonic XABCD, Elliott wave, extended calculus features |
| `dbs/` | Persistent result cache (SQLite via `DataStore`; manifest in `dbs/files.json`) |

Core mathematics (shared with `dji_1pm_close`):
- Geometric Brownian Motion (GBM) with Itô's Lemma
- Ornstein–Uhlenbeck mean-reversion
- Merton Jump-Diffusion
- Fourier / spectral cycle analysis
- Taylor-series price approximation
- Numerical integration (Simpson's rule, Gaussian quadrature, Romberg)
- Black-Scholes PDE + Greeks (Δ, Γ, Θ, ν)
- Monte Carlo with antithetic variates, control variates, stratified sampling

## What's New vs. DJI Engine

| Feature | DJI | IXIC |
|---------|:---:|:----:|
| Ticker | `^DJI` | `^IXIC` |
| Live data seeding | ❌ | ✅ (yfinance/ops) |
| OHLCV snapshot | ❌ | ✅ |
| Technical indicators | ❌ | ✅ (RSI, MACD, BB, Stoch, ADX, CCI, ROC, EMA, SMA) |
| S/R projections | ❌ | ✅ (pivot, BB, ATR, Fib, zone-derived) |
| Active pattern overlays | ❌ | ✅ (yfinance_chart) |
| Zone classification | ❌ | ✅ (yfinance/zones) |
| DataStore persistence | ❌ | ✅ (dbs/ixic_1pm.db) |
| Singular unified result | ❌ | ✅ (`IXICPredictionResult`) |

## Directory Structure

```
ixic_1pm_close/
├── README.md                  # This file
├── Makefile                   # C/C++ build system (reserved for future native impls)
├── ixic_1pm_prediction.py     # Python implementation (primary)
├── ixic_1pm_prediction.png    # Visualization output (auto-generated)
└── prediction_results.json    # JSON output (auto-generated)
```

## Unified Output Schema

All subsystems feed into a single `IXICPredictionResult` dataclass that is serialised to `prediction_results.json`:

```json
{
  "timestamp": "2026-05-05T12:30:00Z",
  "ticker": "^IXIC",
  "data_source": "live",
  "ohlcv": { "open": ..., "high": ..., "low": ..., "close": ..., "vwap": ..., "atr_14": ..., ... },
  "indicators": { "rsi_14": ..., "macd_line": ..., "bb_pct_b": ..., "adx": ..., ... },
  "sr_levels": [
    { "label": "PP",    "price": 19100.00, "source": "pivot", "strength": 0.9 },
    { "label": "R1",    "price": 19250.00, "source": "pivot", "strength": 0.7 },
    { "label": "BB_upper", "price": 19420.00, "source": "bb", "strength": 0.65 },
    ...
  ],
  "zone": { "expansion": false, "consolidation": true, "stochastic_drift": false, ... },
  "active_patterns": [
    { "family": "ou_reversion",  "name": "ou_reversion",  "upper": 19250.0, "lower": 18800.0 },
    { "family": "harmonic",      "name": "harmonic_bat",  "upper": 19400.0, "lower": 18950.0 },
    ...
  ],
  "dominant_cycles": [
    { "frequency": 0.025, "period_minutes": 40.0, "power": 1234567.0 }
  ],
  "gbm":             { "mean": ..., "std": ..., "p5": ..., "p95": ... },
  "antithetic":      { "mean": ..., "std": ..., "variance_reduction": ... },
  "stratified":      { "mean": ..., "std": ... },
  "integration":     { "analytical_expected": ..., "log_mean": ..., "log_std": ... },
  "black_scholes":   { "delta": ..., "gamma": ..., "theta": ..., "vega": ... },
  "ito_lemma":       { "drift_term": ..., "diffusion_term": ..., "new_price": ... },
  "taylor_expansion":{ "price": ..., "expected_drift": ... },
  "confidence_interval": { "mean": ..., "ci_95_lower": ..., "ci_95_upper": ... },
  "combined_prediction": { "mean": ..., "std": ..., "methods_used": 4 }
}
```

## Requirements

```bash
pip install numpy scipy sympy pandas matplotlib yfinance
```

## Quick Start

```bash
# Run with live IXIC data (from repo root so sibling packages are importable)
python ixic_1pm_close/ixic_1pm_prediction.py

# Override defaults via environment variables
IXIC_PRICE=19500.00 VOLATILITY=0.20 SIMULATIONS=20000 python ixic_1pm_close/ixic_1pm_prediction.py
```

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `IXIC_PRICE` | 19000.00 | Starting price if live data unavailable |
| `VOLATILITY` | 0.18 | Annualised volatility override |
| `DRIFT` | 0.06 | Annualised drift override |
| `SIMULATIONS` | 10000 | Monte Carlo simulation count |
| `RANDOM_SEED` | 42 | Reproducibility seed |
| `HISTORY_PERIOD` | 60d | yfinance history window |

## Integration Notes

### yfinance/ops (DataStore)
Results are persisted as a JSON blob under key `ixic_1pm_{timestamp}` in `dbs/ixic_1pm.db`.
The `dbs/files.json` manifest is updated so the DBS monitor dashboard lists the database.

### yfinance/zones
`zones_classify("^IXIC", df)` classifies the current IXIC dataframe against eight zone types.
Zone membership (expansion, consolidation, stochastic drift, etc.) directly augments the S/R
levels list and is emitted as a top-level `zone` key in the result JSON.

### yfinance_chart patterns
All math-based pattern detectors from `yfinance_chart/lightweight_pattern_chart.py` are
evaluated against the live history window.  Each detector contributes its most recently
active overlay to the `active_patterns` list.  When `build_extended_calculus_features` is
available its full feature vector is appended as well.

### Graceful degradation
If any integration layer is unavailable (import failure, network error, insufficient data),
the engine falls back silently to default parameters and skips that subsystem, always
producing a valid output.

## Mathematical Foundation

See `dji_1pm_close/README.md` for the shared mathematical derivations (GBM, Itô's Lemma,
Black-Scholes PDE, Taylor series, Simpson/Gauss/Romberg quadrature).

## License

MIT License – see repository root for details.

## Author

MajixAI – Advanced Financial Modeling
