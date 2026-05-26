"""
Runtime configuration helpers for email/send_email.py.
"""

from __future__ import annotations

import json
from typing import Any, Mapping


def load_email_runtime_config(env: Mapping[str, str] | None = None) -> dict[str, Any]:
    env = env or {}
    raw = (env.get("EMAIL_RUNTIME_SETTINGS_JSON") or "").strip()
    if not raw:
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid EMAIL_RUNTIME_SETTINGS_JSON: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError("EMAIL_RUNTIME_SETTINGS_JSON must decode to an object.")
    return parsed


def get_runtime_value(
    config: Mapping[str, Any],
    *keys: str,
    env: Mapping[str, str] | None = None,
    env_key: str | None = None,
    default: Any = "",
) -> Any:
    env = env or {}
    if env_key:
        env_value = env.get(env_key)
        if env_value not in (None, ""):
            return env_value
    for key in keys:
        if key in config and config[key] not in (None, ""):
            return config[key]
    return default
