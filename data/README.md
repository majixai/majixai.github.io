# Financial Data Store

This directory contains pre-generated `.dat` files with historical OHLCV data
(Open, High, Low, Close, Volume) for over 155 financial instruments.

## Structure

```
data/
├── manifest.json       – index of all available .dat files
├── indices/            – 30 files: major stock market indices & ETFs
├── fortune500/         – 92 files: Fortune 500 companies (top by market cap)
└── crypto/             – 34 files: top cryptocurrencies & crypto ETFs
```

## File Format

Each `.dat` file is UTF-8 JSON with the following structure:

```json
{
  "ticker":       "SPY",
  "name":         "SPDR S&P 500 ETF Trust",
  "category":     "index",
  "currency":     "USD",
  "last_updated": "2026-04-08T22:00:00Z",
  "record_count": 528,
  "meta":         {},
  "ohlcv": [
    { "date": "2024-04-01", "open": 521.0, "high": 523.5, "low": 520.1, "close": 522.8, "volume": 80000000 },
    ...
  ]
}
```

## Indices Covered

SPY, QQQ, DIA, IWM, GLD, SLV, TLT, AGG, XLE, XLF, XLK, XLV, SMH, ARKK,
EEM, EFA, VNQ, ^FTSE, ^N225, ^GDAXI, ^FCHI, ^BVSP, ^NSEI, ^GSPTSE, ^AXJO,
^KS11, ^HSI, ^STOXX50E, ^RUT, ^VIX

## Fortune 500 Companies Covered (sample)

Technology: AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA, AVGO, ORCL, CRM, AMD,
INTC, CSCO, QCOM, TXN, IBM, ADBE, NOW, INTU, PLTR, SNOW, CRWD, NET, PANW

Financials: JPM, BAC, WFC, GS, MS, BLK, V, MA, AXP, SCHW, C, SPGI, CME, ICE

Healthcare: JNJ, LLY, UNH, ABBV, MRK, PFE, TMO, ABT, AMGN, GILD, VRTX,
REGN, ISRG

Consumer: WMT, PG, KO, PEP, MCD, SBUX, NKE, HD, LOW, COST, TGT, DIS,
NFLX, CMCSA

Energy: XOM, CVX, COP, SLB, OXY

Industrials: BA, CAT, GE, HON, UPS, FDX, RTX, LMT, NOC, DE, MMM

Telecom: T, VZ, TMUS · Real Estate: AMT, PLD · Utilities: NEE, DUK
Materials: LIN, SHW, NEM, FCX

## Cryptocurrencies Covered

BTC-USD, ETH-USD, BNB-USD, SOL-USD, XRP-USD, DOGE-USD, ADA-USD, AVAX-USD,
DOT-USD, LINK-USD, LTC-USD, BCH-USD, ALGO-USD, XLM-USD, HBAR-USD, FIL-USD,
VET-USD, NEAR-USD, ATOM-USD, APT-USD, ARB-USD, OP-USD, INJ-USD, SUI-USD,
ICP-USD, TON-USD, SHIB-USD, MATIC-USD, UNI-USD

Crypto ETFs/Trusts: GBTC, ETHE, BITO, IBIT, FBTC

## Updating the Data

Data is automatically refreshed daily (weekdays after US market close) via
GitHub Actions:

```
.github/workflows/financial_data_update.yml
```

To manually trigger an update, run:

```bash
python scripts/generate_financial_data.py --period 2y
```

Requires: `pip install yfinance pandas`

## Consuming the Data

### JavaScript / Browser

```js
const res = await fetch('/data/manifest.json');
const manifest = await res.json();

// Load a specific ticker
const spy = await fetch('/data/indices/spy.dat').then(r => r.json());
const prices = spy.ohlcv;   // [{date, open, high, low, close, volume}, ...]
```

### Python

```python
import json, pathlib
data = json.loads(pathlib.Path('data/crypto/btc_usd.dat').read_text())
df = pd.DataFrame(data['ohlcv'])
```
