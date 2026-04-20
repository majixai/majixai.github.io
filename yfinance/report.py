"""
Top-Heavy Markdown report generator.

Section hierarchy
-----------------
I.   Key Projections   — Bayesian S&P 500 & BTC 24-hour forecast
II.  Zones             — Top-5 Expansion + Consolidation tickers
III. Bull Triggers     — Tickers with high-conviction buy signals
IV.  Data Bulk         — Full 1,000+ ticker snapshot table
"""

from __future__ import annotations

import io
import json
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from .zones import ZoneResult, ZoneSummary

# ── Bayesian projection helpers ──────────────────────────────────────────────
# These are lightweight heuristics that run without network access.
# When live prices are available (passed via `projections` dict), they are
# displayed directly.  Otherwise a short confidence statement is emitted.


def _sp500_projection_text(projections: Optional[Dict[str, Any]]) -> str:
    if not projections:
        return "_Insufficient data for projection – re-run with live market access._"
    sp = projections.get("sp500")
    if sp is None:
        return "_S&P 500 projection unavailable._"
    pct = sp.get("change_pct", 0.0)
    direction = "▲" if pct >= 0 else "▼"
    level = sp.get("projected_level")
    ci_lo = sp.get("ci_low")
    ci_hi = sp.get("ci_high")
    level_str = f" → **{level:,.0f}**" if level else ""
    ci_str = f" (95% CI: {ci_lo:,.0f}–{ci_hi:,.0f})" if (ci_lo and ci_hi) else ""
    return f"{direction} {abs(pct):.2f}%{level_str}{ci_str}"


def _btc_projection_text(projections: Optional[Dict[str, Any]]) -> str:
    if not projections:
        return "_Insufficient data for projection – re-run with live market access._"
    btc = projections.get("btc")
    if btc is None:
        return "_BTC projection unavailable._"
    pct = btc.get("change_pct", 0.0)
    direction = "▲" if pct >= 0 else "▼"
    level = btc.get("projected_level")
    ci_lo = btc.get("ci_low")
    ci_hi = btc.get("ci_high")
    level_str = f" → **${level:,.0f}**" if level else ""
    ci_str = f" (95% CI: ${ci_lo:,.0f}–${ci_hi:,.0f})" if (ci_lo and ci_hi) else ""
    return f"{direction} {abs(pct):.2f}%{level_str}{ci_str}"


# ── Section formatters ────────────────────────────────────────────────────────

def _section_i(projections: Optional[Dict[str, Any]], run_ts: str) -> str:
    sp_text = _sp500_projection_text(projections)
    btc_text = _btc_projection_text(projections)
    return f"""## I. Key Projections _(as of {run_ts})_

| Asset | 24h Forecast | Method |
|-------|-------------|--------|
| S&P 500 (`^GSPC`) | {sp_text} | Bayesian Inference |
| Bitcoin (`BTC-USD`) | {btc_text} | Bayesian Inference |

> Projections are probabilistic estimates; not financial advice.
"""


def _zone_row(r: ZoneResult) -> str:
    atr_z = f"{r.atr_zscore:.2f}" if r.atr_zscore == r.atr_zscore else "—"  # nan check
    rng_pct = f"{r.range_pct * 100:.3f}%" if r.range_pct == r.range_pct else "—"
    gain = f"{r.session_gain_pct * 100:+.2f}%" if r.session_gain_pct == r.session_gain_pct else "—"
    close = f"${r.last_close:,.2f}" if r.last_close == r.last_close else "—"
    bull = "🚀 YES" if r.bull_trigger else "—"
    return f"| `{r.ticker}` | {close} | {atr_z} | {rng_pct} | {gain} | {bull} |"


def _section_ii(summary: ZoneSummary, top_n: int = 5) -> str:
    header = """## II. Zones

### Expansion Zones (ATR z-score > 2σ)

| Ticker | Last Close | ATR z-score | 20d Range % | Session Gain | Bull Trigger |
|--------|-----------|-------------|-------------|--------------|--------------|
"""
    exp_rows = "\n".join(_zone_row(r) for r in summary.top_expansion(top_n))
    if not exp_rows:
        exp_rows = "| — | No expansion zones detected | | | | |"

    consol_header = """
### Consolidation Zones (20d range < 1% of price)

| Ticker | Last Close | ATR z-score | 20d Range % | Session Gain | Bull Trigger |
|--------|-----------|-------------|-------------|--------------|--------------|
"""
    consol_rows = "\n".join(_zone_row(r) for r in summary.top_consolidation(top_n))
    if not consol_rows:
        consol_rows = "| — | No consolidation zones detected | | | | |"

    return header + exp_rows + consol_header + consol_rows + "\n"


def _section_iii(summary: ZoneSummary) -> str:
    triggers = summary.bull_triggers
    header = f"""## III. Bull Triggers _{len(triggers)} detected_

Tickers inside an Expansion Zone **and** showing a ≥ 3% single-session gain.

"""
    if not triggers:
        return header + "_No Bull Triggers detected in this run._\n"

    rows = ["| Ticker | Close | ATR z-score | Session Gain |",
            "|--------|-------|-------------|--------------|"]
    for r in sorted(triggers, key=lambda x: x.session_gain_pct, reverse=True):
        gain = f"{r.session_gain_pct * 100:+.2f}%"
        atr_z = f"{r.atr_zscore:.2f}" if r.atr_zscore == r.atr_zscore else "—"
        close = f"${r.last_close:,.2f}" if r.last_close == r.last_close else "—"
        rows.append(f"| `{r.ticker}` | {close} | {atr_z} | {gain} |")

    return header + "\n".join(rows) + "\n"


def _section_iv(snapshots: List[Dict[str, Any]], limit: int = 1500) -> str:
    header = f"""## IV. Data Bulk _({len(snapshots):,} tickers)_

<details>
<summary>Click to expand the full ticker snapshot table</summary>

| Ticker | Close | ATR z-score | 20d Range % | Session Gain | Expansion | Consolidation | Bull Trigger |
|--------|-------|-------------|-------------|--------------|-----------|---------------|--------------|
"""
    rows = []
    for snap in snapshots[:limit]:
        t = snap.get("ticker", "—")
        close = f"${snap['last_close']:,.2f}" if snap.get("last_close") else "—"
        atr_z = f"{snap['atr_zscore']:.2f}" if snap.get("atr_zscore") is not None else "—"
        rng = f"{snap['range_pct'] * 100:.3f}%" if snap.get("range_pct") is not None else "—"
        gain = f"{snap['session_gain_pct'] * 100:+.2f}%" if snap.get("session_gain_pct") is not None else "—"
        exp = "✓" if snap.get("expansion") else ""
        con = "✓" if snap.get("consolidation") else ""
        bull = "🚀" if snap.get("bull_trigger") else ""
        rows.append(f"| `{t}` | {close} | {atr_z} | {rng} | {gain} | {exp} | {con} | {bull} |")

    return header + "\n".join(rows) + "\n\n</details>\n"


# ── Public API ────────────────────────────────────────────────────────────────

def build_report(
    summary: ZoneSummary,
    *,
    projections: Optional[Dict[str, Any]] = None,
    all_results: Optional[List[ZoneResult]] = None,
    top_n: int = 5,
    run_ts: Optional[str] = None,
) -> str:
    """
    Build the full Top-Heavy Markdown report.

    Parameters
    ----------
    summary:
        ZoneSummary produced by ``zones.classify_many`` or
        ``zones.classify_from_batch_df``.
    projections:
        Optional dict with keys ``"sp500"`` and ``"btc"`` each containing
        ``change_pct``, ``projected_level``, ``ci_low``, ``ci_high``.
    all_results:
        Full list of ZoneResult objects for the Data Bulk section.
        When omitted, only the zone subsets are included in section IV.
    top_n:
        Number of tickers to show in section II.
    run_ts:
        Formatted timestamp string.  Defaults to current UTC time.

    Returns
    -------
    str
        Full Markdown report.
    """
    ts = run_ts or datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    parts = [
        f"# 📊 Top-Heavy Forecast Report\n\n_Generated: {ts}_\n",
        _section_i(projections, ts),
        _section_ii(summary, top_n=top_n),
        _section_iii(summary),
    ]

    if all_results is not None:
        snapshots = [r.to_dict() for r in all_results]
    else:
        seen: set = set()
        snapshots = []
        for r in (
            summary.expansion_zones
            + summary.consolidation_zones
            + summary.bull_triggers
            + summary.errors
        ):
            if r.ticker not in seen:
                seen.add(r.ticker)
                snapshots.append(r.to_dict())

    parts.append(_section_iv(snapshots))

    # Footer
    parts.append(
        f"\n---\n_Expansion Zones: {len(summary.expansion_zones)} · "
        f"Consolidation Zones: {len(summary.consolidation_zones)} · "
        f"Bull Triggers: {len(summary.bull_triggers)} · "
        f"Errors: {len(summary.errors)}_\n"
    )

    return "\n".join(parts)


def write_summary_txt(summary: ZoneSummary, path: str) -> None:
    """
    Write a concise machine-readable summary to a plain-text file.
    Used by downstream tools that parse ``summary.txt``.
    """
    lines = [
        f"TOTAL_TICKERS={summary.total}",
        f"EXPANSION_COUNT={len(summary.expansion_zones)}",
        f"CONSOLIDATION_COUNT={len(summary.consolidation_zones)}",
        f"BULL_TRIGGER_COUNT={len(summary.bull_triggers)}",
        f"ERROR_COUNT={len(summary.errors)}",
        "",
    ]

    for r in summary.top_expansion(5):
        gain_str = f"{r.session_gain_pct * 100:+.2f}%" if r.session_gain_pct == r.session_gain_pct else "N/A"
        lines.append(
            f"EXPANSION\t{r.ticker}\tatr_z={r.atr_zscore:.2f}\tgain={gain_str}"
        )

    for r in summary.top_consolidation(5):
        rng_str = f"{r.range_pct * 100:.3f}%" if r.range_pct == r.range_pct else "N/A"
        lines.append(
            f"CONSOLIDATION\t{r.ticker}\trange_pct={rng_str}"
        )

    for r in summary.bull_triggers:
        gain_str = f"{r.session_gain_pct * 100:+.2f}%"
        lines.append(f"BULL_TRIGGER\t{r.ticker}\tgain={gain_str}")

    with open(path, "w", encoding="utf-8") as fh:
        fh.write("\n".join(lines) + "\n")
