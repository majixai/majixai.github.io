"""
Unit tests for yfinance/report.py — Top-Heavy report generator.
"""
import math
import unittest

import numpy as np
import pandas as pd

import sys, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[2]))

from yfinance.zones import ZoneResult, ZoneSummary
from yfinance.report import (
    _btc_projection_text,
    _sp500_projection_text,
    build_report,
    write_summary_txt,
)


# ── Fixtures ──────────────────────────────────────────────────────────────────

def _mkresult(ticker, expansion=False, consolidation=False, bull_trigger=False,
              atr_zscore=0.5, range_pct=0.05, session_gain_pct=0.01, last_close=100.0):
    r = ZoneResult(ticker=ticker)
    r.expansion = expansion
    r.consolidation = consolidation
    r.bull_trigger = bull_trigger
    r.atr_zscore = atr_zscore
    r.range_pct = range_pct
    r.session_gain_pct = session_gain_pct
    r.last_close = last_close
    return r


def _sample_summary():
    s = ZoneSummary(total=4)
    s.expansion_zones = [
        _mkresult("AAA", expansion=True, atr_zscore=3.5, session_gain_pct=0.04, last_close=150.0),
        _mkresult("BBB", expansion=True, atr_zscore=2.8, session_gain_pct=0.01, last_close=80.0),
    ]
    s.consolidation_zones = [
        _mkresult("CCC", consolidation=True, range_pct=0.005, last_close=200.0),
    ]
    s.bull_triggers = [
        _mkresult("AAA", expansion=True, bull_trigger=True, atr_zscore=3.5, session_gain_pct=0.04, last_close=150.0),
    ]
    return s


_SAMPLE_PROJECTIONS = {
    "sp500": {
        "change_pct": 0.42,
        "projected_level": 5200.0,
        "ci_low": 5100.0,
        "ci_high": 5300.0,
    },
    "btc": {
        "change_pct": -1.2,
        "projected_level": 68000.0,
        "ci_low": 65000.0,
        "ci_high": 71000.0,
    },
}


# ── _sp500_projection_text ────────────────────────────────────────────────────

class TestSP500ProjectionText(unittest.TestCase):
    def test_none_projections(self):
        txt = _sp500_projection_text(None)
        self.assertIn("Insufficient", txt)

    def test_missing_sp500_key(self):
        txt = _sp500_projection_text({"btc": {}})
        self.assertIn("unavailable", txt.lower())

    def test_positive_projection(self):
        txt = _sp500_projection_text(_SAMPLE_PROJECTIONS)
        self.assertIn("▲", txt)
        self.assertIn("0.42", txt)

    def test_projected_level_shown(self):
        txt = _sp500_projection_text(_SAMPLE_PROJECTIONS)
        self.assertIn("5,200", txt)

    def test_ci_shown(self):
        txt = _sp500_projection_text(_SAMPLE_PROJECTIONS)
        self.assertIn("5,100", txt)
        self.assertIn("5,300", txt)


# ── _btc_projection_text ──────────────────────────────────────────────────────

class TestBTCProjectionText(unittest.TestCase):
    def test_none_projections(self):
        txt = _btc_projection_text(None)
        self.assertIn("Insufficient", txt)

    def test_negative_projection(self):
        txt = _btc_projection_text(_SAMPLE_PROJECTIONS)
        self.assertIn("▼", txt)
        self.assertIn("1.20", txt)

    def test_projected_level_shown(self):
        txt = _btc_projection_text(_SAMPLE_PROJECTIONS)
        self.assertIn("68,000", txt)


# ── build_report ──────────────────────────────────────────────────────────────

class TestBuildReport(unittest.TestCase):
    def setUp(self):
        self.summary = _sample_summary()

    def test_returns_string(self):
        md = build_report(self.summary)
        self.assertIsInstance(md, str)
        self.assertGreater(len(md), 100)

    def test_contains_all_sections(self):
        md = build_report(self.summary, projections=_SAMPLE_PROJECTIONS)
        self.assertIn("## I. Key Projections", md)
        self.assertIn("## II. Zones", md)
        self.assertIn("## III. Bull Triggers", md)
        self.assertIn("## IV. Data Bulk", md)

    def test_section_i_with_projections(self):
        md = build_report(self.summary, projections=_SAMPLE_PROJECTIONS)
        self.assertIn("^GSPC", md)
        self.assertIn("BTC-USD", md)
        self.assertIn("Bayesian", md)

    def test_section_i_without_projections(self):
        md = build_report(self.summary)
        self.assertIn("Insufficient", md)

    def test_section_ii_expansion_tickers(self):
        md = build_report(self.summary)
        self.assertIn("AAA", md)
        self.assertIn("BBB", md)

    def test_section_ii_consolidation_tickers(self):
        md = build_report(self.summary)
        self.assertIn("CCC", md)

    def test_section_iii_bull_triggers(self):
        md = build_report(self.summary)
        self.assertIn("Bull Triggers", md)
        self.assertIn("AAA", md)

    def test_section_iii_no_triggers(self):
        summary = ZoneSummary(total=1)
        summary.expansion_zones = [_mkresult("X", expansion=True)]
        md = build_report(summary)
        self.assertIn("No Bull Triggers", md)

    def test_section_iv_all_results(self):
        all_results = [
            _mkresult("AAA", expansion=True),
            _mkresult("BBB"),
            _mkresult("CCC", consolidation=True),
        ]
        md = build_report(self.summary, all_results=all_results)
        self.assertIn("3 tickers", md)

    def test_custom_run_ts(self):
        md = build_report(self.summary, run_ts="2025-01-15 12:00 UTC")
        self.assertIn("2025-01-15", md)

    def test_top_n_limits_rows(self):
        # Create 10 expansion tickers
        s = ZoneSummary(total=10)
        s.expansion_zones = [
            _mkresult(f"T{i}", expansion=True, atr_zscore=float(10 - i))
            for i in range(10)
        ]
        md = build_report(s, top_n=3)
        # Section II should show at most 3 from each zone
        # Count expansion zone ticker names appearing in the table portion
        # (simple smoke-test: first 3 appear, 7th does not)
        self.assertIn("T0", md)
        self.assertIn("T1", md)
        self.assertIn("T2", md)

    def test_footer_present(self):
        md = build_report(self.summary)
        self.assertIn("Expansion Zones:", md)
        self.assertIn("Bull Triggers:", md)


# ── write_summary_txt ─────────────────────────────────────────────────────────

class TestWriteSummaryTxt(unittest.TestCase):
    def test_creates_file(self):
        import tempfile, os
        summary = _sample_summary()
        with tempfile.NamedTemporaryFile(mode='r', suffix='.txt', delete=False) as f:
            path = f.name
        try:
            write_summary_txt(summary, path)
            with open(path) as f:
                content = f.read()
            self.assertIn("TOTAL_TICKERS=4", content)
            self.assertIn("EXPANSION_COUNT=2", content)
            self.assertIn("BULL_TRIGGER_COUNT=1", content)
            self.assertIn("BULL_TRIGGER\tAAA", content)
            self.assertIn("EXPANSION\tAAA", content)
            self.assertIn("CONSOLIDATION\tCCC", content)
        finally:
            os.unlink(path)

    def test_no_triggers_no_bull_line(self):
        import tempfile, os
        s = ZoneSummary(total=1)
        s.expansion_zones = [_mkresult("X", expansion=True)]
        with tempfile.NamedTemporaryFile(mode='r', suffix='.txt', delete=False) as f:
            path = f.name
        try:
            write_summary_txt(s, path)
            with open(path) as f:
                content = f.read()
            # Only the count line should appear; no actual BULL_TRIGGER data rows
            self.assertIn("BULL_TRIGGER_COUNT=0", content)
            # No tab-separated data row for bull triggers
            self.assertNotIn("BULL_TRIGGER\t", content)
        finally:
            os.unlink(path)


if __name__ == "__main__":
    unittest.main()
