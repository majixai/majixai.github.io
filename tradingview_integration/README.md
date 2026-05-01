# TradingView Integration Project

This project demonstrates how to integrate TradingView's Pine Script with Google Apps Script, using GitHub as a data store — and includes a Neural Network ML indicator that generates buy/sell signals directly on TradingView charts.

## Project Structure

- **`pine_ml_indicator.pine`** — Neural Network ML indicator (Pine Script v5) with RSI, MACD, Bollinger Bands, and volume scoring.
- **`omni_architect_pro_unified.pine`** — Extended Omni-Architect PRO indicator with unified nested UDT hierarchy, Bayesian confidence fan rendering, slope-intensity filtering, and integrated H&S detection.
- **`/pine_script`** — Additional Pine Script files:
  - `advanced_indicator.pine` — Multi-indicator strategy combining RSI, MACD, Bollinger Bands, ATR, Stochastic, ADX, VWAP, candlestick patterns, S/R, and MTF signals.
  - `data_reader.pine` — Reads compressed Pine Seeds external data via `request.seed()`.
  - `jinx_alpha_trend_v13.pine` — JINX Alpha Trend v13 strategy.
  - `scalp_poi_hs_dirac.pine` — Scalp POI strategy with 15 analytical engines (see `/pine_script/README.md` for full documentation).
  - `recursive_nested_matrix_engine.pine` — Recursive Nested Matrix Engine v6: 5-level UDT hierarchy (MatrixPoint → VectorSegment → SwingPath → PatternManifest → GlobalMatrix), four pattern detectors (Expansion, Compression, H&S, Double-Top/Bottom), 4-ticker weighted correlation matrix, and rolling volume-profile POC.
- **`/google_apps_script`** — Google Apps Script files that push data to GitHub.
- **`/data`** — Data files in `.csv` and compressed `.dat` format.
- **`/.github/workflows`** — GitHub Actions workflow for scheduled data updates.

## How it works

1.  **Data is stored in a `.csv` file** in the `/data` directory.
2.  **A Google Apps Script** reads the `.csv` file, compresses it into a `.dat` file (using gzip), and pushes it to this GitHub repository using the GitHub API. This script can be triggered manually or on a schedule.
3.  **A Pine Script indicator** on TradingView uses the `request.seed()` function to read the `.dat` file directly from the GitHub repository. This allows the indicator to use external data that is updated dynamically.
4.  **A GitHub Actions workflow** (`tradingview_data_update.yml`) automates the Google Apps Script trigger on a schedule.

## Neural Network ML Indicator (`pine_ml_indicator.pine`)

The `pine_ml_indicator.pine` file is a Pine Script v5 indicator that simulates a neural-network scoring system by combining multiple technical signals:

| Signal | Indicator |
|---|---|
| Momentum | RSI (default period 14) |
| Trend | MACD (12 / 26 / 9) |
| Volatility | Bollinger Bands (20, 2σ) |
| Activity | Volume threshold |

A composite score is computed from these signals. When the score exceeds the **buy threshold** (default `2.0`) a green upward label is plotted; when it falls below the **sell threshold** (default `-2.0`) a red downward label is plotted.

### Adding to TradingView

1. Open the Pine Script editor in TradingView.
2. Paste the contents of `pine_ml_indicator.pine`.
3. Click **Add to chart**.
4. Tune the input parameters (thresholds, indicator periods) in the Settings panel.

## Setup (GitHub ↔ Google Apps Script integration)

1.  **Create a GitHub Personal Access Token (PAT)** with the `repo` scope.
2.  In your Google Apps Script project go to **Project Settings → Script Properties** and add a property with key `GITHUB_TOKEN` set to your PAT. **Do not hardcode the PAT in the script.**
3.  **Deploy your Google Apps Script as a Web App.**
4.  Set up the GitHub Actions workflow to trigger the web app URL on a schedule.

This setup provides a flexible pipeline to get external data into TradingView indicators, managed and updated through Google Apps Script and GitHub Actions.

---

## Unified Feed (`/unified_feed`)

The `unified_feed/` package provides a scalable, offline-capable data pipeline with SHA-256 provenance tracking and gzip-compressed SQLite storage.

### Timing windows

| Horizon | Range |
|---------|-------|
| Short-term | 1 minute – 120 minutes |
| Medium-term | 1 hour – 3 days |
| Long-term | 1 day – 2 weeks |

### Provenance helper (`utils/sha256_provenance.py`)

Every artifact written by the pipeline gets two sidecar files:

- `artifact.sha256` — single-line hex digest of the file contents.
- `artifact.meta.json` — JSON object containing `sha256`, `filename_sha256`, and any custom metadata fields.

**Filename hashing** (`sha256_of_filename`) hashes only the basename of the artifact path, so an artifact can be moved to a different directory without invalidating its filename hash. This is distinct from the content hash (`sha256_of_file`) and is useful for detecting renames or encoding structured information in filenames (e.g. ticker, date, interval).

```python
from tradingview_integration.unified_feed.utils.sha256_provenance import (
    sha256_of_file,
    sha256_of_filename,
    write_metadata_atomic,
    verify_artifact,
)

# Hash content
content_hash = sha256_of_file("data/SPY_1m.parquet")

# Hash filename (basename only — independent of directory)
name_hash = sha256_of_filename("data/SPY_1m.parquet")
# name_hash == sha256_of_filename("other/SPY_1m.parquet")  # True

# Write sidecars atomically
write_metadata_atomic("data/SPY_1m.parquet", {"ticker": "SPY", "interval": "1m"})

# Verify integrity
ok, expected, actual = verify_artifact("data/SPY_1m.parquet", strict=True)
```

### Dynamic .dat.gz databases (`db/dat_manager.py`)

Ticker fetch summaries are persisted in gzip-compressed SQLite `.dat.gz` files with atomic writes and optional rotation by size.

**`dbs/` integration** — a bare filename (no directory component) is automatically resolved to the repository-root `dbs/` directory so the file is immediately visible to `dbs/monitor.js`.  `dbs/files.json` is rewritten atomically after every flush.

```python
from tradingview_integration.unified_feed.db.dat_manager import DatabaseManager

# Stored in <repo_root>/dbs/cache.dat.gz; dbs/files.json updated automatically
with DatabaseManager("cache.dat.gz") as dm:
    dm.append_summary(
        ticker="SPY",
        interval="1m",
        last_ts=1700000000,
        sha256=content_hash,
        filename_sha256=name_hash,
        metadata={"source": "yfinance"},
    )
    rows = dm.query_summaries({"ticker": "SPY"})
```

### Root directive adapters (`adapters/root_directives.py`)

Reads optional YAML / JSON / Python directive files from several well-known root directories and maps them to Feature Engine and `tensor_calculus` inputs.  All sources are optional and silently skipped when absent.

| Source | Key in result | What is loaded |
|--------|---------------|----------------|
| `finance/` | `"finance"` | Domain model directives |
| `mathematics/` | `"mathematics"` | Math / calculus directives |
| `dbs/` | `"dbs"` | DB config files; `files.json` list wrapped under `"files"` key |
| `actions/` | `"actions"` | Action-dispatcher config snippets |
| Root `*.py` whitelist | `"python"` | `config.py`, `settings.py`, `directives.py`, etc. (safe subset) |

```python
from tradingview_integration.unified_feed.adapters.root_directives import (
    load_all_directives,
    map_to_feature_engine_inputs,
    map_to_tensor_calculus_inputs,
)

directives = load_all_directives()                   # {} if all sources absent
fe_inputs  = map_to_feature_engine_inputs(directives)
tc_inputs  = map_to_tensor_calculus_inputs(directives)
```

### Database migrations (`db/migrations/`)

`db/migrations/001_initial.sql` creates the `artifact_metadata`, `fetch_record`, and `job` tables. Apply it to a new SQLite file:

```bash
sqlite3 mydb.sqlite < tradingview_integration/unified_feed/db/migrations/001_initial.sql
```
