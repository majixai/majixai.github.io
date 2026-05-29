"""Unit tests for root_directives adapter.

Tests skip gracefully when the finance/ or mathematics/ directories are absent.
All tests are offline and use only the standard library.
"""

import json
import tempfile
import unittest
from pathlib import Path

import pytest

import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from tradingview_integration.unified_feed.adapters.root_directives import (
    load_all_directives,
    load_directives_from_dir,
    load_root_python_directives,
    map_to_feature_engine_inputs,
    map_to_tensor_calculus_inputs,
)

pytestmark = pytest.mark.fast


class TestLoadDirectivesFromDir(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._dir = Path(self._td.name)

    def tearDown(self):
        self._td.cleanup()

    def test_missing_dir_returns_empty(self):
        result = load_directives_from_dir(self._dir / "nonexistent")
        self.assertEqual(result, {})

    def test_empty_dir_returns_empty(self):
        result = load_directives_from_dir(self._dir)
        self.assertEqual(result, {})

    def test_loads_json_file(self):
        (self._dir / "config.json").write_text(
            json.dumps({"features": ["ema", "rsi"]}), encoding="utf-8"
        )
        result = load_directives_from_dir(self._dir)
        self.assertEqual(result["features"], ["ema", "rsi"])

    def test_merges_multiple_json_files(self):
        (self._dir / "a.json").write_text(json.dumps({"x": 1}), encoding="utf-8")
        (self._dir / "b.json").write_text(json.dumps({"y": 2}), encoding="utf-8")
        result = load_directives_from_dir(self._dir)
        self.assertEqual(result["x"], 1)
        self.assertEqual(result["y"], 2)

    def test_later_file_overrides_earlier(self):
        # "b.json" comes after "a.json" alphabetically
        (self._dir / "a.json").write_text(json.dumps({"key": "from_a"}), encoding="utf-8")
        (self._dir / "b.json").write_text(json.dumps({"key": "from_b"}), encoding="utf-8")
        result = load_directives_from_dir(self._dir)
        self.assertEqual(result["key"], "from_b")

    def test_skips_unsupported_extensions(self):
        (self._dir / "notes.txt").write_text("not a directive", encoding="utf-8")
        (self._dir / "config.json").write_text(json.dumps({"k": "v"}), encoding="utf-8")
        result = load_directives_from_dir(self._dir)
        self.assertIn("k", result)
        self.assertNotIn("notes.txt", result)

    def test_invalid_json_skipped_gracefully(self):
        (self._dir / "bad.json").write_text("{ not valid json", encoding="utf-8")
        (self._dir / "good.json").write_text(json.dumps({"ok": True}), encoding="utf-8")
        result = load_directives_from_dir(self._dir)
        self.assertTrue(result.get("ok"))

    def test_loads_py_file(self):
        (self._dir / "directive.py").write_text(
            "lookback_periods = 20\nfeatures = ['rsi']\n", encoding="utf-8"
        )
        result = load_directives_from_dir(self._dir)
        self.assertEqual(result.get("lookback_periods"), 20)
        self.assertEqual(result.get("features"), ["rsi"])

    def test_py_skips_callables_and_private(self):
        (self._dir / "directive.py").write_text(
            "_private = 'secret'\ndef my_func(): pass\nok_value = 42\n",
            encoding="utf-8",
        )
        result = load_directives_from_dir(self._dir)
        self.assertNotIn("_private", result)
        self.assertNotIn("my_func", result)
        self.assertEqual(result.get("ok_value"), 42)

    def test_json_list_wrapped_under_stem(self):
        """A JSON array at top level is wrapped under the filename stem."""
        (self._dir / "files.json").write_text(
            json.dumps(["a.dat", "b.dat"]), encoding="utf-8"
        )
        result = load_directives_from_dir(self._dir)
        # "files" key should hold the list
        self.assertEqual(result.get("files"), ["a.dat", "b.dat"])


class TestLoadRootPythonDirectives(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._root = Path(self._td.name)

    def tearDown(self):
        self._td.cleanup()

    def test_no_directive_files_returns_empty(self):
        # app.py should NOT be loaded (not in the whitelist)
        (self._root / "app.py").write_text("APP_PORT = 5000\n", encoding="utf-8")
        result = load_root_python_directives(self._root)
        self.assertEqual(result, {})

    def test_config_py_loaded(self):
        (self._root / "config.py").write_text(
            "DEBUG = False\nTIMEOUT = 30\n", encoding="utf-8"
        )
        result = load_root_python_directives(self._root)
        self.assertFalse(result.get("DEBUG"))
        self.assertEqual(result.get("TIMEOUT"), 30)

    def test_settings_py_loaded(self):
        (self._root / "settings.py").write_text(
            "MAX_WORKERS = 4\n", encoding="utf-8"
        )
        result = load_root_python_directives(self._root)
        self.assertEqual(result.get("MAX_WORKERS"), 4)

    def test_absent_whitelist_files_skipped_silently(self):
        result = load_root_python_directives(self._root)
        self.assertEqual(result, {})

    def test_multiple_whitelist_files_merged(self):
        (self._root / "config.py").write_text("A = 1\n", encoding="utf-8")
        (self._root / "settings.py").write_text("B = 2\n", encoding="utf-8")
        result = load_root_python_directives(self._root)
        self.assertEqual(result.get("A"), 1)
        self.assertEqual(result.get("B"), 2)


class TestLoadAllDirectives(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._root = Path(self._td.name)

    def tearDown(self):
        self._td.cleanup()

    def test_absent_dirs_omitted(self):
        result = load_all_directives(repo_root=self._root)
        self.assertEqual(result, {})

    def test_present_dir_included(self):
        fin = self._root / "finance"
        fin.mkdir()
        (fin / "config.json").write_text(json.dumps({"thresholds": [0.1, 0.9]}))
        result = load_all_directives(repo_root=self._root)
        self.assertIn("finance", result)
        self.assertEqual(result["finance"]["thresholds"], [0.1, 0.9])

    def test_both_dirs_present(self):
        for d in ("finance", "mathematics"):
            p = self._root / d
            p.mkdir()
            (p / "cfg.json").write_text(json.dumps({"src": d}))
        result = load_all_directives(repo_root=self._root)
        self.assertIn("finance", result)
        self.assertIn("mathematics", result)

    def test_dbs_dir_loaded(self):
        dbs = self._root / "dbs"
        dbs.mkdir()
        (dbs / "files.json").write_text(json.dumps(["a.dat", "b.dat"]))
        result = load_all_directives(repo_root=self._root)
        self.assertIn("dbs", result)
        # files.json list is wrapped under "files" key
        self.assertIn("files", result["dbs"])

    def test_actions_dir_loaded(self):
        act = self._root / "actions"
        act.mkdir()
        (act / "config.json").write_text(json.dumps({"namespace": "test-app"}))
        result = load_all_directives(repo_root=self._root)
        self.assertIn("actions", result)
        self.assertEqual(result["actions"]["namespace"], "test-app")

    def test_root_python_under_python_key(self):
        (self._root / "config.py").write_text("WORKERS = 8\n", encoding="utf-8")
        result = load_all_directives(repo_root=self._root)
        self.assertIn("python", result)
        self.assertEqual(result["python"]["WORKERS"], 8)

    def test_non_directive_py_not_in_python_key(self):
        """app.py must NOT appear in the 'python' namespace."""
        (self._root / "app.py").write_text("PORT = 5000\n", encoding="utf-8")
        result = load_all_directives(repo_root=self._root)
        self.assertNotIn("python", result)


class TestMappingHelpers(unittest.TestCase):
    def _fake_directives(self) -> dict:
        return {
            "finance": {
                "features": ["ema", "rsi"],
                "weights": {"ema": 0.5, "rsi": 0.5},
                "unrelated_key": "ignored_in_fe",
                "metric_tensor": [[1, 0], [0, 1]],
            }
        }

    def test_feature_engine_extracts_known_keys(self):
        fe = map_to_feature_engine_inputs(self._fake_directives())
        self.assertEqual(fe["features"], ["ema", "rsi"])
        self.assertIn("weights", fe)

    def test_feature_engine_extra_bucket(self):
        fe = map_to_feature_engine_inputs(self._fake_directives())
        self.assertIn("unrelated_key", fe["extra"])

    def test_tensor_calculus_extracts_known_keys(self):
        tc = map_to_tensor_calculus_inputs(self._fake_directives())
        self.assertIn("metric_tensor", tc)

    def test_empty_directives(self):
        fe = map_to_feature_engine_inputs({})
        self.assertEqual(fe, {"extra": {}})
        tc = map_to_tensor_calculus_inputs({})
        self.assertEqual(tc, {"extra": {}})


if __name__ == "__main__":
    unittest.main()

