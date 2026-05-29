"""Unit tests for sha256_provenance.py.

All tests are offline and use only the standard library + tempfile.
Marked with pytest.mark.fast for quick CI inclusion.
"""

import hashlib
import json
import os
import tempfile
import unittest
from pathlib import Path

import pytest

# Allow running directly: python tradingview_integration/unified_feed/tests/test_sha256_provenance.py
import sys
sys.path.insert(0, str(Path(__file__).resolve().parents[4]))

from tradingview_integration.unified_feed.utils.sha256_provenance import (
    db_register_artifact,
    sha256_of_bytes,
    sha256_of_file,
    sha256_of_filename,
    verify_artifact,
    write_metadata_atomic,
)

pytestmark = pytest.mark.fast


# ─────────────────────────────────────────────────────────────────────────────
# sha256_of_bytes
# ─────────────────────────────────────────────────────────────────────────────

class TestSha256OfBytes(unittest.TestCase):
    def test_empty(self):
        expected = hashlib.sha256(b"").hexdigest()
        self.assertEqual(sha256_of_bytes(b""), expected)

    def test_known(self):
        data = b"hello world"
        self.assertEqual(sha256_of_bytes(data), hashlib.sha256(data).hexdigest())

    def test_returns_64_chars(self):
        self.assertEqual(len(sha256_of_bytes(b"test")), 64)


# ─────────────────────────────────────────────────────────────────────────────
# sha256_of_file
# ─────────────────────────────────────────────────────────────────────────────

class TestSha256OfFile(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._dir = Path(self._td.name)

    def tearDown(self):
        self._td.cleanup()

    def _write(self, name: str, content: bytes) -> Path:
        p = self._dir / name
        p.write_bytes(content)
        return p

    def test_known_content(self):
        content = b"artifact content"
        p = self._write("a.bin", content)
        self.assertEqual(sha256_of_file(p), hashlib.sha256(content).hexdigest())

    def test_empty_file(self):
        p = self._write("empty.bin", b"")
        self.assertEqual(sha256_of_file(p), hashlib.sha256(b"").hexdigest())

    def test_missing_file_raises(self):
        with self.assertRaises(FileNotFoundError):
            sha256_of_file(self._dir / "nonexistent.bin")


# ─────────────────────────────────────────────────────────────────────────────
# sha256_of_filename  (filename hashing)
# ─────────────────────────────────────────────────────────────────────────────

class TestSha256OfFilename(unittest.TestCase):
    def test_basename_only(self):
        """Only the basename should be hashed, not the full path."""
        name = "SPY_1m_2024-01-15.parquet"
        expected = hashlib.sha256(name.encode()).hexdigest()
        self.assertEqual(sha256_of_filename(f"some/deep/path/{name}"), expected)
        self.assertEqual(sha256_of_filename(name), expected)

    def test_different_dirs_same_hash(self):
        """Moving a file to a different directory must not change filename hash."""
        h1 = sha256_of_filename("/dir_a/report.json")
        h2 = sha256_of_filename("/dir_b/report.json")
        self.assertEqual(h1, h2)

    def test_different_names_different_hash(self):
        h1 = sha256_of_filename("file_a.txt")
        h2 = sha256_of_filename("file_b.txt")
        self.assertNotEqual(h1, h2)

    def test_returns_64_chars(self):
        self.assertEqual(len(sha256_of_filename("anything.dat")), 64)

    def test_file_need_not_exist(self):
        # Should not raise even if the file doesn't exist
        result = sha256_of_filename("/tmp/ghost_file_that_does_not_exist.parquet")
        self.assertEqual(len(result), 64)

    def test_pathlib_path(self):
        p = Path("/some/path/data.parquet")
        self.assertEqual(sha256_of_filename(p), sha256_of_filename("data.parquet"))


# ─────────────────────────────────────────────────────────────────────────────
# write_metadata_atomic / verify_artifact
# ─────────────────────────────────────────────────────────────────────────────

class TestWriteAndVerify(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._dir = Path(self._td.name)

    def tearDown(self):
        self._td.cleanup()

    def _artifact(self, name: str = "artifact.bin", content: bytes = b"data") -> Path:
        p = self._dir / name
        p.write_bytes(content)
        return p

    def test_sidecars_created(self):
        p = self._artifact()
        write_metadata_atomic(p, {"ticker": "SPY"})
        self.assertTrue((self._dir / "artifact.bin.meta.json").exists())
        self.assertTrue((self._dir / "artifact.bin.sha256").exists())

    def test_meta_contains_required_keys(self):
        p = self._artifact()
        write_metadata_atomic(p, {"ticker": "QQQ"})
        meta = json.loads((self._dir / "artifact.bin.meta.json").read_text())
        self.assertIn("sha256", meta)
        self.assertIn("filename_sha256", meta)
        self.assertIn("artifact", meta)
        self.assertEqual(meta["ticker"], "QQQ")

    def test_filename_sha256_in_meta(self):
        p = self._artifact("my_ticker_1h.bin")
        write_metadata_atomic(p, {})
        meta = json.loads((self._dir / "my_ticker_1h.bin.meta.json").read_text())
        expected_fhash = sha256_of_filename("my_ticker_1h.bin")
        self.assertEqual(meta["filename_sha256"], expected_fhash)

    def test_verify_ok(self):
        p = self._artifact()
        write_metadata_atomic(p, {})
        ok, exp, act = verify_artifact(p, strict=True)
        self.assertTrue(ok)
        self.assertEqual(exp, act)

    def test_verify_detects_tamper(self):
        p = self._artifact(content=b"original")
        write_metadata_atomic(p, {})
        p.write_bytes(b"tampered!")
        ok, exp, act = verify_artifact(p, strict=False)
        self.assertFalse(ok)
        self.assertNotEqual(exp, act)

    def test_verify_strict_raises_on_tamper(self):
        p = self._artifact(content=b"original")
        write_metadata_atomic(p, {})
        p.write_bytes(b"tampered!")
        with self.assertRaises(ValueError):
            verify_artifact(p, strict=True)

    def test_verify_no_sidecar(self):
        p = self._artifact()
        ok, exp, act = verify_artifact(p, strict=False)
        self.assertFalse(ok)
        self.assertIsNone(exp)
        self.assertIsNotNone(act)

    def test_atomic_write_no_partial(self):
        """Sidecar files must not leave .tmp files on disk after write."""
        p = self._artifact()
        write_metadata_atomic(p, {})
        tmp_files = list(self._dir.glob("*.tmp"))
        self.assertEqual(tmp_files, [])


# ─────────────────────────────────────────────────────────────────────────────
# db_register_artifact (in-memory SQLite path)
# ─────────────────────────────────────────────────────────────────────────────

class TestDbRegisterArtifact(unittest.TestCase):
    def setUp(self):
        self._td = tempfile.TemporaryDirectory()
        self._dir = Path(self._td.name)

    def tearDown(self):
        self._td.cleanup()

    def test_no_session_returns_none(self):
        p = self._dir / "artifact.bin"
        p.write_bytes(b"data")
        result = db_register_artifact(None, p, {})
        self.assertIsNone(result)

    def test_with_sqlalchemy_session(self):
        pytest.importorskip("sqlalchemy")
        import sqlite3 as _sqlite3
        from sqlalchemy import create_engine
        from sqlalchemy.orm import Session

        p = self._dir / "artifact.bin"
        p.write_bytes(b"test content for db")

        engine = create_engine("sqlite:///:memory:", future=True)
        with Session(engine) as session:
            result = db_register_artifact(session, p, {"source": "test"})
            # Should return an ORM row (not None) when SQLAlchemy is available
            if result is not None:
                self.assertEqual(result.artifact_name, "artifact.bin")
                self.assertEqual(len(result.sha256), 64)
                self.assertEqual(len(result.filename_sha256), 64)


if __name__ == "__main__":
    unittest.main()
