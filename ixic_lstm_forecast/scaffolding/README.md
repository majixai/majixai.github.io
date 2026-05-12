# IXIC forecast scaffolding

This directory keeps the nightly IXIC project scaffold explicit without duplicating the repository's existing engines.

- `yfinance/` → mirrors the repository `yfinance/` entry points for market-data acquisition.
- `neural/` → points at `yfinance_data/models/neural_forecaster.py` for neural inference hand-off.
- `ml/` → tracks the core `ixic_lstm_forecast/` model pipeline and compressed runtime outputs.
- `ai/` → aligns Gemini prompt assembly and `ai/packet-router.js` integrations.
- `gpu/` → aligns optional GPU acceleration from `gpu/` for heavier retraining.
- `routing/` → documents Git/GAS webhook routing and `router/routes.json` coordination.

The Bash export pipeline writes a machine-readable scaffold manifest to:

- `ixic_lstm_forecast/output/runtime/ixic_directory_scaffold.json`
- `ixic_lstm_forecast/output/runtime/ixic_directory_scaffold.dat.gz`
