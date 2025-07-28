// --- Football Game AI Integration for Google Apps Script ---
// Modular, extensible, and robust for advanced gameplay and analytics

/**
 * Main entry for all game AI and commentary requests.
 * @param {string} event - The event type (e.g., 'update', 'play-analysis', 'drive-summary', etc.)
 * @param {string|Object} details - JSON string or object with event details
 * @return {Object} - JSON with AI-generated results
 */
function getGameUpdate(event, details) {
  const apiKey = "AIzaSyAqAZ9i3L4dMtRAP8O-qDVNk7iPzrG5gsg";
  const model = 'gemini-1.5-pro';
  const api = 'streamGenerateContent';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${api}?key=${apiKey}`;

  // --- Prompt Engineering ---
  let prompt = buildPrompt(event, details);

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
    apiModel: model
  };
  return result;
}

/**
 * Build a prompt for the AI based on event type and details.
 * @param {string} event
 * @param {string|Object} details
 * @return {string}
 */
function buildPrompt(event, details) {
  let d = (typeof details === 'string') ? details : JSON.stringify(details);
  switch (event) {
    case 'update':
      return `You are a football game AI. Generate challenging and realistic opponent behavior and play outcomes based on the following details: ${d}. Respond in JSON format with the following keys: 'opponentBehavior', 'playOutcome', 'commentary', 'suggestedPlays', 'playerStats', 'momentum', 'injuries', 'weather'.`;
    case 'play-analysis':
      return `You are a football analyst. Provide a detailed analysis of the following play: ${d}. Include keys: 'breakdown', 'keyPlayers', 'successFactors', 'improvementSuggestions', 'commentary'.`;
    case 'drive-summary':
      return `Summarize the drive with advanced analytics. Details: ${d}. Include keys: 'driveResult', 'keyMoments', 'playerOfDrive', 'statSummary', 'commentary'.`;
    case 'game-summary':
      return `Provide a full game summary and advanced stats. Details: ${d}. Include keys: 'finalScore', 'topPerformers', 'turningPoints', 'statLeaders', 'commentary'.`;
    case 'injury-update':
      return `You are a team doctor. Analyze the following injury event: ${d}. Include keys: 'injuryType', 'severity', 'expectedReturn', 'impact', 'commentary'.`;
    case 'weather-update':
      return `You are a meteorologist. Give a weather update for the game: ${d}. Include keys: 'conditions', 'impactOnGame', 'advice', 'commentary'.`;
    case 'momentum-shift':
      return `Analyze the momentum shift in the game. Details: ${d}. Include keys: 'cause', 'effect', 'momentumScore', 'commentary'.`;
    case 'penalty':
      return `Analyze the impact of this penalty: ${d}. Include keys: 'penaltyType', 'yardage', 'effect', 'commentary'.`;
    case 'timeout':
      return `Analyze the use of this timeout: ${d}. Include keys: 'reason', 'effect', 'strategy', 'commentary'.`;
    case 'challenge':
      return `Analyze the coach's challenge: ${d}. Include keys: 'callOnField', 'challengeReason', 'result', 'impact', 'commentary'.`;
    default:
      return `Generate a play-by-play commentary for the following event: ${event}. Details: ${d}`;
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
