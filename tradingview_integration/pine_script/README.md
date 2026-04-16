# Scalp POI Strategy — Pine Script v2

**File:** `scalp_poi_hs_dirac.pine`  
**Language:** Pine Script v5  
**Type:** Strategy (backtest-enabled, overlay)

---

## Overview

A multi-engine scalping strategy that detects local price extremes (**Points of
Interest — POI**) from rolling pivot high/low history.  Entry conviction is built
from **15 independent analytical engines** combined into a composite bull/bear
score.  A trade fires only when the score clears a configurable threshold *and*
the bull-minus-bear edge exceeds a minimum gap.

---

## Engine Components

| # | Engine | Method | Score Contribution |
|---|--------|--------|--------------------|
| ① | **Pivot / POI** | `ta.pivothigh` / `ta.pivotlow` rolling arrays | Break of nearest POI = +1.5 |
| ② | **Head & Shoulders** | 3-pivot geometry + neckline break | +2.0 per confirmed pattern |
| ③ | **Double Top / Bottom** | 2-equal-peak + valley depth check | +1.5 per pattern |
| ④ | **Linear Regression** | Manual OLS: slope, intercept, R², std-error | R² × weight when slope aligned |
| ⑤ | **Polynomial Curvature** | 2nd + 3rd linreg differences (accel + jerk) | ±0.8 / ±0.4 normalised |
| ⑥ | **Dirac Proximity** | Lorentzian `1/(π·w·(1+(x/w)²))` to POI | 0→1 normalised weight |
| ⑦ | **Cosh Momentum** | `cosh(barRet × scale)` magnitude gate | +0.5 when cosh > threshold |
| ⑧ | **Skew Z-Score** | Asymmetric Z with independent bull/bear multipliers | Continuous ±contribution |
| ⑨ | **RSI Divergence** | Higher RSI low / lower RSI high at pivot | +1.2 per divergence |
| ⑩ | **CMF** | Chaikin Money Flow direction | 0→1 × weight |
| ⑪ | **OBV** | On Balance Volume slope | 0→1 × weight |
| ⑫ | **VWAP** | Session VWAP deviation Z-score | 0→2 × weight |
| ⑬ | **Regime** | ADX trending/ranging + MTF EMA | Multiplier 1.0 / 0.5 |
| ⑭ | **Neckline Retest** | Post-break pullback to neckline | +1.2 (H&S weight × 0.6) |
| ⑮ | **Confluence Counter** | Count of agreeing engines (0–9) | Lowers threshold by 0.5 when ≥5 |

---

## Parameter Groups

| Group | Key Inputs |
|-------|-----------|
| Pivot Detection | Left/Right bars, max stored pivots |
| Pattern H&S | Neckline tolerance, shoulder symmetry %, weight, retest window |
| Pattern DT/DB | Tolerance %, min valley depth %, lookback, weight |
| Statistics | Std dev length, ATR length, RSI length, CMF length |
| Linear Regression | Length (10–200), band multiplier, min R², weight, slope filter |
| Polynomial Curvature | Lookback, curvature weight, jerk weight |
| Dirac Delta | ATR multiplier for width, score weight |
| Cosh Momentum | Scale, threshold, weight |
| Skew Disjointing | Bull multiplier, bear multiplier, lookback, weight |
| Divergence | Pivot lookback, weight |
| CMF / Volume | Weight, OBV slope lookback, weight |
| VWAP | Enable toggle, Z-score lookback, weight |
| Regime | ADX length, threshold, MTF timeframe, MTF EMA length, require-trending toggle |
| Entry | Base threshold, score edge, adaptive confluence toggle, bar cooldown |
| Risk | Stop %, TP %, trailing stop toggle + % |
| Filters | Volume filter + multiplier, ATR % floor |
| Display | Pivots, POI, bands, regression channel, VWAP, score label, engine table |

---

## Regression Analysis Detail

The regression subsystem implements **Ordinary Least Squares (OLS)** from scratch
(Pine Script has no native OLS function that returns statistics):

```
slope     = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
intercept = (Σy − slope·Σx) / n
R²        = 1 − SS_res / SS_tot
std_err   = √(SS_res / (n − 2))
```

A **regression channel** is plotted at `lrLine ± band_mult × std_err`.

**Polynomial curvature** is approximated via second and third differences of
`ta.linreg` values (no matrix operations needed):

```
accel = (lr[0] − lr[1]) − (lr[1] − lr[2])   // 2nd order
jerk  = accel[0] − accel[1]                  // 3rd order
```

Both are normalised by ATR and contribute independently to the composite score.

---

## Risk Management

- Fixed SL / TP set at `strategy.exit` on entry.
- **Manual trailing stop** ratchets the protective stop toward the position as
  price moves in the trade's favour.  Updated every bar; never moves against
  the trade.
- **Bar cooldown** prevents re-entering too quickly after a fill.

---

## Visual Elements

| Element | Description |
|---------|-------------|
| 1σ / 2σ / 3σ bands | Standard-deviation channels (filled) |
| Regression channel | OLS line ± std-err band (filled blue) |
| VWAP | Session-anchored VWAP step-line |
| Session open | Additional POI level (yellow) |
| POI levels × 4 | Nearest + 2nd-nearest resistance and support |
| Necklines | Dashed lines for H&S, iH&S, DT, DB |
| Trailing stop | Dot-lines following the live stop level |
| Pivot markers | Triangles at each confirmed pivot |
| Pattern labels | H&S · iH&S · DT · DB stamps |
| Retest diamonds | Small diamonds at neckline retest bars |
| Divergence circles | Aqua / orange dots at RSI divergence pivots |
| Entry arrows | Full-size up/down arrows |
| Score label | Per-bar stats: scores, confluence, R², slope, curvature, ATR, ADX, VWAP Z, CMF |
| Engine table | Top-right table showing every engine's bull/bear contribution |

---

## Future Recommendations

The following enhancements are planned for subsequent versions:

1. **Volume Profile / VPOC** — accumulate tick-level volume by price bucket to
   identify the Value Area High / Low as additional POI anchors.
2. **Market Structure Shift (MSS) detection** — label each pivot as HH/HL (uptrend)
   or LH/LL (downtrend) and trigger only on confirmed structure breaks.
3. **Wavelet-based noise filter** — apply a Haar or Daubechies wavelet
   decomposition to separate trend from high-frequency noise before computing
   pivot levels.
4. **Kalman Filter price smoothing** — replace raw `close` as input to the OLS
   regression for a lower-noise slope estimate.
5. **Hidden Markov Model regime tagging** — replace the ADX-only regime filter
   with a two-state (trend / range) HMM updated via a Viterbi-like approximation.
6. **Adaptive weight optimisation** — use a rolling Sharpe-ratio gradient to
   periodically re-weight the engine contributions during backtesting.
7. **Multi-symbol basket scoring** — combine scores from correlated instruments
   (e.g. SPY + QQQ) for confluence-filtered entries.
8. **GPT / LLM sentiment overlay** — inject a daily sentiment Z-score fetched
   from the `pine_poi_updater.py` workflow into the composite score via
   `request.seed()`.
9. **Partial profit-taking** — add a mid-TP close (e.g. 50% at 0.8×TP) and let
   remainder run to full TP, reducing average holding time.
10. **Portfolio heat management** — cap the number of simultaneous open positions
    at the strategy level and scale `qty` inversely with current equity drawdown.

---

# Recursive Nested Matrix Engine — Pine Script v6

**File:** `recursive_nested_matrix_engine.pine`  
**Language:** Pine Script v5  
**Type:** Indicator (overlay)

---

## Overview

A multi-pattern detection engine built on a 5-level **Recursive Nested Type** (UDT) hierarchy.  Atomic price/volume coordinates are nested into geometric segments, which are assembled into swing paths, which compose pattern manifests, all owned by a single `GlobalMatrix` engine object.  Four chart-pattern detectors fire simultaneously each bar and the highest-confidence detection is rendered.

---

## UDT Hierarchy

| Level | Type | Contains |
|-------|------|---------|
| 1 | `MatrixPoint` | `bar_index`, price, raw volume, volume z-score, ATR snapshot |
| 2 | `VectorSegment` | Two `MatrixPoint`s + slope, ATR-normalised slope, vol-delta, expansion flag |
| 3 | `SwingPath` | `VectorSegment[]` + total length, avg slope, impulsive flag |
| 4 | `PatternManifest` | Two `SwingPath`s + target, stop, R/R, confidence score, vol weight, directional bias |
| 5 | `GlobalMatrix` | `PatternManifest[]` registry + 4×2 correlation matrix + 20-bucket volume-profile matrix + HTF/LTF state |

---

## Pattern Detectors

| Signature | Geometry | Default Bias |
|-----------|----------|-------------|
| `MEGA-EXPANSION` | Three consecutive HH + two LL (diverging structure) | Volume-weighted |
| `COMPRESSION` | LH + HL convergence (pennant / wedge) | Vol-delta direction |
| `HEAD-AND-SHOULDERS` | 3 highs; head tallest; ATR-adaptive shoulder symmetry | Bearish |
| `DOUBLE-TOP` / `DOUBLE-BOTTOM` | Twin pivots within 0.5%; neckline measured move | Directional |

---

## Confidence Scoring

```
confidence = mean_abs_corr × 50  +  directional_alignment × 30  +  vol_quality × 20
```

- **`mean_abs_corr`** — average |correlation| across all 4 reference tickers (SPY, QQQ, IWM, DIA)
- **`directional_alignment`** — how much each ticker's correlation sign agrees with the pattern direction
- **`vol_quality`** — volume z-score modifier; high-volume signals score higher

Patterns below the configurable **Min Confidence Filter** (default 25 %) are suppressed.

---

## Inputs

| Group | Key Inputs |
|-------|-----------|
| Matrix System | Pivot lookback, registry depth, ATR length, volume z-score length, correlation length, min confidence filter |
| Multi-Timeframe | HTF reference TF, LTF delta-precision TF, 4 correlation tickers |
| Visualisation | S/R boxes, pattern labels, dashboard table, polylines toggles |

---

## Rendering

| Element | Description |
|---------|-------------|
| Primary polyline | Curved line through the primary swing path segments |
| Secondary polyline | Opacity-dimmed straight line for the secondary path |
| Target box | Colour-coded ±¼ ATR band at the projected target price |
| Stop box | Gray ±¼ ATR band at the stop level |
| POC box | Blue band at the volume-profile point-of-control |
| HUD label | Signature, confidence %, R/R, vol-weight, composite bias |
| Dashboard table | 3 × 8 table: all 4 correlations + closes, active node count, HTF vol-index, LTF precision factor, composite bias |

---

<!-- AUTO-UPDATE-START -->
_Last updated: 2026-04-16 19:30 UTC_

### Live Market Snapshot  (yfinance · Yahoo Finance chart fallback)

| Ticker | Exch | Price | Chg | Chg% | Mom-5b | RSI~ | Src | Updated |
|--------|------|-------|-----|------|--------|------|-----|---------|
| [SPY](https://finance.yahoo.com/quote/SPY) | NYSEARCA | $701.0391 | 0.3891 | 0.0555% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [QQQ](https://finance.yahoo.com/quote/QQQ) | NASDAQ | $639.48 | 1.145 | 0.1794% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [DIA](https://finance.yahoo.com/quote/DIA) | NYSEARCA | $485.76 | 0.335 | 0.069% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [IWM](https://finance.yahoo.com/quote/IWM) | NYSEARCA | $269.8 | -0.03 | -0.0111% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [AAPL](https://finance.yahoo.com/quote/AAPL) | NASDAQ | $263.625 | -3.3072 | -1.239% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [MSFT](https://finance.yahoo.com/quote/MSFT) | NASDAQ | $418.34 | 2.33 | 0.5601% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [GOOGL](https://finance.yahoo.com/quote/GOOGL) | NASDAQ | $335.295 | -2.005 | -0.5944% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [AMZN](https://finance.yahoo.com/quote/AMZN) | NASDAQ | $248.759 | 0.679 | 0.2737% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [TSLA](https://finance.yahoo.com/quote/TSLA) | NASDAQ | $387.64 | -5.934 | -1.5077% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [NVDA](https://finance.yahoo.com/quote/NVDA) | NASDAQ | $198.2298 | -0.2602 | -0.1311% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [META](https://finance.yahoo.com/quote/META) | NASDAQ | $673.685 | -0.1457 | -0.0216% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [JPM](https://finance.yahoo.com/quote/JPM) | NYSE | $308.75 | 2.01 | 0.6553% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [BAC](https://finance.yahoo.com/quote/BAC) | NYSE | $53.675 | -0.675 | -1.242% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [GS](https://finance.yahoo.com/quote/GS) | NYSE | $904.5701 | 3.2168 | 0.3569% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [XOM](https://finance.yahoo.com/quote/XOM) | NYSE | $151.965 | 3.0639 | 2.0577% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [GLD](https://finance.yahoo.com/quote/GLD) | NYSEARCA | $440.1101 | -2.7699 | -0.6254% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [SLV](https://finance.yahoo.com/quote/SLV) | NYSEARCA | $71.18 | -0.7246 | -1.0077% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [TLT](https://finance.yahoo.com/quote/TLT) | NASDAQ | $86.3397 | -0.4703 | -0.5418% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [VIX](https://finance.yahoo.com/quote/^VIX) | INDEXCBOE | $18.03 | -0.14 | -0.7705% | ─ | — | yfinance | 2026-04-16 19:30 UTC |
| [BTC-USD](https://finance.yahoo.com/quote/BTC-USD) | CRYPTO | $75048.3281 | 221.3047 | 0.2958% | ─ | — | yfinance | 2026-04-16 19:30 UTC |

#### Market Breadth
- Advancing: **9** / 20  | Declining: **11**  | Unchanged: 0
- Composite score: **+218.01**  | Avg RSI proxy: 0.0
- Positive momentum (5b): 0  | Negative: 0

<!-- AUTO-UPDATE-END -->
