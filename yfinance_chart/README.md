# YFinance Interactive Chart

An advanced interactive charting application for stock analysis with 5-day 1-minute interval data.

## Features

### 📊 Charting
- **Candlestick Charts** with Plotly.js for smooth interactivity
- **Zoom, Pan, and Draw** directly on the chart
- **Multiple timeframes** visualization

### 📈 Technical Indicators
- **Moving Averages**: SMA (20, 50) and EMA (12, 26)
- **Bollinger Bands**: Standard deviation-based price channels
- **RSI (14)**: Relative Strength Index oscillator
- **MACD (12, 26, 9)**: Moving Average Convergence Divergence
- **Stochastic Oscillator**: Momentum indicator

### 🔍 Pattern Recognition
- **Double Top/Bottom**: Reversal patterns
- **Head and Shoulders**: Classic reversal formation
- **Ascending/Descending Triangles**: Continuation patterns
- Visual annotations on chart for detected patterns

### 🎯 1PM Close Forecast
Uses **Multivariate Bayesian Nonlinear Differential Analysis** including:
- State-space modeling with matrix eigendecomposition
- Nonlinear polynomial regression
- RSI-based momentum feedback
- Volume-weighted adjustments
- 95% confidence intervals

### 🔄 Feedback Loop Engine
Real-time aggregation of multiple analysis signals:
- Momentum feedback loop
- Volume direction feedback
- Matrix eigenvalue stability
- Pattern recognition feedback
- Aggregate BUY/SELL/HOLD signal

### 🔎 Searchable Watchlist
- Auto-complete ticker search
- Click-to-load from watchlist grid
- 30 pre-configured popular tickers

## Usage

### Browser (Static HTML)
1. Open `index.html` in a web browser
2. The app will load demo data automatically
3. Click on any ticker in the watchlist or search

### With Live Data (Python Backend)
1. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

2. Fetch live data:
   ```bash
   python fetch_data.py
   ```

3. Open `index.html` in a browser to view the charts

### Custom Tickers
```bash
python fetch_data.py --tickers AAPL MSFT GOOGL
```

## Two-Level Git Datastore (CSV + DAT)

This project now supports a Git-directory storage model with two layers:

1. **Level 1 (simple CSV):** per-bar OHLCV + a few lightweight calculations.
2. **Level 2 (extensive compressed DB):** content-addressed `.dat` blobs + manifests/index.

### Run the pipeline

```bash
pip install -r yfinance_chart/requirements.txt
python yfinance_chart/github_datastore_pipeline.py --tickers SPY QQQ AAPL --period 6mo --interval 1d
```

### Minutely append-only updates

```bash
python yfinance_chart/github_datastore_pipeline.py \
   --tickers SPY QQQ AAPL \
   --period 7d \
   --interval 1m \
   --loop-minutely \
   --loop-seconds 60
```

- Level 1 CSV files are **append-only** (new bars only; no full rewrite).
- Level 2 manifests are written to history as new timestamped files for each run.
- Run summaries append to `summary_log.jsonl`.

### Output layout

- `github_data/level1_csv/*.csv`
- `github_data/level2_datastore/objects/xx/<sha>.dat`
- `github_data/level2_datastore/manifests/*.json`
- `github_data/level2_datastore/manifests/history/<ticker>/*.json`
- `github_data/level2_datastore/manifests/index.csv`
- `github_data/plots/*.png`
- `github_data/summary_log.jsonl`

### Notes

- Processing is parallelized across tickers (`--workers`).
- `.dat` blobs are aggressively compressed with `lzma` and addressed by SHA-256.
- Optional Git staging: add `--git-add` to stage generated datastore artifacts.

## GAS + Git Webhook Integration

The datastore pipeline can post each run summary to a Google Apps Script (GAS) webhook, including Git metadata.

### Included GAS receiver

- [yfinance_chart/gas_webhook/Code.gs](yfinance_chart/gas_webhook/Code.gs)

This receiver:
- accepts POST JSON payloads from the pipeline,
- returns JSON success/error,
- optionally logs run rows to Google Sheets.

### Deploy GAS webhook

1. Create a new Google Apps Script project.
2. Paste contents of [yfinance_chart/gas_webhook/Code.gs](yfinance_chart/gas_webhook/Code.gs).
3. Deploy as **Web app** (execute as you, accessible per your policy).
4. Copy the deployment URL.
5. Optional Script Properties for Sheets logging:
    - `SHEET_ID`
    - `SHEET_NAME` (default `WebhookRuns`)

### Run pipeline with GAS webhook

Using flag:

```bash
python yfinance_chart/github_datastore_pipeline.py \
   --tickers SPY QQQ \
   --period 7d \
   --interval 1m \
   --gas-webhook-url "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
```

Using environment variable:

```bash
export GAS_WEBHOOK_URL="https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
python yfinance_chart/github_datastore_pipeline.py --tickers SPY --period 1mo --interval 1d
```

### Payload includes Git context

Pipeline sends:
- `event`, `run_utc`, `tickers`, `period`, `interval`,
- `summary` rows per ticker,
- `git` metadata (`repo`, `branch`, `commit`, `remote`).

This makes GAS logs Git-aware for downstream auditing and automation.

### Quick webhook test (curl)

Use this to verify your deployed GAS endpoint before running the full pipeline:

```bash
curl -X POST "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec" \
   -H "Content-Type: application/json" \
   -d '{
      "event": "yfinance_datastore_run",
      "run_utc": "2026-02-15T00:00:00Z",
      "git": {
         "repo": "majixai.github.io",
         "branch": "main",
         "commit": "test-commit",
         "remote": "https://github.com/majixai/majixai.github.io.git"
      },
      "base_dir": "github_data",
      "tickers": ["SPY"],
      "period": "1mo",
      "interval": "1d",
      "summary": [
         {
            "ticker": "SPY",
            "rows": 22,
            "appended_rows": 1,
            "patterns": 20,
            "sha256": "example",
            "csv": "github_data/level1_csv/SPY_1mo_1d_lite.csv",
            "dat": "github_data/level2_datastore/objects/ab/cdef.dat",
            "manifest": "github_data/level2_datastore/manifests/history/SPY/example.json",
            "plot": "github_data/plots/SPY_close_savgol.png"
         }
      ]
   }'
```

Expected success response:

```json
{
   "ok": true,
   "event": "yfinance_datastore_run",
   "run_utc": "2026-02-15T00:00:00Z",
   "rows_logged": 1
}
```

## Pine Script (request.seed with simple CSV)

This project includes two separate Pine Script files:

- [yfinance_chart/pinescript_seed_csv.pine](yfinance_chart/pinescript_seed_csv.pine) (starter)
- [yfinance_chart/pinescript_seed_csv_daily.pine](yfinance_chart/pinescript_seed_csv_daily.pine) (daily-focused variant)

### What it does

- Pulls OHLCV from a GitHub seed source via `request.seed()`.
- Plots seeded close, SMA, and optional seeded candles.
- Includes simple return and volume diagnostics.
- Daily-focused script adds optional ±1σ band overlays.

### Quick start (TradingView)

1. Open Pine Editor in TradingView.
2. Paste one of the scripts above.
3. Set:
    - `Seed source (owner/repo)`
    - `Seed symbol`
4. Click **Add to chart**.
5. Verify status label shows `Seed status: loaded`.

### Seed mapping expectations

- `request.seed()` depends on TradingView seed symbol mapping.
- `seedSource` is your GitHub repository in `owner/repo` format.
- `seedSymbol` must match the symbol mapping configured for your seed data.
- If mapping is missing or invalid, series return `na` and the script displays a no-data status.

### Recommended data workflow

- Keep generating append-only simple CSV data with:

```bash
python yfinance_chart/github_datastore_pipeline.py --tickers SPY --period 7d --interval 1m --base-dir github_data --loop-minutely --loop-seconds 60
```

- Publish/update your seed-facing CSV mapping as needed.
- Keep `.dat` compression artifacts for deeper storage/search, but use simple CSV series for seed retrieval.

### Daily update behavior

- Seed data on TradingView is generally refreshed on a daily cache/update cycle.
- For reliable behavior, keep seed data refreshed at least daily.
- Intraday source updates can still be useful, but visible seed refresh timing may follow TradingView caching.

### Troubleshooting

- **No data on chart**
   - Confirm `seedSource` is correct (`owner/repo`).
   - Confirm `seedSymbol` exists in your seed mapping.
   - Check repository visibility/access for your seed setup.

- **Values stale**
   - Ensure your CSV pipeline is still running and appending.
   - Re-open chart / reload script after your daily update window.

- **Unexpected gaps**
   - Verify timestamp continuity in source CSV.
   - Ensure symbol mapping points to the intended CSV stream.

## Technical Details

### Bayesian Forecast Method
The forecast uses a multivariate state-space model:
- **State Vector**: `[price, velocity, acceleration, volume_momentum]`
- **Covariance Matrix**: Computed from recent price dynamics
- **Eigendecomposition**: For matrix stability analysis
- **Posterior Distribution**: Conjugate normal-normal Bayesian update
- **Feedback Adjustments**: Nonlinear corrections from multiple signals

### Pattern Detection Algorithm
- Double Top/Bottom: Price peak/trough comparison within tolerance
- Head and Shoulders: Three-peak detection with symmetric shoulders
- Triangles: Trendline slope analysis for convergence patterns

## Files

- `index.html` - Main application HTML
- `script.js` - Chart logic, indicators, pattern detection, forecast
- `style.css` - Responsive styling
- `fetch_data.py` - Python backend for yfinance data
- `requirements.txt` - Python dependencies

## Dependencies

### JavaScript (CDN)
- Plotly.js 2.27.0 - Charting library
- Pako 2.0.4 - Compression/decompression

### Python
- yfinance - Yahoo Finance data API
- pandas - Data manipulation
- numpy - Numerical computing
- requests - HTTP client

## License

MIT License - Free to use and modify.
