from __future__ import annotations

from pathlib import Path

from flask import current_app, jsonify, request

from ..models import (
    build_projection_payload,
    build_overlays_payload,
    get_df,
    get_or_create_session_state,
    hash_session,
    preview_from_dat,
    read_session_state,
    register_event,
    search_manifest_records,
)


def _session_hash() -> str:
    raw_session = request.headers.get("X-Client-Session", "") or request.cookies.get("client_session", "")
    if not raw_session:
        raw_session = f"anon-{request.remote_addr}-{request.user_agent.string[:40]}"
    session_hash = hash_session(raw_session, request.user_agent.string, request.remote_addr or "")
    get_or_create_session_state(session_hash)
    return session_hash


def _log_event(event_name: str, payload: dict):
    session_hash = _session_hash()
    state = register_event(session_hash, event_name, request.path, payload)
    current_app.logger.info(
        "client_event event=%s session=%s path=%s count=%s payload=%s",
        event_name,
        session_hash[:16],
        request.path,
        state.get("event_count", 0),
        payload,
    )
    return session_hash


def candles_response():
    ticker = request.args.get("ticker", "SPY").upper()
    period = request.args.get("period", "6mo")
    interval = request.args.get("interval", "1d")

    session_hash = _log_event("api_candles", {"ticker": ticker, "period": period, "interval": interval})

    df = get_df(ticker, period, interval).copy()
    df["time"] = df["time"].dt.strftime("%Y-%m-%dT%H:%M:%S")
    response = jsonify(
        {
            "ticker": ticker,
            "period": period,
            "interval": interval,
            "count": len(df),
            "candles": df.to_dict(orient="records"),
            "session_hash": session_hash,
        }
    )
    response.set_cookie("client_session_hash", session_hash, httponly=False, samesite="Lax")
    return response


def overlays_response():
    ticker = request.args.get("ticker", "SPY").upper()
    period = request.args.get("period", "6mo")
    interval = request.args.get("interval", "1d")
    max_patterns = int(request.args.get("max_patterns", 60))
    min_score = float(request.args.get("min_score", 0.18))
    projection_horizon = int(request.args.get("projection_horizon", 24))

    session_hash = _log_event(
        "api_overlays",
        {
            "ticker": ticker,
            "period": period,
            "interval": interval,
            "max_patterns": max_patterns,
            "min_score": min_score,
            "projection_horizon": projection_horizon,
        },
    )

    df = get_df(ticker, period, interval)
    overlays_payload, calculus_payload = build_overlays_payload(df, max_patterns=max_patterns, min_score=min_score)
    projection_payload = build_projection_payload(df, interval=interval, horizon=max(1, min(projection_horizon, 120)))

    response = jsonify(
        {
            "ticker": ticker,
            "pattern_count": len(overlays_payload),
            "overlays": overlays_payload,
            "calculus": calculus_payload,
            "projections": projection_payload,
            "session_hash": session_hash,
        }
    )
    response.set_cookie("client_session_hash", session_hash, httponly=False, samesite="Lax")
    return response


def compression_search_response(data_base_dir: Path):
    query = request.args.get("q", "").strip()
    ticker = request.args.get("ticker", "").strip()
    limit = int(request.args.get("limit", 50))
    include_preview = request.args.get("include_preview", "0") in {"1", "true", "yes"}
    limit = max(1, min(limit, 200))

    session_hash = _log_event(
        "api_compression_search",
        {"query": query, "ticker": ticker, "limit": limit, "include_preview": include_preview},
    )

    rows = search_manifest_records(data_base_dir=data_base_dir, query=query, ticker=ticker, limit=limit)
    items = []
    for row in rows:
        item = {
            "run_id": row.get("run_id", ""),
            "ticker": row.get("ticker", ""),
            "period": row.get("period", ""),
            "interval": row.get("interval", ""),
            "object": row.get("object", ""),
            "sha256": row.get("sha256", ""),
            "size": int(float(row.get("size", 0) or 0)),
            "created_utc": row.get("created_utc", ""),
        }
        if include_preview and item["object"]:
            item["preview"] = preview_from_dat(data_base_dir=data_base_dir, object_rel_path=item["object"])
        items.append(item)

    response = jsonify(
        {
            "query": query,
            "ticker_filter": ticker.upper(),
            "count": len(items),
            "items": items,
            "data_base_dir": str(data_base_dir),
            "session_hash": session_hash,
        }
    )
    response.set_cookie("client_session_hash", session_hash, httponly=False, samesite="Lax")
    return response


def client_event_response():
    payload = request.get_json(silent=True) or {}
    event_name = str(payload.get("event", "client_event"))
    session_hash = _log_event(event_name, payload)
    state = read_session_state(session_hash)
    return jsonify({"ok": True, "session_hash": session_hash, "state": state})


def session_state_response():
    session_hash = _session_hash()
    _log_event("api_session_state", {})
    state = read_session_state(session_hash)
    return jsonify({"session_hash": session_hash, "state": state})
