function generateGeminiForecast_(projectConfig, nextSession, symbolReports) {
  const usage = reserveGeminiBudget_(projectConfig);
  const model = projectConfig.defaults.geminiModel || NIGHTLY_MARKET_FORECAST.defaultGeminiModel;
  const promptTemplate = loadGeminiPromptTemplate_(projectConfig);
  const payload = {
    system_instruction: {
      parts: [{ text: promptTemplate }]
    },
    contents: [{
      role: 'user',
      parts: [{
        text: JSON.stringify({
          task: 'Produce a chat-style nightly market forecast email for the next cash session.',
          session: nextSession,
          reports: symbolReports
        }, null, 2)
      }]
    }],
    generationConfig: {
      temperature: 0.35,
      topP: 0.9,
      maxOutputTokens: 3072,
      responseMimeType: 'text/plain'
    }
  };
  const endpoint = 'https://generativelanguage.googleapis.com/v1beta/models/' + encodeURIComponent(model) + ':generateContent';
  const response = UrlFetchApp.fetch(endpoint, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'X-goog-api-key': projectConfig.runtime.geminiApiKey
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  if (response.getResponseCode() < 200 || response.getResponseCode() >= 300) {
    throw new Error('Gemini request failed: ' + response.getResponseCode() + ' ' + response.getContentText());
  }
  const body = JSON.parse(response.getContentText());
  const text = (((body.candidates || [])[0] || {}).content || {}).parts || [];
  return {
    model: model,
    usage: usage,
    text: text.map(function(part) { return part.text || ''; }).join('\n').trim()
  };
}

function loadGeminiPromptTemplate_(projectConfig) {
  try {
    const promptPath = (projectConfig.prompt && projectConfig.prompt.path) || NIGHTLY_MARKET_FORECAST.promptFallbackPath;
    return fetchGitHubTextFile_(promptPath);
  } catch (error) {
    Logger.log('Prompt fetch failed, using built-in fallback: ' + error.message);
    return [
      'You are a disciplined market-structure analyst writing a chat-style nightly market forecast email.',
      'Goals:',
      '- Forecast next-session OHLCV probabilistically, not with certainty.',
      '- Treat weekly and daily patterns as multiday context.',
      '- Treat hourly and 15-minute patterns as session-reset signals that refresh every day.',
      '- Highlight repetitions or echoes across timeframes before making any directional call.',
      '- Only mention indicators that materially support the current bias or invalidation.',
      '- Keep the tone analytical, concise, and HTML-friendly for email rendering.',
      'Output format:',
      '1. Executive summary.',
      '2. Per-symbol chat-style breakdown with bullish, bearish, and invalidation bullets.',
      '3. Forecast OHLCV estimates.',
      '4. Repeated patterns across timeframes.',
      '5. Indicator evidence that matters.',
      '6. Risk note with confidence band.'
    ].join('\n');
  }
}
