# Option Strategy Lab

**Live URL:** [https://majixai.github.io/OptionStrategy/](https://majixai.github.io/OptionStrategy/)

An interactive, browser-based options strategy visualizer and analytics tool. No backend required — all calculations run entirely in the client using vanilla JavaScript.

---

## 🔄 Recent Updates

| Date | Change | Description |
|------|--------|-------------|
| 2026-02-22 | **Initial Release** | Created `index.html` with full rendering engine, Black-Scholes pricer, 13 strategy templates, and custom Strategy Builder |
| 2026-02-22 | **PWA Support** | Added `manifest.json` and `sw.js` service worker for offline capability and installability |
| 2026-02-22 | **Dark-mode UI** | Dark theme using CSS custom properties with GitHub-inspired color palette |
| 2026-02-22 | **Plotly.js Engine** | Integrated Plotly 2.32.0 for interactive, zoomable payoff diagrams with profit/loss shading |

---

## ✨ Features

### Rendering Engines
- **Plotly.js** (v2.32.0) — Primary charting engine for payoff diagrams
  - Interactive hover, zoom, pan
  - Profit zone (green fill) / loss zone (red fill) shading
  - Current-price marker overlay
  - Zero-line breakeven reference

### Black-Scholes Calculator
- Full BSM pricing implementation (call & put)
- All Greeks: **Δ Delta, Γ Gamma, Θ Theta, ν Vega, ρ Rho**
- Intrinsic value and time value decomposition
- "Calculate & Plot" button renders the single-leg payoff diagram

### Strategy Templates (13 built-in)
| Category | Strategies |
|----------|-----------|
| One-Leg | Long Call, Long Put, Short Call, Short Put |
| Two-Leg Spreads | Bull Call Spread, Bear Put Spread, Bull Put Spread, Bear Call Spread |
| Volatility | Long Straddle, Long Strangle, Short Straddle |
| Multi-Leg | Iron Condor, Iron Butterfly, Long Butterfly |

Each template auto-generates:
- Strike selection relative to current underlying price
- BS-computed premiums
- Net debit/credit
- Per-strategy Greeks (Delta, Gamma, Theta, Vega)
- Payoff diagram

### Custom Strategy Builder
- Add up to 4 independent legs (buy/sell, call/put, any strike)
- Enter your own premium or use auto-BS pricing (set to 0)
- Combined payoff diagram with net delta display

---

## 📁 Directory Structure

```
OptionStrategy/
├── index.html       # Complete single-file application (HTML + inline CSS + inline JS)
├── manifest.json    # PWA web app manifest
├── sw.js            # Service Worker for offline caching
└── README.md        # This file
```

---

## 🛠 Technologies

| Technology | Purpose | Version |
|-----------|---------|---------|
| [Plotly.js](https://plotly.com/javascript/) | Interactive payoff charts | 2.32.0 |
| [W3.CSS](https://www.w3schools.com/w3css/) | Responsive CSS framework | 4 |
| [Font Awesome](https://fontawesome.com/) | Icons | 6.5.0 |
| Vanilla JavaScript | All logic, no framework required | ES2020+ |
| Service Worker API | Offline caching / PWA | Browser-native |

---

## 🚀 Getting Started

The page is fully self-contained — simply open `index.html` in any modern browser or visit the [GitHub Pages URL](https://majixai.github.io/OptionStrategy/).

For local development:
```bash
# From the repo root
npx serve OptionStrategy/
# Or
python3 -m http.server 8080 -d OptionStrategy/
```

---

## 📐 Black-Scholes Implementation Notes

The embedded BS engine uses:
- **Normal CDF** approximation (Abramowitz & Stegun method, error < 1.5×10⁻⁷)
- **Standard BSM** formulae for European options
- All Greeks are computed analytically (not numerically)
- Default parameters: S=5975, T=30 days (~0.0833 yr), r=5.25%, σ=18%

> ⚠️ **Note**: The BS model assumes European-style exercise, constant volatility, and no dividends. It is an approximation for American-style equity/index options.

---

## 🗺 Recommendations for Future Updates

The following enhancements are recommended in rough priority order:

### High Priority

1. **Real-time underlying price** — Fetch live spot price (e.g., Yahoo Finance unofficial API or a public proxy) to replace the hardcoded `S=5975` default. Persist last-used ticker via `localStorage`.

2. **Implied Volatility solver** — Given a market premium, compute IV using Newton-Raphson or bisection. Display IV rank/percentile using stored history.

3. **Expiration date picker** — Let the user select an actual expiration date; auto-calculate `T` in years (excluding weekends and holidays).

4. **Options chain integration** — Fetch live options chain data from Nasdaq or Yahoo Finance API to populate strikes and real market premiums instead of BS-theoretical values.

### Medium Priority

5. **Probability of Profit (PoP)** — Calculate PoP from the BS distribution (log-normal assumption) for each strategy and display it as a metric.

6. **Greeks heatmap** — Visualize how Delta and Theta evolve across the price range over time (2D surface plot with Plotly).

7. **P&L at various DTE** — Plot multiple time-slice curves (e.g., at 30, 15, 7, 0 DTE) on the same diagram to visualize theta decay.

8. **Strategy comparison** — Allow plotting two strategies side by side to compare their payoff profiles.

9. **Save/load strategy** — Persist custom builder legs to `localStorage` so users can resume a strategy after page reload.

10. **IndexedDB result cache** — Cache the last N strategy results (with timestamps) using IndexedDB, matching the pattern established in `../option/` and `../options/`.

### Lower Priority / Advanced

11. **Volatility smile / skew** — Replace single IV input with a configurable term-structure / skew model for more realistic pricing across strikes.

12. **Portfolio Greeks** — Allow building a multi-strategy portfolio (multiple trades) and display aggregate Greeks exposure.

13. **Backtesting module** — Simple historical P&L simulation given a chosen strategy, entry date, and exit date using `yfinance` data via a lightweight API proxy.

14. **AI-powered suggestions** — Integrate Google Gemini API (see `../option/` for the pattern) to suggest optimal strategies based on a given market view and risk tolerance.

15. **Export to PDF/CSV** — Allow users to export strategy details (legs, premiums, Greeks, diagram) to PDF or CSV for record-keeping.

16. **Unit tests** — Add `options.test.js`-style tests (see `../options/options.test.js`) for the BS pricing functions and payoff calculations to prevent regressions.

17. **Accessibility improvements** — Enhance ARIA labels, keyboard navigation for the sidebar, and screen-reader support for chart data.

18. **Binomial tree pricing** — Add an alternative pricer (CRR Binomial model) for American-style options and compare with BS results.

---

## 🔗 Related Projects in This Repository

| Project | URL | Description |
|---------|-----|-------------|
| Options Visualizer | [`/options/`](https://majixai.github.io/options/) | Vanilla JS strategy visualizer with external `strategies.json` data |
| Stock Projection Analyzer | [`/option/`](https://majixai.github.io/option/) | AI-powered stock analysis using Gemini API with TradingView charts |
| Stock Analyzer | [`/stock_analyzer/`](https://majixai.github.io/stock_analyzer/) | TypeScript + esbuild stock projection tool |
| Finance Menu | [`/finance/`](https://majixai.github.io/finance/) | Navigation hub for all finance-related tools |

---

## 📜 Disclaimer

This application is for **educational and illustrative purposes only**. It does **not** constitute financial advice. Options trading involves substantial risk of loss and is not suitable for all investors. Black-Scholes theoretical prices may differ significantly from actual market prices. Always consult a qualified financial professional before trading.

---

## 📄 License

Distributed under the MIT License. See the repository root for details.
