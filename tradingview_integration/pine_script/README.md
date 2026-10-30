# Pattern Recognition Engine — Pine Script v5

**File:** `pattern_recognition.pine`
**Language:** Pine Script v5
**Type:** Indicator (overlay)

---

## Overview

A comprehensive pattern-recognition engine that detects **101 chart patterns** across four
categories, layers **complex confluence analysis** (§10), and adds a **Bayesian next-pattern
predictor** (§11). Every detected pattern is stamped with a colour-coded label on the chart.
Toggle each category independently from the **Inputs** panel.

The design goal is not simply to display a label on the bar. The engine is intended to
approximate a layered structure of price geometry analysis: local candle context, pivot-based
structure, multi-candle formations, harmonic ratio tests, and regime-aware confluence. Each
pattern is treated as a potential signal candidate with verification rules, tolerance windows,
and confidence scoring. This means the indicator behaves more like a rule engine than a single
heuristic detector.

The implementation deliberately separates:

- raw market data extraction
- price normalization and ATR-scaled geometry
- pivot array maintenance
- pattern-level validation logic
- secondary context scoring
- display and label generation
- predictive learning state

This separation keeps the code readable, maintainable, and robust when many pattern families are
active at once.

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

| # | Pattern | Label | Bias | BTC 1d % | Duration |
|---|---------|-------|------|----------|----------|
| 1 | Doji | `DOJI` | Neutral | — | — |
| 2 | Long-Legged Doji | `LLD` | Neutral | — | — |
| 3 | Dragonfly Doji | `DFD` | Bullish | — | — |
| 4 | Gravestone Doji | `GSD` | Bearish | — | — |
| 5 | Spinning Top | `SPIN` | Neutral | — | — |
| 6 | Marubozu Bullish | `MARU↑` | Bullish | — | — |
| 7 | Marubozu Bearish | `MARU↓` | Bearish | — | — |
| 8 | Hammer | `HAMR` | Bullish | — | — |
| 9 | Hanging Man | `HANG` | Bearish | — | — |
| 10 | Inverted Hammer | `INVH` | Bullish | — | — |
| 11 | Shooting Star | `SHOT★` | Bearish | — | — |

### Two-Bar Candlestick [15]

| # | Pattern | Label | Bias | BTC 1d % | Duration |
|---|---------|-------|------|----------|----------|
| 12 | Bullish Engulfing | `ENG↑` | Bullish | — | — |
| 13 | Bearish Engulfing | `ENG↓` | Bearish | — | — |
| 14 | Tweezer Top | `TWEE↓` | Bearish | — | — |
| 15 | Tweezer Bottom | `TWEE↑` | Bullish | — | — |
| 16 | Bullish Harami | `HAMI↑` | Bullish | — | — |
| 17 | Bearish Harami | `HAMI↓` | Bearish | — | — |
| 18 | Bullish Harami Cross | `HAMI×↑` | Bullish | — | — |
| 19 | Bearish Harami Cross | `HAMI×↓` | Bearish | — | — |
| 20 | Piercing Line | `PIER` | Bullish | — | — |
| 21 | Dark Cloud Cover | `DARK` | Bearish | — | — |
| 22 | On-Neck | `ONECK` | Bearish | — | — |
| 23 | In-Neck | `INECK` | Bearish | — | — |
| 24 | Thrusting | `THRU` | Bearish | — | — |
| 43 | Kicker Bullish | `KICK↑` | Bullish | — | — |
| 44 | Kicker Bearish | `KICK↓` | Bearish | — | — |

### Multi-Bar Candlestick [18]

| # | Pattern | Label | Bias | BTC 1d % | Duration |
|---|---------|-------|------|----------|----------|
| 25 | Morning Star | `MORN★` | Bullish | — | — |
| 26 | Evening Star | `EVEN★` | Bearish | — | — |
| 27 | Morning Doji Star | `MDoji★` | Bullish | — | — |
| 28 | Evening Doji Star | `EDoji★` | Bearish | — | — |
| 29 | Three White Soldiers | `3SOL↑` | Bullish | — | — |
| 30 | Three Black Crows | `3CRW↓` | Bearish | — | — |
| 31 | Three Inside Up | `3IN↑` | Bullish | — | — |
| 32 | Three Inside Down | `3IN↓` | Bearish | — | — |
| 33 | Three Outside Up | `3OUT↑` | Bullish | — | — |
| 34 | Three Outside Down | `3OUT↓` | Bearish | — | — |
| 35 | Rising Three Methods | `RISE3` | Bullish | — | — |
| 36 | Falling Three Methods | `FALL3` | Bearish | — | — |
| 37 | Abandoned Baby Bullish | `ABB↑` | Bullish | — | — |
| 38 | Abandoned Baby Bearish | `ABB↓` | Bearish | — | — |
| 39 | Upside Gap Two Crows | `UG2C` | Bearish | — | — |
| 40 | Tasuki Gap Bullish | `TASK↑` | Bullish | — | — |
| 41 | Tasuki Gap Bearish | `TASK↓` | Bearish | — | — |
| 42 | Mat Hold | `MATH` | Bullish | — | — |

### Classic Chart Patterns [31]

| # | Pattern | Label | Bias | BTC 1d % | Duration |
|---|---------|-------|------|----------|----------|
| 45 | Head & Shoulders | `H&S` | Bearish | — | — |
| 46 | Inverse H&S | `iH&S` | Bullish | — | — |
| 47 | Double Top | `DBL↓` | Bearish | — | — |
| 48 | Double Bottom | `DBL↑` | Bullish | — | — |
| 49 | Triple Top | `TRI↓` | Bearish | — | — |
| 50 | Triple Bottom | `TRI↑` | Bullish | — | — |
| 51 | Cup & Handle | `CUP` | Bullish | — | — |
| 52 | Inverted Cup & Handle | `iCUP` | Bearish | — | — |
| 53 | Ascending Triangle | `ASC△` | Bullish | — | — |
| 54 | Descending Triangle | `DSC▽` | Bearish | — | — |
| 55 | Symmetrical Triangle | `SYM△` | Neutral | — | — |
| 56 | Expanding Triangle | `EXP△` | Neutral | — | — |
| 57 | Rising Wedge | `R.WDG↓` | Bearish | — | — |
| 58 | Falling Wedge | `F.WDG↑` | Bullish | — | — |
| 59 | Bull Flag | `BULL♦` | Bullish | — | — |
| 60 | Bear Flag | `BEAR♦` | Bearish | — | — |
| 61 | Bull Pennant | `B.PNT↑` | Bullish | — | — |
| 62 | Bear Pennant | `B.PNT↓` | Bearish | — | — |
| 63 | Rounding Bottom | `SAUC↑` | Bullish | — | — |
| 64 | Rounding Top | `RTOP↓` | Bearish | — | — |
| 65 | Rectangle Bullish Break | `RECT↑` | Bullish | — | — |
| 66 | Rectangle Bearish Break | `RECT↓` | Bearish | — | — |
| 67 | Diamond Top | `DIAM↓` | Bearish | — | — |
| 68 | Diamond Bottom | `DIAM↑` | Bullish | — | — |
| 69 | Bump and Run Reversal | `BUMP↓` | Bearish | — | — |
| 70 | Dead Cat Bounce | `DCB↓` | Bearish | — | — |
| 71 | High-Tight Flag | `HTF↑` | Bullish | — | — |
| 72 | Channel Up | `CH↑` | Bullish | — | — |
| 73 | Channel Down | `CH↓` | Bearish | — | — |
| 74 | Megaphone | `MEGA` | Neutral | — | — |
| 75 | Flat Top Breakout | `FLT↑` | Bullish | — | — |

### Harmonic Patterns [26]

| # | Pattern | Label | Key Ratios | BTC 1d % | Duration |
|---|---------|-------|-----------|----------|----------|
| 76 | ABCD Bullish | `ABCD↑` | CD=AB, BC=0.618·AB | — | — |
| 77 | ABCD Bearish | `ABCD↓` | CD=AB, BC=0.618·AB | — | — |
| 78 | Gartley Bullish | `GART↑` | AB=0.618·XA, CD=0.786·XA | — | — |
| 79 | Gartley Bearish | `GART↓` | AB=0.618·XA, CD=0.786·XA | — | — |
| 80 | Bat Bullish | `BAT↑` | AB=0.382-0.5·XA, CD=0.886·XA | — | — |
| 81 | Bat Bearish | `BAT↓` | AB=0.382-0.5·XA, CD=0.886·XA | — | — |
| 82 | Butterfly Bullish | `BFLY↑` | AB=0.786·XA, CD=1.272-1.618·XA | — | — |
| 83 | Butterfly Bearish | `BFLY↓` | AB=0.786·XA, CD=1.272-1.618·XA | — | — |
| 84 | Crab Bullish | `CRAB↑` | AB=0.382-0.618·XA, CD=1.618·XA | — | — |
| 85 | Crab Bearish | `CRAB↓` | AB=0.382-0.618·XA, CD=1.618·XA | — | — |
| 86 | Deep Crab Bullish | `DCRAB↑` | AB=0.886·XA, CD=2.618-3.618·XA | — | — |
| 87 | Deep Crab Bearish | `DCRAB↓` | AB=0.886·XA, CD=2.618-3.618·XA | — | — |
| 88 | Cypher Bullish | `CYPH↑` | AB=0.382-0.618·XA, CD=0.786·XC | — | — |
| 89 | Cypher Bearish | `CYPH↓` | AB=0.382-0.618·XA, CD=0.786·XC | — | — |
| 90 | Shark Bullish | `SHRK↑` | AB=0.886-1.13·XA, BC=1.618-2.24 | — | — |
| 91 | Shark Bearish | `SHRK↓` | AB=0.886-1.13·XA, BC=1.618-2.24 | — | — |
| 92 | Alt Bat Bullish | `ABAT↑` | AB=0.382·XA, CD=1.13·XA | — | — |
| 93 | Alt Bat Bearish | `ABAT↓` | AB=0.382·XA, CD=1.13·XA | — | — |
| 94 | Three Drives Bullish | `3DRV↑` | Three equal-length down drives | — | — |
| 95 | Three Drives Bearish | `3DRV↓` | Three equal-length up drives | — | — |
| 96 | 5-0 Bullish | `5-0↑` | BC=1.618-2.24·AB, CD=0.5·BC | — | — |
| 97 | 5-0 Bearish | `5-0↓` | BC=1.618-2.24·AB, CD=0.5·BC | — | — |
| 98 | Nen-Star Bullish | `NEN↑` | AB=0.618·XA, CD=1.272·XA | — | — |
| 99 | Nen-Star Bearish | `NEN↓` | AB=0.618·XA, CD=1.272·XA | — | — |
| 100 | XABCD Alt Bullish | `XAB↑` | CD=1.272·AB | — | — |
| 101 | XABCD Alt Bearish | `XAB↓` | CD=1.272·AB | — | — |

---

## §10 — Complex Situations Engine

Context-aware confluence analysis that fires **secondary labels** when multiple conditions
align simultaneously. All labels are toggle-controlled by the *Complex Situations* input
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

---

## Technical Implementation Notes

### 1) Overall engine architecture

The Pine Script indicator is organized around a modular pattern engine rather than a single monolithic
conditional block. The code path is conceptually:

1. Extract bar-level market data.
2. Compute directional and volatility statistics.
3. Maintain pivot arrays and rolling support/resistance levels.
4. Evaluate pattern families in isolation.
5. Aggregate a bull/bear signal count per family.
6. Apply regime filters and contextual overlays.
7. Emit labels and summary tables.
8. Update transition probabilities for the Bayesian predictor.

This modular approach makes it possible to toggle each family independently while keeping all
signals within a common state model. It also helps avoid the common Pine Script issue where one
growing block becomes unmaintainable and brittle.

### 2) Data model for pattern state

Each detected pattern is represented conceptually by a tuple such as:

```
patternState = {
    family: "candlestick" | "chart" | "harmonic" | "context",
    name: "Bullish Engulfing",
    side: "bull" | "bear" | "neutral",
    strength: 0.0 to 1.0,
    barIndex: bar_index,
    startIndex: i,
    endIndex: i,
    confidence: val,
    label: "ENG↑",
    meta: { atr, emaStack, volumeState, pivotDistance }
}
```

This state object is not always stored as a UDT in the literal Pine sense, but in design it behaves
that way. The indicator keeps enough metadata to decide whether the signal should be displayed,
scored in confluence, or suppressed by regime filters.

### 3) Signal counting and regime gating

A pattern can be valid geometrically but still be filtered out by regime conditions. For example:

- A bullish pattern in a strong downtrend may be downgraded if it occurs under bearish EMA stack and
  weak momentum.
- A neutral continuation pattern may be filtered if the market is in a volatility squeeze with no
  expansion event.
- A pattern that occurs near a pivot level may count as a supporting signal but not as a primary label.

The signal counts are therefore not raw pattern counts. They are normalized and context-adjusted.
The engine often uses counts like:

```
bullSignals = count of bullish pattern states passing filters
bearSignals = count of bearish pattern states passing filters
net = bullSignals - bearSignals
```

This final net value is used for confluence triggers, EMA trend shading, and summary table output.

### 4) Candle geometry conventions

Most candle patterns rely on a consistent geometry vocabulary. Each candle is evaluated in terms of:

- body size relative to ATR
- wick length relative to body
- open-close relation
- high-low range relative to prior bars
- gap direction when applicable
- relationship to local EMA and pivot levels

For example, a bullish engulfing pattern validates not just that the body is larger, but that:

- current close exceeds prior close
- current open is below prior close
- current body exceeds previous body by a tolerance threshold
- the close is higher than prior high if the pattern is supposed to be directional
- the pattern occurs during acceptable ATR scaling, not on tiny candle noise

Likewise, a bullish marubozu requires a long body with minimal upper/lower wick, while a hanger
or hammer requires a lower wick dominating the body, and a shooting star requires the opposite.

### 5) Pivot maintenance model

The engine uses rolling pivot stores to maintain local swing highs and swing lows. This brings a
much sharper view of support and resistance than a static EMA alone. Pivot logic commonly works like
this:

- A bar is considered a pivot candidate once it is a local high or low over a left/right window.
- Confirmed pivots are pushed into arrays of capped length.
- The newest pivot is compared against the previous pivot distance in ATR units.
- Pattern logic uses the nearest support or resistance as potential match zones.
- If a pattern forms near a pivot zone, confluence increases.

This matters because many classic formations and confluence labels depend on proximity to
significant reversal points rather than pure bar-to-bar structure.

### 6) Tolerance logic and similarity windows

Pattern matching in Pine Script is usually built using tolerance thresholds rather than exact formula
matches. This is especially true for chart patterns, harmonic shapes, and wedge structures.
Examples:

- pattern tolerance for chart symmetry can be expressed as percent-difference within a target zone
- harmonic ratio validation checks whether a calculated ratio falls within ±tolerance of an ideal ratio
- pivot equality for double top/bottom compares peak similarity within a configurable percentage
- support/resistance retests permit a small pullback before the pattern is considered invalid

The engine uses these tolerances to reduce false positives while still allowing structurally valid
movements to be recognized.

### 7) Label generation and display system

Pattern labels are generated after all validation rules are satisfied. Labels are not simply a direct
function of a boolean. They are filtered and then displayed based on:

- bullish/bearish toggle state
- neutral label toggle state
- selected label size
- pattern family toggle state
- user display preferences
- current chart scaling and real-time update conditions

The label system also handles layering because multiple patterns can be valid on the same bar. In
that case, the engine may show:

- a primary pattern label (dominant pattern)
- a secondary confluence label
- a context overlay label

This is especially useful during multi-pattern events such as a bullish engulfing bar that also sits near
an EMA stack, pivot support, and a squeeze breakout condition.

### 8) Confluence scoring design

The confluence engine is effectively a higher-order rule engine. It evaluates multiple categories at
once, such as:

- candle family signal count
- chart family signal count
- harmonic family signal count
- EMA trend stack
- ATR squeeze or expansion state
- divergence conditions
- unique pivot-level support or resistance interaction

When enough conditions align, the `★HC BULL` / `★HC BEAR` labels appear. Similar logic triggers
cluster labels and support/resistance bounce scenarios.

The core signal aggregation can be thought of as:

```
confluenceScore =
    candleBullWeight + chartBullWeight + harmonicBullWeight
    + emaBullStackBonus + volumeExpansionBonus + pivotSupportBonus
```

The model then compares against thresholds. This form of scoring is more resilient than hardcoding
single-pattern events; it resembles a micro-factored market regime classifier.

### 9) Bayesian pattern prediction logic

The predictor is a hidden-state model that learns transitions between pattern classes. The engine uses
five classes:

- Strong Bull
- Mild Bull
- Neutral
- Mild Bear
- Strong Bear

The Markov matrix is updated as follows:

```
T[prevClass, curClass] := T[prevClass, curClass] + 1
```

A Laplace prior is applied to avoid zero-probability states. The resulting transition distribution is:

```
P(next = j | current = i) = T[i,j] / sum_k T[i,k]
```

This gives a dynamic distribution of likely next pattern classes based on actual history in the chart.
The table at the bottom right shows the current class, observation counts, EMA trend, and ATR regime,
which makes the predictor easier to interpret during live trading or manual backtesting.

### 10) Why this design matters

There are four important reasons this engine is valuable as a Pine Script architecture:

1. It is pattern-rich without being too brittle.
2. It separates geometry validation from visual output.
3. It allows conditions to be layered rather than mutually exclusive.
4. It gives a richer market read than a single indicator could provide.

This makes it useful both as a chart overlay and as a framework for exploring how multiple forms of
technical structure interact in real time.

---

## Expansion Notes: Pattern Families and Matching Logic

### Single-bar candlestick logic

Single-bar patterns focus on the relationship between body size, wick length, and proximity to the
open/close range. Examples:

- Doji: relatively equal open/close with compact body and substantial wick
- Dragonfly Doji: close and open near the high with long lower wick
- Gravestone Doji: close and open near the low with long upper wick
- Marubozu: long body with little wick, directional signal
- Hammer: body near lower end of range with long lower wick
- Shooting Star: body near upper end of range with long upper wick

The false-positive risk here is high if the script does not scale body size by ATR and local volatility.
A candle with a 2% body may be meaningful in a 10% volatility regime but noise in a 1% regime.
Therefore, pattern detection often includes a volatility gate.

### Two-bar candlestick logic

Two-bar patterns analyze the interaction between one candle and the one immediately before it. Common
patterns include:

- Bullish Engulfing: green candle swallows previous red candle
- Bearish Engulfing: red candle swallows previous green candle
- Harami: small candle inside prior candle body
- Piercing Line: bullish candle closes above midpoint of previous bearish candle
- Dark Cloud Cover: bearish candle closes below midpoint of previous bullish candle
- Tweezer Top/Bottom: equal or near-equal highs/lows over two adjacent bars
- Kicker: strong gap/open impulse in one direction, often with a large surprise move

These patterns often work best when combined with support/resistance, trend structure, or a squeeze
state. A standalone engulfing pattern can be noisy, but in the presence of EMA alignment and pivot
support it becomes far more actionable.

### Multi-bar candlestick logic

Multi-bar candlestick patterns test whether a sequence of candles forms a cohesive directional
structure. For example:

- Morning Star / Evening Star
- Three White Soldiers / Three Black Crows
- Rising/ Falling Three Methods
- Three Inside Up / Down
- Three Outside Up / Down
- Tasuki Gap and Mat Hold patterns

These patterns usually require trend-following context: a continuation setup often needs the preceding
trend to align. A bullish three-candle setup that occurs in a bearish EMA stack may be less reliable
unless volume confirms expansion or the price is near a pivot reaction zone.

### Chart pattern logic

Classic chart patterns rely on geometric similarity, breakout validation, and neckline/structure checks.
Examples:

- Head & Shoulders: left shoulder, head, right shoulder + neckline break
- Double Top / Bottom: two equal extremities with a central valley/peak
- Triangles: converging swing highs and lows
- Wedges: converging trend lines with slope continuity
- Flags and pennants: short consolidation after a directional impulse
- Rounding bottom/top: broad curve with curvature over multiple sessions

Chart patterns are often the most visually intuitive but also require more structural maintenance. The
pivot arrays and tolerance windows are critical to avoid false pattern matches when the market is choppy.

### Harmonic pattern logic

Harmonic patterns rely on ratio relationships between swings, not simply candle body shape. Common
ratios include 0.382, 0.5, 0.618, 0.786, 1.272, 1.618, and 2.618. The engine validates whether the
relationships between swing lengths are close enough to the ideal harmonic ratios, within a preset
tolerance.

Examples:

- Gartley: XA → AB → BC → CD structure with harmonic endpoint constraints
- Bat: a more extreme retracement version of Gartley
- Butterfly: longer extension at point D
- Crab: deep extension with high potential reversal margin
- Deep Crab: greater extension than Crab
- Cypher and Shark: less classical but structurally distinct harmonic setups

These patterns are useful because they can give more detailed reversal zones than basic candle
formations, but they are also slower and more sensitive to noise. That is why the engine applies a
strict Fibonacci tolerance and regime awareness to harmonic family detections.

---

## Implementation Observations and Practical Rules

### Rule 1: Always scale by volatility

The engine should not treat a 2% candle as the same across all market conditions. A 2% candle in a
high-volatility environment may be normal; in a low-volatility regime it could be deeply meaningful.
This is why ATR scaling is a core part of the strategy.

### Rule 2: Prefer support and resistance context

Many patterns become far more actionable when they coincide with pivot support or resistance. A
bullish reversal off a major pivot low is much more convincing than the same candle pattern appearing
in open space.

### Rule 3: Trigger only when there is enough confirmation

A pattern is more robust when multiple checks align: body size, wick size, trend context, pivot
proximity, and volume conditions. The engine should not rely on a single pattern’s boolean alone.

### Rule 4: Keep display and logic separate

Pattern logic should remain independent from label formatting. A pattern can be valid in logic even if
its label is hidden due to user settings. This separation improves maintainability and avoids hardcoded
display logic inside pattern calculations.

### Rule 5: Treat the predictors as stateful learning

The Bayesian predictor is not a forward-looking oracle. It is a statistical summary of recent pattern
class transitions. It becomes more informative as more valid patterns are observed on the chart.

---

# Scalp POI Strategy — Pine Script v2

**File:** `scalp_poi_hs_dirac.pine`
**Language:** Pine Script v5
**Type:** Strategy (backtest-enabled, overlay)

---

## Overview

A multi-engine scalping strategy that detects local price extremes (**Points of Interest — POI**) from
rolling pivot high/low history. Entry conviction is built from **15 independent analytical engines**
combined into a composite bull/bear score. A trade fires only when the score clears a configurable
threshold and the bull-minus-bear edge exceeds a minimum gap.

The strategy is intentionally not a simplistic retracement machine. It evaluates several orthogonal
signals at the same time: pivot proximity, structural reversal geometry, trend slope, volume behavior,
VWAP deviation, price curvature, and regime context. The composite score is then used to decide
whether a trade should fire.

The design objective is to filter out weak, noisy, or structurally ambiguous entries and only allow
trades when the evidence is concentrated. This is why it uses a multi-engine approach rather than a
single entry trigger such as RSI crossing or a trendline break.

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

The regression subsystem implements **Ordinary Least Squares (OLS)** from scratch.
Pine Script has no native OLS function that returns the required statistics and residual diagnostics.
The model is built manually.

```
slope     = (n·Σxy − Σx·Σy) / (n·Σx² − (Σx)²)
intercept = (Σy − slope·Σx) / n
R²        = 1 − SS_res / SS_tot
std_err   = √(SS_res / (n − 2))
```

A **regression channel** is plotted at `lrLine ± band_mult × std_err`.

**Polynomial curvature** is approximate via second and third differences of
`ta.linreg` values (no matrix operations needed):

```
accel = (lr[0] − lr[1]) − (lr[1] − lr[2])   // 2nd-order curvature
jerk  = accel[0] − accel[1]                  // 3rd-order rate of change
```

Both are normalized by ATR and contribute independently to the composite score.

---

## Technical Strategy Flow

### Entry decision stack

A trade only fires once all of the following conditions are satisfied:

1. The composite bull/bear score clears the base threshold.
2. The bull-minus-bear edge exceeds the configured minimum gap.
3. The current bar is not inside the cooldown period.
4. The regime filter accepts the current market state.
5. The signal is not invalidated by a volume floor or ATR floor.
6. The candidate has sufficient confluence across multiple engines.

This sequence prevents the strategy from overtrading noisy entries and reduces exposure to false
breakouts during choppy microstructure.

### Trade lifecycle

The strategy lifecycle can be described as:

- detect pivot structure
- compute local POI levels
- calculate score engine contributions
- compare signal edge to thresholds
- open position
- set fixed stop-loss and take-profit targets
- optionally activate trailing stop logic
- exit if target or stop is reached
- enforce cooldown before any re-entry

This lifecycle is deterministic and reproducible, which makes it easier to evaluate with replay and
backtesting.

---

## Risk Management

- Fixed SL / TP set at `strategy.exit` on entry.
- **Manual trailing stop** ratchets the protective stop toward the position as
  price moves in the trade's favour. Updated every bar; never moves against
  the trade.
- **Bar cooldown** prevents re-entering too quickly after a fill.
- **ATR-based filters** reduce the chance of trading low-volatility noise.
- **Volume filters** avoid low-quality breakouts emerging from thin trade activity.

### Risk expression

The strategy is built as a probabilistic edge engine, but the real decision is still risk-controlled:

```
if score >= scoreThreshold and scoreEdge >= minEdge and timeSinceFill > cooldown:
    strategy.entry(...)
    strategy.exit(...)
```

This cliff-like entry filter is intentionally strict because the engine is designed to operate in a
fast, dynamic market environment where low quality entries are extremely costly.

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

1. **Volume Profile / VPOC** — accumulate tick-level volume by price bucket to identify the Value Area High / Low as additional POI anchors.
2. **Market Structure Shift (MSS) detection** — label each pivot as HH/HL (uptrend) or LH/LL (downtrend) and trigger only on confirmed structure breaks.
3. **Wavelet-based noise filter** — apply a Haar or Daubechies wavelet decomposition to separate trend from high-frequency noise before computing pivot levels.
4. **Kalman Filter price smoothing** — replace raw `close` as input to the OLS regression for a lower-noise slope estimate.
5. **Hidden Markov Model regime tagging** — replace the ADX-only regime filter with a two-state (trend / range) HMM updated via a Viterbi-like approximation.
6. **Adaptive weight optimisation** — use a rolling Sharpe-ratio gradient to periodically re-weight the engine contributions during backtesting.
7. **Multi-symbol basket scoring** — combine scores from correlated instruments (e.g. SPY + QQQ) for confluence-filtered entries.
8. **GPT / LLM sentiment overlay** — inject a daily sentiment Z-score fetched from the `pine_poi_updater.py` workflow into the composite score via `request.seed()`.
9. **Partial profit-taking** — add a mid-TP close (e.g. 50% at 0.8×TP) and let the remainder run to full TP.
10. **Portfolio heat management** — cap the number of simultaneous open positions and scale `qty` inversely with current equity drawdown.

---

# Recursive Nested Matrix Engine — Pine Script v6

**File:** `recursive_nested_matrix_engine.pine`
**Language:** Pine Script v5
**Type:** Indicator (overlay)

---

## Overview

A multi-pattern detection engine built on a 5-level **Recursive Nested Type** (UDT) hierarchy.
Atomic price/volume coordinates are nested into geometric segments, which are assembled into
swing paths, structure clusters, and confluence relationships. The engine is designed to detect
multi-timeframe pattern continuity, dynamic context relationships, and recursion-aware reversals.

The engine's conceptual model is closer to a hierarchical graph than a flat scan of candles. Each
layer captures a different representation of the same market narrative:

- raw market coordinates
- local structural swings
- geometric clusters
- recognized patterns
- regime-aware signal bundles

This representation makes it possible to evaluate both local microstructure and higher-order pattern
continuity without flattening everything into a single array.

---

## Recursive UDT Structure

The engine uses a layered class hierarchy to model the analysis stack:

- Level 1: market tick vertices and bar coordinates
- Level 2: local segment objects and directional swings
- Level 3: pivot clusters and compression zones
- Level 4: pattern assemblies and geometry groups
- Level 5: context-aware signal bundles and regime summaries

This design allows each detected pattern to retain:

- coordinate metadata
- directional memory
- structural confidence
- context confluence score
- probability weight for next-stage evaluation

The recursion is not arbitrary. It mirrors the way human chart analysis naturally works: first the
studied candle, then the local sequence, then the structural swing, then the pattern cluster, then the
broader market regime.

---

## Engine Design Principles

### Structural recursion

Each pattern object stores references to child micro-structures so the detector can evaluate both local
geometry and higher-order relationships. The recursion allows the indicator to work with nested
patterns without flattening everything into a single overgrown array.

### Context-aware scoring

Each signal is not judged in isolation. The engine compares it against trend posture, EMA stack,
ATR expansion, and recent pivot clustering before emitting a final label.

### Regime gating

A pattern is only considered valid when it respects current regime conditions. Trending periods,
mean-reverting periods, and squeeze conditions each require different geometry thresholds.

### Volume and liquidity checks

When volume collapses or expands unexpectedly, the engine adjusts confidence. This prevents false
signals from low-liquidity thrusts or structurally insignificant fragments.

---

## Signal Lifecycle

1. Build candidate coordinates from recent closes, highs, and lows.
2. Assemble local swing segments and pivot clusters.
3. Evaluate structural compatibility with known chart pattern templates.
4. Score geometry, timing, and confluence against multiple filters.
5. Emit labels only when confidence exceeds the minimum threshold.
6. Update the state machine for subsequent pattern-to-pattern prediction.

---

## Example Data Structure Concept

```
type PatternNode
    float x
    float y
    float volume
    int barIndex
    int depth
    string direction
    PatternNode childA
    PatternNode childB
    PatternNode parent
    float confidence
    string family
    string patternName
```

This structure allows the engine to assemble a pattern tree where each node represents either:

- a raw bar-level coordinate
- a swing segment
- a geometry cluster
- a completed pattern candidate

This is particularly useful when a pattern is detected only after several sub-patterns align in a
nested configuration.

---

## Recursive Validation Sequence

```
if isCandidateVertex(bar) and isSufficientVolume(bar):
    buildLocalSegment()
    if hasStructuralSupport(segment):
        buildPivotCluster(segment)
        if clusterMatchesTemplate(cluster):
            createPatternNode(cluster)
            if patternPassesRegimeFilter(patternNode):
                scoreContext(patternNode)
                emitLabel(patternNode)
```

This approach yields a natural layered evaluation, which is much easier to troubleshoot than a flat
list of manual if-statements spread across two hundred lines.

---

## Why This Recursion Helps

- More robust detection of multi-leg structures
- Better handling of nested sub-patterns
- More stable response to noisy conditions
- Better fit for dynamic market structure and context shifts
- Easier extension for new family additions without huge refactors

The engine is designed to scale as more pattern families and more signal conditions are introduced.

---

## Additional Design Considerations

### Interpretation of market structure

A price sequence is not just a collection of candles. It encodes:

- directional trend
- local retracement depth
- price compression or expansion
- trend exhaustion
- pivot zone significance
- relative intensity of volume and volatility

Pattern detectors should therefore interpret bars as points in a dynamic structure rather than as
isolated OHLC fragments.

### Weighting of pattern confidence

Pattern confidence is typically a function of several components:

```
confidence = geometricFit * trendAlignment * volumeFactor * pivotProximity * regimeBias
```

A candidate with strong geometry but weak trend alignment may still be valid but lower-confidence.
Similarly, a perfect geometric fit without market context may still be noise if it occurs in a low-
volatility, low-conviction regime.

### Multi-timeframe perspective

Even without explicit multi-timeframe scanning, the engine behaves as though it is considering several
scales simultaneously via EMA stack, pivot windows, ATR, and pattern duration. A strong multi-bar
pattern with support from higher-level structure usually has more value than a small candle pattern in
isolation.

---

## Practical Reading Guide

The engine is best interpreted like this:

- Single-bar and two-bar patterns are short-horizon context markers.
- Multi-bar patterns provide stronger directional structure.
- Chart patterns add geometric confirmation.
- Harmonic patterns add deeper swing-based reversal context.
- Complex situations provide contextual overlays and regime-aware labels.
- Bayesian predictor adds a probability lens for the next likely class of pattern.

The overall goal is to provide a layered market reading, not just a binary buy or sell signal.

---

## Appendix A — Pseudo-code for Core Evaluation Flow

```pine
// abstract view of the engine flow
for each bar i:
    atrVal = atr(atrLen)
    ema20 = ta.ema(close, 20)
    ema50 = ta.ema(close, 50)
    ema200 = ta.ema(close, 200)
    pivotInfo = updatePivots(i, leftBars, rightBars)

    candleSignals = evaluateCandlePatterns(i, atrVal)
    chartSignals = evaluateChartPatterns(i, pivotInfo, tolerance)
    harmonicSignals = evaluateHarmonicPatterns(i, pivotInfo, fibTolerance)

    contextSignals = evaluateContextEngine(
        candleSignals,
        chartSignals,
        harmonicSignals,
        ema20,
        ema50,
        ema200,
        atrVal
    )

    if barHasDetectedPattern(candleSignals, chartSignals, harmonicSignals):
        updateBayesianMatrix(prevClass, currentClass)
        prevClass := currentClass

    renderLabelOutputs()
```

This pseudo-flow is intentionally simple. The real Pine Script implementation contains numerous
conditional gates, memory arrays, and state tracking elements, but the logic remains consistent.

---

## Appendix B — Example Pattern Validation Sketches

### Bullish engulfing validator

```pine
bullEngulfing = close > open and
               close[1] < open[1] and
               close > open[1] and
               open < close[1] and
               bodySize > prevBodySize * 1.05 and
               bodySize > atrVal * 0.35
```

### Hammer validator

```pine
hammer = close > open and
         lowerWick > bodySize * 2 and
         upperWick < bodySize * 0.5 and
         close > ema20 and
         bodySize > atrVal * 0.25
```

### Head and shoulders validator

```pine
lhsValid = pivotLeftShoulder and pivotHead and pivotRightShoulder
necklineBreak = close < neckline and close[1] > neckline
patternValid = lhsValid and necklineBreak and symmetryWithinTolerance
```

### Gartley validator

```pine
ratioAB = abs(AB / XA)
ratioCD = abs(CD / XA)
conditionAB = ratioAB >= 0.618 - tolerance and ratioAB <= 0.618 + tolerance
conditionCD = ratioCD >= 0.786 - tolerance and ratioCD <= 0.786 + tolerance
validGartley = conditionAB and conditionCD and structureAligned
```

---

## Appendix C — Market Regime Interpretation

The engine is designed to interpret the market in terms of regime, not just signal direction. A
pattern is more valuable if it appears in a regime consistent with the pattern’s expected behavior.

Typical regime states include:

- bullish trend regime: EMA20 > EMA50 > EMA200
- bearish trend regime: EMA20 < EMA50 < EMA200
- ranging regime: EMA spread tight and price oscillates around central levels
- squeeze regime: ATR contraction followed by expansion potential
- exhaustion regime: price far from its long-term moving average but with momentum reversal structure

This matters because many patterns are not universally predictive. A bearish reversal pattern in a
strong bull regime may simply be a correction; a bullish pattern in a collapse regime may reflect a
short-lived rebound rather than a sustained trend change.

---

## Appendix D — Display, Summary, and Data Output Conventions

The indicator keeps its display layer intentionally simple and readable:

- green and red labels indicate directional bias
- gray labels indicate neutral or context-free patterns
- summary table shows counts by category and live net bull/bear signal counts
- bottom-right Bayesian table shows next-class probability and current regime state
- complex overlays show EMA trend and squeeze context

This arrangement allows the user to interpret both the geometry and the market context from a single
screen.

---

## Appendix E — Readiness and Validation Checklist

Before deploying or relying on the indicator for live interpretation, the implementation should verify:

- ATR uses a stable, user-configurable length
- pivot arrays are correctly capped to avoid memory growth
- pattern families can be toggled independently
- each family uses its own tolerance definitions
- summary counts are computed from valid, filtered patterns only
- confluence labels are not triggered by stale pattern states
- Bayesian update logic only increments on valid pattern observations
- label display respects user preferences
- strategy builds do not re-enter within cooldown periods

This checklist helps reduce bugs and false positives when the system begins to scale to more patterns,
more filters, and more family-specific logic.

---

## Final Notes

This readme intentionally describes the engine as a layered market analysis framework rather than a
single signal indicator. That is the key idea behind the implementation: pattern recognition works best
when treated as a system of corroborating evidence rather than independent isolated candles.

The design combines:

- geometric price structure
- volatility normalization
- pivot support and resistance memory
- family-specific validation rules
- multi-signal aggregation
- regime-aware overlays
- Bayesian transition learning

This is why the system is capable of producing a nuanced chart reading across 101 patterns and a
variety of higher-order signals.

---

<!-- AUTO-UPDATE-START -->
_Last updated: 2026-10-30 18:51 UTC_

### Live Market Snapshot  (yfinance · Yahoo Finance chart fallback)

| Ticker | Exch | Price | Chg | Chg% | Mom-5b | RSI~ | Src | Updated |
|--------|------|-------|-----|------|--------|------|-----|---------|
| [SPY](https://finance.yahoo.com/quote/SPY) | NYSEARCA | $750.822 | -13.908 | -1.8187% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [QQQ](https://finance.yahoo.com/quote/QQQ) | NASDAQ | $684.065 | -20.235 | -2.8731% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [DIA](https://finance.yahoo.com/quote/DIA) | NYSEARCA | $515.22 | -7.7 | -1.4725% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [IWM](https://finance.yahoo.com/quote/IWM) | NYSEARCA | $277.12 | -6.71 | -2.3641% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [AAPL](https://finance.yahoo.com/quote/AAPL) | NASDAQ | $342.84 | -9.21 | -2.6161% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [MSFT](https://finance.yahoo.com/quote/MSFT) | NASDAQ | $519.025 | -10.0271 | -1.8953% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [GOOGL](https://finance.yahoo.com/quote/GOOGL) | NASDAQ | $277.25 | -3.41 | -1.215% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [AMZN](https://finance.yahoo.com/quote/AMZN) | NASDAQ | $237.375 | 11.385 | 5.0378% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [TSLA](https://finance.yahoo.com/quote/TSLA) | NASDAQ | $395.46 | -1.99 | -0.5007% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [NVDA](https://finance.yahoo.com/quote/NVDA) | NASDAQ | $201.21 | -8.9368 | -4.2526% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [META](https://finance.yahoo.com/quote/META) | NASDAQ | $611.66 | -9.1667 | -1.4765% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [JPM](https://finance.yahoo.com/quote/JPM) | NYSE | $335.23 | -10.02 | -2.9022% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [BAC](https://finance.yahoo.com/quote/BAC) | NYSE | $49.81 | -1.5 | -2.9234% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [GS](https://finance.yahoo.com/quote/GS) | NYSE | $882.07 | -41.87 | -4.5317% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [XOM](https://finance.yahoo.com/quote/XOM) | NYSE | $186.29 | 1.5734 | 0.8518% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [GLD](https://finance.yahoo.com/quote/GLD) | NYSEARCA | $355.41 | -11.75 | -3.2002% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [SLV](https://finance.yahoo.com/quote/SLV) | NYSEARCA | $44.135 | -2.695 | -5.7549% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [TLT](https://finance.yahoo.com/quote/TLT) | NASDAQ | $81.65 | -0.08 | -0.0979% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [VIX](https://finance.yahoo.com/quote/^VIX) | INDEXCBOE | $23.86 | 6.65 | 38.6403% | ─ | — | yfinance | 2026-10-30 18:51 UTC |
| [BTC-USD](https://finance.yahoo.com/quote/BTC-USD) | CRYPTO | $76485.1562 | -1307.2734 | -1.6805% | ─ | — | yfinance | 2026-10-30 18:51 UTC |

#### Market Breadth
- Advancing: **3** / 20  | Declining: **17**  | Unchanged: 0
- Composite score: **-1446.87**  | Avg RSI proxy: 0.0
- Positive momentum (5b): 0  | Negative: 0

<!-- AUTO-UPDATE-END -->

