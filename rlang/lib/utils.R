#!/usr/bin/env Rscript
# ==============================================================================
# rlang/lib/utils.R — Shared Utility Functions
# ==============================================================================
# General-purpose helpers used across all R scripts in this repository.
# Source with: source(file.path(rlang_root(), "lib/utils.R"))
# ==============================================================================

# --------------------------------------------------------------------------- #
# Root helpers
# --------------------------------------------------------------------------- #

#' Return the absolute path to the rlang root directory
#' Works whether called interactively or via Rscript.
rlang_root <- function() {
  script <- tryCatch(
    normalizePath(sys.frame(1)$ofile, mustWork = FALSE),
    error = function(e) NULL
  )
  if (!is.null(script)) {
    return(dirname(dirname(script)))   # lib/ -> rlang/
  }
  # Fall back to env variable set by runner.R
  root <- Sys.getenv("RLANG_ROOT", unset = "")
  if (nchar(root) > 0) return(root)
  stop("Cannot determine rlang root. Set RLANG_ROOT env variable.")
}

#' Return the repository root (one level above rlang/)
repo_root <- function() {
  dirname(rlang_root())
}

# --------------------------------------------------------------------------- #
# Logging
# --------------------------------------------------------------------------- #

.rlang_log_level <- new.env(parent = emptyenv())
.rlang_log_level$value <- "INFO"

#' Set the global log level: DEBUG | INFO | WARN | ERROR
set_log_level <- function(level) {
  level <- toupper(level)
  stopifnot(level %in% c("DEBUG", "INFO", "WARN", "ERROR"))
  .rlang_log_level$value <- level
}

.log_levels <- c(DEBUG = 1L, INFO = 2L, WARN = 3L, ERROR = 4L)

.log <- function(level, ...) {
  if (.log_levels[[level]] >= .log_levels[[.rlang_log_level$value]]) {
    ts <- format(Sys.time(), "%Y-%m-%d %H:%M:%S")
    message(sprintf("[%s] [%s] %s", ts, level, paste(..., sep = " ")))
  }
}

log_debug <- function(...) .log("DEBUG", ...)
log_info  <- function(...) .log("INFO",  ...)
log_warn  <- function(...) .log("WARN",  ...)
log_error <- function(...) .log("ERROR", ...)

# --------------------------------------------------------------------------- #
# Timing
# --------------------------------------------------------------------------- #

#' Execute expr and return a list(result, elapsed_secs)
timed <- function(expr) {
  start <- proc.time()[["elapsed"]]
  result <- force(expr)
  elapsed <- proc.time()[["elapsed"]] - start
  list(result = result, elapsed_secs = elapsed)
}

# --------------------------------------------------------------------------- #
# Environment / config
# --------------------------------------------------------------------------- #

#' Read env variable; return default if unset or empty
env_or <- function(var, default) {
  val <- Sys.getenv(var, unset = "")
  if (nchar(val) == 0) default else val
}

#' Read env variable as numeric; return default if unset
env_num <- function(var, default) {
  as.numeric(env_or(var, as.character(default)))
}

#' Read env variable as integer; return default if unset
env_int <- function(var, default) {
  as.integer(env_or(var, as.character(default)))
}

# --------------------------------------------------------------------------- #
# File utilities
# --------------------------------------------------------------------------- #

#' Ensure a directory exists (creates recursively if needed)
ensure_dir <- function(path) {
  if (!dir.exists(path)) dir.create(path, recursive = TRUE)
  invisible(path)
}

#' Return TRUE if path exists (file or dir)
path_exists <- function(path) file.exists(path) || dir.exists(path)

# --------------------------------------------------------------------------- #
# String helpers
# --------------------------------------------------------------------------- #

#' Left-pad a string to width
str_pad_left <- function(x, width, pad = " ") {
  x <- as.character(x)
  sprintf(paste0("%-", width, "s"), x)
}

#' Repeat a character n times and return single string
str_rep <- function(ch, n) paste(rep(ch, n), collapse = "")

#' Header banner
banner <- function(title, width = 70, char = "=") {
  line <- str_rep(char, width)
  cat(line, "\n")
  cat(sprintf("  %s\n", title))
  cat(line, "\n")
}
