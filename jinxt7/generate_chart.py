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

    fig = go.Figure(
        [
            go.Candlestick(
                x=data.index,
                open=data["Open"],
                high=data["High"],
                low=data["Low"],
                close=data["Close"],
                name="OHLC",
            ),
            go.Scatter(
                x=data.index,
                y=data["SMA_20"],
                name="SMA 20",
                line={"color": "orange"},
            ),
            go.Scatter(
                x=data.index,
                y=data["SMA_50"],
                name="SMA 50",
                line={"color": "cyan"},
            ),
            go.Scatter(
                x=data.index[is_doji],
                y=data.loc[is_doji, "Low"] - 0.1,
                mode="markers",
                name="Doji",
                marker={"symbol": "triangle-up", "color": "purple", "size": 9},
            ),
            go.Scatter(
                x=data.index[is_bull_engulfing],
                y=data.loc[is_bull_engulfing, "Low"] - 0.2,
                mode="markers",
                name="Bull Engulfing",
                marker={"symbol": "star", "color": "gold", "size": 11},
            ),
        ]
    )

    fig.update_layout(
        title=f"{TICKER} Live 1M Chart",
        yaxis_title="Price (USD)",
        xaxis_title="Time",
        xaxis_rangeslider_visible=False,
        template="plotly_dark",
        height=650,
    )

    price = float(data["Close"].iloc[-1])
    sma20 = float(data["SMA_20"].iloc[-1]) if data["SMA_20"].iloc[-1] == data["SMA_20"].iloc[-1] else 0.0
    sma50 = float(data["SMA_50"].iloc[-1]) if data["SMA_50"].iloc[-1] == data["SMA_50"].iloc[-1] else 0.0
    updated = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S UTC")
    chart = fig.to_html(full_html=False, include_plotlyjs="cdn")

    html = f'''<!doctype html>
<html lang="en" data-bs-theme="dark">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{TICKER} Trading Dashboard</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <style>
    body {{ background: #0d1117; color: #f0f6fc; }}
    .card {{ background: #161b22; border-color: #30363d; }}
  </style>
</head>
<body>
  <main class="container-fluid py-4">
    <div class="d-flex justify-content-between align-items-center mb-4">
      <div>
        <h1 class="text-primary">{TICKER} Trading Dashboard</h1>
        <p class="text-secondary mb-0">yfinance 1-minute OHLC and pattern insights</p>
      </div>
      <div class="text-end">
        <small class="text-secondary">Updated</small>
        <div class="fw-semibold">{updated}</div>
      </div>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-md-3">
        <div class="card p-3 h-100">
          <small class="text-secondary">Current Price</small>
          <h3 class="text-success mb-0">${price:.2f}</h3>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card p-3 h-100">
          <small class="text-secondary">SMA 20</small>
          <h3 class="text-info mb-0">${sma20:.2f}</h3>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card p-3 h-100">
          <small class="text-secondary">SMA 50</small>
          <h3 class="text-warning mb-0">${sma50:.2f}</h3>
        </div>
      </div>
      <div class="col-md-3">
        <div class="card p-3 h-100">
          <small class="text-secondary">Pattern</small>
          <h3 class="text-light mb-0">Bullish</h3>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body p-0">
        {chart}
      </div>
    </div>
  </main>
</body>
</html>'''

    with open("index.html", "w", encoding="utf-8") as output:
        output.write(html)

    print("index.html successfully updated")


if __name__ == "__main__":
    main()
