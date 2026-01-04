/**
 * -------------------------------------------------------------------------
 * FILE: AIEngine.gs
 * DESCRIPTION: Interfaces with Google's Gemini for market analysis.
 * -------------------------------------------------------------------------
 */

const AIEngine = {

  GEMINI_ENDPOINT: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",

  /**
   * Helper function to call the Gemini API.
   * @param {string} prompt The prompt to send to the AI.
   * @returns {string} The text response from the AI.
   */
  callGeminiAPI: function(prompt) {
    const apiKey = PropertiesService.getScriptProperties().getProperty('GENAI_API_KEY');
    if (!apiKey) throw new Error("Gemini API key is not set in Settings.");

    const url = `${this.GEMINI_ENDPOINT}?key=${apiKey}`;
    const payload = {
      "contents": [{
        "parts": [{ "text": prompt }]
      }],
      "generationConfig": {
        "temperature": 0.3,
        "maxOutputTokens": 1024
      }
    };

    const options = {
      'method': 'post',
      'contentType': 'application/json',
      'payload': JSON.stringify(payload),
      'muteHttpExceptions': true
    };

    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      if (result.candidates && result.candidates.length > 0) {
        return result.candidates[0].content.parts[0].text;
      } else {
        throw new Error("Invalid response structure from Gemini.");
      }
    } else {
      const errorMsg = result.error ? result.error.message : "Unknown API error.";
      throw new Error(`Gemini API Error ${responseCode}: ${errorMsg}`);
    }
  },

  /**
   * Generates a new watchlist based on a user-provided theme.
   * @param {string} theme The theme for the watchlist (e.g., "AI stocks").
   * @returns {string} A confirmation or error message.
   */
  generateNewWatchlist: function(theme) {
    const prompt = `
      Analyze the current market based on the theme: "${theme}".
      Identify the top 5 most promising stocks or cryptocurrencies related to this theme.
      For each, provide its ticker symbol and primary stock exchange (e.g., NASDAQ, NYSE, CRYPTO).
      Format the output ONLY as a JSON array of objects, with "ticker" and "exchange" keys.
      Example: [{"ticker": "GOOGL", "exchange": "NASDAQ"}, {"ticker": "BTC-USD", "exchange": "CRYPTO"}]
    `;

    try {
      const response = this.callGeminiAPI(prompt);
      // Clean the response to ensure it's valid JSON
      const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const newTickers = JSON.parse(cleanedResponse);

      let addedCount = 0;
      newTickers.forEach(item => {
        const result = DataEngine.addTicker(item.ticker, item.exchange);
        if (result.startsWith("Successfully")) {
          addedCount++;
        }
      });

      return `AI analysis complete. Added ${addedCount} new assets to the watchlist.`;

    } catch (e) {
      LogSystem.log("AI-GenerateWatchlist", e.toString(), true);
      throw new Error(`AI generation failed: ${e.message}`);
    }
  },

  /**
   * Periodically updates the 'AI_Bulls' sheet with bullish stock suggestions.
   * @param {Array<Object>} marketData The latest market data.
   */
  updateBullsSuggestions: function(marketData) {
    // Select top 3 performers based on projected return
    const topPerformers = marketData
      .sort((a, b) => b.projectedReturn - a.projectedReturn)
      .slice(0, 3);

    if (topPerformers.length === 0) return;

    const marketContext = JSON.stringify(topPerformers.map(s => ({
      ticker: s.ticker,
      price: s.price,
      projected_15min_return: s.projectedReturn,
      volatility: s.sigma
    })));

    const prompt = `
      You are a financial analyst AI. Given the following high-performing tickers from a quantitative model, provide a brief, plausible reason for why each might be considered bullish for the short term.

      Market Data:
      ${marketContext}

      For each ticker, provide a confidence score from 0.0 to 1.0 on your reasoning.
      Format the output ONLY as a JSON array of objects with "ticker", "reasoning", and "confidence" keys.
    `;

    try {
      const response = this.callGeminiAPI(prompt);
      const cleanedResponse = response.replace(/```json/g, '').replace(/```/g, '').trim();
      const suggestions = JSON.parse(cleanedResponse);

      // Update the sheet
      const ss = DataEngine.initEnvironment();
      const sheet = ss.getSheetByName('AI_Bulls');
      sheet.clearContents().getRange(1,1,1,4).setValues([['Ticker', 'Reasoning', 'Confidence_Score', 'Last_Updated']]).setFontWeight('bold');

      const newRows = suggestions.map(s => [s.ticker, s.reasoning, s.confidence, new Date()]);
      sheet.getRange(2, 1, newRows.length, 4).setValues(newRows);

      LogSystem.log("AIEngine", "Updated AI Bulls suggestions.");
    } catch (e) {
      LogSystem.log("AI-Bulls", e.toString(), true);
    }
  }
};
