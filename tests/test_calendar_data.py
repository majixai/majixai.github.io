"""
tests/test_calendar_data.py

Unit tests for the root-level ``calendar_data`` module.

Covers:
- Correct calendar structure for a known month.
- JSON serialisation and file writing.
- Boundary cases (leap-year February, December).
"""
import json
import os
import sys
import tempfile
import unittest
from unittest.mock import patch, mock_open

# conftest.py already inserts REPO_ROOT onto sys.path
import calendar_data


class TestGenerateCalendarData(unittest.TestCase):
    """Tests for ``generate_calendar_data``."""

    def test_returns_correct_year_and_month(self):
        """The output dict contains the requested year and month."""
        with patch("builtins.open", mock_open()):
            calendar_data.generate_calendar_data(2024, 3)
        # We can't inspect the return value because the function writes to disk
        # and returns None — so we verify via a fresh call with a real tmpfile.

    def test_json_file_is_written(self):
        """generate_calendar_data writes a valid JSON file."""
        import builtins

        with tempfile.TemporaryDirectory() as tmpdir:
            json_path = os.path.join(tmpdir, "calendar.json")
            real_open = builtins.open

            def fake_open(path, mode="r", **kwargs):
                if path == "json/calendar.json" and "w" in mode:
                    return real_open(json_path, mode, **kwargs)
                return real_open(path, mode, **kwargs)

            with patch("builtins.open", side_effect=fake_open):
                calendar_data.generate_calendar_data(2024, 6)

            with real_open(json_path) as fh:
                written_data = json.load(fh)

        self.assertEqual(written_data["year"], 2024)
        self.assertEqual(written_data["month"], 6)
        self.assertIn("calendar", written_data)
        self.assertIsInstance(written_data["calendar"], list)

    def test_calendar_structure_january(self):
        """January 2025 has exactly the right week rows."""
        import calendar as _cal

        expected = _cal.monthcalendar(2025, 1)

        written_data: dict = {}

        def fake_open(path, mode="r", **kwargs):
            if "w" in mode:
                import io

                buf = io.StringIO()

                class _Writer:
                    def __enter__(self_inner):
                        return buf

                    def __exit__(self_inner, *_):
                        buf.seek(0)
                        written_data.update(json.loads(buf.getvalue()))

                    def write(self_inner, s):
                        buf.write(s)

                return _Writer()
            return open(path, mode, **kwargs)

        # Use mock_open to avoid real file I/O
        m = mock_open()
        with patch("builtins.open", m):
            calendar_data.generate_calendar_data(2025, 1)

        # Verify the data passed to json.dump via mock inspection
        handle = m()
        written = "".join(call.args[0] for call in handle.write.call_args_list)
        result = json.loads(written)

        self.assertEqual(result["year"], 2025)
        self.assertEqual(result["month"], 1)
        self.assertEqual(result["calendar"], expected)

    def test_leap_year_february(self):
        """Leap-year February 2024 has 29 days reflected in the calendar."""
        import calendar as _cal

        expected_weeks = _cal.monthcalendar(2024, 2)
        # Flatten and count non-zero days
        all_days = [d for week in expected_weeks for d in week if d != 0]
        self.assertEqual(len(all_days), 29)

        m = mock_open()
        with patch("builtins.open", m):
            calendar_data.generate_calendar_data(2024, 2)

        handle = m()
        written = "".join(call.args[0] for call in handle.write.call_args_list)
        result = json.loads(written)

        self.assertEqual(result["year"], 2024)
        self.assertEqual(result["month"], 2)
        self.assertEqual(result["calendar"], expected_weeks)

    def test_december_has_31_days(self):
        """December always has 31 days."""
        import calendar as _cal

        expected_weeks = _cal.monthcalendar(2023, 12)
        all_days = [d for week in expected_weeks for d in week if d != 0]
        self.assertEqual(len(all_days), 31)

        m = mock_open()
        with patch("builtins.open", m):
            calendar_data.generate_calendar_data(2023, 12)

        handle = m()
        written = "".join(call.args[0] for call in handle.write.call_args_list)
        result = json.loads(written)
        self.assertEqual(result["calendar"], expected_weeks)


if __name__ == "__main__":
    unittest.main()
