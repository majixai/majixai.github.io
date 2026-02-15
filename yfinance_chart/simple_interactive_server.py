from __future__ import annotations

from pathlib import Path

from mvc_app import create_app

BASE_DIR = Path(__file__).resolve().parent
DATA_BASE_DIR = BASE_DIR.parent / "github_data"

app = create_app(base_dir=BASE_DIR, data_base_dir=DATA_BASE_DIR)


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=8787, debug=False)
