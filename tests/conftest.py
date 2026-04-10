"""
tests/conftest.py

Shared pytest configuration for the root-level test suite.

Inserts the repository root and every first-level module directory onto
sys.path so that ``import <module>`` works inside any test file without
each test having to repeat the path manipulation itself.
"""
import os
import sys

# ---------------------------------------------------------------------------
# Ensure the repository root is always importable
# ---------------------------------------------------------------------------
REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

# ---------------------------------------------------------------------------
# Register every first-level sub-directory that contains Python source so
# tests can do ``from <subdir> import something`` directly.
# ---------------------------------------------------------------------------
_SKIP_DIRS = {
    ".git", ".github", "__pycache__", "tests",
    "node_modules", "venv", ".venv",
}

for _entry in os.listdir(REPO_ROOT):
    _full = os.path.join(REPO_ROOT, _entry)
    if os.path.isdir(_full) and _entry not in _SKIP_DIRS:
        if _full not in sys.path:
            sys.path.insert(0, _full)
