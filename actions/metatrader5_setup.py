#!/usr/bin/env python3
"""
metatrader5_setup.py — Install or upgrade the MetaTrader5 Python package.

Usage:
    python3 actions/metatrader5_setup.py             # install (or upgrade if already present)
    python3 actions/metatrader5_setup.py --upgrade   # force upgrade to latest version
"""

from __future__ import annotations

import argparse
import subprocess
import sys


PACKAGE = "MetaTrader5"


def _run_pip(*args: str) -> int:
    cmd = [sys.executable, "-m", "pip", *args]
    print(f"Running: {' '.join(cmd)}")
    result = subprocess.run(cmd)
    return result.returncode


def install(upgrade: bool = False) -> int:
    base_args = ["install", PACKAGE]
    if upgrade:
        base_args.insert(1, "--upgrade")
    return _run_pip(*base_args)


def main() -> int:
    parser = argparse.ArgumentParser(
        description=f"Install or upgrade the {PACKAGE} Python package."
    )
    parser.add_argument(
        "--upgrade",
        action="store_true",
        help="Upgrade to the latest available version.",
    )
    args = parser.parse_args()

    rc = install(upgrade=args.upgrade)
    if rc == 0:
        action = "upgraded" if args.upgrade else "installed"
        print(f"\n{PACKAGE} {action} successfully.")
    else:
        print(f"\nERROR: pip returned exit code {rc}.", file=sys.stderr)
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
