function loadProjectDirectoryConfig_() {
  const manifestUrl = getScriptProperty_(
    NIGHTLY_MARKET_FORECAST.properties.manifestUrl,
    buildRawGitHubUrl_(getScriptProperty_(
      NIGHTLY_MARKET_FORECAST.properties.manifestPath,
      NIGHTLY_MARKET_FORECAST.manifestPath
    ))
  );

  const baseConfig = {
    repository: {
      owner: getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.repoOwner, NIGHTLY_MARKET_FORECAST.repoOwner),
      name: getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.repoName, NIGHTLY_MARKET_FORECAST.repoName),
      ref: getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.repoRef, NIGHTLY_MARKET_FORECAST.repoRef)
    },
    defaults: {
      symbols: parseCsvList_(getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.symbols, '')),
      marketDataProvider: getScriptProperty_(
        NIGHTLY_MARKET_FORECAST.properties.marketDataProvider,
        NIGHTLY_MARKET_FORECAST.defaultMarketDataProvider
      ),
      marketDataDelayMs: toNumberOrDefault_(
        getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.marketDataDelayMs, ''),
        NIGHTLY_MARKET_FORECAST.defaultMarketDataDelayMs
      ),
      geminiModel: getScriptProperty_(
        NIGHTLY_MARKET_FORECAST.properties.geminiModel,
        NIGHTLY_MARKET_FORECAST.defaultGeminiModel
      ),
      geminiDailyLimit: toNumberOrDefault_(
        getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.geminiDailyLimit, ''),
        NIGHTLY_MARKET_FORECAST.defaultGeminiDailyLimit
      ),
      geminiMonthlyLimit: toNumberOrDefault_(
        getScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.geminiMonthlyLimit, ''),
        NIGHTLY_MARKET_FORECAST.defaultGeminiMonthlyLimit
      )
    }
  };

  const manifest = fetchGitHubJsonManifest_(manifestUrl) || fetchGitHubJsonManifest_(
    buildRawGitHubUrl_(NIGHTLY_MARKET_FORECAST.manifestFallbackPath)
  ) || {};
  const merged = deepMerge_(manifest, baseConfig);

  if (!merged.defaults.symbols || !merged.defaults.symbols.length) {
    merged.defaults.symbols = NIGHTLY_MARKET_FORECAST.defaultSymbols.slice();
  }
  if (!merged.prompt || !merged.prompt.path) {
    merged.prompt = { path: NIGHTLY_MARKET_FORECAST.promptFallbackPath };
  }
  merged.runtime = {
    recipients: parseCsvList_(getRequiredScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.recipients)),
    geminiApiKey: getRequiredScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.geminiApiKey),
    marketDataApiKey: getRequiredScriptProperty_(NIGHTLY_MARKET_FORECAST.properties.marketDataApiKey)
  };
  return merged;
}

function fetchGitHubJsonManifest_(url) {
  try {
    const response = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
    if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
      return null;
    }
    let payload;
    if (/\.gz(?:$|\?)/.test(url)) {
      payload = Utilities.ungzip(Utilities.newBlob(response.getContent())).getDataAsString();
    } else {
      payload = response.getContentText();
    }
    return JSON.parse(payload);
  } catch (error) {
    Logger.log('Manifest fetch failed for ' + url + ': ' + error.message);
    return null;
  }
}

function fetchGitHubTextFile_(path) {
  const response = UrlFetchApp.fetch(buildRawGitHubUrl_(path), { muteHttpExceptions: true });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Unable to fetch GitHub text file: ' + path + ' (' + response.getResponseCode() + ')');
  }
  return response.getContentText();
}
