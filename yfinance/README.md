# yfinance

Central directory for repository yfinance operations.

## Purpose

- Provide one place for shared yf operations (`yfinance/ops.py`).
- Keep existing `import yfinance as yf` code working safely by proxying to the installed third-party package (`yfinance/__init__.py`).
- Avoid import breakage after introducing the repository-level `yfinance/` directory.

## Shared ops

- `download(...)`
- `ticker(symbol)`
- `ticker_history(symbol, **kwargs)`
- `ticker_info(symbol)`

