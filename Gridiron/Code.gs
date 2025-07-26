function getGameUpdate(event, details) {
  const apiKey = "AIzaSyAqAZ9i3L4dMtRAP8O-qDVNk7iPzrG5gsg";
  const model = 'gemini-1.5-pro';
  const api = 'streamGenerateContent';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${api}?key=${apiKey}`;

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

  const payload = {
    contents: [
      {
        role: 'user',
        parts: [
          {
            text: prompt
          },
        ]
      },
    ],
  };

  const options = {
    method: 'POST',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify(payload),
  };

  const response = UrlFetchApp.fetch(url, options);
  const chunks = JSON.parse(response.getContentText());

  let fullResponse = "";
  for (const chunk of chunks) {
    fullResponse += chunk.candidates[0].content.parts[0].text;
  }

  return JSON.parse(fullResponse);
}
