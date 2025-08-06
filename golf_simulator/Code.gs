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
    GEMINI_MODEL: 'gemini-pro',
    GEMINI_PROMPT_TEMPLATE: 'I am a golf coach. A student just swung a golf club. The motion detection system registered a power of {power} and an angle of {angle}. Give me a short, encouraging tip for the student based on this data. Keep the tip to 2-3 sentences.',
    // Add other dynamic properties here
  };
  PropertiesService.getScriptProperties().setProperties(properties, true); // `true` deletes other properties
  console.log("Application properties have been set.");
}


/**
 * Calls the generative AI to get a golf tip based on swing data.
 * @param {object} swingData - An object with power and angle of the swing.
 * @returns {string} A golf tip from the AI.
 */
function getGolfTip(swingData) {
  try {
    const apiKey = getApiKey_();
    const scriptProperties = PropertiesService.getScriptProperties();
    const model = scriptProperties.getProperty('GEMINI_MODEL');
    const promptTemplate = scriptProperties.getProperty('GEMINI_PROMPT_TEMPLATE');

    if (!model || !promptTemplate) {
        throw new Error("Application properties not set. Please run setAppProperties() from the editor.");
    }

    const prompt = promptTemplate
        .replace('{power}', swingData.power.toFixed(2))
        .replace('{angle}', swingData.angle.toFixed(2));

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

    const requestBody = {
      contents: [{
        parts: [{
          text: prompt
        }]
      }]
    };

    const options = {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify(requestBody),
      muteHttpExceptions: true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseBody = response.getContentText();

    if (responseCode === 200) {
      const data = JSON.parse(responseBody);
      // Add more robust error handling for API response structure
      if (data && data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0]) {
        return data.candidates[0].content.parts[0].text;
      } else {
        console.error("Unexpected API response structure:", responseBody);
        return "The AI Coach is thinking... please try again.";
      }
    } else {
      console.error(`API Error: ${responseCode} ${responseBody}`);
      return `Error from AI Coach: Could not get a tip at this time. (Code: ${responseCode})`;
    }
  } catch (e) {
    console.error(`Error in getGolfTip: ${e.toString()}`);
    return `An error occurred while contacting the AI Coach: ${e.message}`;
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
