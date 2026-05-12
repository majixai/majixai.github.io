#!/usr/bin/env Rscript
# ==============================================================================
# conics/r/fit_and_export.R
# ==============================================================================
# Helper script called by conics/integrations/rlang_bridge.py via subprocess.
#
# Usage (internal — do not call directly):
#   Rscript --vanilla fit_and_export.R <csv_path> <rlang_dir> <repo_root>
#
# Input:  CSV file with columns x, y, z
# Output: Single-line JSON with conic decomposition fields
# ==============================================================================

args      <- commandArgs(trailingOnly = TRUE)
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

# Fallback OLS if conic_fit_ols was not sourced from conics.R
if (!exists("conic_fit_ols")) {
  conic_fit_ols <- function(x, y, z) {
    df  <- data.frame(z = z, x2 = x^2, xy = x*y, y2 = y^2, x1 = x, y1 = y)
    fit <- lm(z ~ x2 + xy + y2 + x1 + y1, data = df)
    co  <- coef(fit)
    list(
      coeffs = c(
        A = unname(co["x2"]),
        B = unname(co["xy"]),
        C = unname(co["y2"]),
        D = unname(co["x1"]),
        E = unname(co["y1"]),
        F = unname(co["(Intercept)"])
      ),
      rss = sum(residuals(fit)^2),
      r2  = summary(fit)$r.squared
    )
  }
}

res <- tryCatch(conic_fit_ols(x, y, z), error = function(e) NULL)
if (is.null(res)) {
  cat('{"ok":false}\n')
  quit(save = "no")
}

coeffs <- unname(res$coeffs)
A <- coeffs[1]; B <- coeffs[2]; C <- coeffs[3]
D <- coeffs[4]; E <- coeffs[5]; F <- coeffs[6]

disc <- B^2 - 4 * A * C
kind <- if (disc < -1e-9) "ELLIPSE" else if (disc > 1e-9) "HYPERBOLA" else "PARABOLA"

det2 <- 4 * A * C - B^2
if (abs(det2) > 1e-12) {
  cx <- (B*E - 2*C*D) / det2
  cy <- (B*D - 2*A*E) / det2
} else {
  cx <- 0; cy <- 0
}

theta <- if (abs(A - C) < 1e-12 && abs(B) < 1e-12) 0 else 0.5 * atan2(B, A - C)

k33   <- F - cx*(D / 2) - cy*(E / 2)
ediff <- 0.5 * sqrt(max(0, (A - C)^2 + B^2))
lam1  <- (A + C) / 2 + ediff
lam2  <- (A + C) / 2 - ediff
sA    <- if (abs(lam1) > 1e-12) sqrt(abs(-k33 / lam1)) else 0
sB    <- if (abs(lam2) > 1e-12) sqrt(abs(-k33 / lam2)) else 0

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

# Output JSON (use jsonlite if available, otherwise manual sprintf)
if (exists("toJSON")) {
  cat(toJSON(out, auto_unbox = TRUE), "\n")
} else {
  cat(sprintf(
    '{"ok":true,"kind":"%s","disc":%g,"cx":%g,"cy":%g,"semiA":%g,"semiB":%g,"theta":%g,"rss":%g,"r2":%g,"A":%g,"B":%g,"C":%g,"D":%g,"E":%g,"F":%g}\n',
    kind, disc, cx, cy, sA, sB, theta, res$rss, res$r2, A, B, C, D, E, F
  ))
}
