# Nightly Market Forecast (Google Apps Script + GitHub Directory)

This directory is the **GitHub-hosted project directory/source of truth** for a nightly 10 PM market forecast system.

The runtime is **Google Apps Script**. The repository stores:
- the Apps Script source files,
- the prompt pack,
- compressed `.dat.gz` project artifacts,
- and Bash / GitHub Actions automation used to validate, package, and optionally deploy the script.

## What the nightly job does

At **10 PM America/New_York** the Apps Script trigger runs `nightlyMarketForecastJob()`:
1. checks whether the **US equities market is open the next morning**,
2. loads the repo-hosted project directory manifest from GitHub (`project-directory.dat.gz`),
3. fetches OHLCV for weekly, daily, hourly, and 15-minute timeframes,
4. treats **weekly + daily as multiday context**,
5. treats **hourly + 15-minute as session-reset context**,
6. detects cross-timeframe repetitions and relevant indicators,
7. sends an extensive Gemini prompt for chat-style analysis,
8. enforces **daily + monthly Gemini rate limits**, and
9. emails the forecast.

## Runtime secrets and configuration

Do **not** hardcode secrets.

Set these in **Apps Script → Project Settings → Script properties**:

| Property | Required | Purpose |
|---|---:|---|
| `GEMINI_API_KEY` | yes | Gemini API key used by `Gemini.gs` |
| `MARKET_DATA_API_KEY` | yes | Market data provider API key (default implementation uses Alpha Vantage) |
| `RECIPIENT_EMAILS` | yes | Comma-separated email recipients |
| `SYMBOLS` | optional | CSV override for manifest symbols |
| `GEMINI_MODEL` | optional | Override Gemini model (default `gemini-2.5-flash`) |
| `GEMINI_MAX_DAILY_CALLS` | optional | Daily Gemini request budget |
| `GEMINI_MAX_MONTHLY_CALLS` | optional | Monthly Gemini request budget |
| `MARKET_DATA_REQUEST_DELAY_MS` | optional | Delay between market-data calls to respect provider limits |
| `GITHUB_REPO_OWNER` / `GITHUB_REPO_NAME` / `GITHUB_REPO_REF` | optional | Override GitHub raw source location |
| `GITHUB_DIRECTORY_PATH` | optional | Override manifest path |
| `GITHUB_DIRECTORY_URL` | optional | Override manifest URL directly |

## GitHub as the source of truth

The Apps Script project reads the repo-hosted manifest from:
- `gas_market_forecast/artifacts/project-directory.dat.gz`
- fallback: `gas_market_forecast/artifacts/project-directory.dat`

The Gemini analyst instructions are also versioned in GitHub at:
- `gas_market_forecast/prompts/gemini-market-brief.md`

That means GitHub is the directory of record for symbols, workflow metadata, prompt wording, and artifact paths.

## Deployment and maintenance automation

### Validate locally

```bash
bash scripts/gas_market_forecast_refresh_samples.sh --check
bash scripts/gas_market_forecast_validate.sh
bash scripts/gas_market_forecast_package.sh
```

### Optional GitHub Actions deployment

Workflow: `/.github/workflows/gas_market_forecast.yml`

Manual deploy requires these **GitHub Actions secrets**:
- `GAS_SCRIPT_ID`
- `CLASP_CLIENT_ID`
- `CLASP_CLIENT_SECRET`
- `CLASP_REFRESH_TOKEN`

The workflow uses Bash helpers plus `clasp` to push the GitHub-tracked Apps Script sources to Google Apps Script.

### Apps Script setup

1. Create a new Apps Script project.
2. Copy the project script ID if you plan to deploy via GitHub Actions.
3. Add the Script Properties listed above.
4. Run `installNightlyMarketForecastTrigger()` once.
5. Confirm the trigger is scheduled for **10 PM America/New_York**.

## Compressed `.dat` artifacts

Artifacts live in `gas_market_forecast/artifacts/`.

- `project-directory.dat` / `.dat.gz` — repo manifest consumed by the GAS runtime.
- `sample-forecast-context.dat` / `.dat.gz` — example normalized forecast payload for maintenance and documentation.

Refresh them with:

```bash
bash scripts/gas_market_forecast_refresh_samples.sh
```

## Security notes

- No secrets are hardcoded anywhere in this project directory.
- Use **Apps Script properties** for runtime secrets.
- Use **GitHub Actions secrets** for deployment secrets.
- The implementation intentionally does **not** operationalize personal access tokens shared in conversation history.

## Provider note

The sample implementation uses **Alpha Vantage** for OHLCV because it exposes weekly, daily, 60-minute, and 15-minute series with one API family. If you need a different provider, replace `fetchAlphaVantageTimeSeries_()` in `MarketData.gs` while keeping the surrounding GitHub directory + rate-limit design unchanged.
