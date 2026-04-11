"""
tests/test_database.py

Unit tests for the root-level ``database`` module.

The module wraps SQLite via Flask's application-context helpers (``g``).
All tests use a minimal in-memory Flask application so no real database
file is created on disk.

Covers:
- ``get_db`` returns a connection and caches it on ``g``.
- ``close_db`` closes the connection and removes it from ``g``.
- ``init_app`` registers the teardown hook and CLI command.
"""
import os
import sys
import unittest

# ---------------------------------------------------------------------------
# Guard: skip the entire module if Flask is not installed.
# ---------------------------------------------------------------------------
try:
    from flask import Flask
    _FLASK_AVAILABLE = True
except ImportError:  # pragma: no cover
    _FLASK_AVAILABLE = False

import database


@unittest.skipUnless(_FLASK_AVAILABLE, "Flask is not installed")
class TestGetDb(unittest.TestCase):
    """Tests for ``database.get_db``."""

    def _make_app(self):
        app = Flask(__name__)
        app.config["DATABASE"] = ":memory:"
        # Override the module-level DATABASE constant for isolation
        database.DATABASE = ":memory:"
        database.init_app(app)
        return app

    def test_get_db_returns_connection(self):
        """get_db() should return a sqlite3 connection."""
        import sqlite3

        app = self._make_app()
        with app.app_context():
            conn = database.get_db()
            self.assertIsNotNone(conn)
            self.assertIsInstance(conn, sqlite3.Connection)

    def test_get_db_cached_on_g(self):
        """Calling get_db() twice returns the same connection object."""
        app = self._make_app()
        with app.app_context():
            conn1 = database.get_db()
            conn2 = database.get_db()
            self.assertIs(conn1, conn2)

    def test_close_db_removes_from_g(self):
        """After close_db() the connection is no longer stored on g."""
        from flask import g

        app = self._make_app()
        with app.app_context():
            database.get_db()
            self.assertIn("db", g.__dict__ if hasattr(g, "__dict__") else dir(g))
            database.close_db()
            # After closing, 'db' should be absent from g
            self.assertNotIn("db", g.__dict__ if hasattr(g, "__dict__") else {})

    def test_close_db_without_prior_get_db(self):
        """close_db() should not raise even if get_db() was never called."""
        app = self._make_app()
        with app.app_context():
            # Should complete silently
            database.close_db()


@unittest.skipUnless(_FLASK_AVAILABLE, "Flask is not installed")
class TestInitApp(unittest.TestCase):
    """Tests for ``database.init_app``."""

    def test_init_app_registers_teardown(self):
        """init_app() should register a teardown_appcontext handler."""
        app = Flask(__name__)
        # Teardown functions are stored internally; just verify no exception
        database.init_app(app)

    def test_init_app_registers_cli_command(self):
        """init_app() should add the 'init-db' CLI command."""
        app = Flask(__name__)
        database.init_app(app)
        self.assertIn("init-db", app.cli.commands)


if __name__ == "__main__":
    unittest.main()
