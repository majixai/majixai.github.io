# Quantitative AI

Umbrella directory for the repository's market-data, compute, modeling, and
mathematics assets.

## Layer order

1. `math/` — foundation layer for linear algebra, statistics, optimization, and numerics
2. `gpu/` — compute acceleration and backend selection
3. `ml/` and `neural/` — classical ML and neural modeling layers
4. `yfinance/` — data ingestion and cached market snapshots
5. `common/` — shared schemas, logging, caching, and error handling
6. `data/`, `models/`, `experiments/`, `reports/` — isolated artifacts and outputs

## Canonical entry points

- `yfinance/` → [`../yfinance/`](../yfinance/) (`fetch_yfinance.py`, `ops.py`, `report.py`)
- `gpu/` → [`../gpu/`](../gpu/) (`manager.py`, `dispatcher.py`, `kernels/`)
- `neural/` → [`../tensor/neural/`](../tensor/neural/) and [`../neural_tensor_network/`](../neural_tensor_network/)
- `ml/` → [`../market_prediction/`](../market_prediction/), [`../stock_analyzer/`](../stock_analyzer/), [`../regression/`](../regression/)
- `math/` → [`../math_index.md`](../math_index.md) and the core math directories such as [`../matrix/`](../matrix/), [`../calculus/`](../calculus/), [`../optimization/`](../optimization/), [`../numerical_methods/`](../numerical_methods/), each with examples subdirectories for worked snippets

## Directory layout

```text
quantitative_ai/
├── README.md
├── common/
├── data/
├── experiments/
├── gpu/
├── math/
├── ml/
├── models/
├── neural/
├── reports/
└── yfinance/
```

This tree is organizational: it groups the existing repository assets without
breaking current paths or imports.
