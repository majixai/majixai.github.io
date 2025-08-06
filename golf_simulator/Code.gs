function doGet() {
  return HtmlService.createHtmlOutputFromFile('index');
}


// --- API Key Management ---

/**
 * To set the API key, run this function from the Apps Script editor,
 * replacing "YOUR_API_KEY" with your actual key. This function should only
 * be run once to store the key securely in script properties.
 */
function setApiKey() {
  // IMPORTANT: Replace "YOUR_API_KEY" with your actual key before running.
  const apiKey = "AIzaSyAqAZ9i3L4dMtRAP8O-qDVNk7iPzrG5gsg"; // Replace with your key
  PropertiesService.getScriptProperties().setProperty('GEMINI_API_KEY', apiKey);
  console.log("API Key has been set successfully.");
}

/**
 * Retrieves the API key from script properties. Throws an error if the
 * key has not been set.
 * The trailing underscore indicates this is a private function not to be
 * called directly by the client.
 *
 * @returns {string} The stored API key.
 */
function getApiKey_() {
  const apiKey = PropertiesService.getScriptProperties().getProperty('GEMINI_API_KEY');
  if (!apiKey) {
    throw new Error("API key not set. Please run the setApiKey function from the Apps Script editor.");
  }
  return apiKey;
}


/**
 * Sets the default properties for the application. Run this once from the editor.
 */
function setAppProperties() {
  const properties = {
    GEMINI_MODEL: 'gemini-1.5-pro',
    GEMINI_API: 'streamGenerateContent',
    GEMINI_PROMPT_TEMPLATE: 'I am a golf coach. A student just swung a golf club. The motion detection system registered a power of {power} and an angle of {angle}. Give me a short, encouraging tip for the student based on this data. Keep the tip to 2-3 sentences. You can use Google Search to find relevant information if needed.',
    MOTION_THRESHOLD_DIVISOR: 1000,
    SWING_POWER_MULTIPLIER: 0.05,
    MAX_SWING_POWER: 20
  };
  PropertiesService.getScriptProperties().setProperties(properties, true);
  console.log("Application properties have been set.");
}


/**
 * Calls the generative AI to get a golf tip based on swing data.
 * @param {object} swingData - An object with power and angle of the swing.
 * @returns {string} A JSON string containing the streamed response from the AI.
 */
function getGolfTip(swingData) {
  try {
    const apiKey = getApiKey_();
    const scriptProperties = PropertiesService.getScriptProperties();
    const model = scriptProperties.getProperty('GEMINI_MODEL');
    const api = scriptProperties.getProperty('GEMINI_API');
    const promptTemplate = scriptProperties.getProperty('GEMINI_PROMPT_TEMPLATE');

    if (!model || !api || !promptTemplate) {
        throw new Error("Application properties not set. Please run setAppProperties() from the editor.");
    }

    const prompt = promptTemplate
        .replace('{power}', swingData.power.toFixed(2))
        .replace('{angle}', swingData.angle.toFixed(2));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${api}?key=${apiKey}`;

    const requestBody = {
      contents: [{
        role: 'user',
        parts: [{ text: prompt }]
      }],
      tools: [{ googleSearch: {} }],
    };

    const options = {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      // We return the full JSON string and simulate the stream on the client,
      // as google.script.run does not support true streaming.
      return responseBody;
    } else {
      console.error(`API Error: ${responseCode} ${responseBody}`);
      return JSON.stringify([{ error: `Error from AI Coach: Could not get a tip at this time. (Code: ${responseCode})` }]);
    }
  } catch (e) {
    console.error(`Error in getGolfTip: ${e.toString()}`);
    return JSON.stringify([{ error: `An error occurred while contacting the AI Coach: ${e.message}` }]);
  }
}

/**
 * Returns all script properties to the client.
 * @returns {Object} A JavaScript object containing all script properties.
 */
function getAppProperties() {
    const properties = PropertiesService.getScriptProperties().getProperties();
    // The returned object is a Java object, so we manually convert it
    const props = {};
    for (const key in properties) {
        props[key] = properties[key];
    }
    return props;
}
