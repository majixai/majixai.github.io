#!/usr/bin/env Rscript
# ==============================================================================
# rlang/lib/io.R — Shared I/O Helpers (JSON, CSV, plain text)
# ==============================================================================
# Source after utils.R:
#   source(file.path(rlang_root(), "lib/utils.R"))
#   source(file.path(rlang_root(), "lib/io.R"))
# ==============================================================================

# --------------------------------------------------------------------------- #
# JSON
# --------------------------------------------------------------------------- #

#' Write an R object to a JSON file (requires jsonlite)
#'
#' @param obj      R object to serialise
#' @param path     Output file path
#' @param pretty   Pretty-print (default TRUE)
#' @param unbox    Auto-unbox scalars (default TRUE)
#' @return Invisible path on success; NULL on failure
write_json_safe <- function(obj, path, pretty = TRUE, unbox = TRUE) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    if (exists("log_warn")) log_warn("jsonlite not available — skipping JSON write to", path)
    return(invisible(NULL))
  }
  ensure_dir(dirname(path))
  jsonlite::write_json(obj, path, pretty = pretty, auto_unbox = unbox)
  if (exists("log_info")) log_info("JSON written:", path)
  invisible(path)
}

#' Read a JSON file into an R object (requires jsonlite)
#'
#' @param path   Input file path
#' @param simple Simplify vectors/data-frames (default TRUE)
#' @return Parsed object, or NULL on failure
read_json_safe <- function(path, simple = TRUE) {
  if (!requireNamespace("jsonlite", quietly = TRUE)) {
    if (exists("log_warn")) log_warn("jsonlite not available — cannot read", path)
    return(invisible(NULL))
  }
  if (!file.exists(path)) {
    if (exists("log_warn")) log_warn("JSON file not found:", path)
    return(invisible(NULL))
  }
  jsonlite::fromJSON(path, simplifyVector = simple)
}

# --------------------------------------------------------------------------- #
# CSV
# --------------------------------------------------------------------------- #

#' Write a data frame to CSV
#'
#' @param df   Data frame
#' @param path Output file path
#' @param ...  Additional arguments to write.csv
#' @return Invisible path
write_csv_safe <- function(df, path, ...) {
  ensure_dir(dirname(path))
  write.csv(df, path, row.names = FALSE, ...)
  if (exists("log_info")) log_info("CSV written:", path)
  invisible(path)
}

#' Read a CSV into a data frame
#'
#' @param path Input file path
#' @param ...  Additional arguments to read.csv
#' @return Data frame, or NULL if file missing
read_csv_safe <- function(path, ...) {
  if (!file.exists(path)) {
    if (exists("log_warn")) log_warn("CSV file not found:", path)
    return(invisible(NULL))
  }
  read.csv(path, stringsAsFactors = FALSE, ...)
}

# --------------------------------------------------------------------------- #
# Plain text / reports
# --------------------------------------------------------------------------- #

#' Append lines to a text file (creates file if absent)
#'
#' @param lines Character vector of lines to append
#' @param path  Output file path
#' @return Invisible path
append_lines <- function(lines, path) {
  ensure_dir(dirname(path))
  cat(paste(lines, collapse = "\n"), "\n", file = path, append = TRUE)
  invisible(path)
}

#' Write lines to a text file (overwrites)
#'
#' @param lines Character vector of lines
#' @param path  Output file path
#' @return Invisible path
write_lines_safe <- function(lines, path) {
  ensure_dir(dirname(path))
  writeLines(lines, con = path)
  if (exists("log_info")) log_info("Text written:", path)
  invisible(path)
}
