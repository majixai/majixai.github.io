#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
export IXIC_OUTPUT_DIR="${IXIC_OUTPUT_DIR:-$repo_root/ixic_lstm_forecast/output}"

tmp_env="$(mktemp)"
trap 'rm -f "$tmp_env"' EXIT

bash "$repo_root/ixic_lstm_forecast/bash/export_runtime_env.sh" "$tmp_env"
set -a
source "$tmp_env"
set +a

python "$repo_root/ixic_lstm_forecast/ixic_main.py"

summary_json="${IXIC_SUMMARY_JSON:-$IXIC_OUTPUT_DIR/ixic_summary.json}"
if [[ -f "$summary_json" ]]; then
  summary_dat="${summary_json%.json}.dat"
  cp "$summary_json" "$summary_dat"
  gzip -9 -c "$summary_dat" > "$summary_dat.gz"
  printf 'Compressed summary artifact: %s\n' "$summary_dat.gz"
fi
