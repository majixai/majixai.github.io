from __future__ import annotations

from pathlib import Path

from flask import send_file


def render_main_page(base_dir: Path):
    return send_file(base_dir / "simple_interactive_view.html")


def render_compression_search_page(base_dir: Path):
    return send_file(base_dir / "compression_db_search.html")
