from __future__ import annotations

import logging
from pathlib import Path

from flask import Flask

from .router import create_router


def create_app(base_dir: Path | None = None, data_base_dir: Path | None = None) -> Flask:
    resolved_base_dir = (base_dir or Path(__file__).resolve().parents[1]).resolve()
    resolved_data_base = (data_base_dir or resolved_base_dir.parent / "github_data").resolve()

    app = Flask(__name__)
    app.config["BASE_DIR"] = str(resolved_base_dir)
    app.config["DATA_BASE_DIR"] = str(resolved_data_base)

    if not app.logger.handlers:
        handler = logging.StreamHandler()
        handler.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(message)s"))
        app.logger.addHandler(handler)
    app.logger.setLevel(logging.INFO)

    router = create_router(base_dir=resolved_base_dir, data_base_dir=resolved_data_base)
    app.register_blueprint(router)

    app.logger.info("app_start base_dir=%s data_base_dir=%s", resolved_base_dir, resolved_data_base)
    return app
