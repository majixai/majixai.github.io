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
_Last updated: 2026-04-15 19:42 UTC_

### Live Market Snapshot  (yfinance · Yahoo Finance chart fallback)

| Ticker | Exch | Price | Chg | Chg% | Mom-5b | RSI~ | Src | Updated |
|--------|------|-------|-----|------|--------|------|-----|---------|
| [SPY](https://finance.yahoo.com/quote/SPY) | NYSEARCA | $699.44 | 4.84 | 0.6968% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [QQQ](https://finance.yahoo.com/quote/QQQ) | NASDAQ | $636.64 | 7.68 | 1.2211% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [DIA](https://finance.yahoo.com/quote/DIA) | NYSEARCA | $484.48 | -1.07 | -0.2204% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [IWM](https://finance.yahoo.com/quote/IWM) | NYSEARCA | $268.96 | 0.2001 | 0.0744% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [AAPL](https://finance.yahoo.com/quote/AAPL) | NASDAQ | $265.72 | 7.1199 | 2.7532% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [MSFT](https://finance.yahoo.com/quote/MSFT) | NASDAQ | $412.12 | 17.7201 | 4.4929% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [GOOGL](https://finance.yahoo.com/quote/GOOGL) | NASDAQ | $336.19 | 2.9 | 0.8701% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [AMZN](https://finance.yahoo.com/quote/AMZN) | NASDAQ | $248.63 | -0.53 | -0.2127% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [TSLA](https://finance.yahoo.com/quote/TSLA) | NASDAQ | $393.73 | 27.73 | 7.5765% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [NVDA](https://finance.yahoo.com/quote/NVDA) | NASDAQ | $198.205 | 2.015 | 1.0271% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [META](https://finance.yahoo.com/quote/META) | NASDAQ | $673.29 | 7.355 | 1.1045% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [JPM](https://finance.yahoo.com/quote/JPM) | NYSE | $305.57 | -5.72 | -1.8375% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [BAC](https://finance.yahoo.com/quote/BAC) | NYSE | $54.295 | 0.905 | 1.6951% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [GS](https://finance.yahoo.com/quote/GS) | NYSE | $897.465 | -12.355 | -1.358% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [XOM](https://finance.yahoo.com/quote/XOM) | NYSE | $149.02 | 0.36 | 0.2422% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [GLD](https://finance.yahoo.com/quote/GLD) | NYSEARCA | $440.47 | -3.83 | -0.862% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [SLV](https://finance.yahoo.com/quote/SLV) | NYSEARCA | $71.805 | -0.195 | -0.2708% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [TLT](https://finance.yahoo.com/quote/TLT) | NASDAQ | $86.825 | -0.485 | -0.5555% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [VIX](https://finance.yahoo.com/quote/^VIX) | INDEXCBOE | $18.0 | -0.36 | -1.9608% | ─ | — | yfinance | 2026-04-15 19:42 UTC |
| [BTC-USD](https://finance.yahoo.com/quote/BTC-USD) | CRYPTO | $75099.4609 | 894.8125 | 1.2059% | ─ | — | yfinance | 2026-04-15 19:42 UTC |

#### Market Breadth
- Advancing: **12** / 20  | Declining: **8**  | Unchanged: 0
- Composite score: **+949.09**  | Avg RSI proxy: 0.0
- Positive momentum (5b): 0  | Negative: 0

<!-- AUTO-UPDATE-END -->
