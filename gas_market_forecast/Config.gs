const NIGHTLY_MARKET_FORECAST = Object.freeze({
  version: '1.0.0',
  timezone: 'America/New_York',
  manifestPath: 'gas_market_forecast/artifacts/project-directory.dat.gz',
  manifestFallbackPath: 'gas_market_forecast/artifacts/project-directory.dat',
  promptFallbackPath: 'gas_market_forecast/prompts/gemini-market-brief.md',
  repoOwner: 'majixai',
  repoName: 'majixai.github.io',
  repoRef: 'main',
  defaultSymbols: ['SPY'],
  defaultGeminiModel: 'gemini-2.5-flash',
  defaultGeminiDailyLimit: 5,
  defaultGeminiMonthlyLimit: 60,
  defaultMarketDataProvider: 'alphavantage',
  defaultMarketDataDelayMs: 15000,
  defaultIntradayLookback: 64,
  defaultDailyLookback: 80,
  defaultWeeklyLookback: 60,
  defaultManifestUrlTemplate: 'https://raw.githubusercontent.com/{owner}/{repo}/{ref}/{path}',
  properties: Object.freeze({
    geminiApiKey: 'GEMINI_API_KEY',
    geminiModel: 'GEMINI_MODEL',
    geminiDailyLimit: 'GEMINI_MAX_DAILY_CALLS',
    geminiMonthlyLimit: 'GEMINI_MAX_MONTHLY_CALLS',
    marketDataApiKey: 'MARKET_DATA_API_KEY',
    marketDataProvider: 'MARKET_DATA_PROVIDER',
    marketDataDelayMs: 'MARKET_DATA_REQUEST_DELAY_MS',
    recipients: 'RECIPIENT_EMAILS',
    symbols: 'SYMBOLS',
    repoOwner: 'GITHUB_REPO_OWNER',
    repoName: 'GITHUB_REPO_NAME',
    repoRef: 'GITHUB_REPO_REF',
    manifestPath: 'GITHUB_DIRECTORY_PATH',
    manifestUrl: 'GITHUB_DIRECTORY_URL'
  })
});

function getScriptProperty_(key, fallback) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  return value == null || value === '' ? fallback : value;
}

function getRequiredScriptProperty_(key) {
  const value = getScriptProperty_(key, '');
  if (!value) {
    throw new Error('Missing required Script Property: ' + key);
  }
  return value;
}

function parseCsvList_(value) {
  if (!value) {
    return [];
  }
  return String(value)
    .split(',')
    .map(function(entry) { return entry.trim(); })
    .filter(Boolean);
}

function toNumberOrDefault_(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildRawGitHubUrl_(path) {
  const owner = getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.repoOwner, NIGHTLY_MARKET_FORECAST.repoOwner);
  const repo = getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.repoName, NIGHTLY_MARKET_FORECAST.repoName);
  const ref = getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.repoRef, NIGHTLY_MARKET_FORECAST.repoRef);
  return NIGHTLY_MARKET_FORECAST.defaultManifestUrlTemplate
    .replace('{owner}', owner)
    .replace('{repo}', repo)
    .replace('{ref}', ref)
    .replace('{path}', path);
}

function average_(values) {
  if (!values || !values.length) {
    return 0;
  }
  return values.reduce(function(sum, value) { return sum + value; }, 0) / values.length;
}

function roundTo_(value, places) {
  if (value == null || !Number.isFinite(value)) {
    return null;
  }
  const factor = Math.pow(10, places == null ? 2 : places);
  return Math.round(value * factor) / factor;
}

function escapeHtml_(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function isoDateKey_(date, timezone) {
  return Utilities.formatDate(date, timezone || NIGHTLY_MARKET_FORECAST.timezone, 'yyyy-MM-dd');
}

function isoMonthKey_(date, timezone) {
  return Utilities.formatDate(date, timezone || NIGHTLY_MARKET_FORECAST.timezone, 'yyyy-MM');
}

function deepMerge_(base, override) {
  const output = JSON.parse(JSON.stringify(base || {}));
  Object.keys(override || {}).forEach(function(key) {
    const value = override[key];
    if (value && typeof value === 'object' && !Array.isArray(value) && output[key] && typeof output[key] === 'object' && !Array.isArray(output[key])) {
      output[key] = deepMerge_(output[key], value);
    } else {
      output[key] = value;
    }
  });
  return output;
}
