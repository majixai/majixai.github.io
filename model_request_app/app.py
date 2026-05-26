from __future__ import annotations

from pathlib import Path

from flask import Flask, jsonify, render_template, request

from command_store import CommandStore
from model_request import DEFAULT_REQUEST, ModelRequest


BASE_DIR = Path(__file__).resolve().parent
STORE_PATH = BASE_DIR / "data" / "requests.json"

app = Flask(__name__)
store = CommandStore(STORE_PATH)


def _payload_from_request() -> dict:
    if request.is_json:
        return request.get_json(silent=True) or {}
    return request.form.to_dict(flat=True)


@app.route("/")
def index():
    return render_template(
        "index.html",
        default_request=DEFAULT_REQUEST.to_dict(),
        history=store.recent(limit=12),
    )


@app.route("/api/preview", methods=["POST"])
def preview():
    payload = _payload_from_request()
    model_request = ModelRequest.from_mapping(payload)
    return jsonify(model_request.to_dict())


@app.route("/api/runs", methods=["GET", "POST"])
def runs():
    if request.method == "GET":
        return jsonify({"items": store.all()})

    payload = _payload_from_request()
    model_request = ModelRequest.from_mapping(payload)
    saved = store.append(model_request)
    return jsonify({"success": True, "item": saved, "items": store.recent(limit=12)})


@app.route("/healthz")
def healthz():
    return jsonify({"status": "ok", "items": len(store.all())})


if __name__ == "__main__":
    app.run(debug=True, port=5001)
