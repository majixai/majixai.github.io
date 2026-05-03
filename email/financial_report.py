#!/usr/bin/env python3
"""
financial_report.py — MajixAI Financial Email Report Builder
=============================================================
Builds HTML financial-report payloads used by send_email.py.

Report modes
------------
  weekday_open   — 6 AM  : Pre-market bull screener for stocks & crypto,
                            today + 3-day forecast, most-bullish at open.
  weekday_9am    — 9 AM  : Refreshed bull list + indices 1-PM projection.
  weekday_10am   — 10 AM : Mid-morning snapshot, indices + top movers.
  weekday_1pm    — 1 PM  : Indices 1 PM close summary + afternoon outlook.
  weekend        — Sat/Sun 9 AM & 10 PM : Full weekly digest.

Advanced metrics used
---------------------
  - ATR z-score expansion zones      (yfinance/zones.py)
  - Bull triggers (Expansion + ≥3%)  (yfinance/zones.py)
  - Bayesian GBM 1/3-day forecast    (yfinance/fetch_yfinance.py pattern)
  - OU mean-reversion speed (κ)      (yfinance/zones.py stochastic_drift)
  - Higuchi fractal dimension        (yfinance/zones.py fractal_*)
  - Discrete vector-curl score       (yfinance/zones.py vector_field)
  - RSI, MACD, Bollinger Bands       (computed inline)
  - Monte Carlo 1-day CI             (inline GBM simulation)

Charts
------
  Links to GitHub Pages chart URLs in yfinance_chart/ and dji_monte_carlo/.
"""

from __future__ import annotations

import json
import math
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

try:
    import pandas as pd
    import yfinance as yf
    _HAS_YF = True
except ImportError:
    _HAS_YF = False

# ── Repository root on sys.path ───────────────────────────────────────────────
_HERE = Path(__file__).resolve().parent
_REPO = _HERE.parent
if str(_REPO) not in sys.path:
    sys.path.insert(0, str(_REPO))

# ── Try importing repo modules ────────────────────────────────────────────────
try:
    from yfinance.zones import classify_ticker, ZoneResult, ZoneSummary, classify_many
    from yfinance.report import build_report
    _HAS_ZONES = True
except ImportError:
    _HAS_ZONES = False

# ── GitHub Pages base URL ─────────────────────────────────────────────────────
REPO_PAGES_BASE = "https://majixai.github.io/majixai.github.io"
REPO_RAW_BASE   = "https://raw.githubusercontent.com/majixai/majixai.github.io/main"

# ── Ticker universe ───────────────────────────────────────────────────────────
INDEX_TICKERS = ["^GSPC", "^DJI", "^IXIC", "^RUT", "^VIX"]
CRYPTO_TICKERS = [
    "BTC-USD", "ETH-USD", "BNB-USD", "SOL-USD", "XRP-USD",
    "ADA-USD", "DOGE-USD", "AVAX-USD", "DOT-USD", "MATIC-USD",
]
BULL_STOCK_UNIVERSE = [
    "NVDA", "TSLA", "META", "AAPL", "MSFT", "AMZN", "GOOGL", "AMD",
    "PLTR", "SMCI", "ARM", "SNOW", "CRWD", "NET", "PANW", "MSTR",
    "COIN", "HOOD", "SOFI", "RBLX", "RIVN", "LCID", "NIO", "XPEV",
    "GME", "AMC", "BBBY", "SNDL", "CLOV", "BBAI", "IONQ", "RGTI",
]

# ── HTML colour palette ───────────────────────────────────────────────────────
BULL_COLOR   = "#00c853"
BEAR_COLOR   = "#d50000"
NEUTRAL_COLOR = "#ff6f00"
HEADER_BG    = "#0d1117"
CARD_BG      = "#161b22"
TEXT_COLOR   = "#e6edf3"
MUTED_COLOR  = "#8b949e"
ACCENT_COLOR = "#58a6ff"


# ─────────────────────────────────────────────────────────────────────────────
# Math helpers
# ─────────────────────────────────────────────────────────────────────────────

def _safe_pct(val: Optional[float]) -> str:
    """Format float as percentage string."""
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return "—"
    sign = "+" if val >= 0 else ""
    return f"{sign}{val:.2f}%"


def _format_forecast_pct(forecast: Dict[str, Any]) -> str:
    """Format a forecast dict's expected % change as a signed string."""
    if not forecast:
        return "—"
    pct = forecast.get("pct_change_expected", float("nan"))
    if isinstance(pct, float) and math.isnan(pct):
        return "—"
    sign = "+" if pct >= 0 else ""
    return f"{sign}{pct:.2f}%"


def _colour(val: float) -> str:
    if val is None or (isinstance(val, float) and math.isnan(val)):
        return MUTED_COLOR
    return BULL_COLOR if val >= 0 else BEAR_COLOR


def _rsi(closes: "pd.Series", period: int = 14) -> float:
    """Wilder RSI."""
    if not _HAS_YF or len(closes) < period + 1:
        return float("nan")
    delta = closes.diff().dropna()
    up = delta.clip(lower=0)
    dn = (-delta).clip(lower=0)
    rs = up.ewm(alpha=1 / period, adjust=False).mean() / (
        dn.ewm(alpha=1 / period, adjust=False).mean() + 1e-12
    )
    rsi_series = 100 - 100 / (1 + rs)
    return float(rsi_series.iloc[-1])


def _macd(closes: "pd.Series") -> Tuple[float, float]:
    """Return (MACD line, signal line) last values."""
    if not _HAS_YF or len(closes) < 26:
        return float("nan"), float("nan")
    ema12 = closes.ewm(span=12, adjust=False).mean()
    ema26 = closes.ewm(span=26, adjust=False).mean()
    macd_line = ema12 - ema26
    signal    = macd_line.ewm(span=9, adjust=False).mean()
    return float(macd_line.iloc[-1]), float(signal.iloc[-1])


def _bollinger(closes: "pd.Series", window: int = 20) -> Tuple[float, float, float]:
    """Return (upper, mid, lower) Bollinger bands."""
    if not _HAS_YF or len(closes) < window:
        return float("nan"), float("nan"), float("nan")
    mid   = closes.rolling(window).mean()
    std   = closes.rolling(window).std(ddof=1)
    upper = mid + 2 * std
    lower = mid - 2 * std
    return float(upper.iloc[-1]), float(mid.iloc[-1]), float(lower.iloc[-1])


def _gbm_forecast(closes: "pd.Series", days: int = 3, simulations: int = 2000
                  ) -> Dict[str, float]:
    """
    GBM Monte Carlo forecast for *days* trading days.
    Returns dict with keys: mu, sigma, p50, ci_lo, ci_hi, pct_change_expected.
    """
    if not _HAS_YF or len(closes) < 20:
        return {}
    log_ret = np.log(closes / closes.shift(1)).dropna()
    mu      = float(log_ret.mean())
    sigma   = float(log_ret.std(ddof=1))
    s0      = float(closes.iloc[-1])
    dt      = 1.0
    rng     = np.random.default_rng(42)
    z       = rng.standard_normal((simulations, days))
    paths   = s0 * np.exp(np.cumsum((mu - 0.5 * sigma**2) * dt + sigma * np.sqrt(dt) * z, axis=1))
    final   = paths[:, -1]
    return {
        "s0": s0,
        "mu_daily": mu,
        "sigma_daily": sigma,
        "p50": float(np.percentile(final, 50)),
        "ci_lo": float(np.percentile(final, 5)),
        "ci_hi": float(np.percentile(final, 95)),
        "pct_change_expected": float((np.percentile(final, 50) / s0 - 1) * 100),
    }


def _ou_kappa(closes: "pd.Series", window: int = 30) -> float:
    """
    Estimate Ornstein-Uhlenbeck mean-reversion speed κ via OLS on AR(1).
    κ ≈ -log(AR1 coefficient).
    """
    if not _HAS_YF or len(closes) < window + 1:
        return float("nan")
    s = closes.iloc[-window:].values
    x = s[:-1]
    y = s[1:]
    if x.std() < 1e-12:
        return float("nan")
    beta = float(np.cov(x, y)[0, 1] / np.var(x))
    kappa = -math.log(max(abs(beta), 1e-12))
    return round(kappa, 6)


def _higuchi_fd(closes: "pd.Series", k_max: int = 8) -> float:
    """Higuchi fractal dimension of the price series."""
    if not _HAS_YF or len(closes) < 2 * k_max:
        return float("nan")
    x = closes.values.astype(float)
    N = len(x)
    L_k = []
    ks  = []
    for k in range(1, k_max + 1):
        lengths = []
        for m in range(1, k + 1):
            idx = np.arange(m - 1, N, k)
            if len(idx) < 2:
                continue
            segment = x[idx]
            lm = np.sum(np.abs(np.diff(segment))) * (N - 1) / (k * (len(segment) - 1))
            lengths.append(lm)
        if lengths:
            L_k.append(np.mean(lengths))
            ks.append(k)
    if len(ks) < 2:
        return float("nan")
    log_k  = np.log(np.array(ks, dtype=float))
    log_Lk = np.log(np.array(L_k, dtype=float))
    slope, _ = np.polyfit(log_k, log_Lk, 1)
    return round(-slope, 4)


# ─────────────────────────────────────────────────────────────────────────────
# Data fetch helpers
# ─────────────────────────────────────────────────────────────────────────────

def _fetch_snapshot(tickers: List[str], period: str = "5d", interval: str = "1d"
                    ) -> Dict[str, Any]:
    """
    Fetch OHLCV for a list of tickers and return a dict of ticker → metrics.
    Gracefully degrades to empty metrics when yfinance is unavailable.
    """
    if not _HAS_YF:
        return {t: {} for t in tickers}

    import yfinance as yf

    result: Dict[str, Any] = {}
    try:
        raw = yf.download(
            tickers=tickers,
            period=period,
            interval=interval,
            group_by="ticker",
            auto_adjust=True,
            progress=False,
            timeout=45,
        )
    except Exception:
        return {t: {} for t in tickers}

    for tkr in tickers:
        try:
            if isinstance(raw.columns, pd.MultiIndex):
                df = raw.xs(tkr, level=1, axis=1, drop_level=True)
            else:
                df = raw if len(tickers) == 1 else pd.DataFrame()
            if df is None or df.empty:
                result[tkr] = {}
                continue
            closes = df["Close"].dropna()
            if closes.empty:
                result[tkr] = {}
                continue
            last     = float(closes.iloc[-1])
            prev     = float(closes.iloc[-2]) if len(closes) >= 2 else last
            chg_pct  = (last / prev - 1) * 100 if prev else 0.0
            vol      = float(df["Volume"].dropna().iloc[-1]) if "Volume" in df else float("nan")
            hi       = float(df["High"].dropna().iloc[-1])  if "High"   in df else float("nan")
            lo       = float(df["Low"].dropna().iloc[-1])   if "Low"    in df else float("nan")
            rsi_val  = _rsi(closes)
            macd_line, macd_sig = _macd(closes)
            bb_up, bb_mid, bb_lo = _bollinger(closes)
            forecast_1d = _gbm_forecast(closes, days=1)
            forecast_3d = _gbm_forecast(closes, days=3)
            kappa       = _ou_kappa(closes)
            hfd         = _higuchi_fd(closes)
            result[tkr] = {
                "last": last, "prev": prev, "chg_pct": chg_pct,
                "volume": vol, "high": hi, "low": lo,
                "rsi": rsi_val, "macd": macd_line, "macd_signal": macd_sig,
                "bb_upper": bb_up, "bb_mid": bb_mid, "bb_lower": bb_lo,
                "forecast_1d": forecast_1d, "forecast_3d": forecast_3d,
                "ou_kappa": kappa, "higuchi_fd": hfd,
            }
        except Exception:
            result[tkr] = {}

    return result


def _fetch_bull_screener(universe: List[str], top_n: int = 10) -> List[Dict[str, Any]]:
    """
    Return the top *top_n* most bullish tickers by percent change,
    combining zone analysis when available.
    """
    snaps = _fetch_snapshot(universe, period="5d")
    rows  = []
    for tkr, m in snaps.items():
        if not m:
            continue
        chg = m.get("chg_pct", float("nan"))
        if math.isnan(chg):
            continue
        bull_score = chg  # base score = today's % change
        # Boost by RSI > 60 (momentum confirmation)
        rsi = m.get("rsi", float("nan"))
        if not math.isnan(rsi) and rsi > 60:
            bull_score += (rsi - 60) * 0.1
        # Boost by MACD crossover
        macd_v, macd_s = m.get("macd", float("nan")), m.get("macd_signal", float("nan"))
        if not (math.isnan(macd_v) or math.isnan(macd_s)) and macd_v > macd_s:
            bull_score += 0.5
        # Boost by OU low kappa → trending (not mean-reverting)
        kappa = m.get("ou_kappa", float("nan"))
        if not math.isnan(kappa) and kappa < 0.1:
            bull_score += 0.3
        m["ticker"]     = tkr
        m["bull_score"] = round(bull_score, 4)
        rows.append(m)

    rows.sort(key=lambda r: r["bull_score"], reverse=True)
    return rows[:top_n]


# ─────────────────────────────────────────────────────────────────────────────
# HTML building blocks
# ─────────────────────────────────────────────────────────────────────────────

_BASE_CSS = f"""
  body {{ margin:0; padding:0; background:{HEADER_BG}; color:{TEXT_COLOR};
          font-family: 'Segoe UI', Arial, sans-serif; font-size:14px; }}
  .wrap {{ max-width:900px; margin:0 auto; padding:20px; }}
  h1 {{ color:{ACCENT_COLOR}; font-size:22px; margin-bottom:4px; }}
  h2 {{ color:{ACCENT_COLOR}; font-size:16px; margin:20px 0 8px; border-bottom:1px solid #30363d; padding-bottom:4px; }}
  h3 {{ color:{MUTED_COLOR}; font-size:13px; margin:12px 0 4px; text-transform:uppercase; letter-spacing:1px; }}
  .sub {{ color:{MUTED_COLOR}; font-size:12px; margin-bottom:16px; }}
  table {{ width:100%; border-collapse:collapse; margin-bottom:16px; }}
  th {{ background:#21262d; color:{MUTED_COLOR}; font-size:11px; text-transform:uppercase;
        padding:6px 10px; text-align:left; letter-spacing:0.5px; }}
  td {{ padding:6px 10px; border-bottom:1px solid #21262d; font-size:13px; }}
  tr:hover td {{ background:#1c2128; }}
  .bull {{ color:{BULL_COLOR}; font-weight:600; }}
  .bear {{ color:{BEAR_COLOR}; font-weight:600; }}
  .neutral {{ color:{NEUTRAL_COLOR}; font-weight:600; }}
  .card {{ background:{CARD_BG}; border:1px solid #30363d; border-radius:8px;
           padding:14px 18px; margin-bottom:14px; }}
  .badge {{ display:inline-block; padding:2px 8px; border-radius:12px; font-size:11px;
            font-weight:600; margin-left:6px; }}
  .badge-bull {{ background:#003d1a; color:{BULL_COLOR}; }}
  .badge-bear {{ background:#3d0000; color:{BEAR_COLOR}; }}
  .metric-row {{ display:flex; flex-wrap:wrap; gap:10px; margin:8px 0; }}
  .metric {{ background:#21262d; border-radius:6px; padding:8px 14px; min-width:120px; }}
  .metric-label {{ color:{MUTED_COLOR}; font-size:11px; }}
  .metric-value {{ font-size:16px; font-weight:700; margin-top:2px; }}
  a {{ color:{ACCENT_COLOR}; text-decoration:none; }}
  a:hover {{ text-decoration:underline; }}
  .chart-link {{ font-size:12px; color:{MUTED_COLOR}; }}
  footer {{ color:{MUTED_COLOR}; font-size:11px; margin-top:30px; border-top:1px solid #21262d;
            padding-top:12px; }}
"""


def _html_header(title: str, subtitle: str, ts: str) -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>{title}</title>
<style>{_BASE_CSS}</style>
</head>
<body>
<div class="wrap">
<h1>📈 {title}</h1>
<div class="sub">{subtitle} &nbsp;|&nbsp; Generated: {ts}</div>
"""


def _html_footer() -> str:
    return f"""
<footer>
  <p>MajixAI Financial Reports &nbsp;·&nbsp;
     <a href="{REPO_PAGES_BASE}/yfinance/index.html">Live Dashboard</a> &nbsp;·&nbsp;
     <a href="{REPO_PAGES_BASE}/yfinance_chart/index.html">Charts</a> &nbsp;·&nbsp;
     <a href="{REPO_PAGES_BASE}/sp_closing_projection/latest_projection.json">Latest Projection JSON</a>
  </p>
  <p style="margin-top:6px;">
    <em>Not financial advice. All data sourced from Yahoo Finance via yfinance.</em>
  </p>
</footer>
</div>
</body>
</html>"""


def _ticker_color_class(chg: float) -> str:
    if math.isnan(chg):
        return ""
    return "bull" if chg >= 0 else "bear"


def _bull_table(rows: List[Dict[str, Any]], title: str = "🚀 Most Bullish Tickers") -> str:
    if not rows:
        return f"<div class='card'><h2>{title}</h2><p>No data available.</p></div>"
    html = f"<div class='card'><h2>{title}</h2>"
    html += "<table><thead><tr>"
    html += "<th>Ticker</th><th>Last</th><th>Chg%</th><th>RSI</th><th>MACD ×</th>"
    html += "<th>BB Position</th><th>OU κ</th><th>Higuchi FD</th><th>Bull Score</th>"
    html += "<th>1-Day Forecast</th><th>3-Day Forecast</th></tr></thead><tbody>"
    for r in rows:
        tkr  = r.get("ticker", "?")
        last = r.get("last", float("nan"))
        chg  = r.get("chg_pct", float("nan"))
        rsi  = r.get("rsi", float("nan"))
        macd_v = r.get("macd", float("nan"))
        macd_s = r.get("macd_signal", float("nan"))
        bb_up  = r.get("bb_upper", float("nan"))
        bb_lo  = r.get("bb_lower", float("nan"))
        bb_mid = r.get("bb_mid", float("nan"))
        kappa  = r.get("ou_kappa", float("nan"))
        hfd    = r.get("higuchi_fd", float("nan"))
        score  = r.get("bull_score", float("nan"))

        # BB position: where last price sits in band (0=at lower, 100=at upper)
        bb_pos = "—"
        if not (math.isnan(bb_up) or math.isnan(bb_lo) or math.isnan(last)):
            rng = bb_up - bb_lo
            if rng > 0:
                pct_in_band = (last - bb_lo) / rng * 100
                bb_pos = f"{pct_in_band:.0f}%"

        macd_cross = "✓" if not (math.isnan(macd_v) or math.isnan(macd_s)) and macd_v > macd_s else "—"

        f1d = r.get("forecast_1d", {})
        f3d = r.get("forecast_3d", {})
        f1d_str = _format_forecast_pct(f1d)
        f3d_str = _format_forecast_pct(f3d)
        f1d_ci  = f"[{f1d['ci_lo']:,.2f}–{f1d['ci_hi']:,.2f}]" if f1d else "—"
        f3d_ci  = f"[{f3d['ci_lo']:,.2f}–{f3d['ci_hi']:,.2f}]" if f3d else "—"

        cc = _ticker_color_class(chg)
        html += f"""<tr>
          <td><strong>{tkr}</strong></td>
          <td>${last:,.2f}</td>
          <td class="{cc}">{_safe_pct(chg)}</td>
          <td class="{'bull' if not math.isnan(rsi) and rsi > 60 else ''}">{rsi:.1f if not math.isnan(rsi) else '—'}</td>
          <td class="{'bull' if macd_cross=='✓' else ''}">{macd_cross}</td>
          <td>{bb_pos}</td>
          <td>{kappa:.4f if not math.isnan(kappa) else '—'}</td>
          <td>{hfd:.4f if not math.isnan(hfd) else '—'}</td>
          <td class="{'bull' if not math.isnan(score) and score > 2 else ''}">{score:.2f if not math.isnan(score) else '—'}</td>
          <td class="{'bull' if f1d.get('pct_change_expected',0)>=0 else 'bear'}">{f1d_str if f1d else '—'} <small>{f1d_ci}</small></td>
          <td class="{'bull' if f3d.get('pct_change_expected',0)>=0 else 'bear'}">{f3d_str if f3d else '—'} <small>{f3d_ci}</small></td>
        </tr>"""
    html += "</tbody></table></div>"
    return html


def _index_table(snaps: Dict[str, Any], title: str = "📊 Major Indices") -> str:
    html = f"<div class='card'><h2>{title}</h2>"
    html += "<table><thead><tr>"
    html += "<th>Index</th><th>Last</th><th>Chg%</th><th>High</th><th>Low</th>"
    html += "<th>RSI</th><th>1-Day GBM Forecast (p50, 90% CI)</th>"
    html += "</tr></thead><tbody>"
    labels = {
        "^GSPC": "S&P 500", "^DJI": "Dow Jones", "^IXIC": "NASDAQ",
        "^RUT": "Russell 2000", "^VIX": "VIX",
    }
    for tkr in INDEX_TICKERS:
        m   = snaps.get(tkr, {})
        lbl = labels.get(tkr, tkr)
        if not m:
            html += f"<tr><td>{lbl}</td><td colspan='6' style='color:{MUTED_COLOR}'>No data</td></tr>"
            continue
        last = m.get("last", float("nan"))
        chg  = m.get("chg_pct", float("nan"))
        hi   = m.get("high", float("nan"))
        lo   = m.get("low", float("nan"))
        rsi  = m.get("rsi", float("nan"))
        f1d  = m.get("forecast_1d", {})
        p50  = f1d.get("p50", float("nan"))
        ci_lo, ci_hi = f1d.get("ci_lo", float("nan")), f1d.get("ci_hi", float("nan"))
        fc_str = (f"{p50:,.2f} [{ci_lo:,.2f}–{ci_hi:,.2f}]"
                  if not math.isnan(p50) else "—")
        cc = _ticker_color_class(chg)
        html += f"""<tr>
          <td><strong>{lbl}</strong> <small style="color:{MUTED_COLOR}">{tkr}</small></td>
          <td>{last:,.2f if not math.isnan(last) else '—'}</td>
          <td class="{cc}">{_safe_pct(chg)}</td>
          <td>{hi:,.2f if not math.isnan(hi) else '—'}</td>
          <td>{lo:,.2f if not math.isnan(lo) else '—'}</td>
          <td class="{'bull' if not math.isnan(rsi) and rsi > 55 else ''}">{rsi:.1f if not math.isnan(rsi) else '—'}</td>
          <td class="{'bull' if f1d.get('pct_change_expected',0)>=0 else 'bear'}">{fc_str}</td>
        </tr>"""
    html += "</tbody></table>"
    # Chart links
    html += f"""
      <p class="chart-link">
        🔗 Charts:
        <a href="{REPO_PAGES_BASE}/dji_1pm_close/dji_1pm_prediction.png">DJI 1PM Prediction</a> &nbsp;·&nbsp;
        <a href="{REPO_PAGES_BASE}/dji_monte_carlo/dji_simulation_output.png">DJI Monte Carlo</a> &nbsp;·&nbsp;
        <a href="{REPO_PAGES_BASE}/sp_closing_projection/sp_closing_projection_output.png">S&P 500 Closing Projection</a> &nbsp;·&nbsp;
        <a href="{REPO_PAGES_BASE}/yfinance_chart/index.html">Interactive Charts</a>
      </p>
    </div>"""
    return html


def _crypto_table(snaps: Dict[str, Any]) -> str:
    html = "<div class='card'><h2>₿ Crypto Snapshot</h2>"
    html += "<table><thead><tr>"
    html += "<th>Coin</th><th>Last</th><th>Chg%</th><th>RSI</th>"
    html += "<th>OU κ (mean-reversion)</th><th>Higuchi FD</th>"
    html += "<th>1-Day Forecast</th><th>3-Day Forecast</th></tr></thead><tbody>"
    for tkr in CRYPTO_TICKERS:
        m = snaps.get(tkr, {})
        if not m:
            html += f"<tr><td>{tkr}</td><td colspan='7' style='color:{MUTED_COLOR}'>No data</td></tr>"
            continue
        last  = m.get("last", float("nan"))
        chg   = m.get("chg_pct", float("nan"))
        rsi   = m.get("rsi", float("nan"))
        kappa = m.get("ou_kappa", float("nan"))
        hfd   = m.get("higuchi_fd", float("nan"))
        f1d   = m.get("forecast_1d", {})
        f3d   = m.get("forecast_3d", {})
        f1d_str = _format_forecast_pct(f1d)
        f3d_str = _format_forecast_pct(f3d)
        cc = _ticker_color_class(chg)
        html += f"""<tr>
          <td><strong>{tkr.replace('-USD','')}</strong></td>
          <td>${last:,.2f if not math.isnan(last) else '—'}</td>
          <td class="{cc}">{_safe_pct(chg)}</td>
          <td>{rsi:.1f if not math.isnan(rsi) else '—'}</td>
          <td>{kappa:.4f if not math.isnan(kappa) else '—'}</td>
          <td>{hfd:.4f if not math.isnan(hfd) else '—'}</td>
          <td class="{'bull' if f1d.get('pct_change_expected',0)>=0 else 'bear'}">{f1d_str}</td>
          <td class="{'bull' if f3d.get('pct_change_expected',0)>=0 else 'bear'}">{f3d_str}</td>
        </tr>"""
    html += "</tbody></table></div>"
    return html


def _weekly_summary_section(index_snaps: Dict[str, Any],
                             bull_stocks: List[Dict[str, Any]],
                             bull_crypto: List[Dict[str, Any]]) -> str:
    html = "<div class='card'><h2>📅 Weekly Market Summary</h2>"
    # Build short performance bar
    for tkr, label in [("^GSPC","S&P 500"),("^DJI","DOW"),("^IXIC","NASDAQ"),("BTC-USD","BTC")]:
        snaps = {**index_snaps, **{r["ticker"]: r for r in bull_crypto if r.get("ticker") == tkr}}
        m     = index_snaps.get(tkr) or snaps.get(tkr, {})
        chg   = m.get("chg_pct", float("nan")) if m else float("nan")
        color = _colour(chg)
        bar   = "█" * min(int(abs(chg) * 2), 20) if not math.isnan(chg) else ""
        sign  = "+" if not math.isnan(chg) and chg >= 0 else ""
        html += f"""<div style="margin:4px 0;">
          <span style="display:inline-block;width:100px;color:{MUTED_COLOR}">{label}</span>
          <span style="color:{color}">{bar} {sign}{chg:.2f}%</span>
        </div>"""
    html += "<br>"
    # Top bull stocks
    if bull_stocks:
        html += "<h3>Top Bull Stocks (Week)</h3><ul style='padding-left:20px'>"
        for r in bull_stocks[:5]:
            tkr  = r.get("ticker","?")
            chg  = r.get("chg_pct", float("nan"))
            html += f"<li><strong>{tkr}</strong> <span class='bull'>{_safe_pct(chg)}</span></li>"
        html += "</ul>"
    if bull_crypto:
        html += "<h3>Top Bull Crypto (Week)</h3><ul style='padding-left:20px'>"
        for r in bull_crypto[:5]:
            tkr  = r.get("ticker","?").replace("-USD","")
            chg  = r.get("chg_pct", float("nan"))
            html += f"<li><strong>{tkr}</strong> <span class='bull'>{_safe_pct(chg)}</span></li>"
        html += "</ul>"
    html += "</div>"
    return html


# ─────────────────────────────────────────────────────────────────────────────
# Report entry points
# ─────────────────────────────────────────────────────────────────────────────

def build_weekday_open_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    6 AM weekday report.
    Subject: "🌅 Pre-Market Bull Alert — {date}"
    Returns (subject, html_body).
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")
    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=12)
    bull_crypto = _fetch_bull_screener(CRYPTO_TICKERS, top_n=6)

    subject = f"🌅 Pre-Market Bull Alert — {date_str}"
    html  = _html_header("Pre-Market Bull Alert", f"Most bullish stocks & crypto at open · {date_str}", ts)
    html += _index_table(index_snaps, title="📊 Pre-Market Indices Snapshot")
    html += _bull_table(bull_stocks, title="🚀 Most Bullish Stocks at Open (6 AM)")
    html += _crypto_table(
        {r["ticker"]: r for r in bull_crypto}
    )
    html += _html_footer()
    return subject, html


def build_weekday_9am_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """9 AM: refreshed bull list + 1-day + 3-day forecasts."""
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")
    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=10)
    bull_crypto = _fetch_bull_screener(CRYPTO_TICKERS, top_n=6)

    subject = f"📊 9 AM Market Snapshot — {date_str}"
    html  = _html_header("9 AM Market Snapshot", f"Live open + 1 & 3-day forecasts · {date_str}", ts)
    html += _index_table(index_snaps)
    html += _bull_table(bull_stocks, title="🚀 Top Bull Stocks (1-Day & 3-Day GBM Forecast)")
    html += _crypto_table(
        {r["ticker"]: r for r in bull_crypto}
    )
    html += _html_footer()
    return subject, html


def build_weekday_10am_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """10 AM: mid-morning snapshot, indices + top movers."""
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")
    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=8)

    subject = f"🔔 10 AM Mid-Morning Report — {date_str}"
    html  = _html_header("10 AM Mid-Morning Report", f"Mid-morning movers & indices · {date_str}", ts)
    html += _index_table(index_snaps)
    html += _bull_table(bull_stocks, title="📈 Mid-Morning Top Movers")
    html += _html_footer()
    return subject, html


def build_weekday_1pm_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """1 PM: indices 1 PM close summary + afternoon outlook."""
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")
    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=8)

    # Try to load latest DJI / S&P projection JSON from repo
    proj_html = ""
    proj_file = _REPO / "sp_closing_projection" / "latest_projection.json"
    if proj_file.exists():
        try:
            proj = json.loads(proj_file.read_text())
            proj_html = f"""<div class='card'>
              <h2>📐 S&amp;P 500 Closing Projection (Monte Carlo)</h2>
              <div class='metric-row'>
                <div class='metric'><div class='metric-label'>Expected Close</div>
                  <div class='metric-value'>{proj.get('projected_close', '—'):,.2f}</div></div>
                <div class='metric'><div class='metric-label'>Confidence</div>
                  <div class='metric-value'>{proj.get('confidence_pct', '—')}%</div></div>
                <div class='metric'><div class='metric-label'>Range</div>
                  <div class='metric-value'>{proj.get('range_low','—'):,.0f}–{proj.get('range_high','—'):,.0f}</div></div>
              </div>
              <p class='chart-link'>🔗 <a href="{REPO_PAGES_BASE}/sp_closing_projection/sp_closing_projection_output.png">Projection Chart</a></p>
            </div>"""
        except Exception:
            pass

    subject = f"🏦 1 PM Indices Close Report — {date_str}"
    html  = _html_header("1 PM Indices Close Report", f"Close projection & afternoon outlook · {date_str}", ts)
    html += _index_table(index_snaps, title="📊 Indices at 1 PM")
    html += proj_html
    html += _bull_table(bull_stocks, title="📈 Afternoon Movers")
    html += _html_footer()
    return subject, html


def build_weekend_report(now: Optional[datetime] = None, slot: str = "9am") -> Tuple[str, str]:
    """
    Weekend digest (Saturday & Sunday, 9 AM and 10 PM).
    slot: '9am' | '10pm'
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")
    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=12)
    bull_crypto = _fetch_bull_screener(CRYPTO_TICKERS, top_n=8)

    emoji   = "🌅" if slot == "9am" else "🌙"
    slot_lbl = "Morning Digest" if slot == "9am" else "Evening Digest"
    subject = f"{emoji} Weekend Market {slot_lbl} — {date_str}"

    html  = _html_header(f"Weekend Market {slot_lbl}", f"Full weekly recap · {date_str}", ts)
    html += _weekly_summary_section(index_snaps, bull_stocks, bull_crypto)
    html += _index_table(index_snaps, title="📊 Indices Weekly Snapshot")
    html += _bull_table(bull_stocks, title="🚀 Weekly Top Bull Stocks")
    html += _crypto_table(
        {r["ticker"]: r for r in bull_crypto}
    )
    # Chart gallery
    html += f"""<div class='card'>
      <h2>📉 Chart Gallery</h2>
      <ul>
        <li><a href="{REPO_PAGES_BASE}/dji_1pm_close/dji_1pm_prediction.png">DJI 1PM Prediction PNG</a></li>
        <li><a href="{REPO_PAGES_BASE}/dji_monte_carlo/dji_simulation_output.png">DJI Monte Carlo Simulation</a></li>
        <li><a href="{REPO_PAGES_BASE}/sp_closing_projection/sp_closing_projection_output.png">S&amp;P 500 Closing Projection</a></li>
        <li><a href="{REPO_PAGES_BASE}/yfinance_chart/index.html">Interactive Lightweight Charts</a></li>
        <li><a href="{REPO_PAGES_BASE}/yfinance/index.html">Top-Heavy Live Dashboard</a></li>
        <li><a href="{REPO_RAW_BASE}/yfinance_chart/pinescript_seed_csv.pine">Pine Script Seed CSV</a></li>
        <li><a href="{REPO_RAW_BASE}/tradingview_integration/pine_script/advanced_indicator.pine">Advanced Indicator (Pine)</a></li>
      </ul>
    </div>"""
    html += _html_footer()
    return subject, html


# ─────────────────────────────────────────────────────────────────────────────
# Trading-Prompt Agent — overnight / pre-market / market-hours / midday slots
#
# Schedule (all times US Eastern, EDT = UTC-4 shown for GitHub cron reference):
#
#   OVERNIGHT  (10 PM – 6 AM ET)
#     overnight_day_plan   11 PM ET (03:00 UTC)  — trading day ahead management
#     overnight_bull_pick   1 AM ET (05:00 UTC)  — most bullish stock/crypto
#     overnight_project     3 AM ET (07:00 UTC)  — project brief
#
#   PRE-MARKET (4 AM – 6:59 AM ET)
#     premarket_1pm_proj    4:00 AM ET (08:00 UTC) — projected 1 PM close
#     premarket_followup    5:30 AM ET (09:30 UTC) — follow-up project
#     premarket_extra       6:30 AM ET (10:30 UTC) — third pre-market slot
#
#   MARKET MORNING (8 AM – 11:59 AM ET)
#     weekday_9am           9:00 AM ET (13:00 UTC) — market open snapshot
#     market_bullnews      10:00 AM ET (14:00 UTC) — extremely bullish / news-driven
#     market_midday        11:59 AM ET (15:59 UTC) — midday follow-up
#
#   MIDDAY  (1 PM ET)
#     market_1pm_et         1:00 PM ET (17:00 UTC) — index feedback + next day plan
# ─────────────────────────────────────────────────────────────────────────────

def _trading_prompts_section(prompt_items: List[str], title: str = "🤖 Trading Prompts") -> str:
    """Render a card with a numbered list of AI prompt suggestions."""
    html = f"<div class='card'><h2>{title}</h2><ol style='padding-left:20px;line-height:1.8'>"
    for item in prompt_items:
        html += f"<li style='margin-bottom:6px'>{item}</li>"
    html += "</ol></div>"
    return html


def _next_day_checklist_section(now: datetime) -> str:
    """Produce a 'Next Trading Day' preparation checklist card."""
    tomorrow = now + timedelta(days=1)
    day_name = tomorrow.strftime("%A")
    html = f"""<div class='card'>
      <h2>📋 Next Trading Day Prep — {day_name}</h2>
      <ul style='padding-left:20px;line-height:1.9'>
        <li>Review overnight futures &amp; pre-market movers</li>
        <li>Check Fed/macro calendar for scheduled announcements</li>
        <li>Identify top bull candidates from overnight screener</li>
        <li>Set key S&amp;P 500 / DJI support &amp; resistance levels</li>
        <li>Update stop-loss levels for open positions</li>
        <li>Review Monte Carlo projected close range</li>
        <li>Scan crypto for correlation moves with risk assets</li>
        <li>Confirm sector rotation signals (tech, energy, financials)</li>
      </ul>
    </div>"""
    return html


# ── Overnight slot builders ───────────────────────────────────────────────────

def build_overnight_day_plan_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    11 PM ET — Trading Day Ahead Management.
    Plans the next session: macro context, key levels, day plan prompts.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")
    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=8)

    prompts = [
        "Summarise the macro drivers expected to move markets in the next session "
        "and suggest 3 specific entry setups for tomorrow.",
        "Based on current index futures and overnight sentiment, outline the bull vs bear "
        "scenarios for S&amp;P 500 at the open.",
        "List the 5 most important support and resistance levels for DJI and NASDAQ "
        "entering tomorrow's session, with rationale.",
    ]

    subject = f"🌙 Trading Day Ahead Plan — {date_str}"
    html  = _html_header("Trading Day Ahead Plan",
                         f"Overnight session · day management brief · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 Day-Ahead Planning Prompts")
    html += _index_table(index_snaps, title="📊 After-Hours Index Snapshot")
    html += _bull_table(bull_stocks, title="🚀 Overnight Bull Candidates")
    html += _next_day_checklist_section(now)
    html += _html_footer()
    return subject, html


def build_overnight_bull_pick_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    1 AM ET — Most Bullish Projected Stock / Crypto.
    Deep bull screener across stocks and crypto with GBM forecasts.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=5)
    bull_crypto = _fetch_bull_screener(CRYPTO_TICKERS, top_n=5)

    prompts = [
        "Which single stock from the current bull screener has the strongest confluence "
        "of GBM forecast, RSI momentum, and MACD crossover? Provide a trade thesis.",
        "For the top-ranked crypto by bull score, describe the overnight on-chain signals "
        "and whether the current move is liquidity-driven or sentiment-driven.",
        "Compare the Higuchi fractal dimension of the top stock pick vs top crypto pick "
        "and explain what it implies for next-day volatility.",
    ]

    subject = f"⚡ Most Bullish Pick Alert — {date_str}"
    html  = _html_header("Most Bullish Pick Alert",
                         f"Overnight screener · top stock &amp; crypto · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 Bull Pick Analysis Prompts")
    html += _bull_table(bull_stocks, title="🚀 Top Bull Stocks (Overnight)")
    html += _bull_table(bull_crypto, title="₿ Top Bull Crypto (Overnight)")
    html += _html_footer()
    return subject, html


def build_overnight_project_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    3 AM ET — Project Overview.
    Strategy project brief, portfolio review prompts, and algo signal review.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")

    prompts = [
        "Review the MajixAI OU mean-reversion strategy performance over the past 5 sessions "
        "and suggest parameter recalibrations based on current κ values.",
        "Generate a 3-point GBM simulation brief for SPY, QQQ, and BTC that can be used "
        "to calibrate position sizes entering tomorrow's open.",
        "Outline a hedging strategy using VIX derivatives if the index RSI is above 70 "
        "or below 30 at tomorrow's open.",
    ]

    subject = f"🛠️ Overnight Project Brief — {date_str}"
    html  = _html_header("Overnight Project Brief",
                         f"Strategy &amp; algo review · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 Project &amp; Strategy Prompts")
    html += _index_table(index_snaps, title="📊 Overnight Index Context")
    html += _html_footer()
    return subject, html


# ── Pre-market slot builders ──────────────────────────────────────────────────

def build_premarket_1pm_proj_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    4 AM ET — Projected 1 PM Close of Indices.
    Early pre-market projection for midday index levels.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")

    # Load Monte Carlo projection if available
    proj_html = ""
    proj_file = _REPO / "sp_closing_projection" / "latest_projection.json"
    if proj_file.exists():
        try:
            proj = json.loads(proj_file.read_text())
            proj_html = f"""<div class='card'>
              <h2>📐 S&amp;P 500 Projected 1 PM Close (Monte Carlo)</h2>
              <div class='metric-row'>
                <div class='metric'><div class='metric-label'>Expected Close</div>
                  <div class='metric-value'>{proj.get('projected_close', '—'):,.2f}</div></div>
                <div class='metric'><div class='metric-label'>Confidence</div>
                  <div class='metric-value'>{proj.get('confidence_pct', '—')}%</div></div>
                <div class='metric'><div class='metric-label'>Range</div>
                  <div class='metric-value'>{proj.get('range_low','—'):,.0f}–{proj.get('range_high','—'):,.0f}</div></div>
              </div>
              <p class='chart-link'>🔗
                <a href="{REPO_PAGES_BASE}/sp_closing_projection/sp_closing_projection_output.png">Projection Chart</a> &nbsp;·&nbsp;
                <a href="{REPO_PAGES_BASE}/dji_1pm_close/dji_1pm_prediction.png">DJI 1PM Prediction</a>
              </p>
            </div>"""
        except Exception:
            pass

    prompts = [
        "Based on pre-market futures and the Monte Carlo projection, what is the most "
        "likely S&amp;P 500 level at 1 PM ET today? Give a bull case, base case, and bear case.",
        "Estimate the probability that DJI closes above its 20-day moving average by 1 PM ET, "
        "using the GBM forecast and current RSI.",
        "If the projected 1 PM close is within 0.5% of the current pre-market level, "
        "what range-bound strategies are most appropriate?",
    ]

    subject = f"📐 Projected 1 PM Close — {date_str}"
    html  = _html_header("Projected 1 PM Index Close",
                         f"Pre-market 4 AM brief · Monte Carlo forecasts · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 1 PM Close Projection Prompts")
    html += _index_table(index_snaps, title="📊 Pre-Market Index Snapshot (4 AM ET)")
    html += proj_html
    html += _html_footer()
    return subject, html


def build_premarket_followup_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    5:30 AM ET — Pre-Market Follow-Up Project.
    Mid pre-market window: updated screener + sector rotation prompts.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=10)
    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")

    prompts = [
        "Identify which sector (tech, energy, financials, healthcare) is showing the "
        "strongest pre-market momentum based on the current top movers list.",
        "For each of the top 3 bull stock picks, describe the risk:reward ratio for a "
        "gap-up continuation trade vs a fade-the-gap strategy at the open.",
        "Update the overnight bull thesis: has the overnight narrative changed since the "
        "11 PM brief? What new catalyst or risk factor has emerged?",
    ]

    subject = f"📊 Pre-Market Follow-Up (5:30 AM) — {date_str}"
    html  = _html_header("Pre-Market Follow-Up Project",
                         f"5:30 AM ET · sector rotation &amp; screener update · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 Follow-Up Analysis Prompts")
    html += _index_table(index_snaps, title="📊 Indices (5:30 AM ET)")
    html += _bull_table(bull_stocks, title="🚀 Updated Bull Screener (5:30 AM ET)")
    html += _html_footer()
    return subject, html


def build_premarket_extra_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    6:30 AM ET — Third Pre-Market Slot.
    Final pre-market brief before the 9:30 AM open.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=8)
    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")

    prompts = [
        "Final pre-market summary: rank today's 3 highest-conviction trade ideas with "
        "entry price, target, and stop. Include confidence level for each.",
        "Check if VIX level suggests elevated uncertainty entering today's open. "
        "How should position sizing be adjusted accordingly?",
        "Identify any early-morning news events (earnings, Fed speakers, macro data) "
        "that could create gap-open opportunities in the first 30 minutes.",
    ]

    subject = f"🔔 Pre-Market Final Brief (6:30 AM) — {date_str}"
    html  = _html_header("Pre-Market Final Brief",
                         f"6:30 AM ET · final check before open · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 Final Pre-Market Prompts")
    html += _index_table(index_snaps, title="📊 Indices (6:30 AM ET — 3h Before Open)")
    html += _bull_table(bull_stocks, title="🚀 Final Bull Candidate List")
    html += _html_footer()
    return subject, html


# ── Market-hours slot builders ────────────────────────────────────────────────

def build_market_bullnews_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    10 AM ET — Extremely Bullish Behavior / News-Driven Alert.
    Scans for outsized moves, news catalysts, and momentum breakouts.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=10)
    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")

    prompts = [
        "Alert: scan for tickers with RSI > 75 AND bull_score > 5 in the first 30 minutes. "
        "Identify if the move is news-driven or pure momentum, and suggest a chase vs wait strategy.",
        "If the S&amp;P 500 is up more than 1.5% by 10 AM ET, evaluate whether this is a "
        "sustainable trend day or an overextension likely to fade.",
        "Identify the single most news-driven bull catalyst active right now (earnings beat, "
        "acquisition, regulatory approval) and outline a momentum trade plan with a 30-min chart setup.",
    ]

    subject = f"⚡ Bull Momentum / News Alert (10 AM) — {date_str}"
    html  = _html_header("Bull Momentum &amp; News Alert",
                         f"10 AM ET · breakout &amp; news-driven movers · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 Bull Momentum Prompts")
    html += _index_table(index_snaps, title="📊 Indices at 10 AM ET")
    html += _bull_table(bull_stocks, title="🚀 Extreme Bull Movers (10 AM Screener)")
    html += _html_footer()
    return subject, html


def build_market_midday_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    11:59 AM ET — Midday Follow-Up.
    Pre-lunch check: indices, positions, and afternoon setups.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=8)
    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")

    prompts = [
        "Midday check: compare the 11:59 AM index levels against the 4 AM projected 1 PM "
        "close. Is the day tracking the bull, base, or bear scenario?",
        "For any open positions from morning setups, evaluate whether to hold through "
        "lunch or take partial profits given current momentum and VIX level.",
        "Preview the afternoon session: identify the 2 most likely afternoon catalysts "
        "(Fed speaker, auction results, market-on-close imbalances) and their directional bias.",
    ]

    subject = f"⏱️ Midday Market Follow-Up (11:59 AM) — {date_str}"
    html  = _html_header("Midday Market Follow-Up",
                         f"11:59 AM ET · lunch-time brief · {date_str}", ts)
    html += _trading_prompts_section(prompts, title="💡 Midday Follow-Up Prompts")
    html += _index_table(index_snaps, title="📊 Indices at 11:59 AM ET")
    html += _bull_table(bull_stocks, title="📈 Midday Top Movers")
    html += _html_footer()
    return subject, html


def build_market_1pm_et_report(now: Optional[datetime] = None) -> Tuple[str, str]:
    """
    1 PM ET — Index Feedback Data + Next Day Planning.
    Dual-purpose report: afternoon index data AND next-session preparation.
    """
    if now is None:
        now = datetime.now(timezone.utc)
    ts       = now.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now.strftime("%A, %B %d %Y").replace(" 0", " ")

    index_snaps = _fetch_snapshot(INDEX_TICKERS, period="5d")
    bull_stocks = _fetch_bull_screener(BULL_STOCK_UNIVERSE, top_n=8)
    bull_crypto = _fetch_bull_screener(CRYPTO_TICKERS, top_n=5)

    # Load projection JSON
    proj_html = ""
    proj_file = _REPO / "sp_closing_projection" / "latest_projection.json"
    if proj_file.exists():
        try:
            proj = json.loads(proj_file.read_text())
            proj_html = f"""<div class='card'>
              <h2>📐 S&amp;P 500 Closing Projection (1 PM ET Read)</h2>
              <div class='metric-row'>
                <div class='metric'><div class='metric-label'>Expected Close</div>
                  <div class='metric-value'>{proj.get('projected_close', '—'):,.2f}</div></div>
                <div class='metric'><div class='metric-label'>Confidence</div>
                  <div class='metric-value'>{proj.get('confidence_pct', '—')}%</div></div>
                <div class='metric'><div class='metric-label'>Range</div>
                  <div class='metric-value'>{proj.get('range_low','—'):,.0f}–{proj.get('range_high','—'):,.0f}</div></div>
              </div>
              <p class='chart-link'>🔗
                <a href="{REPO_PAGES_BASE}/sp_closing_projection/sp_closing_projection_output.png">Projection Chart</a> &nbsp;·&nbsp;
                <a href="{REPO_PAGES_BASE}/dji_1pm_close/dji_1pm_prediction.png">DJI 1PM Chart</a>
              </p>
            </div>"""
        except Exception:
            pass

    feedback_prompts = [
        "Evaluate today's index performance against the pre-market projection: "
        "did SPX, DJI, and NASDAQ hit their projected 1 PM levels? Describe variance and cause.",
        "Based on the 1 PM index levels and current momentum, forecast the final 3 PM close "
        "range for S&amp;P 500 with confidence percentages for each scenario.",
    ]
    planning_prompts = [
        "Plan tomorrow's top 3 trading opportunities based on today's sector performance, "
        "earnings calendar, and macro events scheduled overnight.",
        "Review today's top 5 bull movers: which have continuation potential into tomorrow "
        "vs which are likely to consolidate or reverse?",
        "Summarise the key learnings from today's session — what worked, what didn't, "
        "and how to refine tomorrow's pre-market brief.",
    ]

    subject = f"🏦 1 PM ET Index Feedback + Next Day Plan — {date_str}"
    html  = _html_header("1 PM ET Index Feedback &amp; Next Day Planning",
                         f"Dual-purpose brief · index data &amp; tomorrow's plan · {date_str}", ts)
    html += _trading_prompts_section(feedback_prompts, title="📊 Index Feedback Prompts")
    html += _index_table(index_snaps, title="📊 Indices at 1 PM ET")
    html += proj_html
    html += _trading_prompts_section(planning_prompts, title="📋 Next Day Planning Prompts")
    html += _bull_table(bull_stocks, title="📈 1 PM ET Top Movers")
    html += _crypto_table({r["ticker"]: r for r in bull_crypto})
    html += _next_day_checklist_section(now)
    html += _html_footer()
    return subject, html


# ─────────────────────────────────────────────────────────────────────────────
# CLI  (python email/financial_report.py --mode weekday_open)
# ─────────────────────────────────────────────────────────────────────────────

_ALL_MODES = [
    "weekday_open", "weekday_9am", "weekday_10am", "weekday_1pm",
    "weekend_9am", "weekend_10pm",
    # Trading-prompt agent slots
    "overnight_day_plan", "overnight_bull_pick", "overnight_project",
    "premarket_1pm_proj", "premarket_followup", "premarket_extra",
    "market_bullnews", "market_midday", "market_1pm_et",
]

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Generate a financial HTML email report.")
    parser.add_argument(
        "--mode",
        choices=_ALL_MODES,
        default="weekday_open",
        help="Report mode to generate",
    )
    parser.add_argument("--out", default="", help="Write HTML to this file (default: stdout)")
    args = parser.parse_args()

    now = datetime.now(timezone.utc)
    dispatch = {
        "weekday_open":       lambda: build_weekday_open_report(now),
        "weekday_9am":        lambda: build_weekday_9am_report(now),
        "weekday_10am":       lambda: build_weekday_10am_report(now),
        "weekday_1pm":        lambda: build_weekday_1pm_report(now),
        "weekend_9am":        lambda: build_weekend_report(now, "9am"),
        "weekend_10pm":       lambda: build_weekend_report(now, "10pm"),
        "overnight_day_plan": lambda: build_overnight_day_plan_report(now),
        "overnight_bull_pick":lambda: build_overnight_bull_pick_report(now),
        "overnight_project":  lambda: build_overnight_project_report(now),
        "premarket_1pm_proj": lambda: build_premarket_1pm_proj_report(now),
        "premarket_followup": lambda: build_premarket_followup_report(now),
        "premarket_extra":    lambda: build_premarket_extra_report(now),
        "market_bullnews":    lambda: build_market_bullnews_report(now),
        "market_midday":      lambda: build_market_midday_report(now),
        "market_1pm_et":      lambda: build_market_1pm_et_report(now),
    }
    subject, html = dispatch[args.mode]()
    print(f"Subject: {subject}", file=sys.stderr)
    if args.out:
        Path(args.out).write_text(html, encoding="utf-8")
        print(f"Written to {args.out}", file=sys.stderr)
    else:
        print(html)
