"""Unit tests for dat_manager.py — focuses on dbs/ defaults and manifest sync.

All tests are offline and use only the standard library + tempfile.
"""

import gzip
import json
import os
import sqlite3
import tempfile
import unittest
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from tradingview_integration.unified_feed.db.dat_manager import (
    DatabaseManager,
    _update_dbs_manifest,
)

pytestmark = pytest.mark.fast


# ─────────────────────────────────────────────────────────────────────────────
# _update_dbs_manifest
# ─────────────────────────────────────────────────────────────────────────────

class TestUpdateDbsManifest(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._dbs = Path(self._td.name) / "dbs"
        self._dbs.mkdir()

    def tearDown(self):
        self._td.cleanup()

    def test_creates_files_json(self):
        (self._dbs / "cache.dat.gz").write_bytes(b"fake gz")
        _update_dbs_manifest(self._dbs)
        manifest = json.loads((self._dbs / "files.json").read_text())
        self.assertIn("cache.dat.gz", manifest)

    def test_excludes_files_json_itself(self):
        (self._dbs / "cache.dat.gz").write_bytes(b"fake gz")
        (self._dbs / "files.json").write_text("[]")
        _update_dbs_manifest(self._dbs)
        manifest = json.loads((self._dbs / "files.json").read_text())
        self.assertNotIn("files.json", manifest)

    def test_sorted_output(self):
        for name in ("z.dat.gz", "a.dat.gz", "m.dat.gz"):
            (self._dbs / name).write_bytes(b"x")
        _update_dbs_manifest(self._dbs)
        manifest = json.loads((self._dbs / "files.json").read_text())
        self.assertEqual(manifest, sorted(manifest))

    def test_empty_dir_writes_empty_list(self):
        _update_dbs_manifest(self._dbs)
        manifest = json.loads((self._dbs / "files.json").read_text())
        self.assertEqual(manifest, [])

    def test_absent_dir_no_error(self):
        _update_dbs_manifest(Path(self._td.name) / "nonexistent")


# ─────────────────────────────────────────────────────────────────────────────
# DatabaseManager — bare filename resolution
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseManagerDefaults(unittest.TestCase):
    def test_bare_filename_resolves_to_dbs_dir(self):
        from tradingview_integration.unified_feed.db.dat_manager import _DEFAULT_DBS_DIR
        dm = DatabaseManager("my_cache.dat.gz")
        self.assertEqual(dm._dat_path.parent.resolve(), _DEFAULT_DBS_DIR.resolve())

    def test_absolute_path_unchanged(self):
        with tempfile.TemporaryDirectory() as td:
            target = Path(td) / "feed.dat.gz"
            dm = DatabaseManager(target)
            self.assertEqual(dm._dat_path, target)

    def test_relative_path_with_dir_unchanged(self):
        """A relative path with a directory component is not moved to dbs/."""
        dm = DatabaseManager("some/subdir/feed.dat.gz")
        self.assertEqual(dm._dat_path, Path("some/subdir/feed.dat.gz"))


# ─────────────────────────────────────────────────────────────────────────────
# DatabaseManager — manifest sync when writing to dbs/
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseManagerManifestSync(unittest.TestCase):
    """Tests manifest sync by using explicit paths inside a temp dbs/ dir."""

    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._dbs = Path(self._td.name) / "dbs"
        self._dbs.mkdir()

    def tearDown(self):
        self._td.cleanup()

    def _dat_path(self, name: str = "test.dat.gz") -> Path:
        return self._dbs / name

    def _make_dm(self, name: str = "test.dat.gz") -> DatabaseManager:
        return DatabaseManager(self._dat_path(name))

    def _fake_dbs_dir(self, dm: "DatabaseManager") -> None:
        """Monkey-patch _dat_path so manifest detection uses our temp dbs/."""
        import tradingview_integration.unified_feed.db.dat_manager as mod
        self._orig_dbs_dir = mod._DEFAULT_DBS_DIR
        mod._DEFAULT_DBS_DIR = self._dbs

    def _restore_dbs_dir(self, dm: "DatabaseManager") -> None:
        import tradingview_integration.unified_feed.db.dat_manager as mod
        mod._DEFAULT_DBS_DIR = self._orig_dbs_dir

    def test_manifest_updated_after_append(self):
        import tradingview_integration.unified_feed.db.dat_manager as mod
        orig = mod._DEFAULT_DBS_DIR
        mod._DEFAULT_DBS_DIR = self._dbs
        try:
            dm = self._make_dm()
            dm.open_dat()
            dm.append_summary("AAPL", "1d", 1_700_000_000, "abc" * 20)
            dm.close()

            self.assertTrue((self._dbs / "test.dat.gz").exists())
            manifest_path = self._dbs / "files.json"
            self.assertTrue(manifest_path.exists())
            manifest = json.loads(manifest_path.read_text())
            self.assertIn("test.dat.gz", manifest)
        finally:
            mod._DEFAULT_DBS_DIR = orig

    def test_manifest_not_created_outside_dbs(self):
        """No files.json side-effect when the dat file is in a different dir."""
        with tempfile.TemporaryDirectory() as other_td:
            other_path = Path(other_td) / "feed.dat.gz"
            dm = DatabaseManager(other_path)
            dm.open_dat()
            dm.append_summary("SPY", "1m", 1_700_000_000, "x" * 64)
            dm.close()
            # Our temp dbs/ should NOT have had a files.json created
            self.assertFalse((self._dbs / "files.json").exists())


# ─────────────────────────────────────────────────────────────────────────────
# DatabaseManager — basic round-trip (regression)
# ─────────────────────────────────────────────────────────────────────────────

class TestDatabaseManagerRoundtrip(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._path = Path(self._td.name) / "store.dat.gz"

    def tearDown(self):
        self._td.cleanup()

    def test_open_write_query_close(self):
        dm = DatabaseManager(self._path)
        dm.open_dat()
        rowid = dm.append_summary(
            "TSLA", "5m", 1_700_000_000, "a" * 64,
            metadata={"src": "yfinance"},
            filename_sha256="b" * 64,
        )
        self.assertIsInstance(rowid, int)
        rows = dm.query_summaries({"ticker": "TSLA"})
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["ticker"], "TSLA")
        self.assertEqual(rows[0]["interval"], "5m")
        self.assertEqual(rows[0]["metadata"]["src"], "yfinance")
        dm.close()

    def test_context_manager(self):
        with DatabaseManager(self._path) as dm:
            dm.append_summary("GLD", "1h", 1_700_000_001, "c" * 64)
        self.assertTrue(self._path.exists())

    def test_no_query_without_open(self):
        dm = DatabaseManager(self._path)
        with self.assertRaises(RuntimeError):
            dm.query_summaries()

    def test_dat_gz_is_valid_gzip(self):
        with DatabaseManager(self._path) as dm:
            dm.append_summary("IWM", "1d", 1_700_000_002, "d" * 64)
        with gzip.open(self._path, "rb") as gz:
            raw = gz.read()
        self.assertGreater(len(raw), 0)


if __name__ == "__main__":
    unittest.main()
