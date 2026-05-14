#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARTIFACT_DIR="$ROOT/gas_market_forecast/artifacts"
FILES=("project-directory.dat" "sample-forecast-context.dat")
CHECK_ONLY="false"

if [[ "${1:-}" == "--check" ]]; then
  CHECK_ONLY="true"
fi

for file in "${FILES[@]}"; do
  src="$ARTIFACT_DIR/$file"
  dst="$src.gz"
  tmp="$(mktemp)"
  gzip -c -n "$src" > "$tmp"
  if [[ "$CHECK_ONLY" == "true" ]]; then
    cmp --silent "$tmp" "$dst"
  else
    mv "$tmp" "$dst"
    echo "refreshed $dst"
  fi
  rm -f "$tmp"
done
