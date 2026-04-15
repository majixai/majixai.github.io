# rlang — R Language Processing Hub

Central directory for managing **R-language processing** across every directory in this repository.

## Directory Structure

```
rlang/
├── runner.R           # Central dispatcher — discovers & runs all *.R scripts
├── lib/
│   ├── utils.R        # Shared utilities (logging, timing, env helpers)
│   ├── finance.R      # Shared quantitative-finance functions
│   └── io.R           # Shared I/O helpers (JSON, CSV, plain text)
└── runner_results.json  # Auto-generated run results (git-ignored)
```

## Quick Start

### Run all R scripts in the repo
```bash
Rscript rlang/runner.R
```

### Dry-run (list scripts without executing)
```bash
RLANG_DRY_RUN=1 Rscript rlang/runner.R
```

### Limit to specific directories
```bash
RLANG_DIRS=dji_1pm_close:sp_monte_carlo Rscript rlang/runner.R
```

### Increase verbosity
```bash
RLANG_LOG_LEVEL=DEBUG Rscript rlang/runner.R
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `RLANG_DIRS` | *(all)* | Colon-separated list of directories to scan |
| `RLANG_PATTERN` | `\.R$` | Regex to match R script filenames |
| `RLANG_EXCLUDE` | `rlang/` | Colon-separated paths to skip (relative to repo root) |
| `RLANG_DRY_RUN` | `0` | Set to `1` to list scripts without running |
| `RLANG_TIMEOUT` | `300` | Per-script timeout in seconds |
| `RLANG_LOG_LEVEL` | `INFO` | `DEBUG` \| `INFO` \| `WARN` \| `ERROR` |

## Using the Shared Library in Your Own Scripts

Source the helpers at the top of any R script in the repo:

```r
# Determine rlang root relative to this script's location
.rlang_root <- file.path(
  normalizePath(dirname(sys.frame(1)$ofile), mustWork = FALSE),
  "..", "rlang"          # adjust depth as needed
)
source(file.path(.rlang_root, "lib", "utils.R"))
source(file.path(.rlang_root, "lib", "finance.R"))
source(file.path(.rlang_root, "lib", "io.R"))
```

### `lib/utils.R` highlights
- `log_debug()`, `log_info()`, `log_warn()`, `log_error()` — levelled logging
- `timed(expr)` — execute and measure wall-clock time
- `env_or(var, default)`, `env_num()`, `env_int()` — typed env-variable reads
- `ensure_dir(path)` — create directory recursively if needed
- `banner(title)` — print a formatted section header

### `lib/finance.R` highlights
- `gbm_path()` — Geometric Brownian Motion path
- `ou_path()` — Ornstein-Uhlenbeck mean-reverting path
- `jump_diffusion_path()` — Merton jump-diffusion
- `mc_antithetic()`, `mc_stratified()` — variance-reduction Monte Carlo
- `bs_greeks()` — Black-Scholes call price + full Greeks
- `taylor_price()` — log-price Taylor-series approximation
- `conf_interval()` — confidence interval helper

### `lib/io.R` highlights
- `write_json_safe()`, `read_json_safe()` — JSON via jsonlite (graceful fallback)
- `write_csv_safe()`, `read_csv_safe()` — CSV read/write
- `write_lines_safe()`, `append_lines()` — plain-text output

## GitHub Actions

The workflow `.github/workflows/rlang.yml` runs the dispatcher automatically:
- **On push** to any branch when R files change
- **On pull request** targeting `main`
- **On schedule** (daily at 06:00 UTC)
- **Manually** via `workflow_dispatch`

## Adding a New R Script

1. Create your `*.R` file anywhere in the repository.
2. Optionally source the shared library (see above).
3. The runner will discover and execute it automatically on the next run.

## Output

After each run, `rlang/runner_results.json` is written with per-script status,
elapsed time, and any error codes.
