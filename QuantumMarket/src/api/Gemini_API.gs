/**
 * ==========================================================================
 * FILE: Gemini_API.gs
 * DESCRIPTION: A low-level library for making calls to the Google Gemini API.
 *              This service handles the technical aspects of the API call,
 *              such as authentication, payload construction, and error handling.
 * ==========================================================================
 */

const Gemini_API = {

  GEMINI_ENDPOINT: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",

  /**
   * Executes a call to the Gemini API with a given prompt.
   * @param {string} prompt The complete prompt to send to the AI.
   * @param {number} temperature The creativity of the response (0.0 to 1.0).
   * @returns {string} The text response from the AI.
   * @throws {Error} If the API key is missing or if the API returns an error.
   */
  generateContent: function(prompt, temperature = 0.3) {
    const apiKey = System_Config.getSetting('GENAI_API_KEY');
    if (!apiKey) {
      throw new Error("Gemini API key is not set in Settings.");
    }

    const url = `${this.GEMINI_ENDPOINT}?key=${apiKey}`;

    const payload = {
      "contents": [{
        "parts": [{ "text": prompt }]
      }],
      "generationConfig": {
        "temperature": temperature,
        "maxOutputTokens": 2048
      },
      // Stricter safety settings to prevent unwanted content
      "safetySettings": [
        { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_LOW_AND_ABOVE" },
        { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_LOW_AND_ABOVE" },
        { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_LOW_AND_ABOVE" },
        { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_LOW_AND_ABOVE" }
      ]
    };

    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true // Allows us to parse the error response
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      if (result.candidates && result.candidates.length > 0 && result.candidates[0].content) {
        return result.candidates[0].content.parts[0].text;
      } else if (result.candidates && result.candidates[0].finishReason === 'SAFETY') {
        throw new Error("Response blocked by safety settings. The prompt may have been inappropriate.");
      }
      else {
        throw new Error("Invalid or empty response structure from Gemini.");
      }
    } else {
      const errorMsg = result.error ? result.error.message : "Unknown API error.";
      System_Logger.log("GeminiAPI", `Error ${responseCode}: ${errorMsg}`, true);
      throw new Error(`Gemini API Error (${responseCode}): ${errorMsg}`);
    }
  },

  /**
   * A helper function specifically for parsing JSON responses from the AI.
   * It cleans the raw text and attempts to parse it.
   * @param {string} rawText The raw text response from the Gemini API.
   * @returns {Object} The parsed JSON object.
   * @throws {Error} If the JSON is invalid or cannot be parsed.
   */
  parseJsonResponse: function(rawText) {
    try {
      // Remove markdown backticks and "json" specifier for robust parsing
      const cleanedText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleanedText);
    } catch (e) {
      System_Logger.log("GeminiAPI-Parse", `Failed to parse JSON response. Raw text: ${rawText}`, true);
      throw new Error(`AI returned invalid JSON: ${e.message}`);
    }
  }
};
