"""
Zone detection for the Top-Heavy reporting pipeline.

Definitions
-----------
Expansion Zone
    A ticker whose 14-day Average True Range (ATR) has risen more than 2
    standard deviations above its own 20-day rolling mean.  This signals
    an abnormal volatility expansion that warrants immediate attention.

Consolidation Zone
    A ticker whose 20-day price range (High − Low) is less than 1 % of
    the current closing price.  The narrow channel suggests the ticker is
    coiling before a breakout.

Bull Trigger
    A ticker that sits inside an Expansion Zone *and* has gained more than
    3 % since the prior closing session.

Extended Mathematical Zones
---------------------------
Stochastic Drift Zone
    Detects whether the Ornstein-Uhlenbeck mean-reversion speed (κ) is
    anomalously high, suggesting a strong gravitational pull toward the
    long-run mean — drawn from the Stochastic Calculus module.

Vector Field Zone
    Applies a discrete curl-approximation to the (price, volume) 2-D field.
    Non-zero curl implies rotational price-volume dynamics (divergence or
    convergence momentum), analogous to the Vector Calculus module.

Geometric Curvature Zone
    Uses the discrete Frenet–Serret curvature of the price curve to detect
    inflection points where the path curvature exceeds a threshold, drawn
    from the Geometric Calculus module.

Fractal Dimension Zone
    Estimates the Higuchi fractal dimension of the closing price series.
    A high fractal dimension (> 1.5) indicates complex, non-trending price
    action; a low value (< 1.3) indicates strong trending behaviour.

Differential Form Zone
    Computes the discrete 1-form exterior derivative of log-returns,
    detecting regions of high local change (analogous to the wedge-product
    magnitude from the Differential Forms / Exterior Calculus module).
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

# ── Tunable thresholds ──────────────────────────────────────────────────────
ATR_WINDOW: int = 14          # bars used to calculate each ATR point
ATR_MEAN_WINDOW: int = 20     # rolling window for ATR mean/std
ATR_STDEV_THRESHOLD: float = 2.0   # z-score above which expansion is triggered
CONSOL_RANGE_WINDOW: int = 20      # look-back bars for consolidation range
CONSOL_PCT_THRESHOLD: float = 0.01  # 1 % of price
BULL_TRIGGER_PCT: float = 0.03      # 3 % single-session gain

# ── Extended mathematical zone thresholds ────────────────────────────────────
OU_KAPPA_WINDOW: int = 30           # Ornstein-Uhlenbeck look-back
OU_KAPPA_HIGH_THRESHOLD: float = 0.5  # High mean-reversion speed (stochastic drift zone)
VECTOR_CURL_WINDOW: int = 20        # Window for discrete vector-field curl
VECTOR_CURL_THRESHOLD: float = 0.15  # |curl| above which rotational dynamics detected
GEO_CURVATURE_WINDOW: int = 15      # Frenet curvature look-back
GEO_CURVATURE_THRESHOLD: float = 0.30  # Curvature z-score threshold
HIGUCHI_K_MAX: int = 8              # Max interval for Higuchi FD
HIGUCHI_HIGH_FD: float = 1.50       # Fractal dimension → complex/noisy
HIGUCHI_LOW_FD: float = 1.30        # Fractal dimension → trending
DIFF_FORM_WINDOW: int = 20          # Exterior-derivative look-back
DIFF_FORM_THRESHOLD: float = 0.80   # Normalised wedge magnitude threshold


@dataclass
class ZoneResult:
    """Outcome of the zone classification for one ticker."""

    ticker: str
    expansion: bool = False
    consolidation: bool = False
    bull_trigger: bool = False

    # Extended mathematical zones
    stochastic_drift: bool = False     # OU mean-reversion speed zone
    vector_field: bool = False         # Price-volume rotational dynamics
    geometric_curvature: bool = False  # Frenet curvature inflection
    fractal_complex: bool = False      # High fractal dimension (noisy)
    fractal_trending: bool = False     # Low fractal dimension (trending)
    differential_form: bool = False    # High exterior-derivative magnitude

    # Underlying metrics (NaN when data was unavailable)
    atr: float = float("nan")
    atr_zscore: float = float("nan")
    range_pct: float = float("nan")
    session_gain_pct: float = float("nan")
    last_close: float = float("nan")

    # Extended metrics
    ou_kappa: float = float("nan")
    vector_curl: float = float("nan")
    curvature_zscore: float = float("nan")
    higuchi_fd: float = float("nan")
    diff_form_magnitude: float = float("nan")

    error: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "ticker": self.ticker,
            "expansion": self.expansion,
            "consolidation": self.consolidation,
            "bull_trigger": self.bull_trigger,
            "stochastic_drift": self.stochastic_drift,
            "vector_field": self.vector_field,
            "geometric_curvature": self.geometric_curvature,
            "fractal_complex": self.fractal_complex,
            "fractal_trending": self.fractal_trending,
            "differential_form": self.differential_form,
            "atr": round(self.atr, 4) if not np.isnan(self.atr) else None,
            "atr_zscore": round(self.atr_zscore, 4) if not np.isnan(self.atr_zscore) else None,
            "range_pct": round(self.range_pct, 6) if not np.isnan(self.range_pct) else None,
            "session_gain_pct": round(self.session_gain_pct, 6) if not np.isnan(self.session_gain_pct) else None,
            "last_close": round(self.last_close, 4) if not np.isnan(self.last_close) else None,
            "ou_kappa": round(self.ou_kappa, 6) if not np.isnan(self.ou_kappa) else None,
            "vector_curl": round(self.vector_curl, 6) if not np.isnan(self.vector_curl) else None,
            "curvature_zscore": round(self.curvature_zscore, 4) if not np.isnan(self.curvature_zscore) else None,
            "higuchi_fd": round(self.higuchi_fd, 4) if not np.isnan(self.higuchi_fd) else None,
            "diff_form_magnitude": round(self.diff_form_magnitude, 6) if not np.isnan(self.diff_form_magnitude) else None,
            "error": self.error,
        }


@dataclass
class ZoneSummary:
    """Aggregate classification output for all processed tickers."""

    total: int = 0
    expansion_zones: List[ZoneResult] = field(default_factory=list)
    consolidation_zones: List[ZoneResult] = field(default_factory=list)
    bull_triggers: List[ZoneResult] = field(default_factory=list)
    stochastic_drift_zones: List[ZoneResult] = field(default_factory=list)
    vector_field_zones: List[ZoneResult] = field(default_factory=list)
    geometric_curvature_zones: List[ZoneResult] = field(default_factory=list)
    fractal_complex_zones: List[ZoneResult] = field(default_factory=list)
    fractal_trending_zones: List[ZoneResult] = field(default_factory=list)
    differential_form_zones: List[ZoneResult] = field(default_factory=list)
    errors: List[ZoneResult] = field(default_factory=list)

    def top_expansion(self, n: int = 5) -> List[ZoneResult]:
        """Return up to *n* highest-z-score expansion tickers."""
        return sorted(
            self.expansion_zones,
            key=lambda r: r.atr_zscore if not np.isnan(r.atr_zscore) else -1,
            reverse=True,
        )[:n]

    def top_consolidation(self, n: int = 5) -> List[ZoneResult]:
        """Return up to *n* tightest consolidation tickers (smallest range_pct)."""
        return sorted(
            self.consolidation_zones,
            key=lambda r: r.range_pct if not np.isnan(r.range_pct) else 1.0,
        )[:n]

    def top_stochastic_drift(self, n: int = 5) -> List[ZoneResult]:
        """Return up to *n* highest mean-reversion speed tickers."""
        return sorted(
            self.stochastic_drift_zones,
            key=lambda r: r.ou_kappa if not np.isnan(r.ou_kappa) else 0.0,
            reverse=True,
        )[:n]

    def top_geometric_curvature(self, n: int = 5) -> List[ZoneResult]:
        """Return up to *n* highest Frenet-curvature tickers."""
        return sorted(
            self.geometric_curvature_zones,
            key=lambda r: r.curvature_zscore if not np.isnan(r.curvature_zscore) else 0.0,
            reverse=True,
        )[:n]

    def to_dict(self) -> Dict:
        return {
            "total": self.total,
            "expansion_count": len(self.expansion_zones),
            "consolidation_count": len(self.consolidation_zones),
            "bull_trigger_count": len(self.bull_triggers),
            "stochastic_drift_count": len(self.stochastic_drift_zones),
            "vector_field_count": len(self.vector_field_zones),
            "geometric_curvature_count": len(self.geometric_curvature_zones),
            "fractal_complex_count": len(self.fractal_complex_zones),
            "fractal_trending_count": len(self.fractal_trending_zones),
            "differential_form_count": len(self.differential_form_zones),
            "error_count": len(self.errors),
        }




# ── Core calculation helpers (vectorised, DataFrame-in / scalar-out) ─────────

def _true_range(df: pd.DataFrame) -> pd.Series:
    """Compute True Range from a DataFrame with High, Low, Close columns."""
    high = df["High"]
    low = df["Low"]
    prev_close = df["Close"].shift(1)
    tr = pd.concat(
        [high - low, (high - prev_close).abs(), (low - prev_close).abs()],
        axis=1,
    ).max(axis=1)
    return tr


def _atr(df: pd.DataFrame, window: int = ATR_WINDOW) -> pd.Series:
    """Compute ATR (simple rolling mean of TR)."""
    return _true_range(df).rolling(window).mean()


# ── Extended mathematical helpers ─────────────────────────────────────────────

def _ou_kappa(closes: np.ndarray, window: int = OU_KAPPA_WINDOW) -> float:
    """
    Estimate the Ornstein-Uhlenbeck mean-reversion speed (κ) using
    least-squares regression of ΔX_t on X_{t-1}.

    κ ≈ −slope of OLS fit: ΔX = α + β·X_{t-1} + ε
    Returns float κ (positive → mean-reverting; negative → trending).

    Drawn from the Stochastic Calculus module.
    """
    x = closes[-window:].astype(np.float64)
    if len(x) < 4:
        return float("nan")
    dx = np.diff(x)
    x_lag = x[:-1]
    # OLS: β = cov(dx, x_lag) / var(x_lag)
    denom = float(np.var(x_lag, ddof=1))
    if denom < 1e-10:
        return float("nan")
    beta = float(np.cov(dx, x_lag, ddof=1)[0, 1]) / denom
    return -beta  # kappa = -β


def _vector_curl(closes: np.ndarray, volumes: np.ndarray, window: int = VECTOR_CURL_WINDOW) -> float:
    """
    Discrete curl approximation of the 2-D (log-price, log-volume) field.

    curl ≈ ∂v_y/∂x − ∂v_x/∂y  over a sliding window, where:
      x = normalised log-price changes
      y = normalised log-volume changes

    Non-zero curl signals rotational price-volume momentum, drawn from the
    Vector Calculus module.
    """
    p = closes[-window:].astype(np.float64)
    v = volumes[-window:].astype(np.float64)
    if len(p) < 4:
        return float("nan")
    lp = np.log(np.maximum(p, 1e-10))
    lv = np.log(np.maximum(v, 1e-10))
    dlp = np.diff(lp)
    dlv = np.diff(lv)
    # Green's theorem: A = ½ Σ (x_i·y_{i+1} − x_{i+1}·y_i)
    n = len(dlp) - 1
    if n < 2:
        return float("nan")
    area = 0.5 * float(np.sum(dlp[:n] * dlv[1:] - dlv[:n] * dlp[1:]))
    # Normalise by path length
    path_len = float(np.sum(np.sqrt(dlp ** 2 + dlv ** 2))) + 1e-12
    return area / path_len


def _frenet_curvature(closes: np.ndarray, window: int = GEO_CURVATURE_WINDOW) -> float:
    """
    Estimate the mean Frenet–Serret curvature κ of the price curve.

    Uses the discrete formula:
        κ_i ≈ |x′′_i| / (1 + x′_i²)^(3/2)

    where x′ = first finite difference and x′′ = second finite difference,
    drawn from the Geometric Calculus module.
    """
    x = closes[-window:].astype(np.float64)
    if len(x) < 5:
        return float("nan")
    x_n = (x - x.mean()) / (x.std(ddof=1) + 1e-10)
    d1 = np.diff(x_n)
    d2 = np.diff(d1)
    kappas = np.abs(d2) / (1.0 + d1[:-1] ** 2) ** 1.5
    return float(np.mean(kappas))


def _higuchi_fd(series: np.ndarray, k_max: int = HIGUCHI_K_MAX) -> float:
    """
    Estimate the Higuchi fractal dimension of *series*.

    Drawn from the Fractional Calculus module's fractal dimension tools.

    Returns a value in [1.0, 2.0]:
        ≈ 1.0  → perfectly smooth / strongly trending
        ≈ 2.0  → white noise / highly complex
    """
    x = np.asarray(series, dtype=np.float64)
    n = len(x)
    if n < 2 * k_max + 2:
        return float("nan")
    lm_list = []
    for k in range(1, k_max + 1):
        lm_k = []
        for m in range(1, k + 1):
            idxs = np.arange(m - 1, n, k)
            if len(idxs) < 2:
                continue
            sub = x[idxs]
            length = np.sum(np.abs(np.diff(sub))) * (n - 1) / (k * len(sub))
            lm_k.append(length)
        if lm_k:
            lm_list.append((math.log(k), math.log(max(np.mean(lm_k), 1e-20))))
    if len(lm_list) < 2:
        return float("nan")
    ks = np.array([row[0] for row in lm_list])
    lms = np.array([row[1] for row in lm_list])
    slope, _ = np.polyfit(ks, lms, 1)
    return float(-slope)


def _differential_form_magnitude(closes: np.ndarray, window: int = DIFF_FORM_WINDOW) -> float:
    """
    Compute the magnitude of the discrete exterior derivative (1-form) of
    log-returns over *window*.

    In the Exterior Calculus framework the 1-form ω = Σ f_i dx^i; its
    exterior derivative dω encodes how rapidly the log-return field is
    changing.  Here we approximate it as the Frobenius norm of the
    antisymmetric difference matrix of the log-return vector, normalised
    by the number of pairs.

    Drawn from the Exterior Calculus / Differential Forms module.
    """
    x = closes[-window:].astype(np.float64)
    if len(x) < 4:
        return float("nan")
    log_rets = np.diff(np.log(np.maximum(x, 1e-10)))
    n = len(log_rets)
    # Build antisymmetric wedge matrix: A_{ij} = ω_i ∧ ω_j = ω_i·ω_j − ω_j·ω_i
    # Simplified: A_{ij} = log_rets[i] - log_rets[j]  (antisymmetric 1-form diff)
    row, col = np.triu_indices(n, k=1)
    diffs = log_rets[row] - log_rets[col]
    magnitude = float(np.sqrt(np.sum(diffs ** 2)) / max(len(diffs), 1))
    return magnitude


def classify_ticker(ticker: str, df: pd.DataFrame) -> ZoneResult:
    """
    Classify *one* ticker DataFrame into zones.

    Parameters
    ----------
    ticker:
        Symbol string.
    df:
        DataFrame returned by yfinance.download or equivalent.  Must contain
        columns Open, High, Low, Close, Volume sorted ascending by date.

    Returns
    -------
    ZoneResult
    """
    result = ZoneResult(ticker=ticker)

    if df is None or df.empty or len(df) < max(ATR_MEAN_WINDOW + ATR_WINDOW, CONSOL_RANGE_WINDOW + 1):
        result.error = f"insufficient data ({len(df) if df is not None else 0} rows)"
        return result

    # Normalise multi-level columns produced by yfinance batch download
    if isinstance(df.columns, pd.MultiIndex):
        df = df.xs(ticker, level=1, axis=1, drop_level=True) if ticker in df.columns.get_level_values(1) else df
        df.columns = [c[0] if isinstance(c, tuple) else c for c in df.columns]

    required = {"High", "Low", "Close"}
    if not required.issubset(set(df.columns)):
        result.error = f"missing columns {required - set(df.columns)}"
        return result

    df = df[list(required)].copy()
    df = df.dropna()

    # ── ATR z-score ──────────────────────────────────────────────────────────
    atr_series = _atr(df)
    rolling_mean = atr_series.rolling(ATR_MEAN_WINDOW).mean()
    rolling_std = atr_series.rolling(ATR_MEAN_WINDOW).std(ddof=1)

    latest_atr = atr_series.iloc[-1]
    m = rolling_mean.iloc[-1]
    s = rolling_std.iloc[-1]

    result.atr = float(latest_atr) if not pd.isna(latest_atr) else float("nan")
    if not any(pd.isna(v) for v in (latest_atr, m, s)) and s > 0:
        result.atr_zscore = float((latest_atr - m) / s)
        result.expansion = result.atr_zscore > ATR_STDEV_THRESHOLD
    else:
        result.atr_zscore = float("nan")

    # ── Consolidation range ───────────────────────────────────────────────────
    window_slice = df.tail(CONSOL_RANGE_WINDOW)
    high_max = window_slice["High"].max()
    low_min = window_slice["Low"].min()
    last_close = float(df["Close"].iloc[-1])
    result.last_close = last_close

    if last_close > 0:
        result.range_pct = (high_max - low_min) / last_close
        result.consolidation = result.range_pct < CONSOL_PCT_THRESHOLD

    # ── Session gain ─────────────────────────────────────────────────────────
    if len(df) >= 2:
        prev_close = float(df["Close"].iloc[-2])
        if prev_close > 0:
            result.session_gain_pct = (last_close - prev_close) / prev_close

    # ── Bull Trigger ─────────────────────────────────────────────────────────
    if result.expansion and not np.isnan(result.session_gain_pct):
        result.bull_trigger = result.session_gain_pct > BULL_TRIGGER_PCT

    # ── Extended mathematical zones ───────────────────────────────────────────
    closes_arr = df["Close"].to_numpy(dtype=np.float64)
    volumes_arr = df["Volume"].to_numpy(dtype=np.float64) if "Volume" in df.columns else np.ones(len(df))

    # Stochastic Drift (Ornstein-Uhlenbeck κ)
    try:
        kappa = _ou_kappa(closes_arr)
        result.ou_kappa = kappa
        if not np.isnan(kappa):
            result.stochastic_drift = kappa > OU_KAPPA_HIGH_THRESHOLD
    except Exception:
        pass

    # Vector Field (discrete curl)
    try:
        curl = _vector_curl(closes_arr, volumes_arr)
        result.vector_curl = curl
        if not np.isnan(curl):
            result.vector_field = abs(curl) > VECTOR_CURL_THRESHOLD
    except Exception:
        pass

    # Geometric Curvature (Frenet κ z-score)
    try:
        mean_kappa = _frenet_curvature(closes_arr)
        if not np.isnan(mean_kappa) and len(closes_arr) >= GEO_CURVATURE_WINDOW:
            # Compute z-score against rolling window
            chunk_kappas = []
            step = max(1, GEO_CURVATURE_WINDOW // 2)
            for start in range(0, len(closes_arr) - GEO_CURVATURE_WINDOW, step):
                k = _frenet_curvature(closes_arr[start: start + GEO_CURVATURE_WINDOW])
                if not np.isnan(k):
                    chunk_kappas.append(k)
            if len(chunk_kappas) > 2:
                mu_k = float(np.mean(chunk_kappas))
                sd_k = float(np.std(chunk_kappas, ddof=1)) + 1e-12
                result.curvature_zscore = (mean_kappa - mu_k) / sd_k
                result.geometric_curvature = result.curvature_zscore > GEO_CURVATURE_THRESHOLD
    except Exception:
        pass

    # Fractal Dimension (Higuchi)
    try:
        fd = _higuchi_fd(closes_arr)
        result.higuchi_fd = fd
        if not np.isnan(fd):
            result.fractal_complex = fd > HIGUCHI_HIGH_FD
            result.fractal_trending = fd < HIGUCHI_LOW_FD
    except Exception:
        pass

    # Differential Form (exterior derivative magnitude)
    try:
        mag = _differential_form_magnitude(closes_arr)
        result.diff_form_magnitude = mag
        if not np.isnan(mag):
            # Normalise against window std of magnitudes
            mags = []
            step = max(1, DIFF_FORM_WINDOW // 3)
            for start in range(0, len(closes_arr) - DIFF_FORM_WINDOW, step):
                m = _differential_form_magnitude(closes_arr[start: start + DIFF_FORM_WINDOW])
                if not np.isnan(m):
                    mags.append(m)
            if mags:
                threshold = float(np.percentile(mags, 80))
                result.differential_form = mag > max(threshold, 1e-10)
    except Exception:
        pass

    return result


def classify_many(
    ticker_frames: Dict[str, pd.DataFrame],
    *,
    log_interval: int = 50,
) -> ZoneSummary:
    """
    Classify a dict of {ticker → DataFrame} into a ZoneSummary.

    Parameters
    ----------
    ticker_frames:
        Mapping of symbol → OHLCV DataFrame.
    log_interval:
        How often to emit a progress log.
    """
    summary = ZoneSummary(total=len(ticker_frames))

    for idx, (sym, df) in enumerate(ticker_frames.items(), 1):
        if idx % log_interval == 0:
            logger.info("classify_many: processed %d / %d", idx, summary.total)

        result = classify_ticker(sym, df)

        if result.error:
            summary.errors.append(result)
            continue

        if result.expansion:
            summary.expansion_zones.append(result)
        if result.consolidation:
            summary.consolidation_zones.append(result)
        if result.bull_trigger:
            summary.bull_triggers.append(result)
        if result.stochastic_drift:
            summary.stochastic_drift_zones.append(result)
        if result.vector_field:
            summary.vector_field_zones.append(result)
        if result.geometric_curvature:
            summary.geometric_curvature_zones.append(result)
        if result.fractal_complex:
            summary.fractal_complex_zones.append(result)
        if result.fractal_trending:
            summary.fractal_trending_zones.append(result)
        if result.differential_form:
            summary.differential_form_zones.append(result)

    logger.info(
        "Zone scan complete: %d tickers → %d expansion, %d consolidation, %d bull triggers, %d errors",
        summary.total,
        len(summary.expansion_zones),
        len(summary.consolidation_zones),
        len(summary.bull_triggers),
        len(summary.errors),
    )
    return summary


def classify_from_batch_df(
    batch_df: pd.DataFrame,
    tickers: List[str],
    *,
    log_interval: int = 50,
) -> ZoneSummary:
    """
    Classify zones from a single multi-ticker DataFrame produced by
    ``yfinance.download(tickers, ...)``.

    The DataFrame is expected to have a two-level MultiIndex on columns
    (field, ticker) – e.g. ``("Close", "AAPL")``.  If yfinance returned
    only a single-level column frame (one ticker), it is wrapped.
    """
    if batch_df is None or batch_df.empty:
        return ZoneSummary(total=len(tickers))

    # Build per-ticker frames without copying the whole dataset
    ticker_frames: Dict[str, pd.DataFrame] = {}

    if isinstance(batch_df.columns, pd.MultiIndex):
        for sym in tickers:
            try:
                sub = batch_df.xs(sym, level=1, axis=1, drop_level=True)
                ticker_frames[sym] = sub
            except KeyError:
                # Ticker not present in the batch result – treat as empty
                ticker_frames[sym] = pd.DataFrame()
    else:
        # Single-ticker fallback: the whole frame belongs to tickers[0]
        if len(tickers) == 1:
            ticker_frames[tickers[0]] = batch_df
        else:
            logger.warning("classify_from_batch_df: single-level columns but multiple tickers; skipping.")
            return ZoneSummary(total=len(tickers))

    return classify_many(ticker_frames, log_interval=log_interval)
