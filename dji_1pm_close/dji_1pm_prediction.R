#!/usr/bin/env Rscript
# ==============================================================================
# DJI 1 PM Close Prediction Engine - R Implementation
# ==============================================================================
# A comprehensive statistical prediction system for the Dow Jones Industrial
# Average 1 PM close price using advanced calculus and stochastic methods.
#
# This implementation uses:
# - Geometric Brownian Motion (GBM)
# - Ornstein-Uhlenbeck Mean-Reversion Process
# - Monte Carlo with variance reduction
# - Numerical integration (Gaussian Quadrature)
# - Taylor Series expansion
# - Black-Scholes Greeks calculations
#
# Author: MajixAI
# License: MIT
# ==============================================================================

# ==============================================================================
# EXTENSIVE IMPORTS - R Statistical Computing Stack
# ==============================================================================

# Core packages - suppress startup messages
suppressPackageStartupMessages({
  # Statistical computing
  library(stats)      # Core statistics, distributions
  library(MASS)       # Modern Applied Statistics
  library(Matrix)     # Sparse and dense matrix operations
  
  # Numerical methods
  library(pracma)     # Practical Numerical Math Functions
  library(Deriv)      # Symbolic differentiation
  
  # Data manipulation (optional, will work without)
  tryCatch({
    library(dplyr)      # Data manipulation
    library(tidyr)      # Data tidying
  }, error = function(e) {
    message("Note: tidyverse packages not available, using base R")
  })
  
  # Parallel computing (optional)
  tryCatch({
    library(parallel)   # Parallel processing
  }, error = function(e) {
    message("Note: parallel package not available")
  })
})

# ==============================================================================
# CONFIGURATION
# ==============================================================================

MarketConfig <- list(
  current_price = as.numeric(Sys.getenv("DJI_PRICE", unset = "44000.00")),
  target_time = "13:00",
  volatility = as.numeric(Sys.getenv("VOLATILITY", unset = "0.15")),
  drift = as.numeric(Sys.getenv("DRIFT", unset = "0.05")),
  risk_free_rate = 0.045,
  trading_days = 252,
  minutes_per_day = 390,
  simulations = as.integer(Sys.getenv("SIMULATIONS", unset = "10000")),
  random_seed = as.integer(Sys.getenv("RANDOM_SEED", unset = "42"))
)

# Set seed for reproducibility
set.seed(MarketConfig$random_seed)

# ==============================================================================
# ADVANCED CALCULUS FUNCTIONS
# ==============================================================================

#' Taylor Series Expansion for Log-Normal Price
#' 
#' Computes Taylor expansion around S0 for price approximation
#' Uses log transformation for better numerical stability
#'
#' @param S0 Current price
#' @param dS Expected price change
#' @param order Expansion order (default 4)
#' @return Approximated price
taylor_expansion_price <- function(S0, dS, order = 4) {
  # Log-price Taylor expansion
  log_S0 <- log(S0)
  
  # Derivatives of log(S) at S0
  # d^n/dS^n [log(S)] = (-1)^(n-1) * (n-1)! / S^n
  coefficients <- numeric(order + 1)
  
  for (n in 0:order) {
    if (n == 0) {
      coefficients[n + 1] <- log_S0
    } else {
      # n-th derivative of log(S) at S0
      deriv_n <- ((-1)^(n - 1) * factorial(n - 1)) / (S0^n)
      coefficients[n + 1] <- deriv_n * (dS^n) / factorial(n)
    }
  }
  
  # Sum Taylor series and exponentiate
  log_price_approx <- sum(coefficients)
  return(exp(log_price_approx))
}

#' Ito's Lemma Application for Stochastic Calculus
#'
#' For f(S, t) where dS = μS·dt + σS·dW:
#' df = (∂f/∂t + μS·∂f/∂S + ½σ²S²·∂²f/∂S²)dt + σS·∂f/∂S·dW
#'
#' @param S0 Current price
#' @param dt Time step
#' @param dW Wiener process increment
#' @param mu Drift rate
#' @param sigma Volatility
#' @return List with Ito calculus results
ito_lemma_application <- function(S0, dt, dW, mu, sigma) {
  # For f(S) = log(S):
  # df/dS = 1/S
  # d²f/dS² = -1/S²
  
  df_dS <- 1 / S0
  d2f_dS2 <- -1 / (S0^2)
  
  # Ito's Lemma drift term: (μ - ½σ²)dt
  drift_coeff <- mu - 0.5 * sigma^2
  drift_term <- drift_coeff * dt
  
  # Ito's Lemma diffusion term: σ·dW
  diffusion_term <- sigma * dW
  
  # New log-price
  d_log_S <- drift_term + diffusion_term
  new_log_S <- log(S0) + d_log_S
  new_S <- exp(new_log_S)
  
  return(list(
    df_dS = df_dS,
    d2f_dS2 = d2f_dS2,
    drift_term = drift_term,
    diffusion_term = diffusion_term,
    d_log_S = d_log_S,
    new_price = new_S,
    price_change = new_S - S0
  ))
}

#' Black-Scholes PDE Solution
#'
#' Solves the Black-Scholes PDE for option pricing:
#' ∂V/∂t + ½σ²S²·∂²V/∂S² + rS·∂V/∂S - rV = 0
#'
#' @param S0 Current price
#' @param K Strike price
#' @param T Time to expiration
#' @param r Risk-free rate
#' @param sigma Volatility
#' @return List with option price and Greeks
black_scholes_greeks <- function(S0, K, T, r, sigma) {
  # d1 and d2 parameters
  d1 <- (log(S0 / K) + (r + 0.5 * sigma^2) * T) / (sigma * sqrt(T))
  d2 <- d1 - sigma * sqrt(T)
  
  # Standard normal CDF and PDF
  N <- pnorm  # Cumulative distribution function
  n <- dnorm  # Probability density function
  
  # Call price
  call_price <- S0 * N(d1) - K * exp(-r * T) * N(d2)
  
  # Greeks (partial derivatives)
  delta <- N(d1)  # ∂V/∂S
  gamma <- n(d1) / (S0 * sigma * sqrt(T))  # ∂²V/∂S²
  theta <- -S0 * n(d1) * sigma / (2 * sqrt(T)) - r * K * exp(-r * T) * N(d2)  # ∂V/∂t
  vega <- S0 * sqrt(T) * n(d1)  # ∂V/∂σ
  rho <- K * T * exp(-r * T) * N(d2)  # ∂V/∂r
  
  return(list(
    d1 = d1,
    d2 = d2,
    call_price = call_price,
    delta = delta,
    gamma = gamma,
    theta = theta,
    vega = vega,
    rho = rho
  ))
}

# ==============================================================================
# STOCHASTIC PROCESSES
# ==============================================================================

#' Geometric Brownian Motion Simulation
#'
#' dS = μS·dt + σS·dW
#' Solution: S(t) = S(0)·exp((μ - σ²/2)t + σW(t))
#'
#' @param S0 Initial price
#' @param T Time horizon
#' @param steps Number of time steps
#' @param mu Drift rate
#' @param sigma Volatility
#' @return Vector of prices
geometric_brownian_motion <- function(S0, T, steps, mu, sigma) {
  dt <- T / steps
  
  # Generate Brownian increments
  dW <- rnorm(steps, mean = 0, sd = sqrt(dt))
  
  # Cumulative Brownian motion (prepend 0 for W(0))
  W <- c(0, cumsum(dW))
  
  # Time vector
  t <- seq(0, T, length.out = steps + 1)
  
  # GBM solution
  S <- S0 * exp((mu - 0.5 * sigma^2) * t + sigma * W)
  
  return(S)
}

#' Ornstein-Uhlenbeck Mean-Reverting Process
#'
#' dS = θ(μ - S)dt + σdW
#'
#' @param S0 Initial price
#' @param theta Mean-reversion speed
#' @param mu_eq Equilibrium level
#' @param sigma Volatility
#' @param T Time horizon
#' @param steps Number of steps
#' @return Vector of prices
ornstein_uhlenbeck <- function(S0, theta, mu_eq, sigma, T, steps) {
  dt <- T / steps
  
  S <- numeric(steps + 1)
  S[1] <- S0
  
  # Euler-Maruyama discretization
  for (i in 1:steps) {
    dW <- rnorm(1, mean = 0, sd = sqrt(dt))
    S[i + 1] <- S[i] + theta * (mu_eq - S[i]) * dt + sigma * dW
  }
  
  return(S)
}

#' Merton Jump-Diffusion Model
#'
#' dS/S = (μ - λκ)dt + σdW + dJ
#'
#' @param S0 Initial price
#' @param T Time horizon
#' @param steps Number of steps
#' @param mu Drift rate
#' @param sigma Volatility
#' @param lambda_j Jump intensity
#' @param mu_j Jump mean
#' @param sigma_j Jump volatility
#' @return Vector of prices
jump_diffusion <- function(S0, T, steps, mu, sigma, 
                           lambda_j = 0.1, mu_j = 0.0, sigma_j = 0.1) {
  dt <- T / steps
  
  # Expected jump size
  kappa <- exp(mu_j + 0.5 * sigma_j^2) - 1
  
  S <- numeric(steps + 1)
  S[1] <- S0
  
  for (i in 1:steps) {
    # Brownian component
    dW <- rnorm(1, mean = 0, sd = sqrt(dt))
    
    # Jump component (Poisson)
    n_jumps <- rpois(1, lambda_j * dt)
    if (n_jumps > 0) {
      jump_sizes <- rnorm(n_jumps, mean = mu_j, sd = sigma_j)
      J <- sum(exp(jump_sizes) - 1)
    } else {
      J <- 0
    }
    
    # Price evolution
    dS <- S[i] * ((mu - lambda_j * kappa) * dt + sigma * dW + J)
    S[i + 1] <- S[i] + dS
  }
  
  return(S)
}

# ==============================================================================
# NUMERICAL INTEGRATION
# ==============================================================================

#' Simpson's Rule for Numerical Integration
#'
#' ∫[a,b] f(x)dx ≈ (h/3)[f(a) + 4·Σf(odd) + 2·Σf(even) + f(b)]
#'
#' @param f Function to integrate
#' @param a Lower bound
#' @param b Upper bound
#' @param n Number of subintervals (must be even)
#' @return Integral approximation
simpsons_rule <- function(f, a, b, n) {
  if (n %% 2 == 1) n <- n + 1
  
  h <- (b - a) / n
  x <- seq(a, b, length.out = n + 1)
  y <- sapply(x, f)
  
  # Simpson's weights: 1, 4, 2, 4, 2, ..., 4, 1
  weights <- rep(c(2, 4), length.out = n - 1)
  weights <- c(1, weights, 1)
  
  return(h / 3 * sum(weights * y))
}

#' Gaussian Quadrature Integration
#'
#' Uses Gauss-Legendre quadrature for high-accuracy integration
#'
#' @param f Function to integrate
#' @param a Lower bound
#' @param b Upper bound
#' @param n Number of quadrature points
#' @return Integral approximation
gaussian_quadrature <- function(f, a, b, n = 5) {
  # Get Gauss-Legendre nodes and weights for [-1, 1]
  gl <- pracma::gaussLegendre(n, -1, 1)
  nodes <- gl$x
  weights <- gl$w
  
  # Transform to [a, b]
  x <- 0.5 * (b - a) * nodes + 0.5 * (a + b)
  w <- 0.5 * (b - a) * weights
  
  return(sum(w * sapply(x, f)))
}

# ==============================================================================
# MONTE CARLO WITH VARIANCE REDUCTION
# ==============================================================================

#' Antithetic Variates Monte Carlo
#'
#' For each random path Z, also use -Z to reduce variance
#'
#' @param S0 Initial price
#' @param T Time horizon
#' @param n_sims Number of simulations
#' @param mu Drift rate
#' @param sigma Volatility
#' @return Vector of terminal prices
antithetic_variates <- function(S0, T, n_sims, mu, sigma) {
  # Generate normal variates
  Z <- rnorm(n_sims / 2)
  
  # Antithetic pairs
  S_pos <- S0 * exp((mu - 0.5 * sigma^2) * T + sigma * sqrt(T) * Z)
  S_neg <- S0 * exp((mu - 0.5 * sigma^2) * T + sigma * sqrt(T) * (-Z))
  
  return(c(S_pos, S_neg))
}

#' Stratified Sampling Monte Carlo
#'
#' Divides probability space into strata and samples from each
#'
#' @param S0 Initial price
#' @param T Time horizon
#' @param n_sims Number of simulations
#' @param n_strata Number of strata
#' @param mu Drift rate
#' @param sigma Volatility
#' @return Vector of terminal prices
stratified_sampling <- function(S0, T, n_sims, n_strata = 10, mu, sigma) {
  samples_per_stratum <- n_sims %/% n_strata
  S_T <- numeric(n_sims)
  
  for (i in 1:n_strata) {
    # Uniform samples within stratum
    u_low <- (i - 1) / n_strata
    u_high <- i / n_strata
    u <- runif(samples_per_stratum, min = u_low, max = u_high)
    
    # Transform to normal via inverse CDF
    Z <- qnorm(u)
    
    # Compute prices
    start_idx <- (i - 1) * samples_per_stratum + 1
    end_idx <- start_idx + samples_per_stratum - 1
    S_T[start_idx:end_idx] <- S0 * exp((mu - 0.5 * sigma^2) * T + sigma * sqrt(T) * Z)
  }
  
  return(S_T)
}

# ==============================================================================
# MAIN PREDICTION ENGINE
# ==============================================================================

#' Compute Time to 1 PM Target
#'
#' @return Time in years
compute_time_to_target <- function() {
  now <- Sys.time()
  market_open <- as.POSIXlt(now)
  market_open$hour <- 9
  market_open$min <- 30
  market_open$sec <- 0
  
  target <- as.POSIXlt(now)
  target$hour <- 13
  target$min <- 0
  target$sec <- 0
  
  # Minutes to 1 PM
  minutes_to_1pm <- max(0, as.numeric(difftime(target, now, units = "mins")))
  
  # Default to 207 minutes if time has passed
  if (minutes_to_1pm <= 0) minutes_to_1pm <- 207
  
  # Convert to years
  T <- minutes_to_1pm / (MarketConfig$trading_days * MarketConfig$minutes_per_day)
  
  return(T)
}

#' Run Comprehensive Simulation
#'
#' @return List with all prediction results
run_comprehensive_simulation <- function() {
  S0 <- MarketConfig$current_price
  T <- compute_time_to_target()
  n_sims <- MarketConfig$simulations
  mu <- MarketConfig$drift
  sigma <- MarketConfig$volatility
  r <- MarketConfig$risk_free_rate
  
  results <- list()
  
  # 1. Geometric Brownian Motion (Monte Carlo)
  gbm_paths <- replicate(n_sims, {
    path <- geometric_brownian_motion(S0, T, 100, mu, sigma)
    path[length(path)]  # Return terminal price
  })
  
  results$gbm <- list(
    mean = mean(gbm_paths),
    std = sd(gbm_paths),
    p5 = quantile(gbm_paths, 0.05),
    p95 = quantile(gbm_paths, 0.95)
  )
  
  # 2. Antithetic Variates
  av_prices <- antithetic_variates(S0, T, n_sims, mu, sigma)
  results$antithetic <- list(
    mean = mean(av_prices),
    std = sd(av_prices),
    variance_reduction = var(gbm_paths) / var(av_prices)
  )
  
  # 3. Stratified Sampling
  strat_prices <- stratified_sampling(S0, T, n_sims, 10, mu, sigma)
  results$stratified <- list(
    mean = mean(strat_prices),
    std = sd(strat_prices)
  )
  
  # 4. Black-Scholes Greeks (ATM)
  K <- S0
  bs_result <- black_scholes_greeks(S0, K, T, r, sigma)
  results$black_scholes <- bs_result
  
  # 5. Ito's Lemma
  dt <- T
  dW <- 0  # Expected value
  ito_result <- ito_lemma_application(S0, dt, dW, mu, sigma)
  results$ito_lemma <- ito_result
  
  # 6. Taylor Expansion
  expected_dS <- S0 * mu * T
  taylor_price <- taylor_expansion_price(S0, expected_dS, order = 4)
  results$taylor_expansion <- list(
    price = taylor_price,
    expected_drift = expected_dS
  )
  
  # 7. Analytical Expected Value (Integration)
  E_S <- S0 * exp(mu * T)
  m <- log(S0) + (mu - 0.5 * sigma^2) * T
  s <- sigma * sqrt(T)
  
  results$integration <- list(
    analytical_expected = E_S,
    log_mean = m,
    log_std = s
  )
  
  # 8. Confidence Intervals
  z_95 <- qnorm(0.975)
  ci_std <- sd(av_prices) / sqrt(n_sims)
  ci_lower <- mean(av_prices) - z_95 * ci_std
  ci_upper <- mean(av_prices) + z_95 * ci_std
  
  results$confidence_interval <- list(
    mean = mean(av_prices),
    ci_95_lower = ci_lower,
    ci_95_upper = ci_upper
  )
  
  # Combined prediction
  predictions <- c(
    results$gbm$mean,
    results$antithetic$mean,
    results$stratified$mean,
    results$integration$analytical_expected
  )
  
  results$combined_prediction <- list(
    mean = mean(predictions),
    std = sd(predictions),
    methods_used = 4
  )
  
  return(results)
}

#' Generate Formatted Report
#'
#' @param results Results from simulation
#' @return Formatted report string
generate_report <- function(results) {
  report <- c(
    paste(rep("=", 70), collapse = ""),
    "      DJI 1 PM CLOSE PREDICTION REPORT (R Implementation)",
    "      Advanced Calculus & Stochastic Methods",
    paste(rep("=", 70), collapse = ""),
    "",
    sprintf("Current Price:    $%12.2f", MarketConfig$current_price),
    sprintf("Volatility (σ):   %11.1f%%", MarketConfig$volatility * 100),
    sprintf("Drift (μ):        %11.1f%%", MarketConfig$drift * 100),
    sprintf("Simulations:      %11s", format(MarketConfig$simulations, big.mark = ",")),
    "",
    paste(rep("-", 70), collapse = ""),
    "PREDICTION RESULTS",
    paste(rep("-", 70), collapse = ""),
    "",
    "1. Geometric Brownian Motion:",
    sprintf("   Mean:           $%12.2f", results$gbm$mean),
    sprintf("   Std Dev:        $%12.2f", results$gbm$std),
    sprintf("   90%% Range:      $%12.2f - $%.2f", results$gbm$p5, results$gbm$p95),
    "",
    "2. Antithetic Variates:",
    sprintf("   Mean:           $%12.2f", results$antithetic$mean),
    sprintf("   Var Reduction:  %12.2fx", results$antithetic$variance_reduction),
    "",
    "3. Stratified Sampling:",
    sprintf("   Mean:           $%12.2f", results$stratified$mean),
    "",
    "4. Analytical (Integration):",
    sprintf("   Expected:       $%12.2f", results$integration$analytical_expected),
    "",
    paste(rep("=", 70), collapse = ""),
    "COMBINED PREDICTION",
    paste(rep("=", 70), collapse = ""),
    "",
    sprintf("   1 PM Close:     $%12.2f", results$combined_prediction$mean),
    sprintf("   95%% CI:         $%12.2f - $%.2f", 
            results$confidence_interval$ci_95_lower,
            results$confidence_interval$ci_95_upper),
    "",
    paste(rep("-", 70), collapse = ""),
    "BLACK-SCHOLES GREEKS (ATM)",
    paste(rep("-", 70), collapse = ""),
    sprintf("   Delta:          %12.4f", results$black_scholes$delta),
    sprintf("   Gamma:          %12.6f", results$black_scholes$gamma),
    sprintf("   Theta:          %12.4f", results$black_scholes$theta),
    sprintf("   Vega:           %12.4f", results$black_scholes$vega),
    "",
    paste(rep("=", 70), collapse = "")
  )
  
  return(paste(report, collapse = "\n"))
}

# ==============================================================================
# MAIN EXECUTION
# ==============================================================================

main <- function() {
  cat("Running comprehensive DJI 1 PM prediction simulation (R)...\n\n")
  
  # Run simulation
  results <- run_comprehensive_simulation()
  
  # Generate and print report
  report <- generate_report(results)
  cat(report)
  cat("\n")
  
  # Save results to JSON
  output_dir <- dirname(normalizePath(".", mustWork = FALSE))
  script_dir <- tryCatch({
    dirname(sys.frame(1)$ofile)
  }, error = function(e) {
    getwd()
  })
  
  # Try to save JSON if jsonlite is available
  tryCatch({
    library(jsonlite)
    json_output <- file.path(script_dir, "prediction_results_r.json")
    write_json(results, json_output, pretty = TRUE, auto_unbox = TRUE)
    cat(sprintf("\nResults saved to: %s\n", json_output))
  }, error = function(e) {
    cat("\nNote: jsonlite not available, skipping JSON output\n")
  })
  
  return(invisible(results))
}

# Run main function
if (!interactive()) {
  main()
}
