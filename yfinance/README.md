# yfinance

Central directory for all yfinance operations in this repository.

## Purpose

- Provide one place for shared yf operations (`ops.py`).
- Keep existing `import yfinance as yf` code working safely by proxying to the installed third-party package (`__init__.py`).
- Avoid import breakage after introducing the repository-level `yfinance/` directory.
- Implement the **Top-Heavy** reporting pipeline for 1,000+ ticker zone detection and executive-summary generation.

## Module layout

```
yfinance/
├── __init__.py          # Compatibility facade — proxies the third-party yfinance package
├── ops.py               # Shared yfinance wrappers (download, ticker, ticker_history, ticker_info)
├── zones.py             # Vectorised Expansion / Consolidation / Bull-Trigger zone detection
├── report.py            # Top-Heavy Markdown report generator (Sections I–IV)
├── fetch_yfinance.py    # CLI entry point — fetch + classify + write outputs
├── index.html           # Bootstrap dashboard with sticky header & IntersectionObserver lazy-load
└── tests/
    ├── test_zones.py    # Unit tests for zone detection
    └── test_report.py   # Unit tests for report generation
```

## Shared ops (`ops.py`)

| Function | Description |
|---|---|
| `download(...)` | `yfinance.download` with `progress=False` default |
| `ticker(symbol)` | Returns a `yfinance.Ticker` instance |
| `ticker_history(symbol, **kwargs)` | Calls `Ticker.history` |
| `ticker_info(symbol)` | Returns `Ticker.info` dict |

## Zone detection (`zones.py`)

| Zone | Definition |
|---|---|
| **Expansion** | ATR 14-day value has z-score > 2 σ above its own 20-day rolling mean |
| **Consolidation** | 20-day High–Low range is < 1% of current closing price |
| **Bull Trigger** | Ticker is in an Expansion Zone **and** gained > 3% in the last session |

## Top-Heavy CLI (`fetch_yfinance.py`)

```bash
# Process up to 1,500 tickers and write all outputs
python yfinance/fetch_yfinance.py \
    --limit 1500 \
    --output raw_data.dat \
    --summary summary.txt \
    --report forecast_report.md

# Dry-run from a previously saved .dat snapshot
python yfinance/fetch_yfinance.py \
    --no-fetch \
    --dat-in raw_data.dat \
    --report forecast_report.md
```

Exit code `2` when Bull Triggers are detected (useful in shell scripts):

```bash
python yfinance/fetch_yfinance.py --limit 1500 --summary summary.txt --report forecast_report.md
BULL_COUNT=$(grep -c "BULL_TRIGGER" summary.txt || true)
if [ "$BULL_COUNT" -gt 0 ]; then
  echo "Bull Triggers detected"
fi
```

## Report structure

| Section | Content |
|---|---|
| **I. Key Projections** | Bayesian S&P 500 & BTC 24h forecast |
| **II. Zones** | Top-5 Expansion & Consolidation tickers |
| **III. Bull Triggers** | Tickers with high-conviction buy signals |
| **IV. Data Bulk** | 1,000+ ticker snapshot table (collapsible) |

## Dashboard (`index.html`)

- **Sticky header** — KPI badges (S&P forecast, BTC forecast, zone counts) always visible.
- **Bootstrap 5** dark theme with `table-sm` for compact rendering on mobile (375 px).
- **IntersectionObserver** lazy-loading for the 1,000+ row bulk table — only renders rows near the viewport.
- Loads `summary.json` (written by the pipeline) automatically on page load.

## Running tests

```bash
python -m unittest yfinance/tests/test_zones.py
python -m unittest yfinance/tests/test_report.py
```

