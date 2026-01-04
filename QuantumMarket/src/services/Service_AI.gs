/**
 * ==========================================================================
 * FILE: Service_AI.gs
 * DESCRIPTION: High-level service for interacting with the Gemini AI.
 *              This service is responsible for "prompt engineering" and
 *              translating business logic into specific requests for the AI.
 * ==========================================================================
 */

const Service_AI = {

  /**
   * Generates a new watchlist based on a user-provided theme.
   * @param {string} theme The theme for the watchlist (e.g., "AI stocks").
   * @returns {string} A confirmation or error message for the UI.
   */
  generateNewWatchlist: function(theme) {
    const prompt = `
      You are a market analyst AI. Your task is to identify the top 7 most promising stocks or cryptocurrencies related to the theme: "${theme}".

      Consider factors like market capitalization, recent performance, and technological innovation.
      For each asset, provide its official ticker symbol and its primary stock exchange (e.g., NASDAQ, NYSE, CRYPTO).

      Format the output ONLY as a valid JSON array of objects, with "ticker" and "exchange" keys.
      Example: [{"ticker": "GOOGL", "exchange": "NASDAQ"}, {"ticker": "BTC-USD", "exchange": "CRYPTO"}]
    `;

    try {
      const rawResponse = Gemini_API.generateContent(prompt, 0.5);
      const newTickers = Gemini_API.parseJsonResponse(rawResponse);

      let addedCount = 0;
      newTickers.forEach(item => {
        if (item.ticker && item.exchange) {
          const result = Service_Data.addTicker(item.ticker, item.exchange);
          if (result.startsWith("Successfully")) {
            addedCount++;
          }
        }
      });

      return `AI analysis complete. Added ${addedCount} of ${newTickers.length} suggested assets to the watchlist.`;

    } catch (e) {
      System_Logger.log("AI-GenerateWatchlist", e.toString(), true);
      throw e; // Re-throw for the UI handler to catch
    }
  },

  /**
   * Periodically updates the 'AI_Bulls' sheet with bullish stock suggestions.
   * @param {Array<Object>} marketData The latest market data from the quant service.
   */
  updateBullsSuggestions: function(marketData) {
    // Select top 5 performers based on a combination of return and low error
    const topPerformers = marketData
      .filter(s => s.error < 0.05) // Filter out wildly inaccurate projections
      .sort((a, b) => b.projectedReturn - a.projectedReturn)
      .slice(0, 5);

    if (topPerformers.length < 3) return;

    const marketContext = JSON.stringify(topPerformers.map(s => ({
      ticker: s.ticker,
      price: s.price,
      proj_return: s.projectedReturn,
      volatility: s.sigma,
      beta: s.beta
    })));

    const prompt = `
      You are a succinct financial analyst AI. Given the following high-performing tickers from a quantitative model, provide a brief, plausible, and unique reason for why each might be considered bullish for the next 1-2 hours.

      Market Data:
      ${marketContext}

      For each ticker, provide a confidence score from 0.0 to 1.0 on your reasoning.
      Format the output ONLY as a valid JSON array of objects with "ticker", "reasoning", and "confidence" keys.
      Reasoning should be concise (under 15 words).
    `;

    try {
      const rawResponse = Gemini_API.generateContent(prompt, 0.7);
      const suggestions = Gemini_API.parseJsonResponse(rawResponse);

      const ss = Service_Data.initEnvironment();
      const sheet = ss.getSheetByName('AI_Bulls');
      sheet.clearContents().getRange(1,1,1,4).setValues([['Ticker', 'Reasoning', 'Confidence_Score', 'Last_Updated']]).setFontWeight('bold');

      const newRows = suggestions.map(s => [s.ticker, s.reasoning, s.confidence, new Date()]);
      if (newRows.length > 0) {
        sheet.getRange(2, 1, newRows.length, 4).setValues(newRows);
      }

      System_Logger.log("AIEngine", "Updated AI Bulls suggestions.");
    } catch (e) {
      System_Logger.log("AI-Bulls", e.toString(), true);
    }
  },

  /**
   * Fetches a daily prediction for a single stock from the Oracle.
   * @param {Object} stock The stock object {ticker, exchange}.
   * @param {string} marketContext The JSON string of previous day's data.
   * @returns {Object|null} The prediction data object or null on failure.
   */
  fetchOraclePrediction: function(stock, marketContext) {
    const prompt = `
      Act as a market prediction oracle.
      You are given a ticker and the previous day's price and volatility data for the entire market watchlist.
      Your task is to predict the OPENING price and the CLOSING price for the given ticker.
      Also, provide a CONFIDENCE score (0.0 to 1.0) for your closing prediction.

      Ticker to Predict: ${stock.ticker} (${stock.exchange})

      Previous Day Market Context (condensed price/sigma tuples):
      ${marketContext}

      Constraints:
      - Analyze the ticker's historical volatility and its relation to the broader market context provided.
      - Base your prediction on patterns within the data, not external news.
      - Return ONLY a single, valid JSON object with the keys "ticker", "opening_prediction", "closing_prediction", and "confidence". Do not include any other text or formatting.
    `;

    try {
      const rawResponse = Gemini_API.generateContent(prompt, 0.2);
      return Gemini_API.parseJsonResponse(rawResponse);
    } catch(e) {
      System_Logger.log("AI-OracleFetch", `Failed for ${stock.ticker}: ${e.message}`, true);
      return null; // Return null to allow the loop to continue
    }
  }
};
