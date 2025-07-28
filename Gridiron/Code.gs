// --- Football Game AI Integration for Google Apps Script ---
// Modular, extensible, and robust for advanced gameplay and analytics
// Integrates with GitIntegration.gs to fetch Gridiron source files for gameplay logic

/**
 * Main entry for all game AI and commentary requests.
 * Optionally uses Gridiron source files for advanced gameplay logic.
 * @param {string} event - The event type (e.g., 'update', 'play-analysis', 'drive-summary', etc.)
 * @param {string|Object} details - JSON string or object with event details
 * @param {boolean} [useGitSource] - If true, fetch Gridiron source files for gameplay context
 * @return {Object} - JSON with AI-generated results
 */
function getGameUpdate(event, details, useGitSource) {
  const apiKey = "AIzaSyAqAZ9i3L4dMtRAP8O-qDVNk7iPzrG5gsg";
  const model = 'gemini-1.5-pro';
  const api = 'streamGenerateContent';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${api}?key=${apiKey}`;

  // --- Optionally fetch Gridiron source files for gameplay context ---
  var gitSourceContext = null;
  if (useGitSource) {
    if (typeof fetchGridironSource === 'function') {
      gitSourceContext = fetchGridironSource();
    } else {
      gitSourceContext = null;
    }
  }

  // --- Prompt Engineering ---
  let prompt = buildPrompt(event, details, gitSourceContext);

  // --- API Call ---
  const payload = {
    contents: [
      {
        role: 'user',
        parts: [ { text: prompt } ]
      },
    ],
  };
  const options = {
    method: 'POST',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
  };

  let response, chunks, fullResponse = "";
  try {
    response = UrlFetchApp.fetch(url, options);
    chunks = JSON.parse(response.getContentText());
    for (const chunk of chunks) {
      fullResponse += chunk.candidates[0].content.parts[0].text;
    }
  } catch (e) {
    Logger.log('API error: ' + e);
    return { error: 'API error', details: e.toString() };
  }

  // --- Parse and Validate JSON ---
  let result;
  try {
    result = JSON.parse(fullResponse);
  } catch (e) {
    Logger.log('Parse error: ' + e + ' | Raw: ' + fullResponse);
    return { error: 'Parse error', raw: fullResponse };
  }

  // --- Add Metadata ---
  result._meta = {
    event: event,
    timestamp: new Date().toISOString(),
    prompt: prompt.substring(0, 500),
    apiModel: model,
    gitSourceUsed: !!gitSourceContext,
    gitSourceFiles: gitSourceContext ? gitSourceContext.map(f => f.name) : null
  };
  return result;
}

/**
 * Build a prompt for the AI based on event type, details, and optional git source context.
 * @param {string} event
 * @param {string|Object} details
 * @param {Array} [gitSourceContext]
 * @return {string}
 */
function buildPrompt(event, details, gitSourceContext) {
  let d = (typeof details === 'string') ? details : JSON.stringify(details);
  let gitContext = '';
  if (gitSourceContext && gitSourceContext.length) {
    gitContext = '\n\nGridiron Source Files:\n' + gitSourceContext.map(f => `File: ${f.name}\nContent:\n${f.content.substring(0, 200)}...`).join('\n---\n');
  }
  switch (event) {
    case 'update':
      return `You are a football game AI. Generate challenging and realistic opponent behavior and play outcomes based on the following details: ${d}.${gitContext}\nRespond in JSON format with the following keys: 'opponentBehavior', 'playOutcome', 'commentary', 'suggestedPlays', 'playerStats', 'momentum', 'injuries', 'weather'.`;
    case 'play-analysis':
      return `You are a football analyst. Provide a detailed analysis of the following play: ${d}.${gitContext}\nInclude keys: 'breakdown', 'keyPlayers', 'successFactors', 'improvementSuggestions', 'commentary'.`;
    case 'drive-summary':
      return `Summarize the drive with advanced analytics. Details: ${d}.${gitContext}\nInclude keys: 'driveResult', 'keyMoments', 'playerOfDrive', 'statSummary', 'commentary'.`;
    case 'game-summary':
      return `Provide a full game summary and advanced stats. Details: ${d}.${gitContext}\nInclude keys: 'finalScore', 'topPerformers', 'turningPoints', 'statLeaders', 'commentary'.`;
    case 'injury-update':
      return `You are a team doctor. Analyze the following injury event: ${d}.${gitContext}\nInclude keys: 'injuryType', 'severity', 'expectedReturn', 'impact', 'commentary'.`;
    case 'weather-update':
      return `You are a meteorologist. Give a weather update for the game: ${d}.${gitContext}\nInclude keys: 'conditions', 'impactOnGame', 'advice', 'commentary'.`;
    case 'momentum-shift':
      return `Analyze the momentum shift in the game. Details: ${d}.${gitContext}\nInclude keys: 'cause', 'effect', 'momentumScore', 'commentary'.`;
    case 'penalty':
      return `Analyze the impact of this penalty: ${d}.${gitContext}\nInclude keys: 'penaltyType', 'yardage', 'effect', 'commentary'.`;
    case 'timeout':
      return `Analyze the use of this timeout: ${d}.${gitContext}\nInclude keys: 'reason', 'effect', 'strategy', 'commentary'.`;
    case 'challenge':
      return `Analyze the coach's challenge: ${d}.${gitContext}\nInclude keys: 'callOnField', 'challengeReason', 'result', 'impact', 'commentary'.`;
    default:
      return `Generate a play-by-play commentary for the following event: ${event}. Details: ${d}${gitContext}`;
  }
}

/**
 * Example utility: log all AI requests for auditing.
 * @param {string} event
 * @param {string|Object} details
 */
function logAIRequest(event, details) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('AI_Log') || SpreadsheetApp.getActiveSpreadsheet().insertSheet('AI_Log');
  sheet.appendRow([new Date(), event, typeof details === 'string' ? details : JSON.stringify(details)]);
}

/**
 * Example: get advanced play analysis
 */
function getAdvancedPlayAnalysis(playDetails) {
  return getGameUpdate('play-analysis', playDetails);
}

/**
 * Example: get drive summary
 */
function getDriveSummary(driveDetails) {
  return getGameUpdate('drive-summary', driveDetails);
}

/**
 * Example: get injury update
 */
function getInjuryUpdate(injuryDetails) {
  return getGameUpdate('injury-update', injuryDetails);
}

/**
 * Example: get weather update
 */
function getWeatherUpdate(weatherDetails) {
  return getGameUpdate('weather-update', weatherDetails);
}

/**
 * Example: get momentum shift analysis
 */
function getMomentumShift(momentumDetails) {
  return getGameUpdate('momentum-shift', momentumDetails);
}

/**
 * Example: get penalty analysis
 */
function getPenaltyAnalysis(penaltyDetails) {
  return getGameUpdate('penalty', penaltyDetails);
}

/**
 * Example: get timeout analysis
 */
function getTimeoutAnalysis(timeoutDetails) {
  return getGameUpdate('timeout', timeoutDetails);
}

/**
 * Example: get challenge analysis
 */
function getChallengeAnalysis(challengeDetails) {
  return getGameUpdate('challenge', challengeDetails);
}

// --- End of Football Game AI Integration ---
