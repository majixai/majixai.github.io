# session_raid_stats.R — R port of the Session Raid Stats Pine Script indicator
# ==============================================================================
# Tracks up to three intraday sessions, detects range-extension raids, buckets
# raid sizes, and computes empirical reach-probabilities for each level.
#
# Dependencies: base R only (no external packages required).
#
# Usage:
#   source("session_raid_stats.R")
#   cfg <- session_config("02:00", "02:15", min_raid_pts = 5.0, cutoff_mins = 120,
#                          bucket_start = 20.0, bucket_step = 10.0)
#   engine <- raid_engine(cfg)
#   for (i in seq_len(nrow(bars))) {
#     engine$on_bar(bars$time_ms[i], bars$open[i], bars$high[i], bars$low[i], bars$close[i])
#   }
#   stats <- engine$get_stats()
#   print(stats$prob_hi)

MAX_BUCKETS <- 6L
BC          <- MAX_BUCKETS + 1L   # 7 buckets: 0..5 + overflow

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

session_config <- function(session_start, session_end,
                            min_raid_pts  = 5.0,
                            cutoff_mins   = 120L,
                            bucket_start  = 20.0,
                            bucket_step   = 10.0,
                            tz_offset_hrs = -5.0) {
  level_pts <- function(n) bucket_start + (n - 1L) * bucket_step
  list(
    session_start  = session_start,
    session_end    = session_end,
    min_raid_pts   = min_raid_pts,
    cutoff_mins    = as.integer(cutoff_mins),
    bucket_start   = bucket_start,
    bucket_step    = bucket_step,
    tz_offset_hrs  = tz_offset_hrs,
    levels         = sapply(1:MAX_BUCKETS, level_pts)
  )
}

# ---------------------------------------------------------------------------
# Bucket helpers
# ---------------------------------------------------------------------------

bucket_index <- function(value, cfg) {
  lvls <- cfg$levels
  for (i in seq_len(MAX_BUCKETS - 1L)) {
    if (value < lvls[i + 1L]) return(i - 1L)   # 0-based
  }
  if (value < lvls[MAX_BUCKETS] + cfg$bucket_step) return(MAX_BUCKETS - 1L)
  return(MAX_BUCKETS)   # overflow
}

cumulative_counts <- function(counts) {
  n   <- length(counts)
  cum <- integer(n)
  running <- 0L
  for (i in n:1L) {
    running <- running + counts[i]
    cum[i]  <- running
  }
  cum
}

update_prob_cache <- function(hi_counts, lo_counts, day_count, cache_hi, cache_lo) {
  if (day_count <= 0L) return(list(hi = cache_hi, lo = cache_lo))
  cum_h <- cumulative_counts(hi_counts)
  cum_l <- cumulative_counts(lo_counts)
  list(
    hi = cum_h / day_count * 100.0,
    lo = cum_l / day_count * 100.0
  )
}

# ---------------------------------------------------------------------------
# Session time helpers
# ---------------------------------------------------------------------------

.parse_hhmm <- function(s) {
  parts <- strsplit(s, ":")[[1L]]
  list(h = as.integer(parts[1L]), m = as.integer(parts[2L]))
}

.bar_local_time <- function(time_ms, tz_offset_hrs) {
  utc_sec   <- time_ms / 1000.0
  local_sec <- utc_sec + tz_offset_hrs * 3600.0
  as.POSIXct(local_sec, origin = "1970-01-01", tz = "UTC")
}

.in_session <- function(time_ms, cfg) {
  dt   <- .bar_local_time(time_ms, cfg$tz_offset_hrs)
  h    <- as.integer(format(dt, "%H"))
  m    <- as.integer(format(dt, "%M"))
  mins <- h * 60L + m
  s    <- .parse_hhmm(cfg$session_start)
  e    <- .parse_hhmm(cfg$session_end)
  s_m  <- s$h * 60L + s$m
  e_m  <- e$h * 60L + e$m
  mins >= s_m && mins < e_m
}

.within_cutoff <- function(time_ms, range_end_ms, cutoff_mins) {
  if (cutoff_mins == 0L) return(TRUE)
  (time_ms - range_end_ms) <= cutoff_mins * 60000L
}

# ---------------------------------------------------------------------------
# Engine factory (returns a closure with mutable state)
# ---------------------------------------------------------------------------

raid_engine <- function(cfg, max_days = 500L) {
  # Mutable state stored in the closure environment
  st <- new.env(parent = emptyenv())
  st$hi        <- NA_real_
  st$lo        <- NA_real_
  st$end_ms    <- NA_integer_
  st$active    <- FALSE
  st$hi_max    <- NA_real_
  st$hi_touch  <- FALSE
  st$hi_conf   <- FALSE
  st$hi_pts    <- NA_real_
  st$lo_min    <- NA_real_
  st$lo_touch  <- FALSE
  st$lo_conf   <- FALSE
  st$lo_pts    <- NA_real_
  st$cut_exp   <- FALSE

  hi_counts    <- integer(BC)
  lo_counts    <- integer(BC)
  prob_hi      <- double(BC)
  prob_lo      <- double(BC)
  day_count    <- 0L
  prev_in_s    <- FALSE

  on_bar <- function(time_ms, open_, high, low, close) {
    in_s <- .in_session(time_ms, cfg)

    # Session open — reset state
    if (in_s && !prev_in_s) {
      st$hi      <<- high;  st$lo <- low
      st$end_ms  <<- NA;    st$active <- FALSE
      st$hi_max  <<- NA;    st$hi_touch <- FALSE
      st$hi_conf <<- FALSE; st$hi_pts <- NA
      st$lo_min  <<- NA;    st$lo_touch <- FALSE
      st$lo_conf <<- FALSE; st$lo_pts <- NA
      st$cut_exp <<- FALSE
    }

    # Expand range during session
    if (in_s && !is.na(st$hi)) {
      st$hi <<- max(st$hi, high)
      st$lo <<- min(st$lo, low)
    }

    # Session close — activate raid detection
    if (!in_s && prev_in_s && !is.na(st$hi)) {
      st$end_ms <<- time_ms
      st$active <<- TRUE
      if (day_count < max_days) day_count <<- day_count + 1L
    }

    # Raid detection
    if (st$active && !is.na(st$end_ms)) {
      if (.within_cutoff(time_ms, st$end_ms, cfg$cutoff_mins)) {
        # High-side
        if (high > st$hi) {
          ext <- high - st$hi
          if (ext >= cfg$min_raid_pts) {
            if (is.na(st$hi_max) || high > st$hi_max) {
              st$hi_max   <<- high
              st$hi_pts   <<- ext
              st$hi_touch <<- TRUE
            }
          }
        }
        # Low-side
        if (low < st$lo) {
          ext <- st$lo - low
          if (ext >= cfg$min_raid_pts) {
            if (is.na(st$lo_min) || low < st$lo_min) {
              st$lo_min   <<- low
              st$lo_pts   <<- ext
              st$lo_touch <<- TRUE
            }
          }
        }
      } else if (!st$cut_exp) {
        if (st$hi_touch && !is.na(st$hi_pts)) {
          idx <- bucket_index(st$hi_pts, cfg) + 1L   # 1-based for R
          hi_counts[idx] <<- hi_counts[idx] + 1L
          st$hi_conf <<- TRUE
        }
        if (st$lo_touch && !is.na(st$lo_pts)) {
          idx <- bucket_index(st$lo_pts, cfg) + 1L
          lo_counts[idx] <<- lo_counts[idx] + 1L
          st$lo_conf <<- TRUE
        }
        cache <- update_prob_cache(hi_counts, lo_counts, day_count, prob_hi, prob_lo)
        prob_hi <<- cache$hi
        prob_lo <<- cache$lo
        st$cut_exp <<- TRUE
      }
    }
    prev_in_s <<- in_s
  }

  get_stats <- function() {
    list(prob_hi = prob_hi, prob_lo = prob_lo, day_count = day_count)
  }

  list(on_bar = on_bar, get_stats = get_stats)
}

# ---------------------------------------------------------------------------
# Three-session facade
# ---------------------------------------------------------------------------

session_raid_stats <- function(cfg1, cfg2, cfg3, max_days = 500L) {
  e1 <- raid_engine(cfg1, max_days)
  e2 <- raid_engine(cfg2, max_days)
  e3 <- raid_engine(cfg3, max_days)

  list(
    on_bar = function(t, o, h, l, c) {
      e1$on_bar(t, o, h, l, c)
      e2$on_bar(t, o, h, l, c)
      e3$on_bar(t, o, h, l, c)
    },
    stats = function() list(r1 = e1$get_stats(), r2 = e2$get_stats(), r3 = e3$get_stats())
  )
}

# ---------------------------------------------------------------------------
# Quick self-test
# ---------------------------------------------------------------------------

if (!interactive()) {
  set.seed(42L)
  cfg <- session_config("02:00", "02:15", min_raid_pts = 5.0, cutoff_mins = 120L,
                         bucket_start = 20.0, bucket_step = 10.0)
  eng <- raid_engine(cfg, max_days = 100L)

  # 2024-01-02 07:00 UTC = 02:00 ET
  base_ms  <- 1704182400000
  ms_min   <- 60000L
  price    <- 4500.0

  for (day in 0:4) {
    day_off <- day * 24L * 60L * ms_min
    for (minute in 0:(8 * 60 - 1)) {
      t  <- base_ms + day_off + minute * ms_min
      o  <- price
      h  <- o + runif(1, 0, 4)
      l  <- o - runif(1, 0, 4)
      c  <- runif(1, l, h)
      price <- c
      eng$on_bar(t, o, h, l, c)
    }
  }

  s <- eng$get_stats()
  cat("Day count:", s$day_count, "\n")
  cat("prob_hi  :", paste0(round(s$prob_hi, 1), "%", collapse = " "), "\n")
  cat("prob_lo  :", paste0(round(s$prob_lo, 1), "%", collapse = " "), "\n")
}
