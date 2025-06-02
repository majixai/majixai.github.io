// jinx_strategy/services/geminiService.js

// IMPORTANT: API Key Management
// The API_KEY should NOT be hardcoded directly in the source code like this for production environments.
// It should be stored securely, for example, in an environment variable,
// a configuration file that is not committed to version control, or fetched from a secure vault.
// For browser-side JavaScript, if the API calls are made directly from the client,
// this often involves a backend proxy to protect the API key.
// For this example, we'll use a placeholder and assume it's managed securely.
const API_KEY = 'YOUR_GEMINI_API_KEY'; // Replace with your actual key if testing locally, but DO NOT COMMIT
const GEMINI_API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Constructs a prompt for the Gemini API based on market data.
 * @param {string} symbol The stock, FX, or crypto symbol.
 * @param {string} timeframe The user-selected timeframe (e.g., "1H", "1D", "1W").
 * @param {string} pattern The user-provided chart pattern (can be empty).
 * @returns {string} The prompt for the Gemini API.
 */
function constructPrompt(symbol, timeframe, pattern) {
    let prompt = `Provide a financial market analysis for the symbol: ${symbol} over a ${timeframe} timeframe.`;

    if (pattern && pattern.trim() !== '') {
        prompt += ` Consider the chart pattern: ${pattern.trim()}.`;
    } else {
        prompt += " No specific chart pattern was provided by the user.";
    }

    prompt += `

Your analysis should include:
1.  A general outlook text (max 2-3 sentences).
2.  A potential price prediction (target price as a number, confidence level as a number between 0.0 and 1.0, and timescale like 'short-term', 'medium-term', 'long-term').
3.  Two distinct actionable option trade suggestions (e.g., Call or Put, strike price, and a brief rationale for each).

Return the response as a JSON object with the following structure:
{
  "predictionText": "string",
  "pricePrediction": {
    "target": "number",
    "confidence": "number",
    "timescale": "string"
  },
  "recommendedOptions": [
    { "type": "Call | Put", "strike": "number", "rationale": "string" },
    { "type": "Call | Put", "strike": "number", "rationale": "string" }
  ]
}

Ensure the output is only the JSON object.`;
    return prompt;
}

/**
 * Parses the response from the Gemini API.
 * @param {object} apiResponse The raw JSON response from the Gemini API.
 * @returns {object | null} The parsed prediction data, or null if parsing fails.
 */
function parseGeminiResponse(apiResponse) {
    try {
        // Gemini API typically returns content in response.candidates[0].content.parts[0].text
        if (apiResponse && apiResponse.candidates && apiResponse.candidates.length > 0) {
            const textPart = apiResponse.candidates[0].content.parts[0].text;
            if (textPart) {
                // Clean the text to ensure it's valid JSON (sometimes models add backticks or "json" prefix)
                const cleanedJsonString = textPart.replace(/^```json\s*|```$/g, '').trim();
                const parsedJson = JSON.parse(cleanedJsonString);

                // Basic validation of the parsed structure
                if (parsedJson.predictionText && parsedJson.pricePrediction && parsedJson.recommendedOptions) {
                    return parsedJson;
                } else {
                    console.error("Parsed JSON from Gemini is missing expected fields:", parsedJson);
                    return null;
                }
            }
        }
        console.error("Invalid or unexpected Gemini API response structure:", apiResponse);
        return null;
    } catch (error) {
        console.error("Error parsing Gemini API response:", error, "Raw response:", apiResponse);
        return {
            predictionText: "Error: Could not parse the prediction data from AI.",
            pricePrediction: { target: 0, confidence: 0, timescale: "N/A" },
            recommendedOptions: []
        };
    }
}

/**
 * Fetches market predictions from the Google Gemini API.
 * @param {string} symbol The stock, FX, or crypto symbol.
 * @param {string} timeframe The user-selected timeframe.
 * @param {string} pattern The user-provided chart pattern.
 * @returns {Promise<object>} A promise that resolves to the structured prediction data.
 */
export async function getPrediction(symbol, timeframe, pattern) {
    const prompt = constructPrompt(symbol, timeframe, pattern);
    const requestBody = {
        contents: [{
            parts: [{ text: prompt }]
        }],
        // Optional: Add generationConfig if needed (e.g., temperature, maxOutputTokens)
        // generationConfig: {
        //   temperature: 0.7,
        //   maxOutputTokens: 500,
        // }
    };

    console.log(`GeminiService: Calling API for Symbol: ${symbol}, Timeframe: ${timeframe}, Pattern: '${pattern || 'None'}'`);
    // console.log("GeminiService: Request body:", JSON.stringify(requestBody, null, 2));


    try {
        const response = await fetch(`${GEMINI_API_ENDPOINT}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Gemini API request failed:", response.status, errorBody);
            throw new Error(`Gemini API request failed with status ${response.status}: ${errorBody}`);
        }

        const responseData = await response.json();
        // console.log("GeminiService: Raw API Response:", JSON.stringify(responseData, null, 2));

        const parsedPrediction = parseGeminiResponse(responseData);

        if (!parsedPrediction) {
             throw new Error("Failed to parse prediction from Gemini API response.");
        }

        return {
            symbol: symbol,
            timeframe: timeframe,
            pattern: pattern || 'None',
            ...parsedPrediction
        };

    } catch (error) {
        console.error("Error in getPrediction calling Gemini API:", error);
        // Return a structured error object that the UI can handle
        return {
            symbol: symbol,
            timeframe: timeframe,
            pattern: pattern || 'None',
            predictionText: `Error fetching prediction from AI: ${error.message}`,
            pricePrediction: { target: 0, confidence: 0, timescale: "Error" },
            recommendedOptions: [],
            error: true
        };
    }
}
