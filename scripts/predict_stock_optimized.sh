#!/usr/bin/env bash
# =============================================================================
# predict_stock_optimized.sh — Optimised Bash stock-prediction pipeline
# =============================================================================
#
# DESCRIPTION
#   Fetches daily adjusted-close prices via an embedded Python/yfinance step,
#   then hands the CSV to a SINGLE awk program that computes all indicators and
#   writes JSON + text outputs without spawning additional subshells.
#
# ALGORITHMIC CHOICES
#   * Linear regression  — two-pass, mean-centred (numerically stable; avoids
#     catastrophic cancellation in ΣxΣy/n).  Both passes are O(N).
#   * EMA                — standard streaming formula in O(N), O(1) extra space.
#   * SMA(k)             — O(k) pass over the last k elements of the stored array.
#   * R²                 — computed in a third O(N) pass over the stored array.
#
# TIME COMPLEXITY  : O(N) — three linear passes over N ≤ --days rows.
# SPACE COMPLEXITY : O(N) — one price array A[1..N] + one date array DATE[1..N].
#                    N defaults to 120, bounded by --days.  Script warns if
#                    N exceeds MAX_N (10 000) and suggests reducing --days.
#
# REQUIREMENTS
#   * gawk (or awk with double-precision support) — detected at startup.
#   * jq   — used ONLY once to validate/pretty-print final JSON (optional; if
#             absent the raw printf output is used directly).
#   * Python 3 + yfinance — required for live data fetch (skipped with --input-csv).
#
# FALLBACK
#   If jq is not found the script continues and writes awk printf output directly.
#   The original Alpha Vantage script is at scripts/predict_stock.sh.
#
# USAGE
#   ./predict_stock_optimized.sh --symbol AAPL [--out-dir artifacts] [--days 120]
#   ./predict_stock_optimized.sh --symbol TEST --input-csv path/to/data.csv
#
# INPUT CSV FORMAT (for --input-csv)
#   Header: Date,adj_close
#   Rows  : YYYY-MM-DD,<price>
#
# DISCLAIMER: Illustrative pipeline — NOT financial advice.

set -euo pipefail
IFS=$'\n\t'

# ── Defaults ──────────────────────────────────────────────────────────────────
SYMBOL=""
OUT_DIR="./"
DAYS=120
INPUT_CSV=""        # optional; bypasses network fetch (used by tests)
MAX_N=10000         # warn threshold

# ── Help ──────────────────────────────────────────────────────────────────────
print_usage() {
  cat <<'EOF'
Usage: predict_stock_optimized.sh --symbol SYMBOL [OPTIONS]

Options:
  --symbol    SYMBOL    Ticker symbol (e.g. AAPL). Required.
  --out-dir   DIR       Output directory (default: ./)
  --days      N         Days of history to fetch/use (default: 120)
  --input-csv FILE      Use local CSV instead of fetching (for testing)
  -h, --help            Show this help
EOF
}

# ── Argument parsing ──────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --symbol)    SYMBOL="$2";    shift 2 ;;
    --out-dir)   OUT_DIR="$2";   shift 2 ;;
    --days)      DAYS="$2";      shift 2 ;;
    --input-csv) INPUT_CSV="$2"; shift 2 ;;
    -h|--help)   print_usage; exit 0   ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; print_usage; exit 2 ;;
  esac
done

if [[ -z "${SYMBOL}" ]]; then
  printf 'Error: --symbol is required\n' >&2
  print_usage
  exit 2
fi

# Validate DAYS is a positive integer
if ! [[ "${DAYS}" =~ ^[1-9][0-9]*$ ]]; then
  printf 'Error: --days must be a positive integer (got: %s)\n' "${DAYS}" >&2
  exit 2
fi

# ── Tool detection ────────────────────────────────────────────────────────────
AWK_CMD=""
if command -v gawk &>/dev/null; then
  AWK_CMD="gawk"
elif awk 'BEGIN{x=1.5/3.0; exit(x!=0.5)}' 2>/dev/null; then
  AWK_CMD="awk"
else
  printf 'Error: gawk or awk with double-precision support is required\n' >&2
  exit 3
fi

JQ_CMD=""
if command -v jq &>/dev/null; then
  JQ_CMD="jq"
fi

# ── Setup temp dir with cleanup ───────────────────────────────────────────────
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

CSV_FILE="${TMP_DIR}/${SYMBOL}_daily.csv"
RESULT_JSON="${OUT_DIR}/${SYMBOL}_prediction.json"
RESULT_TXT="${OUT_DIR}/${SYMBOL}_prediction.txt"

mkdir -p "${OUT_DIR}"

# ── Data acquisition ──────────────────────────────────────────────────────────
if [[ -n "${INPUT_CSV}" ]]; then
  # Testing path — use provided CSV directly (no network required)
  if [[ ! -f "${INPUT_CSV}" ]]; then
    printf 'Error: --input-csv file not found: %s\n' "${INPUT_CSV}" >&2
    exit 4
  fi
  cp "${INPUT_CSV}" "${CSV_FILE}"
else
  # Live path — embedded Python/yfinance fetch (one subprocess)
  if ! command -v python3 &>/dev/null; then
    printf 'Error: python3 is required for live data fetch\n' >&2
    exit 3
  fi
  printf 'Fetching %s days of data for %s via yfinance…\n' "${DAYS}" "${SYMBOL}"
  python3 - "${SYMBOL}" "${DAYS}" > "${CSV_FILE}" <<'PYEOF'
import sys
import yfinance as yf  # pip install yfinance

symbol = sys.argv[1]
days   = int(sys.argv[2])

ticker = yf.Ticker(symbol)
# Request slightly more than DAYS calendar days to cover weekends/holidays
hist = ticker.history(period=f"{days}d")
if hist is None or hist.empty:
    print(f"ERROR: no data returned for {symbol}", file=sys.stderr)
    sys.exit(1)

hist.index = hist.index.strftime('%Y-%m-%d')
print("Date,adj_close")
for date_str, row in hist.iterrows():
    close_val = row.get('Close', row.iloc[0])
    print(f"{date_str},{close_val:.6f}")
PYEOF

  if [[ ! -s "${CSV_FILE}" ]]; then
    printf 'Error: empty CSV received for %s\n' "${SYMBOL}" >&2
    exit 5
  fi
fi

# ── Single awk invocation — all numeric work ──────────────────────────────────
# Complexity: O(N) time (3 passes over stored array), O(N) space for A[] + DATE[].
# No tac, no mapfile, no repeated awk calls.
"${AWK_CMD}" \
  -v symbol="${SYMBOL}" \
  -v max_n="${MAX_N}" \
  -v json_out="${RESULT_JSON}" \
  -v txt_out="${RESULT_TXT}" \
  -F',' \
'
# ── Row ingestion ────────────────────────────────────────────────────────────
NR == 1 { next }   # skip header
NF < 2  { next }   # skip malformed lines
{
    v = $2 + 0
    if (v <= 0) next    # skip non-positive prices
    n++
    DATE[n] = $1
    A[n]    = v
    if (n == max_n + 1) {
        print "WARNING: row count exceeded " max_n "; consider reducing --days" \
              > "/dev/stderr"
    }
}

# ── Numeric engine (END block, three O(N) passes) ────────────────────────────
END {
    if (n < 5) {
        print "ERROR: insufficient data (n=" n "; need >= 5)" > "/dev/stderr"
        exit 1
    }

    # ── Pass 1: means ────────────────────────────────────────────────────────
    sum_y = 0
    for (i = 1; i <= n; i++) sum_y += A[i]
    mean_y = sum_y / n
    mean_x = (n + 1.0) / 2.0     # exact mean of 1..n

    # ── Pass 2: regression sums (mean-centred for numerical stability) ────────
    ss_xy = 0; ss_xx = 0
    for (i = 1; i <= n; i++) {
        dx     = i - mean_x
        ss_xy += dx * (A[i] - mean_y)
        ss_xx += dx * dx
    }
    slope     = (ss_xx == 0) ? 0 : ss_xy / ss_xx
    intercept = mean_y - slope * mean_x
    pred      = slope * (n + 1) + intercept

    # ── Pass 3: R² ──────────────────────────────────────────────────────────
    ss_tot = 0; ss_res = 0
    for (i = 1; i <= n; i++) {
        y_hat   = slope * i + intercept
        ss_tot += (A[i] - mean_y) ^ 2
        ss_res += (A[i] - y_hat) ^ 2
    }
    r2 = (ss_tot == 0) ? 1.0 : 1.0 - ss_res / ss_tot

    # ── EMA (streaming, O(N), O(1) extra space) ──────────────────────────────
    alpha10 = 2.0 / (10.0 + 1.0)
    alpha20 = 2.0 / (20.0 + 1.0)
    ema10   = A[1]
    ema20   = A[1]
    for (i = 2; i <= n; i++) {
        ema10 = alpha10 * A[i] + (1.0 - alpha10) * ema10
        ema20 = alpha20 * A[i] + (1.0 - alpha20) * ema20
    }

    # ── SMA (last k elements) ────────────────────────────────────────────────
    sma5 = 0;  k5  = (n >= 5)  ? 5  : n
    sma10 = 0; k10 = (n >= 10) ? 10 : n
    sma20 = 0; k20 = (n >= 20) ? 20 : n
    for (i = n - k5  + 1; i <= n; i++) sma5  += A[i]
    for (i = n - k10 + 1; i <= n; i++) sma10 += A[i]
    for (i = n - k20 + 1; i <= n; i++) sma20 += A[i]
    sma5  /= k5
    sma10 /= k10
    sma20 /= k20

    last_date  = DATE[n]
    last_close = A[n]

    # ── Emit JSON (no jq subprocess needed) ─────────────────────────────────
    printf "{\n"                                                    > json_out
    printf "  \"symbol\": \"%s\",\n",         symbol              >> json_out
    printf "  \"last_date\": \"%s\",\n",      last_date           >> json_out
    printf "  \"last_close\": %.6f,\n",       last_close          >> json_out
    printf "  \"data_points\": %d,\n",        n                   >> json_out
    printf "  \"indicators\": {\n"                                 >> json_out
    printf "    \"sma5\":  %.6f,\n",          sma5                >> json_out
    printf "    \"sma10\": %.6f,\n",          sma10               >> json_out
    printf "    \"sma20\": %.6f,\n",          sma20               >> json_out
    printf "    \"ema10\": %.6f,\n",          ema10               >> json_out
    printf "    \"ema20\": %.6f\n",           ema20               >> json_out
    printf "  },\n"                                                >> json_out
    printf "  \"linear_regression\": {\n"                          >> json_out
    printf "    \"predicted_next_close\": %.6f,\n", pred          >> json_out
    printf "    \"slope\": %.8f,\n",          slope               >> json_out
    printf "    \"intercept\": %.8f,\n",      intercept           >> json_out
    printf "    \"r_squared\": %.6f\n",       r2                  >> json_out
    printf "  }\n"                                                 >> json_out
    printf "}\n"                                                   >> json_out

    # ── Emit human-readable text report ──────────────────────────────────────
    printf "Symbol:           %s\n",    symbol                     > txt_out
    printf "Data points used: %d\n",   n                          >> txt_out
    printf "Last date:        %s\n",   last_date                  >> txt_out
    printf "Last close:       %.6f\n", last_close                 >> txt_out
    printf "\nIndicators:\n"                                       >> txt_out
    printf "  SMA(5):  %.6f\n",  sma5                             >> txt_out
    printf "  SMA(10): %.6f\n",  sma10                            >> txt_out
    printf "  SMA(20): %.6f\n",  sma20                            >> txt_out
    printf "  EMA(10): %.6f\n",  ema10                            >> txt_out
    printf "  EMA(20): %.6f\n",  ema20                            >> txt_out
    printf "\nLinear regression (next day prediction):\n"          >> txt_out
    printf "  Predicted next close: %.6f\n", pred                 >> txt_out
    printf "  Slope:                %.8f\n", slope                >> txt_out
    printf "  Intercept:            %.8f\n", intercept            >> txt_out
    printf "  R^2:                  %.6f\n", r2                   >> txt_out
    printf "\nNOTE: Illustrative only — not financial advice.\n"   >> txt_out
}
' "${CSV_FILE}"

# ── Optional: pretty-print JSON with jq (single call) ────────────────────────
if [[ -n "${JQ_CMD}" ]]; then
  PRETTY_TMP="${TMP_DIR}/pretty.json"
  "${JQ_CMD}" . "${RESULT_JSON}" > "${PRETTY_TMP}" && mv "${PRETTY_TMP}" "${RESULT_JSON}"
fi

# ── Copy raw CSV to output directory ─────────────────────────────────────────
cp "${CSV_FILE}" "${OUT_DIR}/${SYMBOL}_daily.csv"

printf 'Outputs written to %s\n' "${OUT_DIR}"
printf '  JSON : %s\n' "${RESULT_JSON}"
printf '  Text : %s\n' "${RESULT_TXT}"
printf '  CSV  : %s/%s_daily.csv\n' "${OUT_DIR}" "${SYMBOL}"
