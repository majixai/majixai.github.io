#!/usr/bin/env Rscript
# ==============================================================================
# conics/r/conics.R — Conic Section Analysis in R
# ==============================================================================
#
# General second-degree curve:
#   A x² + B xy + C y² + D x + E y + F = 0
#
# Exports:
#   conic_classify(A, B, C)          — discriminant-based type detection
#   conic_center(A, B, C, D, E)      — centre of the conic
#   conic_angle(A, B, C)             — principal-axis rotation angle
#   conic_axes(A, B, C, D, E, F, cx, cy) — semi-axis lengths
#   conic_decompose(coeffs)          — full decomposition returning a list
#   conic_fit_ols(x, y, z)           — OLS surface fit
#   conic_print(result)              — pretty-print a decomposition
#
# Integrations:
#   Sources rlang/lib/utils.R and rlang/lib/finance.R when available.
#   conic_fit_yfinance(symbol, lookback) — fits a conic to OHLCV data via yfinance
#                                          (invokes Python via system2())
# ==============================================================================

suppressPackageStartupMessages(library(stats))

# --------------------------------------------------------------------------- #
# Locate repository root and optionally source rlang helpers
# --------------------------------------------------------------------------- #

.repo_root <- function() {
  script <- tryCatch(normalizePath(sys.frame(1)$ofile, mustWork = FALSE),
                     error = function(e) NULL)
  if (!is.null(script)) return(dirname(dirname(dirname(script))))  # conics/r -> conics -> repo
  Sys.getenv("REPO_ROOT", unset = getwd())
}

.source_rlang <- function(repo = .repo_root()) {
  u <- file.path(repo, "rlang", "lib", "utils.R")
  f <- file.path(repo, "rlang", "lib", "finance.R")
  if (file.exists(u)) source(u)
  if (file.exists(f)) source(f)
}

.source_rlang()

# --------------------------------------------------------------------------- #
# §1  Classification
# --------------------------------------------------------------------------- #

#' Classify a conic from its discriminant B² − 4AC.
#'
#' @param A,B,C  Quadratic coefficients.
#' @return Character: "ELLIPSE", "PARABOLA", or "HYPERBOLA".
conic_classify <- function(A, B, C) {
  disc <- B^2 - 4 * A * C
  if      (disc < -1e-9)  "ELLIPSE"
  else if (disc >  1e-9)  "HYPERBOLA"
  else                    "PARABOLA"
}

# --------------------------------------------------------------------------- #
# §2  Centre
# --------------------------------------------------------------------------- #

#' Solve the 2×2 gradient-zero system for the conic centre.
#'
#' Gradient = 0:
#'   2A·cx + B·cy + D = 0
#'    B·cx + 2C·cy + E = 0
#'
#' @return Named numeric vector c(cx, cy), or NULL if singular.
conic_center <- function(A, B, C, D, E) {
  det2 <- 4 * A * C - B^2
  if (abs(det2) < 1e-12) return(NULL)
  cx <- (B * E - 2 * C * D) / det2
  cy <- (B * D - 2 * A * E) / det2
  c(cx = cx, cy = cy)
}

# --------------------------------------------------------------------------- #
# §3  Principal-axis angle
# --------------------------------------------------------------------------- #

#' Compute the principal-axis rotation angle.
#'
#' θ = ½ · atan2(B, A − C)
#'
#' @return Angle in radians.
conic_angle <- function(A, B, C) {
  if (abs(A - C) < 1e-12 && abs(B) < 1e-12) return(0)
  0.5 * atan2(B, A - C)
}

# --------------------------------------------------------------------------- #
# §4  Semi-axes
# --------------------------------------------------------------------------- #

#' Compute semi-axis lengths from the eigenvalue decomposition of [[A, B/2], [B/2, C]].
#'
#' λ₁,₂ = (A+C)/2  ±  ½√((A−C)² + B²)
#' aᵢ   = √|−k₃₃ / λᵢ|   where  k₃₃ = F − cx·D/2 − cy·E/2
#'
#' @return Named numeric c(semiA, semiB).
conic_axes <- function(A, B, C, D, E, F, cx, cy) {
  k33   <- F - cx * (D / 2) - cy * (E / 2)
  ediff <- 0.5 * sqrt(max(0, (A - C)^2 + B^2))
  lam1  <- (A + C) / 2 + ediff
  lam2  <- (A + C) / 2 - ediff
  sA    <- if (abs(lam1) > 1e-12) sqrt(abs(-k33 / lam1)) else 0
  sB    <- if (abs(lam2) > 1e-12) sqrt(abs(-k33 / lam2)) else 0
  c(semiA = sA, semiB = sB)
}

# --------------------------------------------------------------------------- #
# §5  Full decomposition
# --------------------------------------------------------------------------- #

#' Full conic decomposition.
#'
#' @param coeffs Named numeric vector with elements A, B, C, D, E, F.
#' @return List: kind, disc, cx, cy, semiA, semiB, theta, ok.
conic_decompose <- function(coeffs) {
  A <- coeffs[["A"]]; B <- coeffs[["B"]]; C <- coeffs[["C"]]
  D <- coeffs[["D"]]; E <- coeffs[["E"]]; F <- coeffs[["F"]]

  disc  <- B^2 - 4 * A * C
  kind  <- conic_classify(A, B, C)
  theta <- conic_angle(A, B, C)
  ctr   <- conic_center(A, B, C, D, E)

  if (!is.null(ctr)) {
    axes <- conic_axes(A, B, C, D, E, F, ctr["cx"], ctr["cy"])
  } else {
    axes <- c(semiA = 0, semiB = 0)
    ctr  <- c(cx = 0, cy = 0)
  }

  list(
    kind  = kind,
    disc  = disc,
    cx    = as.numeric(ctr["cx"]),
    cy    = as.numeric(ctr["cy"]),
    semiA = as.numeric(axes["semiA"]),
    semiB = as.numeric(axes["semiB"]),
    theta = theta,
    ok    = TRUE
  )
}

# --------------------------------------------------------------------------- #
# §6  OLS surface fit
# --------------------------------------------------------------------------- #

#' Fit the explicit quadratic surface z = Ax² + Bxy + Cy² + Dx + Ey + F
#' to data points via normal equations solved with R's built-in \code{lm()}.
#'
#' @param x,y  Numeric vectors of the two predictor axes.
#' @param z    Numeric vector of surface heights (response).
#' @return List: coeffs (named numeric), rss, r2, decomp.
conic_fit_ols <- function(x, y, z) {
  df <- data.frame(
    z   = z,
    x2  = x^2,
    xy  = x * y,
    y2  = y^2,
    x1  = x,
    y1  = y
  )
  fit  <- lm(z ~ x2 + xy + y2 + x1 + y1, data = df)
  coef <- coef(fit)
  rss  <- sum(residuals(fit)^2)
  ss_tot <- sum((z - mean(z))^2)
  r2   <- if (ss_tot > 0) 1 - rss / ss_tot else 0

  coeffs <- c(
    A = unname(coef["x2"]),
    B = unname(coef["xy"]),
    C = unname(coef["y2"]),
    D = unname(coef["x1"]),
    E = unname(coef["y1"]),
    F = unname(coef["(Intercept)"])
  )

  list(
    coeffs = coeffs,
    rss    = rss,
    r2     = r2,
    decomp = conic_decompose(coeffs)
  )
}

# --------------------------------------------------------------------------- #
# §7  Pretty printer
# --------------------------------------------------------------------------- #

#' Pretty-print a conic decomposition.
#'
#' @param result  List returned by \code{conic_decompose()} or \code{conic_fit_ols()}.
conic_print <- function(result) {
  d <- if (!is.null(result$decomp)) result$decomp else result
  cat(sprintf("Conic type   : %s\n",  d$kind))
  cat(sprintf("Disc (B²-4AC): %.6f\n", d$disc))
  cat(sprintf("Centre       : (%.4f, %.4f)\n", d$cx, d$cy))
  cat(sprintf("Semi-axes    : a=%.4f  b=%.4f\n", d$semiA, d$semiB))
  cat(sprintf("Rotation θ   : %.4f rad  (%.2f°)\n", d$theta, d$theta * 180 / pi))
  if (!is.null(result$rss))
    cat(sprintf("RSS / R²     : %.6f / %.6f\n", result$rss, result$r2))
}

# --------------------------------------------------------------------------- #
# §8  yfinance bridge (calls Python subprocess)
# --------------------------------------------------------------------------- #

#' Fetch OHLCV data via yfinance (Python) and fit a conic to (bar_index, log_vol, close).
#'
#' Requires Python with yfinance installed in the PATH.
#'
#' @param symbol   Ticker symbol, e.g. "AAPL".
#' @param lookback Integer number of recent bars to use (default 60).
#' @return List from \code{conic_fit_ols()}, or NULL on failure.
conic_fit_yfinance <- function(symbol, lookback = 60) {
  py_script <- tempfile(fileext = ".py")
  writeLines(c(
    "import sys, json, math",
    sprintf("import yfinance as yf"),
    sprintf("df = yf.download('%s', period='6mo', interval='1d', progress=False)", symbol),
    sprintf("df = df.tail(%d).reset_index(drop=True)", lookback),
    "rows = []",
    "for i, row in df.iterrows():",
    "    lv = math.log(float(row['Volume'])) if float(row['Volume']) > 0 else 0",
    "    rows.append([float(i), lv, float(row['Close'])])",
    "print(json.dumps(rows))"
  ), py_script)

  out <- tryCatch(
    system2("python3", args = py_script, stdout = TRUE, stderr = FALSE),
    error = function(e) NULL
  )
  unlink(py_script)
  if (is.null(out) || length(out) == 0) {
    message("conic_fit_yfinance: Python/yfinance call failed.")
    return(NULL)
  }

  rows <- tryCatch(jsonlite::fromJSON(paste(out, collapse = "")),
                   error = function(e) NULL)
  if (is.null(rows) || nrow(rows) < 6) return(NULL)

  conic_fit_ols(x = rows[, 1], y = rows[, 2], z = rows[, 3])
}

# --------------------------------------------------------------------------- #
# §9  Self-test (runs when sourced directly)
# --------------------------------------------------------------------------- #

if (identical(environment(), globalenv())) {
  cat("=== conics/r/conics.R  self-test ===\n\n")

  # Test 1 — unit circle
  cat("Test 1 — Unit circle:\n")
  r1 <- conic_decompose(c(A=1, B=0, C=1, D=0, E=0, F=-1))
  conic_print(r1)
  cat("Expected: ELLIPSE, centre=(0,0), semiA=semiB≈1\n\n")

  # Test 2 — rectangular hyperbola
  cat("Test 2 — Rectangular hyperbola:\n")
  r2 <- conic_decompose(c(A=1, B=0, C=-1, D=0, E=0, F=-1))
  conic_print(r2)
  cat("Expected: HYPERBOLA\n\n")

  # Test 3 — parabola
  cat("Test 3 — Upward parabola:\n")
  r3 <- conic_decompose(c(A=1, B=0, C=0, D=0, E=-1, F=0))
  conic_print(r3)
  cat("Expected: PARABOLA\n\n")

  # Test 4 — OLS fit to ellipse points
  cat("Test 4 — OLS fit to ellipse sample points:\n")
  t_vals <- seq(0, 2*pi, length.out = 21)[-21]
  x_pts  <- cos(t_vals)
  y_pts  <- 0.5 * sin(t_vals)
  r4     <- conic_fit_ols(x = x_pts, y = y_pts, z = rep(1, 20))
  conic_print(r4)
  cat("\n")
}
