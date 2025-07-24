function doGet() {

  return HtmlService.createHtmlOutputFromFile('index');
}

function getCommentary(event) {
  const cache = CacheService.getScriptCache();
  const lastCall = cache.get('lastCall');
  const now = new Date().getTime();

  if (lastCall && now - lastCall < 5000) { // 5 seconds
    return "Commentary is cooling down...";
  }

  cache.put('lastCall', now, 60); // Cache for 60 seconds

  const apiKey = "YOUR_API_KEY"; // Replace with your actual API key
  const prompt = `Generate a short, exciting play-by-play commentary for a football game. The event is: ${event}`;

  const response = UrlFetchApp.fetch("https://api.generativeai.com/v1/commentary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    payload: JSON.stringify({
      prompt: prompt,
      max_tokens: 50,
    }),
  });

  const data = JSON.parse(response.getContentText());
  return data.choices[0].text.trim();

  return HtmlService.createHtmlOutputFromFile('sidebar');
}

function getUnreadEmails() {
  return GmailApp.getInboxUnreadCount();

}
