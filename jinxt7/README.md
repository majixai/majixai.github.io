Below are all the files in plain text so you can place them exactly where needed.

1) .github/workflows/minute_update.yml
```yaml
name: 1-Minute Chart Generator

on:
  schedule:
    - cron: "*/5 * * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate_html_chart:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Set up Python
        uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install Dependencies
        run: |
          python -m pip install --upgrade pip
          pip install pandas numpy yfinance plotly

      - name: Generate Chart
        run: python generate_chart.py

      - name: Commit and Push Update
        uses: stefanzweifel/git-auto-commit-action@v5
        with:
          commit_message: "Automated chart update [skip ci]"
          file_pattern: index.html
```

2) generate_chart.py
```python
import yfinance as yf
import plotly.graph_objects as go
from datetime import datetime, timezone

TICKER = "AAPL"

def main():
    print(f"Fetching 1m data for {TICKER}...")
    data = yf.Ticker(TICKER).history(period="5d", interval="1m")
    if data.empty:
        raise RuntimeError("No data returned by Yahoo Finance")

    data["SMA_20"] = data["Close"].rolling(20).mean()
    data["SMA_50"] = data["Close"].rolling(50).mean()

    body = (data["Close"] - data["Open"]).abs()
    candle_range = data["High"] - data["Low"]
    prev_open = data["Open"].shift(1)
    prev_close = data["Close"].shift(1)
    is_doji = candle_range.gt(0) & body.le(candle_range * 0.1)
    is_bull_engulfing = (
        prev_close.lt(prev_open)
        & data["Close"].gt(data["Open"])
        & data["Open"].le(prev_close)
        & data["Close"].ge(prev_open)
    )

    fig = go.Figure([
        go.Candlestick(x=data.index, open=data["Open"], high=data["High"], low=data["Low"], close=data["Close"], name="OHLC"),
        go.Scatter(x=data.index, y=data["SMA_20"], name="SMA 20", line={"color": "orange"}),
        go.Scatter(x=data.index, y=data["SMA_50"], name="SMA 50", line={"color": "cyan"}),
        go.Scatter(x=data.index[is_doji], y=data.loc[is_doji, "Low"] - 0.1, mode="markers", name="Doji", marker={"symbol": "triangle-up", "color": "purple", "size": 9}),
        go.Scatter(x=data.index[is_bull_engulfing], y=data.loc[is_bull_engulfing, "Low"] - 0.2, mode="markers", name="Bull Engulfing", marker={"symbol": "star", "color": "gold", "size": 11}),
    ])
    fig.update_layout(title=f"{TICKER} Live 1M Chart", yaxis_title="Price (USD)", xaxis_title="Time", xaxis_rangeslider_visible=False, template="plotly_dark", height=650)

    price = float(data["Close"].iloc[-1])
    sma20 = float(data["SMA_20"].iloc[-1]) if data["SMA_20"].iloc[-1] == data["SMA_20"].iloc[-1] else 0.0
    sma50 = float(data["SMA_50"].iloc[-1]) if data["SMA_50"].iloc[-1] == data["SMA_50"].iloc[-1] else 0.0
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    chart = fig.to_html(full_html=False, include_plotlyjs="cdn")

    html = f'''<!doctype html>
<html lang="en" data-bs-theme="dark"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>{TICKER} Trading Dashboard</title>
<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
<style>body{{background:#0d1117;color:#f0f6fc}}.card{{background:#161b22;border-color:#30363d}}</style>
</head><body><main class="container-fluid py-4">
<div class="d-flex justify-content-between align-items-center mb-4"><div><h1 class="text-primary">{TICKER} Trading Dashboard</h1><p class="text-secondary mb-0">yfinance 1-minute OHLC and pattern recognition</p></div><span class="badge text-bg-secondary">Updated {updated}</span></div>
<div class="row g-3 mb-4"><div class="col-md-3"><div class="card p-3"><small class="text-secondary">Current Price</small><h3 class="text-success">${price:.2f}</h3></div></div><div class="col-md-3"><div class="card p-3"><small class="text-secondary">SMA 20</small><h3>${sma20:.2f}</h3></div></div><div class="col-md-3"><div class="card p-3"><small class="text-secondary">SMA 50</small><h3>${sma50:.2f}</h3></div></div><div class="col-md-3"><div class="card p-3"><small class="text-secondary">Average Range</small><h3>${float((data["High"] - data["Low"]).mean()):.2f}</h3></div></div></div>
<div class="card"><div class="card-body p-0">{chart}</div></div></main></body></html>'''
    with open("index.html", "w", encoding="utf-8") as output:
        output.write(html)
    print("index.html successfully updated")

if __name__ == "__main__":
    main()
```

3) tradingview_pinescript.pine
```pine
//@version=5
indicator("Multi-Timeframe RVOL Webhook Payload", overlay=false)

float threshold = input.float(5.0, "RVOL Trigger")
int baseLookback = input.int(20, "Base Volume MA Lookback", minval=5)

f_rvol(simple string tf, simple int index) =>
    int length = math.max(5, int(baseLookback * (1.5 - index * 0.05)))
    request.security(syminfo.tickerid, tf, nz(volume / ta.sma(volume, length)), barmerge.gaps_off, barmerge.lookahead_off)

float[] values = array.from(f_rvol("1", 0), f_rvol("3", 1), f_rvol("5", 2), f_rvol("15", 3), f_rvol("30", 4), f_rvol("60", 5), f_rvol("120", 6), f_rvol("240", 7), f_rvol("D", 8), f_rvol("W", 9))
string[] frames = array.from("1", "3", "5", "15", "30", "60", "120", "240", "D", "W")

bool triggered = false
string timeframe = ""
float rvol = 0.0
for i = 0 to array.size(values) - 1
    float value = array.get(values, i)
    if not triggered and value >= threshold
        triggered := true
        timeframe := array.get(frames, i)
        rvol := value

if triggered
    string payload = '{"ticker":"' + syminfo.ticker + '","exchange":"' + syminfo.prefix + '","timeframe":"' + timeframe + '","rvol_multiplier":' + str.tostring(rvol, "#.##") + ',"price":' + str.tostring(close, "#.########") + '}'
    alert(payload, alert.freq_once_per_bar)
```

4) README.md
```md
# Trading Dashboard

This repository contains a GitHub Pages dashboard generated by GitHub Actions using Python, yfinance, NumPy/Pandas-compatible calculations, and Plotly.

## Files

- `.github/workflows/minute_update.yml` — scheduled dashboard generation every five minutes
- `generate_chart.py` — downloads 1-minute OHLCV data and writes `index.html`
- `tradingview_pinescript.pine` — multi-timeframe RVOL alert payload generator
- `state.json` — reserved state file for future alert processing

## Pages URL

https://majixai.github.io/majixai.github.io/

## Enable Pages

In Settings → Pages, select Deploy from a branch, choose main, and choose / (root).

## TradingView webhook limitation

TradingView does not provide a shared webhook URL and cannot add GitHub's required Authorization header. Therefore, there is no direct TradingView-to-GitHub webhook URL in this repository.

For a relay, paste the relay's generated HTTPS URL into TradingView's Alert → Notifications → Webhook URL field. The relay must forward to:

https://api.github.com/repos/majixai/majixai.github.io/dispatches

with an authorization token and the repository_dispatch JSON body.
```

5) state.json
```json
{}
```

Important note:
- Use this path: `.github/workflows/minute_update.yml`
- Use this path: `generate_chart.py`
- Use this path: `tradingview_pinescript.pine`
- Use this path: `README.md`
- Use this path: `state.json`

Also, for a real TradingView webhook, the endpoint must be a relay URL, not a direct GitHub URL, because:
- TradingView cannot send custom Authorization headers
- GitHub `repository_dispatch` requires those headers

So the final live webhook pattern is:
- TradingView alert -> relay URL
- relay URL -> https://api.github.com/repos/majixai/majixai.github.io/dispatches
- relay adds the GitHub auth headers

If you want, I can next give you:
- the exact Pipedream relay setup
- the exact Make/Zapier version
- the exact TradingView alert configuration
- a version that writes to `tradingview_integration/` instead of the root
