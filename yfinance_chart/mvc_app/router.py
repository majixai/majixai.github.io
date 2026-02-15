from __future__ import annotations

import time
from pathlib import Path

from flask import Blueprint, current_app, jsonify, request

from .controllers.api_controller import (
    candles_response,
    client_event_response,
    compression_search_response,
    overlays_response,
    session_state_response,
)
from .views import render_compression_search_page, render_main_page


def create_router(base_dir: Path, data_base_dir: Path) -> Blueprint:
    router = Blueprint("router", __name__)

    @router.before_app_request
    def _start_request_timer():
        request._start_ts = time.time()  # type: ignore[attr-defined]

    @router.after_app_request
    def _log_request(response):
        elapsed_ms = int((time.time() - getattr(request, "_start_ts", time.time())) * 1000)
        current_app.logger.info(
            "http_request method=%s path=%s status=%s ms=%s ip=%s ua=%s",
            request.method,
            request.path,
            response.status_code,
            elapsed_ms,
            request.remote_addr,
            request.user_agent.string[:120],
        )
        return response

    @router.get("/")
    def home():
        return render_main_page(base_dir)

    @router.get("/compression-search")
    def compression_search_page():
        return render_compression_search_page(base_dir)

    @router.get("/api/candles")
    def candles():
        return candles_response()

    @router.get("/api/overlays")
    def overlays():
        return overlays_response()

    @router.get("/api/compression-search")
    def compression_search():
        return compression_search_response(data_base_dir)

    @router.post("/api/client-event")
    def client_event():
        return client_event_response()

    @router.get("/api/session-state")
    def session_state():
        return session_state_response()

    @router.get("/health")
    def health():
        return jsonify({"ok": True})

    return router
