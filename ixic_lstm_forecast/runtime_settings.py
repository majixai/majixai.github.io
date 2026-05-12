"""
Runtime settings loader for the IXIC forecast pipeline.

Supports three configuration layers, resolved in increasing precedence:
1. built-in defaults
2. JSON file referenced by ``IXIC_RUNTIME_SETTINGS_PATH``
3. JSON blob supplied in ``IXIC_RUNTIME_SETTINGS_JSON``
4. explicit ``IXIC_*`` environment variables
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Mapping

DEFAULT_RUNTIME_SETTINGS = {
    "symbol": "^IXIC",
    "seq_length": 60,
    "epochs": 3,
    "batch_size": 256,
    "log_level": "INFO",
    "train_verbose": "2",
    "output_dir": None,
}

_JSON_KEY_MAP = {
    "symbol": "symbol",
    "seq_length": "seq_length",
    "epochs": "epochs",
    "batch_size": "batch_size",
    "log_level": "log_level",
    "train_verbose": "train_verbose",
    "output_dir": "output_dir",
}

_ENV_KEY_MAP = {
    "IXIC_SYMBOL": "symbol",
    "IXIC_SEQ_LENGTH": "seq_length",
    "IXIC_EPOCHS": "epochs",
    "IXIC_BATCH_SIZE": "batch_size",
    "IXIC_LOG_LEVEL": "log_level",
    "IXIC_TRAIN_VERBOSE": "train_verbose",
    "IXIC_OUTPUT_DIR": "output_dir",
}


def _coerce_value(key: str, value: Any) -> Any:
    if value in ("", None):
        return None if key == "output_dir" else DEFAULT_RUNTIME_SETTINGS.get(key)
    if key in {"seq_length", "epochs", "batch_size"}:
        return int(value)
    if key == "output_dir":
        return str(value)
    if key in {"log_level", "train_verbose", "symbol"}:
        return str(value)
    return value


def _parse_json_settings(raw: str, source: str) -> dict[str, Any]:
    if not raw or not raw.strip():
        return {}
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"Invalid IXIC runtime settings JSON from {source}: {exc}") from exc
    if not isinstance(parsed, dict):
        raise ValueError(f"IXIC runtime settings from {source} must decode to an object.")
    resolved: dict[str, Any] = {}
    for raw_key, canonical_key in _JSON_KEY_MAP.items():
        if raw_key in parsed:
            resolved[canonical_key] = _coerce_value(canonical_key, parsed[raw_key])
    return resolved


def load_runtime_settings(env: Mapping[str, str] | None = None) -> dict[str, Any]:
    env = env or {}
    resolved = dict(DEFAULT_RUNTIME_SETTINGS)
    source = "defaults"

    settings_path = (env.get("IXIC_RUNTIME_SETTINGS_PATH") or "").strip()
    if settings_path:
        path = Path(settings_path)
        resolved.update(
            _parse_json_settings(path.read_text(encoding="utf-8"), f"file:{path}")
        )
        source = f"file:{path}"

    settings_json = (env.get("IXIC_RUNTIME_SETTINGS_JSON") or "").strip()
    if settings_json:
        resolved.update(_parse_json_settings(settings_json, "IXIC_RUNTIME_SETTINGS_JSON"))
        source = "IXIC_RUNTIME_SETTINGS_JSON"

    for env_key, canonical_key in _ENV_KEY_MAP.items():
        raw_value = env.get(env_key)
        if raw_value not in (None, ""):
            resolved[canonical_key] = _coerce_value(canonical_key, raw_value)
            source = env_key

    resolved["settings_source"] = source
    return resolved
