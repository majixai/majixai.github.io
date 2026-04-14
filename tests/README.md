# Root-Level Unit Test Suite

This directory is the **central unit-testing hub** for the entire repository.
It houses tests for every module and sub-package, making it easy to run the
full test suite from a single location.

## Structure

```
tests/
├── conftest.py                          # Shared fixtures & sys.path setup
├── test_calendar_data.py                # Tests → calendar_data.py (root)
├── test_database.py                     # Tests → database.py (root)
├── dji_monte_carlo/
│   └── test_monte_carlo.py              # Tests → dji_monte_carlo/monte_carlo_simulation.py
├── market_prediction/
│   └── test_market_predictor.py         # Tests → market_prediction/market_predictor.py
├── predictive_ledger/
│   └── test_optimizer.py                # Tests → predictive_ledger/optimizer.py
└── stock_fetcher/
    └── test_fetcher.py                  # Tests → stock_fetcher/fetcher.py
```

> Tests for modules that already have their own `tests/` sub-directory
> (e.g. `yfinance_data/`, `tradingview_integration/`, `holdem_app/`, …) live
> alongside their source code and are **not** duplicated here.  Run them
> directly with `pytest <module>/tests/`.

## Running the Tests

Install dependencies first (Python 3.10+):

```bash
pip install pytest numpy pandas
```

Run **all** tests in this directory:

```bash
pytest tests/
```

Run a specific sub-suite:

```bash
pytest tests/predictive_ledger/
pytest tests/market_prediction/
```

Run with verbose output:

```bash
pytest tests/ -v
```

Run only fast (no-network) tests:

```bash
pytest tests/ -m "not network"
```

## Adding New Tests

1. Create a sub-directory named after the module under `tests/`.
2. Add an `__init__.py` (can be empty).
3. Create `test_<module>.py` following the `unittest.TestCase` style already
   used across the repo.
4. Import helpers from `conftest.py` where possible (e.g. `repo_root` fixture).
