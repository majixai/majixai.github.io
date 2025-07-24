function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getGameUpdate(event, details) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `lastCall_${event}`;
  const lastCall = cache.get(cacheKey);
  const now = new Date().getTime();

  let cooldown = 5000; // Default 5 seconds
  if (event === 'touchdown') {
    cooldown = 10000; // 10 seconds for touchdowns
  }

  if (lastCall && now - lastCall < cooldown) {
    return { commentary: `Commentary for ${event} is cooling down...` };
  }

  cache.put(cacheKey, now, 60); // Cache for 60 seconds

  const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  let prompt;

  switch (event) {
    case 'update':
      prompt = `You are a football game AI. Generate game logic based on the following details: ${details}. Respond in JSON format with the following keys: 'opponentBehavior', 'playOutcome', 'commentary'.`;
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
