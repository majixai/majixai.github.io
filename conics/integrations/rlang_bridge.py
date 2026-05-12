"""
conics/integrations/rlang_bridge.py
=====================================
Bridge between conics/ and rlang/.

Provides:
    fit_via_r(xs, ys, zs)
        — runs conics/r/fit_and_export.R via Rscript, passes data as a
          temporary CSV file, and parses the returned JSON to produce a
          FitResult.

Usage:
    from conics.integrations.rlang_bridge import fit_via_r
    result = fit_via_r(xs, ys, zs)

Dependencies:
    Rscript must be on PATH.
    R packages: stats (base), jsonlite (for JSON output).
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import tempfile
from typing import List, Optional

_REPO_ROOT    = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
_FIT_EXPORT_R = os.path.join(_REPO_ROOT, "conics", "r", "fit_and_export.R")

sys.path.insert(0, os.path.join(_REPO_ROOT, "conics", "python"))
from conics import ConicCoeffs, FitResult, decompose  # type: ignore[import]


def _rscript_available() -> bool:
    try:
        subprocess.run(["Rscript", "--version"],
                       capture_output=True, check=True, timeout=5)
        return True
    except Exception:
        return False


def fit_via_r(
    xs: List[float],
    ys: List[float],
    zs: List[float],
) -> Optional[FitResult]:
    """
    Fit a conic surface via Rscript, delegating to conics/r/fit_and_export.R.

    Passes data as a temporary CSV file and parses the JSON result.
    Returns None when Rscript is not available or the R call fails.
    """
    if not _rscript_available():
        return None

    if not os.path.isfile(_FIT_EXPORT_R):
        return None

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as csv_f:
        csv_f.write("x,y,z\n")
        for x, y, z in zip(xs, ys, zs):
            csv_f.write(f"{x},{y},{z}\n")
        csv_path = csv_f.name

    rlang_dir = os.path.join(_REPO_ROOT, "rlang")
    try:
        proc = subprocess.run(
            ["Rscript", "--vanilla", _FIT_EXPORT_R, csv_path, rlang_dir, _REPO_ROOT],
            capture_output=True, text=True, timeout=60,
        )
        raw = proc.stdout.strip()
        if not raw:
            return None
        data = json.loads(raw)
        if not data.get("ok"):
            return None
    except Exception:
        return None
    finally:
        try:
            os.unlink(csv_path)
        except OSError:
            pass

    cc = ConicCoeffs(
        A=data["A"], B=data["B"], C=data["C"],
        D=data["D"], E=data["E"], F=data["F"]
    )
    d = decompose(cc)
    d.rss = data.get("rss", 0.0)
    d.r2  = data.get("r2",  0.0)
    return FitResult(coeffs=cc, decomp=d, rss=d.rss, r2=d.r2)


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import math as _math, random as _rng
    _rng.seed(42)
    t_vals = [2 * _math.pi * i / 30 for i in range(30)]
    xp = [_math.cos(t) + _rng.gauss(0, 0.08) for t in t_vals]
    yp = [0.5 * _math.sin(t) + _rng.gauss(0, 0.08) for t in t_vals]
    zp = [x*x + 0.5*y*y + 0.1*x + _rng.gauss(0, 0.03) for x, y in zip(xp, yp)]

    if _rscript_available():
        res = fit_via_r(xp, yp, zp)
        if res:
            print(f"rlang_bridge: {res.decomp.kind}, R²={res.r2:.4f}")
        else:
            print("rlang_bridge: R call failed")
    else:
        print("rlang_bridge: Rscript not available — skipping test")
