# IXIC LSTM Forecast

An end-to-end LSTM-based price-forecasting pipeline for the NASDAQ Composite (`^IXIC`), implemented as a modular Python package with an automated GitHub Actions workflow.

## Architecture

The package is split across several root-level sub-directories, each responsible for one concern:

```
ixic_lstm_forecast/
├── framework/          # §1–7 — Interfaces, base classes, decorators, iterators
│   ├── interfaces.py   #   IModelForecaster, IStorageEngine (Protocols)
│   ├── base.py         #   QuantFrameworkBase, Tickers, WeakMap cache
│   ├── decorators.py   #   lifecycle_hook, log_event
│   └── iterators.py    #   TimeSeriesIterator, batch_generator
├── models/             # §8 — LSTM implementation
│   └── lstm_core.py    #   LSTMCore (inherits QuantFrameworkBase)
├── storage/            # §8 — Persistence
│   └── git_storage.py  #   GitDatabaseStorage (gzip pickle + JSON sidecar)
├── workers/            # §9 — Distributed worker architecture
│   ├── pipeline.py     #   async_data_pipeline (asyncio + yfinance)
│   └── reporter.py     #   reporting_worker (multiprocessing.Queue consumer)
├── ixic_main.py        # §10–11 — Main controller + IIFE entry point
├── requirements.txt
└── output/             # Runtime artifacts (.dat.gz, .json, .log)
```

## Framework Concepts Implemented

| Section | Concept | Module |
|---------|---------|--------|
| §1  | Interfaces / Protocols | `framework/interfaces.py` |
| §2  | Structs & Object Mapping | `framework/base.py` → `Tickers` |
| §3  | WeakMap Cache | `framework/base.py` → `_global_tensor_cache` |
| §4  | Hooks, Callbacks, Decorators | `framework/decorators.py` |
| §5  | Advanced OOP (public/protected/private) | `framework/base.py` → `QuantFrameworkBase` |
| §6  | Binary Operations (bitwise) | `framework/base.py` → `calculate_binary_flag` |
| §7  | Iterators & Generators | `framework/iterators.py` |
| §8  | LSTM + Storage implementations | `models/`, `storage/` |
| §9  | Async + Multiprocessing worker | `workers/` |
| §10 | Main async controller | `ixic_main.py` → `main_controller` |
| §11 | IIFE pattern | `ixic_main.py` → lambda banner |

## Usage

### Manual run

```bash
pip install -r ixic_lstm_forecast/requirements.txt
python ixic_lstm_forecast/ixic_main.py
```

Environment overrides:

| Variable | Default | Description |
|----------|---------|-------------|
| `IXIC_SYMBOL` | `^IXIC` | Yahoo Finance ticker |
| `IXIC_SEQ_LENGTH` | `60` | LSTM look-back window |
| `IXIC_EPOCHS` | `3` | Training epochs |
| `IXIC_BATCH_SIZE` | `256` | Generator batch size |
| `IXIC_OUTPUT_DIR` | `output/` | Artifact output directory |

### GitHub Actions

The workflow `.github/workflows/ixic_lstm_forecast.yml` runs automatically:
- **Scheduled**: Mon–Fri at 21:45 UTC (after US market close)
- **Manual**: via *workflow_dispatch* with configurable symbol/epochs

## Outputs

| File | Description |
|------|-------------|
| `output/ixic_summary.json` | Latest run summary (symbol, closes, delta) |
| `output/<SYMBOL>_tickers_payload_<ts>.dat.gz` | Gzip-pickled `Tickers` struct |
| `output/<SYMBOL>_tickers_payload_<ts>.json` | Human-readable JSON sidecar |
| `output/ixic_forecast.log` | Full structured log for the run |
