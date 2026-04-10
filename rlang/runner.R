#!/usr/bin/env Rscript
# ==============================================================================
# rlang/runner.R — Central R Script Dispatcher
# ==============================================================================
# Discovers and executes every *.R script in the repository (except itself
# and the shared library files).
#
# Usage:
#   Rscript rlang/runner.R [options]
#
# Options (environment variables):
#   RLANG_DIRS       Colon-separated list of directories to scan (default: all)
#   RLANG_PATTERN    Glob/regex to match R scripts (default: all *.R)
#   RLANG_EXCLUDE    Colon-separated paths to skip (relative to repo root)
#   RLANG_DRY_RUN    Set to "1" to list scripts without running them
#   RLANG_TIMEOUT    Per-script timeout in seconds (default: 300)
#   RLANG_LOG_LEVEL  DEBUG | INFO | WARN | ERROR  (default: INFO)
#
# Author: MajixAI
# License: MIT
# ==============================================================================

# --------------------------------------------------------------------------- #
# Bootstrap — load shared utilities
# --------------------------------------------------------------------------- #

.runner_file <- tryCatch(
  normalizePath(sys.frame(1)$ofile, mustWork = FALSE),
  error = function(e) file.path(getwd(), "rlang", "runner.R")
)
.rlang_root <- dirname(.runner_file)
Sys.setenv(RLANG_ROOT = .rlang_root)

source(file.path(.rlang_root, "lib", "utils.R"))
source(file.path(.rlang_root, "lib", "io.R"))

# --------------------------------------------------------------------------- #
# Configuration
# --------------------------------------------------------------------------- #

Config <- list(
  repo_root   = repo_root(),
  rlang_root  = .rlang_root,
  dirs        = env_or("RLANG_DIRS",    ""),          # empty == all
  pattern     = env_or("RLANG_PATTERN", "\\.R$"),
  exclude_raw = env_or("RLANG_EXCLUDE", ""),
  dry_run     = env_or("RLANG_DRY_RUN", "0") == "1",
  timeout     = env_int("RLANG_TIMEOUT", 300L),
  log_level   = env_or("RLANG_LOG_LEVEL", "INFO")
)

set_log_level(Config$log_level)

# Always exclude the rlang/ directory itself
.self_rel <- paste0("rlang", .Platform$file.sep)
.exclude_paths <- unique(c(
  .self_rel,
  if (nchar(Config$exclude_raw) > 0)
    strsplit(Config$exclude_raw, ":")[[1]]
  else
    character(0)
))

# --------------------------------------------------------------------------- #
# Script discovery
# --------------------------------------------------------------------------- #

#' Find all R scripts under search_root, honouring Config settings.
#'
#' @return Character vector of absolute file paths
discover_scripts <- function() {
  if (nchar(Config$dirs) > 0) {
    search_dirs <- file.path(Config$repo_root,
                             strsplit(Config$dirs, ":")[[1]])
  } else {
    search_dirs <- Config$repo_root
  }

  all_scripts <- character(0)
  for (d in search_dirs) {
    found <- list.files(d, pattern = Config$pattern,
                        recursive = TRUE, full.names = TRUE)
    all_scripts <- c(all_scripts, found)
  }

  # Normalise
  all_scripts <- normalizePath(all_scripts, mustWork = FALSE)

  # Remove excluded paths
  is_excluded <- vapply(all_scripts, function(p) {
    rel <- sub(paste0(normalizePath(Config$repo_root, mustWork = FALSE),
                      .Platform$file.sep), "", p, fixed = TRUE)
    any(startsWith(rel, .exclude_paths))
  }, logical(1))

  all_scripts[!is_excluded]
}

# --------------------------------------------------------------------------- #
# Script execution
# --------------------------------------------------------------------------- #

#' Run a single R script via Rscript subprocess.
#'
#' @param script Absolute path to the script
#' @return List with fields: script, status (0 = success), elapsed_secs, error
run_script <- function(script) {
  log_info(sprintf("Running: %s", script))
  t <- timed({
    status <- tryCatch({
      result <- system2(
        "Rscript",
        args    = shQuote(script),
        stdout  = "",
        stderr  = "",
        timeout = Config$timeout
      )
      result
    }, error = function(e) {
      log_error("system2 error:", conditionMessage(e))
      -1L
    })
    status
  })
  list(
    script       = script,
    status       = t$result,
    elapsed_secs = t$elapsed_secs,
    error        = if (t$result != 0) sprintf("exit code %d", t$result) else NA_character_
  )
}

# --------------------------------------------------------------------------- #
# Summary report
# --------------------------------------------------------------------------- #

print_summary <- function(results) {
  total   <- length(results)
  passed  <- sum(vapply(results, function(r) r$status == 0, logical(1)))
  failed  <- total - passed

  banner("R RUNNER SUMMARY")
  cat(sprintf("  Total scripts : %d\n", total))
  cat(sprintf("  Passed        : %d\n", passed))
  cat(sprintf("  Failed        : %d\n", failed))
  cat(str_rep("-", 70), "\n")

  for (r in results) {
    rel <- sub(paste0(normalizePath(Config$repo_root, mustWork = FALSE),
                      .Platform$file.sep), "", r$script, fixed = TRUE)
    status_str <- if (r$status == 0) "OK " else "FAIL"
    cat(sprintf("  [%s] %s  (%.1fs)\n", status_str, rel, r$elapsed_secs))
    if (!is.na(r$error)) cat(sprintf("       %s\n", r$error))
  }
  cat(str_rep("=", 70), "\n")
}

# --------------------------------------------------------------------------- #
# Main
# --------------------------------------------------------------------------- #

main <- function() {
  banner(sprintf("rlang runner  —  repo: %s", Config$repo_root))

  scripts <- discover_scripts()
  log_info(sprintf("Discovered %d R script(s)", length(scripts)))

  if (length(scripts) == 0) {
    log_warn("No R scripts found. Check RLANG_DIRS / RLANG_PATTERN settings.")
    return(invisible(NULL))
  }

  if (Config$dry_run) {
    cat("\n[DRY RUN] Scripts that would be executed:\n")
    for (s in scripts) {
      rel <- sub(paste0(normalizePath(Config$repo_root, mustWork = FALSE),
                        .Platform$file.sep), "", s, fixed = TRUE)
      cat(sprintf("  %s\n", rel))
    }
    return(invisible(scripts))
  }

  results <- lapply(scripts, run_script)

  # Persist results
  out_json <- file.path(Config$rlang_root, "runner_results.json")
  write_json_safe(results, out_json)

  print_summary(results)

  # Exit with non-zero if any script failed
  failed <- sum(vapply(results, function(r) r$status != 0, logical(1)))
  if (failed > 0) quit(status = 1)
  invisible(results)
}

if (!interactive()) main()
