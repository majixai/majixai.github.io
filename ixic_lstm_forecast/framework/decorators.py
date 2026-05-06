"""
ixic_lstm_forecast.framework.decorators
=========================================
Lifecycle hook decorator and event-logger utility.

``lifecycle_hook`` wraps any instance method so that optional *pre* and *post*
callbacks are invoked around the real call.  This mirrors the hook pattern
common in component frameworks (§4 of the framework spec).
"""

from __future__ import annotations

import logging
from typing import Callable, Optional

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Event logger  (used as default hook callback)
# ---------------------------------------------------------------------------
def log_event(event_name: str) -> None:
    """Print and log a named framework lifecycle event."""
    msg = f"[*] Framework Event: {event_name}"
    print(msg)
    log.info("[decorators] lifecycle event fired — %s", event_name)


# ---------------------------------------------------------------------------
# Decorator factory: lifecycle_hook
# ---------------------------------------------------------------------------
def lifecycle_hook(
    pre_callback: Optional[Callable[[str], None]] = None,
    post_callback: Optional[Callable[[str], None]] = None,
) -> Callable:
    """
    Class-method decorator that injects *pre* and/or *post* lifecycle hooks.

    Parameters
    ----------
    pre_callback:
        Called with the wrapped function's ``__name__`` *before* the method body
        executes.  Defaults to ``None`` (no pre-hook).
    post_callback:
        Called with the wrapped function's ``__name__`` *after* the method body
        returns.  Defaults to ``None`` (no post-hook).

    Returns
    -------
    Callable
        The decorated method wrapper.

    Example
    -------
    ::

        @lifecycle_hook(pre_callback=log_event, post_callback=log_event)
        def train(self, X, y):
            ...
    """

    def decorator(func: Callable) -> Callable:
        def wrapper(self, *args, **kwargs):
            fname = func.__name__
            log.debug(
                "[lifecycle_hook] PRE-hook — method=%s  pre_cb=%s",
                fname,
                pre_callback.__name__ if pre_callback else "None",
            )
            if pre_callback:
                pre_callback(fname)

            result = func(self, *args, **kwargs)

            log.debug(
                "[lifecycle_hook] POST-hook — method=%s  post_cb=%s",
                fname,
                post_callback.__name__ if post_callback else "None",
            )
            if post_callback:
                post_callback(fname)

            return result

        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        return wrapper

    return decorator
