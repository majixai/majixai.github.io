# IXIC LSTM Forecast

An end-to-end LSTM-based price-forecasting pipeline for the NASDAQ Composite (`^IXIC`), implemented as a modular Python package with GitHub-hosted automation, Bash-based runtime exports, and a Google Apps Script nightly delivery path.

## Architecture

The package is split across several root-level sub-directories, each responsible for one concern:

```text
ixic_lstm_forecast/
├── framework/          # §1–7 — Interfaces, base classes, decorators, iterators
├── models/             # §8 — LSTM implementation
├── storage/            # §8 — Persistence (.dat/.gz sidecars for Git-backed artifacts)
├── workers/            # §9 — Async yfinance worker + multiprocessing reporter
├── bash/               # Bash-heavy automation for symbols CSV export and nightly runs
├── gas/                # Google Apps Script nightly scheduler, webhook sync, email sender
├── scaffolding/        # yfinance / neural / ml / ai / gpu / routing project map
├── runtime_settings.py # CSV + env driven settings resolver
├── ixic_main.py        # §10–11 — Main controller + IIFE entry point
├── requirements.txt
└── output/             # Runtime artifacts (.json, .dat, .dat.gz, .log)
```

## Symbols CSV as the source of truth

The repository-wide symbols catalog at `/home/runner/work/majixai.github.io/majixai.github.io/actions/symbols.csv` is now the default input source for IXIC symbol selection.

Default behavior:

- primary symbol: `^IXIC`
- categories: `indices,tech_mega`
- max symbol count: `12`

Supported runtime overrides:

| Variable | Default | Description |
|----------|---------|-------------|
| `IXIC_SYMBOL` / `IXIC_PRIMARY_SYMBOL` | `^IXIC` | Forecast target symbol |
| `IXIC_SYMBOLS_CSV` | `actions/symbols.csv` | Canonical CSV source |
| `IXIC_SYMBOLS` | empty | Explicit symbol override list |
| `IXIC_SYMBOL_CATEGORIES` | `indices,tech_mega` | CSV categories used when explicit symbols are absent |
| `IXIC_MAX_SYMBOLS` | `12` | Max exported symbol count |
| `IXIC_SEND_HOUR_LOCAL` | `22` | GAS nightly send hour |
| `IXIC_MARKET_CALENDAR` | `US_EQUITIES` | Next-morning market-open check |
| `IXIC_GEMINI_DAILY_LIMIT` | `20` | Daily Gemini budget |
| `IXIC_GEMINI_MONTHLY_LIMIT` | `400` | Monthly Gemini budget |

## Bash automation

These scripts are the operational entry points for GitHub Actions and local maintenance:

```bash
bash /home/runner/work/majixai.github.io/majixai.github.io/ixic_lstm_forecast/bash/export_runtime_env.sh
bash /home/runner/work/majixai.github.io/majixai.github.io/ixic_lstm_forecast/bash/run_nightly_pipeline.sh
```

`export_runtime_env.sh` will:

- resolve symbols from `actions/symbols.csv`
- emit GitHub Actions environment exports
- write runtime settings JSON
- write directory scaffold JSON
- write a Git/GAS webhook payload template
- duplicate each JSON payload as `.dat` and `.dat.gz`

Artifacts land in:

- `ixic_lstm_forecast/output/runtime/ixic_runtime_settings.json`
- `ixic_lstm_forecast/output/runtime/ixic_runtime_settings.dat.gz`
- `ixic_lstm_forecast/output/runtime/ixic_directory_scaffold.json`
- `ixic_lstm_forecast/output/runtime/ixic_directory_scaffold.dat.gz`
- `ixic_lstm_forecast/output/webhooks/ixic_gas_payload.json`
- `ixic_lstm_forecast/output/webhooks/ixic_gas_payload.dat.gz`

## Google Apps Script nightly flow

`ixic_lstm_forecast/gas/Code.gs` provides the repo-hosted GAS implementation for:

- dynamic Script Properties based configuration
- 10 PM local trigger installation
- next-morning market-open gating
- weekly / daily / hourly / 15m OHLCV retrieval from Yahoo Finance chart endpoints
- basic pattern + indicator extraction
- repetition detection across timeframes
- Gemini prompt generation with daily/monthly rate limiting
- HTML email delivery
- webhook-based settings sync from GitHub-generated payloads

Recommended Script Properties:

- `RECIPIENT_EMAILS`
- `GEMINI_API_KEY`
- `IXIC_PRIMARY_SYMBOL`
- `IXIC_SYMBOLS`
- `IXIC_SYMBOL_CATEGORIES`
- `IXIC_MAX_SYMBOLS`
- `IXIC_SYMBOLS_CSV_URL`
- `IXIC_SEND_HOUR_LOCAL`
- `IXIC_TIMEZONE`
- `IXIC_MARKET_CALENDAR`
- `IXIC_GEMINI_DAILY_LIMIT`
- `IXIC_GEMINI_MONTHLY_LIMIT`
- `IXIC_WEBHOOK_SECRET`

> Never hardcode API keys, PATs, or webhook secrets in source. Use Script Properties and GitHub Actions secrets only.

## Routing / webhook scaffolding

The nightly project now emits webhook payloads that include:

- Git context (`repo`, `ref`, `sha`, `actor`)
- route namespace (`/ixic_lstm_forecast/`)
- router manifest location (`router/routes.json`)
- AI packet router linkage (`ai/packet-router.js`)
- yfinance / neural / ml / ai / gpu / routing scaffold entries

This keeps GitHub Actions, Git-hosted artifacts, and GAS webhook automation aligned without duplicating secrets or directory ownership.

## GitHub Actions

The workflow `/home/runner/work/majixai.github.io/majixai.github.io/.github/workflows/ixic_lstm_forecast.yml` now:

- exports runtime settings from the repository CSV before the model run
- uses Bash as the primary automation layer for settings + run orchestration
- uploads runtime/webhook JSON + `.dat.gz` artifacts with the forecast output
- keeps the LSTM pipeline intact while surfacing CSV-driven settings in summaries

## Scaffold map

See `ixic_lstm_forecast/scaffolding/README.md` for the explicit yfinance / neural / ml / ai / gpu / routing project map.
