# Bitcoin Miner

`bitcoin_miner/` is an educational mining module that combines:

- a high-performance C proof-of-work miner (`miner.c`)
- a live Bitcoin network data + analytics pipeline (`fetch_real_data.py`)
- a browser UI with worker-based mining simulation and TensorFlow.js neural fee analysis (`index.html`)

The directory is designed to run as a standalone app while also integrating with repository automation.

## Directory layout

| Path | Purpose |
|------|---------|
| `miner.c` | Multi-threaded educational Bitcoin PoW miner with scalar/SIMD paths and Stratum support |
| `Makefile` | Build targets for release and debug miner binaries |
| `miner_scalar` | Prebuilt Linux binary artifact |
| `fetch_real_data.py` | Pulls live network/fee/price data and writes analytics JSON |
| `data/live_data.json` | Frontend-consumed live data snapshot |
| `index.html` | Dashboard UI, mining controls, worker engine, TensorFlow.js fee model |
| `login.html`, `login.js`, `login.css`, `login-config.json` | Optional local login gate for the app |

## Data + analytics pipeline

`fetch_real_data.py` samples live Bitcoin data and computes derived analytics used by the UI:

- Network metrics (height, difficulty, mempool, hashrate)
- Fee recommendations and percentiles
- BTC/USD pricing
- Reward and halving metrics
- ML/neural signals (priority score, fee-rate guidance, trend/forecast fields)

Output is persisted to:

- `bitcoin_miner/data/live_data.json`

## Automation

This directory is wired to GitHub Actions:

- Workflow: `.github/workflows/bitcoin_miner_data.yml`
- Behavior: runs the fetcher and commits refreshed `bitcoin_miner/data/live_data.json` back to the repository when changed.
- Workflow: `.github/workflows/bitcoin_miner_actions.yml`
- Behavior: runs every minute and launches a 10-slot matrix; each slot executes up to a 5-minute in-memory mining subprocess window with optional tensor/neural integration imports.

## Local usage

### 1) Build the C miner

```bash
cd bitcoin_miner
make
```

Debug build:

```bash
make debug
```

### 2) Run live data collection

```bash
python bitcoin_miner/fetch_real_data.py --runtime 180
```

### 3) Open the web dashboard

Serve the repo root with any static web server and open:

`/bitcoin_miner/index.html`

## Notes

- This module is educational/research-oriented and not intended as production mining infrastructure.
- Real Bitcoin mainnet difficulty is far beyond browser demo settings; UI mining controls are demonstrative.
