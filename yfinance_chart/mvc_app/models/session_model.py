from __future__ import annotations

import hashlib
import os
import time
from threading import Lock
from typing import Any

_SESSION_LOCK = Lock()
_SESSION_STATE: dict[str, dict[str, Any]] = {}
_SESSION_SECRET = os.environ.get("YF_SESSION_SECRET", "yf-default-session-secret")


def hash_session(raw_session: str, user_agent: str, remote_addr: str) -> str:
    raw = f"{_SESSION_SECRET}|{raw_session}|{user_agent}|{remote_addr}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def get_or_create_session_state(session_hash: str) -> dict[str, Any]:
    now = time.time()
    with _SESSION_LOCK:
        state = _SESSION_STATE.get(session_hash)
        if state is None:
            state = {
                "created_at": now,
                "updated_at": now,
                "event_count": 0,
                "last_event": "session_init",
                "last_path": "",
                "last_payload": {},
                "recent_events": [],
            }
            _SESSION_STATE[session_hash] = state
        return state


def register_event(session_hash: str, event_name: str, path: str, payload: dict[str, Any]) -> dict[str, Any]:
    now = time.time()
    with _SESSION_LOCK:
        state = _SESSION_STATE.get(session_hash)
        if state is None:
            state = {
                "created_at": now,
                "updated_at": now,
                "event_count": 0,
                "last_event": "session_init",
                "last_path": "",
                "last_payload": {},
                "recent_events": [],
            }
            _SESSION_STATE[session_hash] = state
        state["updated_at"] = now
        state["event_count"] += 1
        state["last_event"] = event_name
        state["last_path"] = path
        state["last_payload"] = payload

        recent = state.get("recent_events", [])
        recent.append(
            {
                "at": now,
                "event": event_name,
                "path": path,
                "payload": payload,
            }
        )
        state["recent_events"] = recent[-30:]
        return dict(state)


def read_session_state(session_hash: str) -> dict[str, Any]:
    with _SESSION_LOCK:
        state = _SESSION_STATE.get(session_hash)
        if state is None:
            return {}
        return dict(state)
