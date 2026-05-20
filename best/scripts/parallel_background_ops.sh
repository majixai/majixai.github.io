#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <log-dir>" >&2
  exit 2
fi

log_dir=$1
shift
mkdir -p "$log_dir"

declare -a pids=()
declare -a labels=()
declare -a logs=()

while IFS= read -r spec; do
  [[ -z "${spec:-}" ]] && continue
  [[ "${spec:0:1}" == "#" ]] && continue

  label=${spec%%::*}
  command=${spec#*::}
  if [[ "$label" == "$spec" ]]; then
    echo "Invalid job spec (expected label::command): $spec" >&2
    exit 2
  fi

  safe_label=$(printf '%s' "$label" | tr -cs 'A-Za-z0-9._-' '_')
  log_file="$log_dir/${safe_label}.log"

  (
    set -euo pipefail
    printf '[%s] started %s\n' "$label" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    bash -lc "$command"
    printf '[%s] finished %s\n' "$label" "$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
  ) >"$log_file" 2>&1 &

  pids+=("$!")
  labels+=("$label")
  logs+=("$log_file")
done

status=0
for i in "${!pids[@]}"; do
  if ! wait "${pids[$i]}"; then
    status=1
    echo "::error::Parallel job '${labels[$i]}' failed; see ${logs[$i]}" >&2
  fi
done

if [[ $status -ne 0 ]]; then
  echo "Parallel background operation logs:" >&2
  for log_file in "${logs[@]}"; do
    echo "--- ${log_file} ---" >&2
    tail -n 80 "$log_file" >&2 || true
  done
fi

exit "$status"
