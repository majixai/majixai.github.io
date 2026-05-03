#!/usr/bin/env bash
# =============================================================================
# tests/bash/test_predict_opt.sh — unit/regression tests for predict_stock_optimized.sh
# =============================================================================
#
# USAGE
#   bash tests/bash/test_predict_opt.sh
#
# REQUIREMENTS
#   gawk (or awk with double-precision), jq
#   No network access required — uses local CSV fixtures.
#
# EXIT CODE
#   0 — all tests passed
#   1 — one or more tests failed

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"
SCRIPT="${REPO_ROOT}/scripts/predict_stock_optimized.sh"
FIXTURES="${SCRIPT_DIR}/fixtures"

TMP_OUT="$(mktemp -d)"
cleanup() { rm -rf "${TMP_OUT}"; }
trap cleanup EXIT

PASS=0
FAIL=0
FIXTURE_JSON=""   # set by run_fixture

# ── Helpers ───────────────────────────────────────────────────────────────────
ok() {
  PASS=$((PASS + 1))
  printf '  PASS: %s\n' "$1"
}

fail() {
  FAIL=$((FAIL + 1))
  printf '  FAIL: %s\n' "$1" >&2
}

assert_json_key() {
  local json="$1" key="$2"
  if jq -e "${key}" "${json}" > /dev/null 2>&1; then
    ok "key ${key} present"
  else
    fail "key ${key} missing in ${json}"
  fi
}

assert_gt() {
  local label="$1" a="$2" b="$3"
  if awk "BEGIN { exit (${a} > ${b}) ? 0 : 1 }"; then
    ok "${label}: ${a} > ${b}"
  else
    fail "${label}: expected ${a} > ${b}"
  fi
}

assert_approx_eq() {
  local label="$1" a="$2" b="$3" eps="${4:-0.01}"
  if awk "BEGIN { d=${a}-${b}; if(d<0)d=-d; exit (d <= ${eps}) ? 0 : 1 }"; then
    ok "${label}: |${a} - ${b}| <= ${eps}"
  else
    fail "${label}: |${a} - ${b}| > ${eps} (not approximately equal)"
  fi
}

# ── Run script against a fixture ──────────────────────────────────────────────
# Sets global FIXTURE_JSON to the path of the output JSON file.
run_fixture() {
  local name="$1" csv="$2" symbol="$3"
  local out_dir="${TMP_OUT}/${name}"
  mkdir -p "${out_dir}"

  # Suppress script's informational stdout; capture stderr for error reporting
  if bash "${SCRIPT}" \
      --symbol "${symbol}" \
      --input-csv "${csv}" \
      --out-dir "${out_dir}" \
      --days 30 \
      >/dev/null 2>/tmp/test_stderr; then
    printf '[%s] Script exited successfully\n' "${name}"
    FIXTURE_JSON="${out_dir}/${symbol}_prediction.json"
  else
    fail "[${name}] Script exited with error"
    cat /tmp/test_stderr >&2
    FIXTURE_JSON=""
  fi
}

# =============================================================================
# TEST 1 — simple_ascending.csv
# =============================================================================
printf '\n=== Test 1: simple_ascending (30 rows, prices 100..129) ===\n'

run_fixture "ascending" "${FIXTURES}/simple_ascending.csv" "TEST_ASC"
JSON1="${FIXTURE_JSON}"

if [[ -z "${JSON1}" || ! -f "${JSON1}" ]]; then
  fail "JSON output file not created"
else
  ok "JSON file exists"

  # Structural checks
  assert_json_key "${JSON1}" '.symbol'
  assert_json_key "${JSON1}" '.last_date'
  assert_json_key "${JSON1}" '.last_close'
  assert_json_key "${JSON1}" '.data_points'
  assert_json_key "${JSON1}" '.indicators.sma5'
  assert_json_key "${JSON1}" '.indicators.sma10'
  assert_json_key "${JSON1}" '.indicators.sma20'
  assert_json_key "${JSON1}" '.indicators.ema10'
  assert_json_key "${JSON1}" '.indicators.ema20'
  assert_json_key "${JSON1}" '.linear_regression.predicted_next_close'
  assert_json_key "${JSON1}" '.linear_regression.slope'
  assert_json_key "${JSON1}" '.linear_regression.intercept'
  assert_json_key "${JSON1}" '.linear_regression.r_squared'

  # Symbol preserved
  GOT_SYM="$(jq -r '.symbol' "${JSON1}")"
  if [[ "${GOT_SYM}" == "TEST_ASC" ]]; then
    ok "symbol field = TEST_ASC"
  else
    fail "symbol field expected TEST_ASC, got ${GOT_SYM}"
  fi

  # Data points = 30
  GOT_N="$(jq '.data_points' "${JSON1}")"
  if [[ "${GOT_N}" == "30" ]]; then
    ok "data_points = 30"
  else
    fail "data_points expected 30, got ${GOT_N}"
  fi

  PRED1="$(jq '.linear_regression.predicted_next_close' "${JSON1}")"
  LAST1="$(jq '.last_close' "${JSON1}")"
  SLOPE1="$(jq '.linear_regression.slope' "${JSON1}")"
  R2_1="$(jq '.linear_regression.r_squared' "${JSON1}")"

  # For strictly ascending series, predicted_next_close must exceed last_close
  assert_gt "ascending: predicted > last_close" "${PRED1}" "${LAST1}"

  # Slope must be positive
  assert_gt "ascending: slope > 0" "${SLOPE1}" "0"

  # R² must be close to 1.0 for a perfectly linear series
  assert_approx_eq "ascending: R^2 approx 1.0" "${R2_1}" "1.0" "0.001"

  # SMA5 should be > SMA10 for ascending series (recent values higher)
  SMA5_1="$(jq '.indicators.sma5' "${JSON1}")"
  SMA10_1="$(jq '.indicators.sma10' "${JSON1}")"
  assert_gt "ascending: sma5 > sma10" "${SMA5_1}" "${SMA10_1}"
fi

# =============================================================================
# TEST 2 — flat.csv
# =============================================================================
printf '\n=== Test 2: flat (30 rows, all price = 100.00) ===\n'

run_fixture "flat" "${FIXTURES}/flat.csv" "TEST_FLAT"
JSON2="${FIXTURE_JSON}"

if [[ -z "${JSON2}" || ! -f "${JSON2}" ]]; then
  fail "JSON output file not created"
else
  ok "JSON file exists"

  # Structural checks
  assert_json_key "${JSON2}" '.symbol'
  assert_json_key "${JSON2}" '.indicators.sma5'
  assert_json_key "${JSON2}" '.linear_regression.predicted_next_close'

  PRED2="$(jq '.linear_regression.predicted_next_close' "${JSON2}")"
  LAST2="$(jq '.last_close' "${JSON2}")"
  SLOPE2="$(jq '.linear_regression.slope' "${JSON2}")"

  # For flat series: predicted approx last_close (within 0.001)
  assert_approx_eq "flat: predicted approx last_close" "${PRED2}" "${LAST2}" "0.001"

  # Slope must be approx 0
  assert_approx_eq "flat: slope approx 0" "${SLOPE2}" "0" "0.0001"

  # All SMA values should equal last_close
  SMA5_2="$(jq '.indicators.sma5' "${JSON2}")"
  EMA10_2="$(jq '.indicators.ema10' "${JSON2}")"
  assert_approx_eq "flat: sma5 approx last_close" "${SMA5_2}" "${LAST2}" "0.001"
  assert_approx_eq "flat: ema10 approx last_close" "${EMA10_2}" "${LAST2}" "0.1"
fi

# =============================================================================
# TEST 3 — Text report exists
# =============================================================================
printf '\n=== Test 3: text report output ===\n'

TXT1="${TMP_OUT}/ascending/TEST_ASC_prediction.txt"
if [[ -f "${TXT1}" ]]; then
  ok "text report file exists"
  if grep -q 'Predicted next close' "${TXT1}"; then
    ok "text report contains predicted value"
  else
    fail "text report missing 'Predicted next close' line"
  fi
else
  fail "text report not created"
fi

# =============================================================================
# TEST 4 — Raw CSV copied to output dir
# =============================================================================
printf '\n=== Test 4: raw CSV copied to output directory ===\n'

CSV_COPY="${TMP_OUT}/ascending/TEST_ASC_daily.csv"
if [[ -f "${CSV_COPY}" ]]; then
  ok "raw CSV copied to output directory"
else
  fail "raw CSV not found in output directory"
fi

# =============================================================================
# Summary
# =============================================================================
printf '\n=== Summary ===\n'
printf 'Passed: %d\n' "${PASS}"
printf 'Failed: %d\n' "${FAIL}"

if (( FAIL > 0 )); then
  printf 'RESULT: FAILED\n' >&2
  exit 1
fi

printf 'RESULT: ALL TESTS PASSED\n'
exit 0
