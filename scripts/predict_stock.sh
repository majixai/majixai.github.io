#!/usr/bin/env bash
# predict_stock.sh — Bash pipeline: fetch daily adjusted close prices via Alpha Vantage,
# compute SMA/EMA indicators, run least-squares linear regression, emit JSON + text report.
#
# USAGE:
#   ./predict_stock.sh --symbol SYMBOL [--out-dir DIR] [--days N]
#
# REQUIREMENTS:
#   curl, awk, jq   available in standard GitHub runners.
#   ALPHAVANTAGE_API_KEY set as a repository secret (or AV_API_KEY env var).
#
# DISCLAIMER: Illustrative pipeline only — not financial advice.
# NOTE: This is the original/fallback script. For the optimised version see
#       predict_stock_optimized.sh (yfinance-based, single-awk numeric engine).

set -euo pipefail
IFS=$'\n\t'

# ── Defaults ────────────────────────────────────────────────────────────────
SYMBOL=""
OUT_DIR="./"
DAYS=120
AV_KEY="${ALPHAVANTAGE_API_KEY:-${AV_API_KEY:-}}"

# ── Help ─────────────────────────────────────────────────────────────────────
print_usage() {
  cat <<'EOF'
Usage: predict_stock.sh --symbol SYMBOL [--out-dir DIR] [--days N]

Options:
  --symbol SYMBOL   Ticker symbol (e.g., AAPL). Required.
  --out-dir DIR     Directory to write outputs. Default: ./
  --days N          Number of trading days to use (default: 120)
  -h, --help        Show this help
EOF
}

# ── Argument parsing ─────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case "$1" in
    --symbol)  SYMBOL="$2";  shift 2 ;;
    --out-dir) OUT_DIR="$2"; shift 2 ;;
    --days)    DAYS="$2";    shift 2 ;;
    -h|--help) print_usage; exit 0   ;;
    *) printf 'Unknown argument: %s\n' "$1" >&2; print_usage; exit 2 ;;
  esac
done

if [[ -z "${SYMBOL}" ]]; then
  printf 'Error: --symbol is required\n' >&2
  print_usage
  exit 2
fi

if [[ -z "${AV_KEY}" ]]; then
  printf 'Error: No Alpha Vantage API key. Set ALPHAVANTAGE_API_KEY or AV_API_KEY.\n' >&2
  exit 3
fi

# ── Setup ────────────────────────────────────────────────────────────────────
mkdir -p "${OUT_DIR}"
TMP_DIR="$(mktemp -d)"
cleanup() { rm -rf "${TMP_DIR}"; }
trap cleanup EXIT

CSV_FILE="${TMP_DIR}/${SYMBOL}_daily.csv"
RESULT_JSON="${OUT_DIR}/${SYMBOL}_prediction.json"
RESULT_TXT="${OUT_DIR}/${SYMBOL}_prediction.txt"

# ── Fetch CSV from Alpha Vantage ─────────────────────────────────────────────
printf 'Fetching CSV for %s from Alpha Vantage…\n' "${SYMBOL}"
AV_URL="https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED"
AV_URL="${AV_URL}&symbol=${SYMBOL}&outputsize=compact&datatype=csv&apikey=${AV_KEY}"
if ! curl -sSf "${AV_URL}" -o "${CSV_FILE}"; then
  printf 'Error: failed to fetch data for %s\n' "${SYMBOL}" >&2
  exit 4
fi

# ── Parse: keep timestamp + adjusted_close (col 6), reverse to oldest-first ──
# CSV: timestamp,open,high,low,close,adjusted_close,volume,dividend_amount,split_coefficient
awk -F, 'NR==1{print "Date,adj_close"; next} {print $1","$6}' "${CSV_FILE}" \
  > "${TMP_DIR}/date_close.csv"

# Reverse data lines so oldest is first, re-attach header
{
  head -n1 "${TMP_DIR}/date_close.csv"
  tail -n +2 "${TMP_DIR}/date_close.csv" | tac
} > "${TMP_DIR}/ordered.csv"

# Validate row count
DATA_LINES="$(awk 'NR>1{c++} END{print c+0}' "${TMP_DIR}/ordered.csv")"
if (( DATA_LINES < 10 )); then
  printf 'Error: insufficient data (%d rows). Exiting.\n' "${DATA_LINES}" >&2
  exit 5
fi

# Keep only the last DAYS data rows
{
  head -n1 "${TMP_DIR}/ordered.csv"
  tail -n "${DAYS}" "${TMP_DIR}/ordered.csv"
} > "${TMP_DIR}/analysis.csv"

# ── Load into bash arrays ─────────────────────────────────────────────────────
mapfile -t DATES  < <(awk -F, 'NR>1{print $1}' "${TMP_DIR}/analysis.csv")
mapfile -t PRICES < <(awk -F, 'NR>1{print $2}' "${TMP_DIR}/analysis.csv")

N="${#PRICES[@]}"
if (( N < 10 )); then
  printf 'Error: insufficient data after trim (N=%d)\n' "${N}" >&2
  exit 6
fi

# ── SMA helper (last k elements, awk for arithmetic) ─────────────────────────
sma_last_k() {
  local k="$1"
  local start
  start=$(( N - k ))
  (( start < 0 )) && start=0
  local slice=("${PRICES[@]:${start}}")
  printf '%s\n' "${slice[@]}" \
    | awk '{s+=$1} END{printf "%.6f", s/NR}'
}

# ── EMA helper (streaming alpha) ─────────────────────────────────────────────
ema_last_alpha() {
  local alpha="$1"
  printf '%s\n' "${PRICES[@]}" \
    | awk -v a="${alpha}" '
      NR==1 { ema=$1+0; next }
      { ema = a*($1+0) + (1-a)*ema }
      END { printf "%.6f", ema }'
}

# ── Linear regression via awk ─────────────────────────────────────────────────
linear_regression_predict() {
  printf '%s\n' "${PRICES[@]}" \
    | awk -v n="${N}" '
      { A[NR]=$1+0 }
      END {
        sum_y=0
        for(i=1;i<=n;i++) sum_y+=A[i]
        mean_y=sum_y/n
        mean_x=(n+1)/2.0
        ss_xy=0; ss_xx=0
        for(i=1;i<=n;i++){
          dx=i-mean_x
          ss_xy+=dx*(A[i]-mean_y)
          ss_xx+=dx*dx
        }
        slope = (ss_xx==0) ? 0 : ss_xy/ss_xx
        intercept = mean_y - slope*mean_x
        ss_tot=0; ss_res=0
        for(i=1;i<=n;i++){
          yh=slope*i+intercept
          ss_tot+=(A[i]-mean_y)^2
          ss_res+=(A[i]-yh)^2
        }
        r2 = (ss_tot==0) ? 0 : 1-ss_res/ss_tot
        pred = slope*(n+1)+intercept
        printf "%.6f %.8f %.8f %.6f\n", pred, slope, intercept, r2
      }'
}

# ── Compute indicators ────────────────────────────────────────────────────────
SMA_5="$(sma_last_k 5)"
SMA_10="$(sma_last_k 10)"
SMA_20="$(sma_last_k 20)"
EMA_10="$(ema_last_alpha 0.18181818)"   # alpha = 2/(10+1)
EMA_20="$(ema_last_alpha 0.09523810)"   # alpha = 2/(20+1)

read -r PRED SLOPE INTERCEPT R2 <<< "$(linear_regression_predict)"

LAST_DATE="${DATES[$((N-1))]}"
LAST_CLOSE="${PRICES[$((N-1))]}"

# ── Text report ───────────────────────────────────────────────────────────────
cat > "${RESULT_TXT}" <<EOF
Symbol:           ${SYMBOL}
Data points used: ${N}
Last date:        ${LAST_DATE}
Last close:       ${LAST_CLOSE}

Indicators:
  SMA(5):  ${SMA_5}
  SMA(10): ${SMA_10}
  SMA(20): ${SMA_20}
  EMA(10): ${EMA_10}
  EMA(20): ${EMA_20}

Linear regression (next day prediction):
  Predicted next close: ${PRED}
  Slope:                ${SLOPE}
  Intercept:            ${INTERCEPT}
  R^2:                  ${R2}

NOTE: Illustrative only — not financial advice.
EOF

# ── JSON report via jq ────────────────────────────────────────────────────────
jq -n \
  --arg     symbol      "${SYMBOL}" \
  --arg     last_date   "${LAST_DATE}" \
  --argjson last_close  "${LAST_CLOSE}" \
  --argjson data_points "${N}" \
  --argjson sma5        "${SMA_5}" \
  --argjson sma10       "${SMA_10}" \
  --argjson sma20       "${SMA_20}" \
  --argjson ema10       "${EMA_10}" \
  --argjson ema20       "${EMA_20}" \
  --argjson pred        "${PRED}" \
  --argjson slope       "${SLOPE}" \
  --argjson intercept   "${INTERCEPT}" \
  --argjson r2          "${R2}" \
  '{
    symbol:       $symbol,
    last_date:    $last_date,
    last_close:   $last_close,
    data_points:  $data_points,
    indicators: {
      sma5:  $sma5,
      sma10: $sma10,
      sma20: $sma20,
      ema10: $ema10,
      ema20: $ema20
    },
    linear_regression: {
      predicted_next_close: $pred,
      slope:                $slope,
      intercept:            $intercept,
      r_squared:            $r2
    },
    generated_at: (now | todate)
  }' > "${RESULT_JSON}"

# ── Copy raw CSV to output dir ────────────────────────────────────────────────
cp "${CSV_FILE}" "${OUT_DIR}/"

printf 'Done. Outputs written to %s\n' "${OUT_DIR}"
