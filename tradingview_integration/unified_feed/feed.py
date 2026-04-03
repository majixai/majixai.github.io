import asyncio
import concurrent.futures
import gzip
import json
import logging
import os
import sqlite3
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

import numpy as np
import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
log = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parents[3]
SEEDS_DIR = ROOT / "tradingview_integration" / "pine_seeds"
SEEDS_DIR.mkdir(parents=True, exist_ok=True)

DIRS = {
    "sp": ROOT / "sp_closing_projection" / "latest_projection.json",
    "mp": ROOT / "market_prediction" / "latest_prediction.json",
    "yf": ROOT / "yfinance_data" / "yfinance.dat",
    "gf": ROOT / "tradingview_integration" / "data" / "google_finance_quotes.json",
    "gh": ROOT / "github_data" / "level1_csv",
    "idx": ROOT / "index" / "csv",
}

TICKERS = ["spy", "qqq", "dia", "iwm", "aapl", "msft", "nvda", "tsla", "btc-usd"]

SEED_HEADER = "#syminfo.type=index\n#syminfo.currency=usd\n#period=D\ntime,open,high,low,close,volume\n"


def _tolower(v):
    if isinstance(v, str):
        return v.lower()
    if isinstance(v, dict):
        return {_tolower(k): _tolower(vv) for k, vv in v.items()}
    if isinstance(v, list):
        return [_tolower(i) for i in v]
    return v


def _load_json(path):
    try:
        with open(path, "r") as f:
            return _tolower(json.load(f))
    except Exception as e:
        log.warning("json load failed %s: %s", path, e)
        return {}


def _load_yfinance_dat(path, ticker):
    try:
        with gzip.open(path, "rb") as gz:
            raw = gz.read()
        fd, tmp = tempfile.mkstemp(suffix=".db", prefix="uf_yf_")
        try:
            os.write(fd, raw)
            os.close(fd)
            con = sqlite3.connect(tmp)
            df = pd.read_sql_query(
                "select date,open,high,low,close,volume from prices where lower(ticker)=? order by date desc limit 60",
                con,
                params=(ticker.lower(),),
            )
            con.close()
        finally:
            os.unlink(tmp)
        return df
    except Exception as e:
        log.warning("yfinance dat load failed for %s: %s", ticker, e)
        return pd.DataFrame()


def _load_csv_tail(path, n=60):
    try:
        df = pd.read_csv(path)
        df.columns = [c.lower().strip() for c in df.columns]
        return df.tail(n).reset_index(drop=True)
    except Exception as e:
        log.warning("csv load failed %s: %s", path, e)
        return pd.DataFrame()


def _epoch(date_str):
    try:
        dt = pd.to_datetime(str(date_str))
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return int(dt.timestamp())
    except Exception:
        return int(time.time())


async def _fetch_sp(ticker):
    return await asyncio.get_event_loop().run_in_executor(None, _load_json, DIRS["sp"])


async def _fetch_mp(ticker):
    return await asyncio.get_event_loop().run_in_executor(None, _load_json, DIRS["mp"])


async def _fetch_gf(ticker):
    d = await asyncio.get_event_loop().run_in_executor(None, _load_json, DIRS["gf"])
    quotes = d.get("quotes", [])
    for q in quotes:
        if q.get("ticker", "").lower().replace("-", "") == ticker.lower().replace("-", ""):
            return q
    return {}


async def _fetch_yf(ticker):
    return await asyncio.get_event_loop().run_in_executor(
        None, _load_yfinance_dat, DIRS["yf"], ticker
    )


async def _fetch_gh(ticker):
    sym = ticker.upper().replace("-", "") + "_1MO_1D_LITE"
    p = DIRS["gh"] / f"{sym}.csv"
    if not p.exists():
        sym2 = ticker.upper() + "_1mo_1d_lite"
        p = DIRS["gh"] / f"{sym2}.csv"
    return await asyncio.get_event_loop().run_in_executor(None, _load_csv_tail, p, 30)


async def _fetch_idx(ticker):
    sym = ticker.upper().replace("-", "") + "_1m"
    p = DIRS["idx"] / f"{sym}.csv"
    if not p.exists():
        return pd.DataFrame()
    return await asyncio.get_event_loop().run_in_executor(None, _load_csv_tail, p, 390)


def _tensor_agg(ohlcv_df, sp_data, mp_data, gf_data):
    rows = []
    if ohlcv_df.empty:
        return rows

    closes = ohlcv_df["close"].values.astype(float)
    highs = ohlcv_df["high"].values.astype(float) if "high" in ohlcv_df else closes
    lows = ohlcv_df["low"].values.astype(float) if "low" in ohlcv_df else closes
    opens = ohlcv_df["open"].values.astype(float) if "open" in ohlcv_df else closes
    vols = ohlcv_df["volume"].values.astype(float) if "volume" in ohlcv_df else np.ones_like(closes)

    n = len(closes)
    if n < 2:
        return rows

    rets = np.diff(np.log(np.clip(closes, 1e-9, None)))
    vol_20 = np.std(rets[-20:]) * np.sqrt(252) if len(rets) >= 20 else np.std(rets) * np.sqrt(252)

    sp_proj = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("projected_close", closes[-1]))
    sp_res = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("resistance", highs[-1]))
    sp_sup = float(sp_data.get("closing_projection", {}).get("price_targets", {}).get("support", lows[-1]))
    mp_tgt = float(mp_data.get("prediction", {}).get("target_price", closes[-1]))
    mp_res = float(mp_data.get("prediction", {}).get("resistance", highs[-1]))
    mp_sup = float(mp_data.get("prediction", {}).get("support", lows[-1]))

    gf_price = float(gf_data.get("price", closes[-1]) if gf_data else closes[-1])

    avg_range = np.mean(highs[-20:] - lows[-20:]) if n >= 20 else np.mean(highs - lows)

    agg_close_tensor = np.array([sp_proj, mp_tgt, gf_price, closes[-1]])
    agg_high_tensor = np.array([sp_res, mp_res, highs[-1] + avg_range * 0.5])
    agg_low_tensor = np.array([sp_sup, mp_sup, lows[-1] - avg_range * 0.5])

    w_close = np.array([0.35, 0.30, 0.15, 0.20])
    agg_c = float(np.dot(w_close, agg_close_tensor))
    agg_h = float(np.max(agg_high_tensor))
    agg_l = float(np.min(agg_low_tensor))

    bull_score_raw = float(
        (1.0 if sp_data.get("signal", "neutral").lower() == "bullish" else 0.0) * 0.4
        + (1.0 if mp_data.get("prediction", {}).get("signal", "neutral").lower() == "bullish" else 0.0) * 0.4
        + (0.2 if agg_c > closes[-1] else 0.0)
    )
    bull_vol = int(np.clip(bull_score_raw * 1e7, 0, 1e9))

    for i in range(n):
        col_date = ohlcv_df.get("date", ohlcv_df.get("time", ohlcv_df.get("datetime", None)))
        if col_date is None:
            ts = int(time.time()) - (n - 1 - i) * 86400
        else:
            ts = _epoch(ohlcv_df.iloc[i][col_date.name] if hasattr(col_date, "name") else ohlcv_df.index[i])

        if i < n - 1:
            rows.append((ts, opens[i], highs[i], lows[i], closes[i], int(vols[i])))
        else:
            rows.append((ts, opens[i], agg_h, agg_l, agg_c, bull_vol))

    return rows


def _write_seed(ticker, rows):
    sym = "unified_" + ticker.lower().replace("-", "")
    out = SEEDS_DIR / f"{sym.upper()}.csv"
    lines = [SEED_HEADER]
    for r in rows:
        lines.append(",".join(str(x) for x in r) + "\n")
    with open(out, "w") as f:
        f.writelines(lines)
    log.info("wrote seed %s (%d rows)", out.name, len(rows))
    return str(out)


async def process_ticker(ticker):
    tk = ticker.lower()
    sp_task = asyncio.create_task(_fetch_sp(tk))
    mp_task = asyncio.create_task(_fetch_mp(tk))
    gf_task = asyncio.create_task(_fetch_gf(tk))
    yf_task = asyncio.create_task(_fetch_yf(tk))
    gh_task = asyncio.create_task(_fetch_gh(tk))
    idx_task = asyncio.create_task(_fetch_idx(tk))

    sp_data, mp_data, gf_data, yf_df, gh_df, idx_df = await asyncio.gather(
        sp_task, mp_task, gf_task, yf_task, gh_task, idx_task,
        return_exceptions=True,
    )

    sp_data = sp_data if isinstance(sp_data, dict) else {}
    mp_data = mp_data if isinstance(mp_data, dict) else {}
    gf_data = gf_data if isinstance(gf_data, dict) else {}
    yf_df = yf_df if isinstance(yf_df, pd.DataFrame) else pd.DataFrame()
    gh_df = gh_df if isinstance(gh_df, pd.DataFrame) else pd.DataFrame()

    ohlcv = yf_df if not yf_df.empty else gh_df

    if ohlcv.empty:
        log.warning("no ohlcv data for %s", tk)
        return None

    loop = asyncio.get_event_loop()
    rows = await loop.run_in_executor(None, _tensor_agg, ohlcv, sp_data, mp_data, gf_data)
    if not rows:
        return None

    return await loop.run_in_executor(None, _write_seed, tk, rows)


async def run_all():
    log.info("unified feed starting — %d tickers", len(TICKERS))
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        asyncio.get_event_loop().set_default_executor(pool)
        results = await asyncio.gather(*[process_ticker(t) for t in TICKERS], return_exceptions=True)

    ok = [r for r in results if isinstance(r, str)]
    fail = [r for r in results if isinstance(r, Exception)]
    log.info("done — %d ok, %d failed", len(ok), len(fail))
    for f in fail:
        log.error("ticker error: %s", f)

    manifest = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "tickers": [t.lower() for t in TICKERS],
        "seeds": [str(Path(r).name).lower() for r in ok],
        "repo": "majixai/majixai.github.io",
        "seed_prefix": "unified_",
    }
    out = SEEDS_DIR / "manifest.json"
    with open(out, "w") as f:
        json.dump(_tolower(manifest), f, indent=2)
    log.info("manifest written: %s", out)


if __name__ == "__main__":
    asyncio.run(run_all())
