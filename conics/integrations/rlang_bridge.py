"""
conics/integrations/rlang_bridge.py
=====================================
Bridge between conics/ and rlang/.

Provides:
    fit_via_r(xs, ys, zs)
        — runs conics/r/conics.R via Rscript, passes data as CSV via stdin,
          and parses the returned JSON to produce a FitResult.

    r_conic_report(symbol, lookback)
        — invokes the yfinance bridge inside R (requires jsonlite + optionally
          yfinance Python) and returns a ConicDecomposition.

Usage:
    from conics.integrations.rlang_bridge import fit_via_r
    result = fit_via_r(xs, ys, zs)

Dependencies:
    Rscript must be on PATH.
    R packages: stats (base), jsonlite (for JSON output).
"""

from __future__ import annotations

import json
import math
import os
import subprocess
import sys
import tempfile
from typing import List, Optional

_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

sys.path.insert(0, os.path.join(_REPO_ROOT, "conics", "python"))
from conics import ConicCoeffs, ConicDecomposition, FitResult, decompose  # type: ignore[import]

# Inline R script that reads CSV from a temp file and returns JSON
_R_FIT_SCRIPT = r"""
# rlang_bridge helper — sourced dynamically
args <- commandArgs(trailingOnly = TRUE)
csv_path  <- args[1]
rlang_dir <- args[2]
repo_root <- args[3]

# Source rlang helpers if available
utils_path   <- file.path(rlang_dir, "lib", "utils.R")
finance_path <- file.path(rlang_dir, "lib", "finance.R")
conics_path  <- file.path(repo_root, "conics", "r", "conics.R")

if (file.exists(utils_path))   source(utils_path)
if (file.exists(finance_path)) source(finance_path)
if (file.exists(conics_path))  source(conics_path)

suppressPackageStartupMessages(library(stats))
suppressPackageStartupMessages(
  tryCatch(library(jsonlite), error = function(e) NULL)
)

dat <- read.csv(csv_path, header = TRUE)
x   <- dat$x
y   <- dat$y
z   <- dat$z

# Fallback OLS if conic_fit_ols not sourced
if (!exists("conic_fit_ols")) {
  conic_fit_ols <- function(x, y, z) {
    df  <- data.frame(z=z, x2=x^2, xy=x*y, y2=y^2, x1=x, y1=y)
    fit <- lm(z ~ x2 + xy + y2 + x1 + y1, data=df)
    co  <- coef(fit)
    list(coeffs = c(A=co["x2"], B=co["xy"], C=co["y2"],
                    D=co["x1"], E=co["y1"], F=co["(Intercept)"]),
         rss = sum(residuals(fit)^2),
         r2  = summary(fit)$r.squared)
  }
}

res <- tryCatch(conic_fit_ols(x, y, z), error = function(e) NULL)
if (is.null(res)) { cat("{\"ok\":false}\n"); quit(save="no") }

coeffs <- unname(res$coeffs)
A <- coeffs[1]; B <- coeffs[2]; C <- coeffs[3]
D <- coeffs[4]; E <- coeffs[5]; F <- coeffs[6]

disc <- B^2 - 4*A*C
kind <- if (disc < -1e-9) "ELLIPSE" else if (disc > 1e-9) "HYPERBOLA" else "PARABOLA"

# Centre
det2 <- 4*A*C - B^2
if (abs(det2) > 1e-12) {
  cx <- (B*E - 2*C*D) / det2
  cy <- (B*D - 2*A*E) / det2
} else { cx <- 0; cy <- 0 }

# Angle
theta <- if (abs(A-C) < 1e-12 && abs(B) < 1e-12) 0 else 0.5 * atan2(B, A-C)

# Semi-axes
k33   <- F - cx*(D/2) - cy*(E/2)
ediff <- 0.5 * sqrt(max(0, (A-C)^2 + B^2))
lam1  <- (A+C)/2 + ediff; lam2 <- (A+C)/2 - ediff
sA    <- if (abs(lam1) > 1e-12) sqrt(abs(-k33/lam1)) else 0
sB    <- if (abs(lam2) > 1e-12) sqrt(abs(-k33/lam2)) else 0

out <- list(
  ok    = TRUE,
  kind  = kind,
  disc  = disc,
  cx    = cx,   cy    = cy,
  semiA = sA,   semiB = sB,
  theta = theta,
  rss   = res$rss,
  r2    = res$r2,
  A = A, B = B, C = C, D = D, E = E, F = F
)

if (exists("toJSON")) {
  cat(toJSON(out, auto_unbox = TRUE), "\n")
} else {
  cat(sprintf(
    '{"ok":true,"kind":"%s","disc":%g,"cx":%g,"cy":%g,"semiA":%g,"semiB":%g,"theta":%g,"rss":%g,"r2":%g,"A":%g,"B":%g,"C":%g,"D":%g,"E":%g,"F":%g}',
    kind, disc, cx, cy, sA, sB, theta, res$rss, res$r2, A, B, C, D, E, F
  ), "\n")
}
"""


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
    Fit a conic surface via Rscript, delegating to conics/r/conics.R.

    Passes data as a temporary CSV file and parses the JSON result.
    Returns None when Rscript is not available or the R call fails.
    """
    if not _rscript_available():
        return None

    with tempfile.NamedTemporaryFile(mode="w", suffix=".csv", delete=False) as csv_f:
        csv_f.write("x,y,z\n")
        for x, y, z in zip(xs, ys, zs):
            csv_f.write(f"{x},{y},{z}\n")
        csv_path = csv_f.name

    with tempfile.NamedTemporaryFile(mode="w", suffix=".R", delete=False) as r_f:
        r_f.write(_R_FIT_SCRIPT)
        r_path = r_f.name

    rlang_dir = os.path.join(_REPO_ROOT, "rlang")
    try:
        proc = subprocess.run(
            ["Rscript", "--vanilla", r_path, csv_path, rlang_dir, _REPO_ROOT],
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
        for f in (csv_path, r_path):
            try:
                os.unlink(f)
            except OSError:
                pass

    cc = ConicCoeffs(
        A=data["A"], B=data["B"], C=data["C"],
        D=data["D"], E=data["E"], F=data["F"]
    )
    d = decompose(cc)
    d.rss = data.get("rss", 0.0)
    d.r2  = data.get("r2",  0.0)
    return FitResult(
        coeffs=cc, decomp=d,
        rss=d.rss, r2=d.r2,
    )


# ---------------------------------------------------------------------------
# Self-test
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import math as _math
    t_vals = [2 * _math.pi * i / 20 for i in range(20)]
    xp = [_math.cos(t) for t in t_vals]
    yp = [0.5 * _math.sin(t) for t in t_vals]
    zp = [1.0] * 20

    if _rscript_available():
        res = fit_via_r(xp, yp, zp)
        if res:
            print(f"rlang_bridge: {res.decomp.kind}, R²={res.r2:.4f}")
        else:
            print("rlang_bridge: R call failed")
    else:
        print("rlang_bridge: Rscript not available — skipping test")
