function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}

function getCommentary(event, details) {
  const cache = CacheService.getScriptCache();
  const cacheKey = `lastCall_${event}`;
  const lastCall = cache.get(cacheKey);
  const now = new Date().getTime();

  let cooldown = 5000; // Default 5 seconds
  if (event === 'touchdown') {
    cooldown = 10000; // 10 seconds for touchdowns
  }

  if (lastCall && now - lastCall < cooldown) {
    return `Commentary for ${event} is cooling down...`;
  }

  cache.put(cacheKey, now, 60); // Cache for 60 seconds

  const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  let prompt;

  switch (event) {
    case 'touchdown':
      prompt = `Generate an ecstatic play-by-play commentary for a touchdown. Details: ${details}`;
      break;
    case 'interception':
      prompt = `Generate a dramatic play-by-play commentary for an interception. Details: ${details}`;
      break;
    case 'fieldGoal':
      prompt = `Generate a play-by-play commentary for a successful field goal. Details: ${details}`;
      break;
    default:
      prompt = `Generate a play-by-play commentary for the following event: ${event}. Details: ${details}`;
  }

  const response = UrlFetchApp.fetch("https://api.generativeai.com/v1/commentary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    payload: JSON.stringify({
      prompt: prompt,
      max_tokens: 100,
    }),
  });

  const data = JSON.parse(response.getContentText());
  return data.choices[0].text.trim();
}
