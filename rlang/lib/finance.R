#!/usr/bin/env Rscript
# ==============================================================================
# rlang/lib/finance.R — Shared Financial Functions
# ==============================================================================
# Reusable quantitative-finance building blocks for every R script in the repo.
# Source after utils.R:
#   source(file.path(rlang_root(), "lib/utils.R"))
#   source(file.path(rlang_root(), "lib/finance.R"))
# ==============================================================================

suppressPackageStartupMessages({
  library(stats)
})

# --------------------------------------------------------------------------- #
# Stochastic Processes
# --------------------------------------------------------------------------- #

#' Geometric Brownian Motion path
#'
#' dS = μS dt + σS dW
#' Exact solution: S(t) = S₀ exp((μ - σ²/2)t + σW(t))
#'
#' @param S0     Initial price
#' @param T      Time horizon (years)
#' @param steps  Number of discrete time steps
#' @param mu     Annual drift rate
#' @param sigma  Annual volatility
#' @return Numeric vector of length (steps + 1)
gbm_path <- function(S0, T, steps, mu, sigma) {
  dt <- T / steps
  dW <- rnorm(steps, mean = 0, sd = sqrt(dt))
  W  <- c(0, cumsum(dW))
  t  <- seq(0, T, length.out = steps + 1)
  S0 * exp((mu - 0.5 * sigma^2) * t + sigma * W)
}

#' Ornstein-Uhlenbeck mean-reverting path
#'
#' dS = θ(μ_eq - S)dt + σ dW   (Euler-Maruyama)
#'
#' @param S0     Initial value
#' @param theta  Mean-reversion speed
#' @param mu_eq  Long-run equilibrium level
#' @param sigma  Volatility
#' @param T      Time horizon (years)
#' @param steps  Number of steps
#' @return Numeric vector of length (steps + 1)
ou_path <- function(S0, theta, mu_eq, sigma, T, steps) {
  dt <- T / steps
  S  <- numeric(steps + 1)
  S[1] <- S0
  for (i in seq_len(steps)) {
    dW   <- rnorm(1, sd = sqrt(dt))
    S[i + 1] <- S[i] + theta * (mu_eq - S[i]) * dt + sigma * dW
  }
  S
}

#' Merton Jump-Diffusion path
#'
#' dS/S = (μ - λκ)dt + σ dW + dJ
#'
#' @param S0       Initial price
#' @param T        Time horizon (years)
#' @param steps    Number of steps
#' @param mu       Drift rate
#' @param sigma    Diffusion volatility
#' @param lambda_j Jump intensity (jumps per year)
#' @param mu_j     Mean log-jump size
#' @param sigma_j  Std-dev of log-jump size
#' @return Numeric vector of length (steps + 1)
jump_diffusion_path <- function(S0, T, steps, mu, sigma,
                                lambda_j = 0.1, mu_j = 0.0, sigma_j = 0.1) {
  dt    <- T / steps
  kappa <- exp(mu_j + 0.5 * sigma_j^2) - 1
  S     <- numeric(steps + 1)
  S[1]  <- S0
  for (i in seq_len(steps)) {
    dW      <- rnorm(1, sd = sqrt(dt))
    n_jumps <- rpois(1, lambda_j * dt)
    J <- if (n_jumps > 0) sum(exp(rnorm(n_jumps, mu_j, sigma_j)) - 1) else 0
    S[i + 1] <- S[i] + S[i] * ((mu - lambda_j * kappa) * dt + sigma * dW + J)
  }
  S
}

# --------------------------------------------------------------------------- #
# Monte Carlo
# --------------------------------------------------------------------------- #

#' Antithetic-variates Monte Carlo terminal prices
#'
#' @param S0    Initial price
#' @param T     Time horizon (years)
#' @param n     Number of simulations (must be even)
#' @param mu    Drift
#' @param sigma Volatility
#' @return Numeric vector of length n
mc_antithetic <- function(S0, T, n, mu, sigma) {
  Z     <- rnorm(ceiling(n / 2))
  coeff <- (mu - 0.5 * sigma^2) * T
  scale <- sigma * sqrt(T)
  c(S0 * exp(coeff + scale * Z),
    S0 * exp(coeff + scale * (-Z)))[seq_len(n)]
}

#' Stratified-sampling Monte Carlo terminal prices
#'
#' @param S0      Initial price
#' @param T       Time horizon (years)
#' @param n       Total simulations
#' @param strata  Number of strata
#' @param mu      Drift
#' @param sigma   Volatility
#' @return Numeric vector of length n
mc_stratified <- function(S0, T, n, strata = 10, mu, sigma) {
  per   <- n %/% strata
  coeff <- (mu - 0.5 * sigma^2) * T
  scale <- sigma * sqrt(T)
  out   <- numeric(strata * per)
  for (k in seq_len(strata)) {
    u <- runif(per, (k - 1) / strata, k / strata)
    Z <- qnorm(u)
    idx <- ((k - 1) * per + 1):(k * per)
    out[idx] <- S0 * exp(coeff + scale * Z)
  }
  out
}

# --------------------------------------------------------------------------- #
# Black-Scholes
# --------------------------------------------------------------------------- #

#' Black-Scholes call price and Greeks
#'
#' @param S     Spot price
#' @param K     Strike price
#' @param T     Time to expiry (years)
#' @param r     Risk-free rate
#' @param sigma Volatility
#' @return Named list: call_price, delta, gamma, theta, vega, rho, d1, d2
bs_greeks <- function(S, K, T, r, sigma) {
  d1 <- (log(S / K) + (r + 0.5 * sigma^2) * T) / (sigma * sqrt(T))
  d2 <- d1 - sigma * sqrt(T)
  list(
    d1         = d1,
    d2         = d2,
    call_price = S * pnorm(d1) - K * exp(-r * T) * pnorm(d2),
    delta      = pnorm(d1),
    gamma      = dnorm(d1) / (S * sigma * sqrt(T)),
    theta      = -S * dnorm(d1) * sigma / (2 * sqrt(T)) -
                   r * K * exp(-r * T) * pnorm(d2),
    vega       = S * sqrt(T) * dnorm(d1),
    rho        = K * T * exp(-r * T) * pnorm(d2)
  )
}

# --------------------------------------------------------------------------- #
# Numerical calculus helpers
# --------------------------------------------------------------------------- #

#' Log-price Taylor-series approximation
#'
#' @param S0    Current price
#' @param dS    Expected price change
#' @param order Expansion order (default 4)
#' @return Approximate price
taylor_price <- function(S0, dS, order = 4) {
  log_S0 <- log(S0)
  terms  <- numeric(order + 1)
  terms[1] <- log_S0
  for (n in seq_len(order)) {
    deriv_n <- ((-1)^(n - 1) * factorial(n - 1)) / (S0^n)
    terms[n + 1] <- deriv_n * (dS^n) / factorial(n)
  }
  exp(sum(terms))
}

#' Simple confidence interval around a mean
#'
#' @param x    Numeric vector
#' @param conf Confidence level (default 0.95)
#' @return Named numeric vector: mean, lower, upper, se
conf_interval <- function(x, conf = 0.95) {
  n  <- length(x)
  m  <- mean(x)
  se <- sd(x) / sqrt(n)
  z  <- qnorm(1 - (1 - conf) / 2)
  c(mean = m, lower = m - z * se, upper = m + z * se, se = se)
}
