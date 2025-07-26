function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getGameUpdate(event, details) {
  const cache = CacheService.getScriptCache();
  const now = new Date().getTime();

  const eventCooldowns = {
    'default': 5000,
    'tackle': 2000,
    'pass': 3000,
    'touchdown': 10000,
    'interception': 10000,
  };

  const cooldown = eventCooldowns[event] || eventCooldowns['default'];
  const cacheKey = `lastCall_${event}`;
  const lastCall = cache.get(cacheKey);

  if (lastCall && now - lastCall < cooldown) {
    return { commentary: `Commentary for ${event} is cooling down...` };
  }

  cache.put(cacheKey, now, 60); // Cache for 60 seconds

  const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  let prompt;

  switch (event) {
    case 'update':
      prompt = `You are a football game AI. Generate challenging and realistic opponent behavior and play outcomes based on the following details: ${details}. Respond in JSON format with the following keys: 'opponentBehavior', 'playOutcome', 'commentary'.`;
      break;
    case 'play-analysis':
      prompt = `You are a football analyst. Provide a detailed analysis of the following play: ${details}.`;
      break;
    default:
      prompt = `Generate a play-by-play commentary for the following event: ${event}. Details: ${details}`;
  }

  const response = UrlFetchApp.fetch("https://api.generativeai.com/v1/game", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    payload: JSON.stringify({
      prompt: prompt,
      max_tokens: 500,
    }),
  });

  const data = JSON.parse(response.getContentText());
  return JSON.parse(data.choices[0].text.trim());
}
