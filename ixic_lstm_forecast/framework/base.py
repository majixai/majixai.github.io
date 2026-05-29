"""
ixic_lstm_forecast.framework.base
===================================
Core domain objects:

* ``Tickers``            — immutable data struct (dataclass) for a single ticker result.
* ``QuantFrameworkBase`` — base class exposing public / protected / private state
                           and a binary-flag calculator (bitwise ops).
* ``_global_tensor_cache`` — WeakKeyDictionary cache shared across the framework;
                             entries are reclaimed automatically when their key
                             object is garbage-collected.
"""

from __future__ import annotations

import logging
import weakref
from dataclasses import dataclass

import numpy as np

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# WeakMap cache  (§3 of framework spec)
# ---------------------------------------------------------------------------
_global_tensor_cache: weakref.WeakKeyDictionary = weakref.WeakKeyDictionary()
log.debug("[base] _global_tensor_cache (WeakKeyDictionary) initialised.")


# ---------------------------------------------------------------------------
# Tickers struct  (§2 — Object Mapping)
# ---------------------------------------------------------------------------
@dataclass
class Tickers:
    """Lightweight struct mapping a ticker's recent and projected close prices."""

    symbol: str
    recent_close: float
    projected_close: float
    binary_signature: int

    def __post_init__(self) -> None:
        log.debug(
            "[Tickers] created — symbol=%s  recent=%.4f  projected=%.4f  sig=%s",
            self.symbol,
            self.recent_close,
            self.projected_close,
            bin(self.binary_signature),
        )


# ---------------------------------------------------------------------------
# QuantFrameworkBase  (§5 — Advanced OOP)
# ---------------------------------------------------------------------------
class QuantFrameworkBase:
    """
    Base framework class demonstrating public, protected, and private members.

    Access levels:
    - ``public_status``   — freely accessible by any caller.
    - ``_protected_state`` — intended for sub-class use only (convention).
    - ``__private_seed``   — name-mangled; internal-only RNG seed.
    """

    _protected_state: str = "INITIALIZED"   # protected
    __private_seed: int = 42                 # private (name-mangled)

    def __init__(self) -> None:
        self.public_status = "ACTIVE"
        log.info(
            "[QuantFrameworkBase] __init__ — public_status=%s  protected_state=%s",
            self.public_status,
            self._protected_state,
        )

        # Seed both TF and NumPy inside the framework; imports are deferred so
        # that TF is not loaded unless the base class is actually instantiated.
        try:
            import tensorflow as tf  # noqa: F401 — deferred import
            tf.random.set_seed(self.__private_seed)
            log.debug(
                "[QuantFrameworkBase] TensorFlow random seed set to %d",
                self.__private_seed,
            )
        except ImportError:
            log.warning("[QuantFrameworkBase] TensorFlow not available — skipping TF seed.")

        np.random.seed(self.__private_seed)
        log.debug(
            "[QuantFrameworkBase] NumPy random seed set to %d", self.__private_seed
        )

    # ------------------------------------------------------------------
    # §6 — Binary Operations
    # ------------------------------------------------------------------
    @staticmethod
    def calculate_binary_flag(shift_val: int) -> int:
        """
        Return a binary flag using bitwise shift and OR.

        base_flag (0b00000001) is left-shifted by *shift_val*, then OR'd
        with the high-bit mask (0b10000000).

        Example
        -------
        >>> QuantFrameworkBase.calculate_binary_flag(3)
        136   # 0b10001000
        """
        base_flag: int = 0b00000001
        mask: int = 0b10000000
        result = (base_flag << shift_val) | mask
        log.debug(
            "[QuantFrameworkBase] calculate_binary_flag(shift=%d) "
            "→ %s (%d)",
            shift_val,
            bin(result),
            result,
        )
        return result
