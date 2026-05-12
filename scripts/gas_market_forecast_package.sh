#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/gas_market_forecast"
OUT_DIR="${TMPDIR:-/tmp}/gas_market_forecast_bundle"
ARCHIVE="${TMPDIR:-/tmp}/nightly-market-forecast-gas.tgz"

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp "$PROJECT"/*.gs "$OUT_DIR/"
cp "$PROJECT/appsscript.json" "$OUT_DIR/"
cp "$PROJECT/README.md" "$OUT_DIR/"
cp "$PROJECT/index.html" "$OUT_DIR/"
cp -R "$PROJECT/artifacts" "$OUT_DIR/"
cp -R "$PROJECT/prompts" "$OUT_DIR/"

tar -C "$OUT_DIR/.." -czf "$ARCHIVE" "$(basename "$OUT_DIR")"

echo "bundle_dir=$OUT_DIR"
echo "bundle_archive=$ARCHIVE"
