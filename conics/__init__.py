"""
conics/__init__.py
==================
Exposes the main Python API from conics/python/conics.py as the
top-level conics package.

Import from:
    from conics import ConicCoeffs, ConicDecomposition, decompose, fit_ols
"""

from conics.python.conics import (  # noqa: F401
    ConicCoeffs,
    ConicDecomposition,
    FitResult,
    classify,
    center,
    angle,
    axes,
    decompose,
    fit_ols,
    fit_from_yfinance,
    fit_from_tensor,
    print_decomposition,
)

__all__ = [
    "ConicCoeffs",
    "ConicDecomposition",
    "FitResult",
    "classify",
    "center",
    "angle",
    "axes",
    "decompose",
    "fit_ols",
    "fit_from_yfinance",
    "fit_from_tensor",
    "print_decomposition",
]
