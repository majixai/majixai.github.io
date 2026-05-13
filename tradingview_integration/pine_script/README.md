# Pattern Recognition Engine — Pine Script v5

**File:** `pattern_recognition.pine`
**Language:** Pine Script v5
**Type:** Indicator (overlay)

---

## Overview

A comprehensive pattern-recognition engine that detects **101 chart patterns** across four
categories, layers **complex confluence analysis** (§10), and adds a **Bayesian next-pattern
predictor** (§11).  Every detected pattern is stamped with a colour-coded label on the chart.
Toggle each category independently from the **Inputs** panel.

---

## Sections

| § | Title | Lines |
|---|-------|-------|
| 1 | Inputs & Settings | — |
| 2 | Common Calculations (ATR, candle anatomy, bar aliases) | — |
| 3 | Pivot Array Maintenance | — |
| 4 | Helper Functions (labels, Fibonacci, pct-tolerance) | — |
| 5 | Single-Bar Candlestick Patterns **[11]** | — |
| 6 | Two-Bar Candlestick Patterns **[15]** | — |
| 7 | Multi-Bar Candlestick Patterns **[18]** | — |
| 8 | Classic Chart Patterns **[31]** | — |
| 9 | Harmonic Patterns **[26]** | — |
| 10 | Complex Situations — Confluence & Context Engine | — |
| 11 | Bayesian Next-Pattern Class Predictor | — |

---

## Pattern Catalogue (101 total)

### Single-Bar Candlestick [11]

| # | Pattern | Label | Bias |
|---|---------|-------|------|
| 1 | Doji | `DOJI` | Neutral |
| 2 | Long-Legged Doji | `LLD` | Neutral |
| 3 | Dragonfly Doji | `DFD` | Bullish |
| 4 | Gravestone Doji | `GSD` | Bearish |
| 5 | Spinning Top | `SPIN` | Neutral |
| 6 | Marubozu Bullish | `MARU↑` | Bullish |
| 7 | Marubozu Bearish | `MARU↓` | Bearish |
| 8 | Hammer | `HAMR` | Bullish |
| 9 | Hanging Man | `HANG` | Bearish |
| 10 | Inverted Hammer | `INVH` | Bullish |
| 11 | Shooting Star | `SHOT★` | Bearish |

### Two-Bar Candlestick [15]

| # | Pattern | Label | Bias |
|---|---------|-------|------|
| 12 | Bullish Engulfing | `ENG↑` | Bullish |
| 13 | Bearish Engulfing | `ENG↓` | Bearish |
| 14 | Tweezer Top | `TWEE↓` | Bearish |
| 15 | Tweezer Bottom | `TWEE↑` | Bullish |
| 16 | Bullish Harami | `HAMI↑` | Bullish |
| 17 | Bearish Harami | `HAMI↓` | Bearish |
| 18 | Bullish Harami Cross | `HAMI×↑` | Bullish |
| 19 | Bearish Harami Cross | `HAMI×↓` | Bearish |
| 20 | Piercing Line | `PIER` | Bullish |
| 21 | Dark Cloud Cover | `DARK` | Bearish |
| 22 | On-Neck | `ONECK` | Bearish |
| 23 | In-Neck | `INECK` | Bearish |
| 24 | Thrusting | `THRU` | Bearish |
| 43 | Kicker Bullish | `KICK↑` | Bullish |
| 44 | Kicker Bearish | `KICK↓` | Bearish |

### Multi-Bar Candlestick [18]

| # | Pattern | Label | Bias |
|---|---------|-------|------|
| 25 | Morning Star | `MORN★` | Bullish |
| 26 | Evening Star | `EVEN★` | Bearish |
| 27 | Morning Doji Star | `MDoji★` | Bullish |
| 28 | Evening Doji Star | `EDoji★` | Bearish |
| 29 | Three White Soldiers | `3SOL↑` | Bullish |
| 30 | Three Black Crows | `3CRW↓` | Bearish |
| 31 | Three Inside Up | `3IN↑` | Bullish |
| 32 | Three Inside Down | `3IN↓` | Bearish |
| 33 | Three Outside Up | `3OUT↑` | Bullish |
| 34 | Three Outside Down | `3OUT↓` | Bearish |
| 35 | Rising Three Methods | `RISE3` | Bullish |
| 36 | Falling Three Methods | `FALL3` | Bearish |
| 37 | Abandoned Baby Bullish | `ABB↑` | Bullish |
| 38 | Abandoned Baby Bearish | `ABB↓` | Bearish |
| 39 | Upside Gap Two Crows | `UG2C` | Bearish |
| 40 | Tasuki Gap Bullish | `TASK↑` | Bullish |
| 41 | Tasuki Gap Bearish | `TASK↓` | Bearish |
| 42 | Mat Hold | `MATH` | Bullish |

### Classic Chart Patterns [31]

| # | Pattern | Label | Bias |
|---|---------|-------|------|
| 45 | Head & Shoulders | `H&S` | Bearish |
| 46 | Inverse H&S | `iH&S` | Bullish |
| 47 | Double Top | `DBL↓` | Bearish |
| 48 | Double Bottom | `DBL↑` | Bullish |
| 49 | Triple Top | `TRI↓` | Bearish |
| 50 | Triple Bottom | `TRI↑` | Bullish |
| 51 | Cup & Handle | `CUP` | Bullish |
| 52 | Inverted Cup & Handle | `iCUP` | Bearish |
| 53 | Ascending Triangle | `ASC△` | Bullish |
| 54 | Descending Triangle | `DSC▽` | Bearish |
| 55 | Symmetrical Triangle | `SYM△` | Neutral |
| 56 | Expanding Triangle | `EXP△` | Neutral |
| 57 | Rising Wedge | `R.WDG↓` | Bearish |
| 58 | Falling Wedge | `F.WDG↑` | Bullish |
| 59 | Bull Flag | `BULL♦` | Bullish |
| 60 | Bear Flag | `BEAR♦` | Bearish |
| 61 | Bull Pennant | `B.PNT↑` | Bullish |
| 62 | Bear Pennant | `B.PNT↓` | Bearish |
| 63 | Rounding Bottom | `SAUC↑` | Bullish |
| 64 | Rounding Top | `RTOP↓` | Bearish |
| 65 | Rectangle Bullish Break | `RECT↑` | Bullish |
| 66 | Rectangle Bearish Break | `RECT↓` | Bearish |
| 67 | Diamond Top | `DIAM↓` | Bearish |
| 68 | Diamond Bottom | `DIAM↑` | Bullish |
| 69 | Bump and Run Reversal | `BUMP↓` | Bearish |
| 70 | Dead Cat Bounce | `DCB↓` | Bearish |
| 71 | High-Tight Flag | `HTF↑` | Bullish |
| 72 | Channel Up | `CH↑` | Bullish |
| 73 | Channel Down | `CH↓` | Bearish |
| 74 | Megaphone | `MEGA` | Neutral |
| 75 | Flat Top Breakout | `FLT↑` | Bullish |

### Harmonic Patterns [26]

| # | Pattern | Label | Key Ratios |
|---|---------|-------|-----------|
| 76 | ABCD Bullish | `ABCD↑` | CD=AB, BC=0.618·AB |
| 77 | ABCD Bearish | `ABCD↓` | CD=AB, BC=0.618·AB |
| 78 | Gartley Bullish | `GART↑` | AB=0.618·XA, CD=0.786·XA |
| 79 | Gartley Bearish | `GART↓` | AB=0.618·XA, CD=0.786·XA |
| 80 | Bat Bullish | `BAT↑` | AB=0.382-0.5·XA, CD=0.886·XA |
| 81 | Bat Bearish | `BAT↓` | AB=0.382-0.5·XA, CD=0.886·XA |
| 82 | Butterfly Bullish | `BFLY↑` | AB=0.786·XA, CD=1.272-1.618·XA |
| 83 | Butterfly Bearish | `BFLY↓` | AB=0.786·XA, CD=1.272-1.618·XA |
| 84 | Crab Bullish | `CRAB↑` | AB=0.382-0.618·XA, CD=1.618·XA |
| 85 | Crab Bearish | `CRAB↓` | AB=0.382-0.618·XA, CD=1.618·XA |
| 86 | Deep Crab Bullish | `DCRAB↑` | AB=0.886·XA, CD=2.618-3.618·XA |
| 87 | Deep Crab Bearish | `DCRAB↓` | AB=0.886·XA, CD=2.618-3.618·XA |
| 88 | Cypher Bullish | `CYPH↑` | AB=0.382-0.618·XA, CD=0.786·XC |
| 89 | Cypher Bearish | `CYPH↓` | AB=0.382-0.618·XA, CD=0.786·XC |
| 90 | Shark Bullish | `SHRK↑` | AB=0.886-1.13·XA, BC=1.618-2.24 |
| 91 | Shark Bearish | `SHRK↓` | AB=0.886-1.13·XA, BC=1.618-2.24 |
| 92 | Alt Bat Bullish | `ABAT↑` | AB=0.382·XA, CD=1.13·XA |
| 93 | Alt Bat Bearish | `ABAT↓` | AB=0.382·XA, CD=1.13·XA |
| 94 | Three Drives Bullish | `3DRV↑` | Three equal-length down drives |
| 95 | Three Drives Bearish | `3DRV↓` | Three equal-length up drives |
| 96 | 5-0 Bullish | `5-0↑` | BC=1.618-2.24·AB, CD=0.5·BC |
| 97 | 5-0 Bearish | `5-0↓` | BC=1.618-2.24·AB, CD=0.5·BC |
| 98 | Nen-Star Bullish | `NEN↑` | AB=0.618·XA, CD=1.272·XA |
| 99 | Nen-Star Bearish | `NEN↓` | AB=0.618·XA, CD=1.272·XA |
| 100 | XABCD Alt Bullish | `XAB↑` | CD=1.272·AB |
| 101 | XABCD Alt Bearish | `XAB↓` | CD=1.272·AB |

---

## §10 — Complex Situations Engine

Context-aware confluence analysis that fires **secondary labels** when multiple conditions
align simultaneously.  All labels are toggle-controlled by the *Complex Situations* input
group.

| Label | Meaning | Required Conditions |
|-------|---------|---------------------|
| `★HC BULL ×N` | High-Conviction Bullish | ≥N bull signals + EMA bull stack + vol surge |
| `★HC BEAR ×N` | High-Conviction Bearish | ≥N bear signals + EMA bear stack + vol surge |
| `CLSTR↑ [Cs/Ch/Hm]` | Multi-Category Bull Cluster | Bull signals from ≥2 of: Candle / Chart / Harmonic |
| `CLSTR↓ [Cs/Ch/Hm]` | Multi-Category Bear Cluster | Bear signals from ≥2 of: Candle / Chart / Harmonic |
| `SQZ↑ ×N` | Squeeze Breakout Bullish | ATR contraction→expansion + ≥1 bull signal |
| `SQZ↓ ×N` | Squeeze Breakout Bearish | ATR contraction→expansion + ≥1 bear signal |
| `SR↑ ×N` | Support Bounce | ≥1 bull signal near pivot-low level (counter-trend) |
| `SR↓ ×N` | Resistance Rejection | ≥1 bear signal near pivot-high level (counter-trend) |
| `DIV↑ ×N` | Divergence Bull | RSI bullish divergence + ≥1 bull candle/chart signal |
| `DIV↓ ×N` | Divergence Bear | RSI bearish divergence + ≥1 bear candle/chart signal |
| `EXH↑` | Exhaustion Recovery | Price >2.5×ATR below EMA200 + bullish signal |
| `EXH↓` | Exhaustion Reversal | Price >2.5×ATR above EMA200 + bearish signal |
| `COIL@SR` | Coiled Spring at S/R | Inside bar sitting on/at a key pivot level |
| `VDR` | Volume-Dry Reversal | Pattern fires on unusually thin volume (exhaustion) |

**Context overlays** (always plotted when enabled):

| Visual | Description |
|--------|-------------|
| EMA 20 (blue) | Short-term trend |
| EMA 50 (orange) | Mid-term trend |
| EMA 200 (red) | Long-term trend |
| Green background | EMA20 > EMA50 > EMA200 (bull stack) |
| Red background | EMA20 < EMA50 < EMA200 (bear stack) |

---

## §11 — Bayesian Next-Pattern Predictor

A **5-state Markov chain** that learns pattern-to-pattern transitions from the live price
history and predicts the most probable *next* pattern class.

### Pattern Classes

| ID | Class | Typical Patterns |
|----|-------|-----------------|
| 0 | **Strong Bull** | Marubozu↑, Bullish Engulfing, 3 White Soldiers, iH&S, Gartley↑ … |
| 1 | **Mild Bull** | Hammer, Harami↑, Falling Wedge, Bull Flag, ABCD↑ … |
| 2 | **Neutral** | Doji, Spinning Top, Symmetrical Triangle, Megaphone … |
| 3 | **Mild Bear** | Shooting Star, Dark Cloud, Rising Wedge, Bear Flag, ABCD↓ … |
| 4 | **Strong Bear** | Marubozu↓, Bearish Engulfing, 3 Black Crows, H&S, Gartley↓ … |

### Algorithm

```
Prior:    T[i,j]  =  α   ∀ i,j        (Laplace smoothing; α configurable, default 1)
Update:   T[prevClass, curClass] += 1  (on every bar with a detected pattern)
Predict:  P(next=j | current=i)  =  T[i,j] / Σ_k T[i,k]
```

- **No training data required** — the matrix builds from the chart's own history bar-by-bar.
- **Laplace prior** (α ≥ 1) ensures no probability is ever zero.
- The predictor improves with more bars; the *Observations* row shows how many pattern
  transitions have been recorded.

### Bayesian Table (bottom-right)

| Row | Content |
|-----|---------|
| Header | "Bayesian Predictor" |
| Current | Current bar's pattern class + bull/bear signal counts |
| Rows 2–6 | P(next class) for each of the 5 classes + probability bar |
| ⟹ NEXT | Highlighted most-probable next class and its probability % |
| Observations | Number of real transitions observed (excl. Laplace prior) |
| EMA Trend | Current EMA stack state + volume condition |
| ATR Regime | SQUEEZE / EXPAND / COIL / NORMAL |

---

## Inputs

| Group | Parameter | Default | Description |
|-------|-----------|---------|-------------|
| Candlestick | Single-Bar | on | Toggle 11 single-bar patterns |
| Candlestick | Two-Bar | on | Toggle 13 two-bar patterns |
| Candlestick | Multi-Bar | on | Toggle 18 multi-bar patterns |
| Chart | Chart Patterns | on | Toggle 31 classic chart patterns |
| Chart | Pivot Left/Right | 5 / 5 | Pivot confirmation bars each side |
| Chart | Max Pivot History | 10 | Depth of pivot arrays |
| Chart | Pattern Tolerance | 3% | Price similarity tolerance |
| Harmonic | Harmonic Patterns | on | Toggle 26 harmonic patterns |
| Harmonic | Fibonacci Tolerance | 5% | Ratio matching tolerance |
| Display | Label Size | small | tiny / small / normal |
| Display | Show Bullish Labels | on | Hide/show green labels |
| Display | Show Bearish Labels | on | Hide/show red labels |
| Display | ATR Length | 14 | ATR length for candle sizing |
| Complex Situations | Complex Situation Labels | on | Toggle §10 confluence labels |
| Complex Situations | EMA Trend Lines | on | Plot EMA 20/50/200 |
| Complex Situations | Min Signals for HC Label | 2 | Bull/bear signal threshold for ★HC |
| Complex Situations | Background Trend Shade | on | Subtle green/red bar background |
| Bayesian Predictor | Show Bayesian Table | on | Toggle §11 prediction table |
| Bayesian Predictor | Laplace Prior α | 1 | Smoothing constant (1 = weakest prior) |

---

## Visual Elements

| Element | Description |
|---------|-------------|
| Green label (▲) | Bullish pattern detected |
| Red label (▼) | Bearish pattern detected |
| Gray label (▼) | Neutral / reversal-agnostic pattern |
| Lime label `★HC BULL` | High-conviction bullish confluence |
| Orange label `★HC BEAR` | High-conviction bearish confluence |
| Teal label `SQZ↑` | Volatility squeeze breakout bullish |
| Maroon label `SQZ↓` | Volatility squeeze breakout bearish |
| Summary table (top-right) | Pattern count per category + live bull/bear signal counts |
| Bayesian table (bottom-right) | P(next class) for 5 classes + top prediction + context |


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

# XRP Breakout Matrix Bayesian GC — Pine Script v6

**File:** `xrp_breakout_matrix_bayesian.pine`  
**Language:** Pine Script v6  
**Type:** Indicator (overlay)

---

## Overview

A breakout-focused XRP indicator that combines **cup-and-handle geometry**, **Bayesian posterior scoring**, **multi-timeframe squeeze confluence**, and **garbage-collection clustering** for drawing management. The script uses nested UDTs to keep pivots, execution levels, drawings, and Bayesian metadata isolated but linked inside a single pattern state object.

**Prerequisites**

- Pine Script **v6** support in the TradingView editor.
- Enough object headroom for scripts using high drawing limits (`max_lines_count=500`, `max_labels_count=500`, `max_boxes_count=300`, `max_polylines_count=100`).

---

## Core Components

| Component | Purpose |
|-----------|---------|
| `Swing` | Rolling pivot stream for rim / bowl / handle discovery |
| `PatternPivots` | Nested storage for left rim, bottom, right rim, and handle swings |
| `PatternLevels` | Entry structure: rim, invalidation, and target prices |
| `PatternDrawings` | Cup polyline, handle polyline, target line, target box, stop box, and label |
| `BayesianIntel` | Posterior probability, MTF confluence score, confidence state |
| `BrewPattern` | Master state object joining pivots, levels, drawings, Bayesian state, side, lifecycle, and cluster id |
| `GarbageCollector` | Pattern pool manager that sweeps invalidated drawings while preserving stronger clusters |

---

## Engines

### 1. Volatility Matrix

- Bollinger-band squeeze detection on the active chart.
- Gradient shading between upper/lower bands to visualise compression intensity.
- Additional gradient fill weighted by MTF Bayesian confluence.

### 2. Multi-Timeframe Bayesian Matrix

- Dynamic hierarchy: lower, mid-1, mid-2, and upper timeframes.
- `request.security()` squeeze checks for each layer.
- 4×2 matrix stores squeeze states and timeframe durations for dashboard rendering.
- Posterior probability rises as cross-timeframe squeeze agreement improves.

### 3. GC Clustering

- Patterns are assigned to cluster buckets.
- A cluster matrix tracks total, active, validated, and cumulative-posterior values.
- Invalidated patterns are swept once the pool exceeds the GC trigger, while the strongest cluster is retained longer.

### 4. Dynamic Alert Pipeline

- Entry alerts use `alert()` instead of static `alertcondition()`.
- JSON payloads include action, pattern, posterior, MTF score, rim price, stop, target, cluster id, and `log_sheet: "Tickers"`.

---

## Visual Elements

| Element | Description |
|---------|-------------|
| Curved cup polyline | Structural cup mapping |
| Curved handle polyline | Handle recovery / rejection path |
| Target line | Measured-move projection |
| Target box | Target zone band |
| Stop box | Invalidation zone band |
| Pattern label | Pattern name + posterior + MTF score |
| Bollinger fill | Compression gradient |
| Dashboard table | Four timeframe squeeze states + posterior + GC status |

---

<!-- AUTO-UPDATE-START -->
_Last updated: 2026-05-13 17:22 UTC_

### Live Market Snapshot  (yfinance · Yahoo Finance chart fallback)

| Ticker | Exch | Price | Chg | Chg% | Mom-5b | RSI~ | Src | Updated |
|--------|------|-------|-----|------|--------|------|-----|---------|
| [SPY](https://finance.yahoo.com/quote/SPY) | NYSEARCA | $742.615 | 5.955 | 0.8084% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [QQQ](https://finance.yahoo.com/quote/QQQ) | NASDAQ | $714.725 | 9.825 | 1.3938% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [DIA](https://finance.yahoo.com/quote/DIA) | NYSEARCA | $496.373 | -2.677 | -0.5364% | ─ | — | yahoo_chart | 2026-05-13 17:22 UTC |
| [IWM](https://finance.yahoo.com/quote/IWM) | NYSEARCA | $282.385 | 0.425 | 0.1507% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [AAPL](https://finance.yahoo.com/quote/AAPL) | NASDAQ | $299.4 | 4.91 | 1.6673% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [MSFT](https://finance.yahoo.com/quote/MSFT) | NASDAQ | $404.44 | -3.1625 | -0.7759% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [GOOGL](https://finance.yahoo.com/quote/GOOGL) | NASDAQ | $401.45 | 11.76 | 3.0178% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [AMZN](https://finance.yahoo.com/quote/AMZN) | NASDAQ | $269.595 | 2.265 | 0.8473% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [TSLA](https://finance.yahoo.com/quote/TSLA) | NASDAQ | $449.185 | 18.8705 | 4.3853% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [NVDA](https://finance.yahoo.com/quote/NVDA) | NASDAQ | $227.29 | 7.8114 | 3.5591% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [META](https://finance.yahoo.com/quote/META) | NASDAQ | $614.69 | 12.84 | 2.1334% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [JPM](https://finance.yahoo.com/quote/JPM) | NYSE | $301.54 | -3.01 | -0.9883% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [BAC](https://finance.yahoo.com/quote/BAC) | NYSE | $50.3698 | -0.4502 | -0.8859% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [GS](https://finance.yahoo.com/quote/GS) | NYSE | $953.5775 | 8.5775 | 0.9077% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [XOM](https://finance.yahoo.com/quote/XOM) | NYSE | $151.315 | 0.795 | 0.5282% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [GLD](https://finance.yahoo.com/quote/GLD) | NYSEARCA | $431.635 | -1.565 | -0.3613% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [SLV](https://finance.yahoo.com/quote/SLV) | NYSEARCA | $80.645 | 1.745 | 2.2117% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [TLT](https://finance.yahoo.com/quote/TLT) | NASDAQ | $84.79 | -0.1572 | -0.1851% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [VIX](https://finance.yahoo.com/quote/^VIX) | INDEXCBOE | $17.96 | -0.03 | -0.1668% | ─ | — | yfinance | 2026-05-13 17:22 UTC |
| [BTC-USD](https://finance.yahoo.com/quote/BTC-USD) | CRYPTO | $79282.0 | -1202.0781 | -1.4936% | ─ | — | yfinance | 2026-05-13 17:22 UTC |

#### Market Breadth
- Advancing: **12** / 20  | Declining: **8**  | Unchanged: 0
- Composite score: **-1127.35**  | Avg RSI proxy: 0.0
- Positive momentum (5b): 0  | Negative: 0

<!-- AUTO-UPDATE-END -->
