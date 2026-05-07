from __future__ import annotations

from datetime import date, datetime
from typing import Any, Dict

from metatrader5.actions import get_mt5_registry, get_mt5_router


def _to_jsonable(value: Any) -> Any:
    if value is None or isinstance(value, (bool, int, float, str)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, dict):
        return {str(k): _to_jsonable(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_to_jsonable(v) for v in value]
    if hasattr(value, "_asdict"):
        return _to_jsonable(value._asdict())
    if hasattr(value, "tolist") and callable(value.tolist):
        return _to_jsonable(value.tolist())
    if hasattr(value, "item") and callable(value.item):
        try:
            return _to_jsonable(value.item())
        except Exception:
            pass
    return str(value)


def run_git_action(payload: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    Dispatch a git-action payload into the MT5 action registry/router.
    """
    payload = payload or {}
    action = payload.get("action") or payload.get("type") or payload.get("name")
    dispatcher = payload.get("dispatcher", "registry")
    ctx = payload.get("context")
    if ctx is None:
        ctx = payload.get("payload", {})

    if not action:
        return {
            "ok": True,
            "message": "Git action triggered",
            "available_dispatchers": ["registry", "router"],
        }

    try:
        if dispatcher == "router":
            raw = get_mt5_router().dispatch(action, ctx or {})
        else:
            raw = get_mt5_registry().dispatch(action, ctx or {})
        return {
            "ok": True,
            "dispatcher": dispatcher,
            "action": action,
            "result": _to_jsonable(raw),
        }
    except Exception as exc:
        return {
            "ok": False,
            "dispatcher": dispatcher,
            "action": action,
            "error": str(exc),
            "error_type": type(exc).__name__,
        }


if __name__ == "__main__":
    run_git_action()
