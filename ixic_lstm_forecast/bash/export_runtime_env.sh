#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
output_dir="${IXIC_OUTPUT_DIR:-$repo_root/ixic_lstm_forecast/output}"
runtime_dir="$output_dir/runtime"
webhook_dir="$output_dir/webhooks"
mkdir -p "$runtime_dir" "$webhook_dir"

runtime_json="$runtime_dir/ixic_runtime_settings.json"
scaffold_json="$runtime_dir/ixic_directory_scaffold.json"
webhook_json="$webhook_dir/ixic_gas_payload.json"

env_target="${1:-}"

python "$repo_root/ixic_lstm_forecast/runtime_settings.py" --format json > "$runtime_json"
python "$repo_root/ixic_lstm_forecast/runtime_settings.py" --format scaffold > "$scaffold_json"
python "$repo_root/ixic_lstm_forecast/runtime_settings.py" --format webhook > "$webhook_json"

for file in "$runtime_json" "$scaffold_json" "$webhook_json"; do
  dat_file="${file%.json}.dat"
  cp "$file" "$dat_file"
  gzip -9 -c "$dat_file" > "$dat_file.gz"
done

if [[ -n "$env_target" ]]; then
  python "$repo_root/ixic_lstm_forecast/runtime_settings.py" --format env >> "$env_target"
else
  python "$repo_root/ixic_lstm_forecast/runtime_settings.py" --format env
fi

printf 'Generated runtime settings: %s\n' "$runtime_json"
printf 'Generated scaffold manifest: %s\n' "$scaffold_json"
printf 'Generated webhook payload: %s\n' "$webhook_json"
