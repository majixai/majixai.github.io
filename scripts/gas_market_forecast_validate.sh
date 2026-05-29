#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT="$ROOT/gas_market_forecast"

required=(
  "$PROJECT/README.md"
  "$PROJECT/index.html"
  "$PROJECT/appsscript.json"
  "$PROJECT/Config.gs"
  "$PROJECT/GitHubDirectory.gs"
  "$PROJECT/MarketCalendar.gs"
  "$PROJECT/MarketData.gs"
  "$PROJECT/PatternAnalysis.gs"
  "$PROJECT/RateLimiter.gs"
  "$PROJECT/Gemini.gs"
  "$PROJECT/EmailFormatter.gs"
  "$PROJECT/Main.gs"
  "$PROJECT/prompts/gemini-market-brief.md"
  "$PROJECT/artifacts/project-directory.dat"
  "$PROJECT/artifacts/project-directory.dat.gz"
  "$PROJECT/artifacts/sample-forecast-context.dat"
  "$PROJECT/artifacts/sample-forecast-context.dat.gz"
)

for path in "${required[@]}"; do
  [[ -f "$path" ]] || { echo "missing required file: $path" >&2; exit 1; }
done

python3 - "$PROJECT" <<'PY'
import gzip
import json
import sys
from pathlib import Path
root = Path(sys.argv[1])
for name in ['project-directory.dat', 'sample-forecast-context.dat']:
    raw = (root / 'artifacts' / name).read_text()
    json.loads(raw)
    with gzip.open(root / 'artifacts' / f'{name}.gz', 'rt') as fh:
        zipped = fh.read()
    if raw != zipped:
        raise SystemExit(f'gzip mismatch for {name}')
manifest = json.loads((root / 'artifacts' / 'project-directory.dat').read_text())
assert manifest['project']['sourceOfTruth'] == 'github'
assert manifest['defaults']['jobHourLocal'] == 22
assert manifest['automation']['workflow'].endswith('gas_market_forecast.yml')
print('json + gzip validation ok')
PY

if grep -R -nE 'github_pat_|AIza[0-9A-Za-z_-]{20,}' "$PROJECT" >/dev/null; then
  echo 'secret-like literal detected in project files' >&2
  exit 1
fi

echo 'gas_market_forecast validation ok'
