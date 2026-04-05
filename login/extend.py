#!/usr/bin/env python3
"""
extend.py — MajixAI Login Extender

Copies the login template files from the `login/` directory into a target
sibling directory, then auto-configures `login-config.json` for that app.

Usage (called by the GitHub Action):
    python3 login/extend.py <target_dir> [--force]

Arguments:
    target_dir  Path to the directory that should receive login functionality.
    --force     Overwrite existing login files even if they already exist.

Exit codes:
    0  Files were written / already present (with --force overwrite applied).
    1  Error — see stderr.
"""

import argparse
import json
import os
import re
import shutil
import sys
from pathlib import Path

TEMPLATE_DIR = Path(__file__).parent          # login/
TEMPLATE_FILES = ["login.html", "login.js", "login.css", "login-config.json"]

# Default password hash for "admin" / "admin" (SHA-256)
DEFAULT_HASH = "8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918"
DEFAULT_HASH_WARNING = (
    "\n⚠️  WARNING: Using default credentials (admin/admin).\n"
    "   Update 'users' in {config} before deploying to production.\n"
)


def derive_app_name(dir_path: Path) -> str:
    """Turn a directory name like `hotel_booking_app` → `Hotel Booking App`."""
    name = dir_path.name.replace("-", " ").replace("_", " ")
    return name.title()


def derive_session_key(dir_path: Path) -> str:
    clean = re.sub(r"[^a-z0-9]", "_", dir_path.name.lower())
    return f"majixai_session_{clean}"


def find_redirect_target(dir_path: Path) -> str:
    """Return the first useful page to redirect to after login."""
    for candidate in ("index.html", "app.html", "main.html", "home.html"):
        if (dir_path / candidate).exists():
            return candidate
    return "index.html"


def build_config(dir_path: Path) -> dict:
    return {
        "appName": derive_app_name(dir_path),
        "appIcon": "🔐",
        "redirectOnSuccess": find_redirect_target(dir_path),
        "sessionKey": derive_session_key(dir_path),
        "sessionDuration": 86400000,
        "users": [
            {
                "username": "admin",
                "passwordHash": DEFAULT_HASH
            }
        ],
        "theme": {
            "primaryColor": "#2c3e50",
            "accentColor": "#3498db",
            "bgColor": "#f5f6fa"
        }
    }


def extend_directory(target: Path, force: bool = False) -> bool:
    """
    Copy login template files into *target* and write a custom config.
    Returns True when files were (re)written, False when skipped.
    """
    if not target.is_dir():
        print(f"ERROR: target '{target}' is not a directory.", file=sys.stderr)
        sys.exit(1)

    wrote_any = False

    for filename in TEMPLATE_FILES:
        dest = target / filename
        src  = TEMPLATE_DIR / filename

        if dest.exists() and not force:
            print(f"  SKIP  {dest} (already exists; use --force to overwrite)")
            continue

        if filename == "login-config.json":
            # Write a customised config instead of the template one
            config = build_config(target)
            dest.write_text(json.dumps(config, indent=2) + "\n", encoding="utf-8")
            print(f"  WRITE {dest}  [auto-configured]")
            print(DEFAULT_HASH_WARNING.format(config=dest), file=sys.stderr)
        else:
            shutil.copy2(src, dest)
            print(f"  COPY  {src} → {dest}")

        wrote_any = True

    return wrote_any


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("target_dir", help="Directory to extend with login")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing login files")
    args = parser.parse_args()

    target = Path(args.target_dir).resolve()
    print(f"Extending login into: {target}")

    wrote = extend_directory(target, force=args.force)
    if wrote:
        print("Done — login files written.")
    else:
        print("Done — nothing changed (all files already present).")


if __name__ == "__main__":
    main()
