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
