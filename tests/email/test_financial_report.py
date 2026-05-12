import importlib.util
import tempfile
import unittest
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch


REPO_ROOT = Path("/home/runner/work/majixai.github.io/majixai.github.io")
MODULE_PATH = REPO_ROOT / "email" / "financial_report.py"

_SPEC = importlib.util.spec_from_file_location("majix_financial_report_test", MODULE_PATH)
financial_report = importlib.util.module_from_spec(_SPEC)
_SPEC.loader.exec_module(financial_report)


class TestGeminiRateLimit(unittest.TestCase):
    def test_consume_gemini_rate_limit_persists_gzip_state(self):
        now = datetime(2026, 5, 12, 2, 0, tzinfo=timezone.utc)
        with tempfile.TemporaryDirectory() as tmpdir:
            state_path = Path(tmpdir) / "gemini_rate_limit.dat.gz"

            allowed, info = financial_report._consume_gemini_rate_limit(
                now,
                path=state_path,
                daily_limit=1,
                monthly_limit=2,
            )
            self.assertTrue(allowed)
            self.assertEqual(info["daily_count"], 1)
            self.assertTrue(state_path.exists())

            allowed_again, info_again = financial_report._consume_gemini_rate_limit(
                now,
                path=state_path,
                daily_limit=1,
                monthly_limit=2,
            )
            self.assertFalse(allowed_again)
            self.assertIn("Daily Gemini budget exhausted", info_again["reason"])


class TestNightlyIxicReport(unittest.TestCase):
    def test_nightly_ixic_report_uses_ixic_target_and_sections(self):
        bundle = {
            "weekly": {
                "timeframe": "weekly",
                "persistence": "multiday",
                "latest": {"open": 18000, "high": 18200, "low": 17950, "close": 18150, "volume": 1000},
                "indicators": {"SMA20": 17500, "EMA9": 18020, "EMA21": 17890, "RSI14": 61.2, "MACD": 22.1, "ATR14": 180.0},
                "patterns": ["bullish_engulfing"],
                "trend": "up",
                "regime": "expansion",
                "volume_trend": "rising",
                "support": 17800,
                "resistance": 18250,
            },
            "daily": {
                "timeframe": "daily",
                "persistence": "multiday",
                "latest": {"open": 18100, "high": 18210, "low": 18040, "close": 18180, "volume": 2000},
                "indicators": {"SMA20": 17990, "EMA9": 18110, "EMA21": 18010, "RSI14": 63.4, "MACD": 18.2, "ATR14": 120.0},
                "patterns": ["bullish_engulfing"],
                "trend": "up",
                "regime": "compression",
                "volume_trend": "stable",
                "support": 18000,
                "resistance": 18220,
            },
            "hourly": {
                "timeframe": "hourly",
                "persistence": "session-fresh",
                "latest": {"open": 18120, "high": 18190, "low": 18100, "close": 18170, "volume": 3000},
                "indicators": {"SMA20": 18100, "EMA9": 18140, "EMA21": 18110, "RSI14": 58.1, "MACD": 7.2, "ATR14": 42.0},
                "patterns": ["doji"],
                "trend": "up",
                "regime": "compression",
                "volume_trend": "stable",
                "support": 18100,
                "resistance": 18195,
            },
            "15m": {
                "timeframe": "15m",
                "persistence": "session-fresh",
                "latest": {"open": 18160, "high": 18188, "low": 18142, "close": 18174, "volume": 4000},
                "indicators": {"SMA20": 18155, "EMA9": 18168, "EMA21": 18157, "RSI14": 55.9, "MACD": 3.8, "ATR14": 18.0},
                "patterns": ["doji"],
                "trend": "up",
                "regime": "compression",
                "volume_trend": "rising",
                "support": 18140,
                "resistance": 18190,
            },
        }
        forecast = {"open": 18190.0, "high": 18280.0, "low": 18110.0, "close": 18235.0, "volume_bias": "rising", "bias": "bullish"}
        gemini = {"title": "Gemini commentary skipped", "body": "Set GEMINI_API_KEY in secure secret storage."}

        with patch.object(financial_report, "_fetch_ixic_multi_timeframe_bundle", return_value=bundle), \
             patch.object(financial_report, "_derive_ixic_ohlcv_forecast", return_value=forecast), \
             patch.object(financial_report, "_maybe_generate_gemini_ixic_commentary", return_value=gemini):
            subject, html = financial_report.build_nightly_ixic_forecast_report(
                datetime(2026, 5, 12, 2, 0, tzinfo=timezone.utc)
            )

        self.assertIn("IXIC Nightly Market Forecast", subject)
        self.assertIn("^IXIC", html)
        self.assertIn("Next-Session OHLCV Forecast", html)
        self.assertIn("shared trend = up", html)
        self.assertIn("Gemini commentary skipped", html)


if __name__ == "__main__":
    unittest.main()
