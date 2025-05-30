// Assuming @google/genai is available globally or via a module loader.
// For pure JS in browser, you'd typically include it via a <script> tag if it has a UMD build,
// or use a build tool like Webpack/Rollup to bundle it.
// Since we're refactoring to pure JS *without a build process initially*,
// this import will likely cause issues at runtime unless GenAI is attached to `window`.
// We'll proceed assuming it might be available via a CDN script in the HTML.
let GoogleGenAI; // Placeholder
if (typeof window !== 'undefined' && window.GoogleGenAI) {
    GoogleGenAI = window.GoogleGenAI;
} else if (typeof require === 'function') {
    // This is a fallback for Node.js like environment, won't work in browser directly
    try {
        // const genAIModule = require("@google/genai"); // This line would cause error in browser if not handled
        // GoogleGenAI = genAIModule.GoogleGenAI;
        console.warn("@google/genai module not truly loaded in browser pure JS. This will fail if not provided via CDN/global.")
    } catch (e) {
        console.error("Failed to load @google/genai module. Ensure it's available globally (e.g., via CDN).");
    }
}


import {
    OptionType,
    Action,
    StockPriceCategory,
    OutlookHorizon,
    AICallType
    // GeminiStrategyDataResponse, GroundingSource, GeminiBlackScholesInputsResponse,
    // OptionsChainData, OptionChainEntry, TargetStrikeInfo,
    // GeminiStrategySuggestionResponse, SuggestedStrategyInfo,
    // GeminiBullishStockSuggestionResponse, GeminiDeeperAnalysisResponse,
    // BullishStockSuggestion, StoredBullishStockSuggestion,
    // PriceProjectionDetail, FMPProfile, FMPQuote, ChartPatternInfo,
    // BarPlayAnalysisInfo, HistoricalOptionLegSuggestion, GeminiSuggestedHistoricalOption
    // These are effectively JSDoc types now
} from '../types.js'; // Assuming .js extension

// API_KEY will not be available via process.env in client-side JS.
// This needs to be handled differently (e.g., fetched from a secure backend, or via a config)
// For now, we'll make it a global-like variable that should be set.
let API_KEY = null;
if (typeof process !== 'undefined' && process.env && process.env.API_KEY) {
    API_KEY = process.env.API_KEY;
} else {
    console.warn("API_KEY not found in process.env. Please ensure it is set globally or fetched securely for the application to work.");
    // You might set a placeholder here for development, but it's a security risk for production.
    // API_KEY = "YOUR_GEMINI_API_KEY_HERE"; // DO NOT COMMIT ACTUAL KEY
}


/**
 * @param {any} error
 * @param {string} context
 * @returns {{ error: string, durationMs?: number }}
 */
export const commonErrorHandler = (error, context) => {
  console.error(`Error during ${context}:`, error);
  let errorMessage = `An unknown error occurred during ${context}.`;
  if (error instanceof Error) {
      errorMessage = error.message;
  } else if (typeof error === 'string') {
      errorMessage = error;
  }
  if (typeof error === 'object' && error !== null) {
    if ('message' in error) errorMessage = error.message;
  }
  return { error: `API Error (${context}): ${errorMessage}` };
};

/**
 * @template T
 * @param {AICallType} callType
 * @param {string} prompt
 * @param {boolean} [fmpDataUsed=false]
 * @param {string} [modelName="gemini-1.5-flash-latest"] 
 * @param {number} [temperatureToUse=0.0]
 * @param {(text: string | undefined, context: string) => any} [parser]
 * @returns {Promise<T extends { sources?: import('../types.js').GroundingSource[], error?: string, durationMs?: number, fmpDataUsed?: boolean } ? T : any>}
 */
export const executeAICall = async (
    callType,
    prompt,
    fmpDataUsed = false,
    modelName = "gemini-1.5-flash-latest", // Updated model name
    temperatureToUse = 0.0,
    parser
) => {
    if (!API_KEY) {
        console.error(`API_KEY is not configured for ${callType}.`);
        // @ts-ignore
        return { error: `API Key not configured. Cannot execute ${callType}.`, fmpDataUsed };
    }
    if (!GoogleGenAI) {
        console.error("GoogleGenAI SDK is not available. Ensure it's loaded.");
        // @ts-ignore
        return { error: "GoogleGenAI SDK not loaded.", fmpDataUsed };
    }
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    const startTime = performance.now();

    const geminiConfig = {
        // tools: [{ googleSearch: {} }], // googleSearch tool might not be available or desired for all models/versions
        // Temperature can be set if not using tools that restrict it.
        temperature: temperatureToUse,
    };

    try {
        const model = ai.getGenerativeModel({ model: modelName, ...geminiConfig });
        const result = await model.generateContent(prompt);
        const response = await result.response; // Correct way to get response object

        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);

        const sources = extractSources(response); // Pass the actual response object
        let parsedData = null;

        const responseText = response.text(); // Correct way to get text

        if (parser) {
            parsedData = parser(responseText, callType);
            if (parser === parseJsonFromResponse && !parsedData && responseText && responseText.trim() !== '') {
                // @ts-ignore
                 return { error: `AI returned an unparsable JSON response for ${callType}. Original text: ${responseText.substring(0,100)}...`, sources, durationMs, fmpDataUsed };
            }
        } else {
            parsedData = { text: responseText?.trim() };
        }

        if (!parsedData && parser && responseText && responseText.trim() !== '') {
            // @ts-ignore
             return { error: `AI returned an empty or unparsable response for ${callType} despite receiving text.`, sources, durationMs, fmpDataUsed };
        }
        if (!responseText || responseText.trim() === '') {
             console.warn(`AI returned empty text response for ${callType}.`);
        }
        // @ts-ignore
        return { ...parsedData, sources, durationMs, fmpDataUsed };

    } catch (error) {
        const endTime = performance.now();
        const durationMs = Math.round(endTime - startTime);
        const handlerResult = commonErrorHandler(error, callType);
        // @ts-ignore
        return { ...handlerResult, durationMs, fmpDataUsed };
    }
};

/**
 * @param {any} response From GenerateContentResponse object
 * @returns {import('../types.js').GroundingSource[]}
 */
export const extractSources = (response) => {
  // The structure of groundingMetadata might vary. Adapt based on actual SDK version.
  // This is a common structure, but check GoogleGenAI documentation.
  const groundingMetadata = response.candidates?.[0]?.groundingMetadata;
  /** @type {import('../types.js').GroundingSource[]} */
  const sources = [];
  const seenUris = new Set();

  groundingMetadata?.groundingAttributions?.forEach((attribution) => {
    const sourceId = attribution.sourceId; // This might be how it's structured
    const webUri = attribution.web?.uri;
    const webTitle = attribution.web?.title;
    
    // Example logic, adjust based on actual structure from SDK
    let uri = webUri; // Or some other field from sourceId if it's an object
    let title = webTitle || (uri ? new URL(uri).hostname : "Unknown Source");

    if (uri && uri !== "N/A" && uri !== "" && !seenUris.has(uri)) {
      sources.push({ uri: uri, title: title });
      seenUris.add(uri);
    }
  });
  // Fallback if groundingAttributions is not the path, check older paths.
   if (sources.length === 0 && groundingMetadata?.groundingChunks) {
        groundingMetadata.groundingChunks.forEach((chunk) => {
            const uri = chunk.web?.uri || chunk.retrievedContext?.uri;
            if (uri && uri !== "N/A" && uri !== "" && !seenUris.has(uri)) {
                sources.push({
                    uri: uri,
                    title: chunk.web?.title || chunk.retrievedContext?.title || new URL(uri).hostname || "Unknown Source"
                });
                seenUris.add(uri);
            }
        });
    }
  return sources;
};

/**
 * @param {string | undefined} text
 * @param {string} context
 * @returns {any | null}
 */
export const parseJsonFromResponse = (text, context) => {
    if (!text || text.trim() === '') {
        console.warn(`Gemini response text is empty for ${context}. Cannot parse JSON.`);
        return null;
    }
    let jsonString = text.trim();
    const fenceRegex = /^```(?:json)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonString.match(fenceRegex);
    if (match && match[1]) {
      jsonString = match[1].trim();
    }
    try {
      return JSON.parse(jsonString);
    } catch (parseError) {
      console.error(`Failed to parse JSON response from Gemini for ${context}:`, parseError);
      console.error("Received string for parsing (trimmed):", jsonString.substring(0, 500) + (jsonString.length > 500 ? "..." : ""));
      return null;
    }
}

// --- PROMPT DEFINITIONS ---
/**
 * @param {string} underlyingName
 * @param {string} strategyName
 * @param {string} legRolesDescription
 * @param {import('../types.js').FMPProfile | null} fmpProfile
 * @param {import('../types.js').FMPQuote | null} fmpQuote
 * @param {import('../types.js').OptionsChainData | null} fmpOptionsChain
 * @returns {string}
 */
export const getStrategyDataPrompt = (
    underlyingName,
    strategyName,
    legRolesDescription,
    fmpProfile,
    fmpQuote,
    fmpOptionsChain
) => {
    const currentStockPriceFromFMP = fmpQuote?.price || fmpProfile?.price || null;
    const fmpDataSummary = `
FMP Data Context for ${underlyingName}:
- Profile: ${fmpProfile ? `Sector: ${fmpProfile.sector}, Industry: ${fmpProfile.industry}, Beta: ${fmpProfile.beta}, MktCap: ${fmpProfile.mktCap}` : "Not available."}
- Quote: ${fmpQuote ? `Price: ${fmpQuote.price}, Change: ${fmpQuote.change} (${fmpQuote.changesPercentage}%), Volume: ${fmpQuote.volume}, AvgVol: ${fmpQuote.avgVolume}` : "Not available."}
- Current Stock Price (from FMP): ${currentStockPriceFromFMP || "Not available."}
- Options Chain (from FMP): ${fmpOptionsChain ? `Expiration: ${fmpOptionsChain.expirationDate}, ${fmpOptionsChain.calls.length} Calls, ${fmpOptionsChain.puts.length} Puts. First call strike: ${fmpOptionsChain.calls[0]?.strike}, Last put strike: ${fmpOptionsChain.puts[fmpOptionsChain.puts.length-1]?.strike}` : "Not available. You may need to rely on general knowledge or search if specific strikes are needed."}
`;

    const requestedJsonStructure = `{
  "currentStockPrice": "<price_number_confirmed_or_from_FMP | null>",
  "suggestedPointValue": "<standard_point_value_for_underlying e.g. 100, 50 | null>",
  "suggestedNumPoints": "<suggested_number_of_plot_points_e.g. 200, 300 | null>",
  "targetStrikesByRole": [
    { "role": "<Exact Role String from List Provided>", "targetStrike": "<strike_price_number_selected_from_PROVIDED_FMP_chain_or_based_on_FMP_price | null>" }
  ],
  "dataComment": "<Brief comment about how FMP data was used or if any issues interpreting it. If FMP chain was missing, state that. State clearly if any data (e.g. target strikes) could not be determined despite FMP data.>"
}`;
    return `
Given the underlying asset "${underlyingName}", a "${strategyName}" strategy with these legs:
${legRolesDescription}

And the following market data primarily sourced from Financial Modeling Prep (FMP):
${fmpDataSummary}

Please perform the following based on the PROVIDED FMP data and your general market knowledge:
1. Confirm/provide the current market price of "${underlyingName}". Prioritize FMP's quote if available.
2. Suggest the standard option contract point value for "${underlyingName}".
3. Suggest a number of plot points for the P/L graph.
4. For each leg 'role' defined in the input strategy, suggest a specific numeric targetStrike price. This strike MUST be selected from the strikes available in the PROVIDED FMP options chain (if available) or be a reasonable choice based on the FMP current stock price and common practices for that strategy.

CRITICAL: Respond as a single, minified JSON object: ${requestedJsonStructure}
Ensure all price/strike/value fields are numbers if determined, otherwise null. 'role' in 'targetStrikesByRole' must match an input role.
**DO NOT generate an options chain; use the one provided from FMP if available to select target strikes.** If the FMP options chain is marked "Not available" in the context, you may need to use general knowledge for strike selection relative to the FMP price, or indicate if not possible.
`;
}

/**
 * @param {string} strategyName
 * @returns {string}
 */
export const getStrategyExplanationPrompt = (strategyName) => {
  return `Explain the American-style option strategy: "${strategyName}". Cover its typical goal, general market outlook (e.g., bullish, bearish, neutral, high/low volatility), typical risk/reward profile (e.g., defined/undefined risk, limited/unlimited profit), and how its profit/loss is generally achieved. Keep the explanation detailed enough for an intermediate options trader, around 4-6 sentences. If you use external knowledge, cite it.`;
}

/**
 * @param {string} underlyingName
 * @returns {string}
 */
export const getBlackScholesInputsPrompt = (underlyingName) => {
    const requestedJsonStructure = `{
  "stockPrice": "<current_price_number | null>",
  "strikePrice": "<suggested_ATM_strike_price_number | null>",
  "timeToExpiration": "<typical_time_in_years_decimal_e.g.0.25 | null>",
  "riskFreeRate": "<current_annualized_risk_free_rate_decimal_e.g.0.05 | null>",
  "volatility": "<current_annualized_volatility_decimal_e.g.0.20 | null>",
  "dataComment": "<Brief comment about data source, recency or any issues encountered. State if data is not real-time. DO NOT FABRICATE OR SIMULATE DATA.>"
}`;
  return `
For the underlying asset "${underlyingName}", provide the following data points suitable for a Black-Scholes (European-style) option pricing model. **Retrieve real market data where possible from reliable financial sources. ABSOLUTELY DO NOT PROVIDE ILLUSTRATIVE OR SIMULATED DATA.** If actual data for any field is unavailable, return null for that field.
1. Current stock price.
2. A suggested At-The-Money (ATM) strike price (should be close or equal to the current stock price, reflecting an actual tradable strike if possible from market data).
3. A typical time to expiration for actively traded options, expressed in years (e.g., 0.25 for 3 months, 0.0833 for 1 month).
4. The current annualized risk-free interest rate (e.g., based on a short-term U.S. Treasury bill yield from a financial data provider).
5. The current annualized volatility (implied or historical) for "${underlyingName}", obtained from financial data sources.

CRITICAL: Present your entire response as a single, minified JSON object string. Do NOT include any surrounding text, explanations, or markdown formatting. The JSON object must strictly follow this structure:
${requestedJsonStructure}

Ensure all values are numbers if available from real market data, otherwise use null.
`;
}

/**
 * @param {string} underlyingName
 * @returns {Promise<import('../types.js').GeminiBlackScholesInputsResponse>}
 */
export const fetchBlackScholesInputsFromGemini = async (underlyingName) => {
    const prompt = getBlackScholesInputsPrompt(underlyingName);
    const result = await executeAICall(
        AICallType.BsInputs,
        prompt,
        false,
        "gemini-1.5-flash-latest", // Updated model name
        0.0,
        parseJsonFromResponse
    );

    if (!result.error) {
        if (result.stockPrice === undefined) result.stockPrice = null;
        if (result.strikePrice === undefined) result.strikePrice = null;
        if (result.timeToExpiration === undefined) result.timeToExpiration = null;
        if (result.riskFreeRate === undefined) result.riskFreeRate = null;
        if (result.volatility === undefined) result.volatility = null;
    }
    return result;
};

/**
 * @param {string} underlyingName
 * @param {string[]} predefinedStrategyNames
 * @param {import('../types.js').FMPProfile | null} fmpProfile
 * @param {import('../types.js').FMPQuote | null} fmpQuote
 * @returns {string}
 */
export const getStrategySuggestionsPrompt = (
    underlyingName,
    predefinedStrategyNames,
    fmpProfile,
    fmpQuote
) => {
    const strategyListString = predefinedStrategyNames.filter(name => name !== "Select a Strategy...").join(", ");
    const fmpDataSummary = `
FMP Data Context for ${underlyingName}:
- Profile: ${fmpProfile ? `Sector: ${fmpProfile.sector}, Industry: ${fmpProfile.industry}, Beta: ${fmpProfile.beta}, MktCap: ${fmpProfile.mktCap}` : "Not available."}
- Quote: ${fmpQuote ? `Price: ${fmpQuote.price}, Change: ${fmpQuote.change} (${fmpQuote.changesPercentage}%), Volume: ${fmpQuote.volume}, AvgVol: ${fmpQuote.avgVolume}, Day Range: ${fmpQuote.dayLow}-${fmpQuote.dayHigh}` : "Not available."}
`;

    const requestedJsonStructure = `{
  "suggestedStrategies": [
    {
      "name": "<StrategyNameFromProvidedList>",
      "rank": "<numeric_rank_1_to_N | null>",
      "suitability": "<'High' | 'Medium' | 'Low' | 'Score X/10'>",
      "reasoning": "<Detailed reasoning (minimum 4-6 sentences) for this American-style option strategy. This MUST connect the strategy's characteristics to an in-depth technical analysis of '${underlyingName}', incorporating the PROVIDED FMP data context (e.g., sector trends, company specifics if relevant from profile, current price action from quote) and any further real-time technical indicators/chart patterns you can find via search. Quantify indicator values (e.g., 'RSI is 68', 'Price just broke above 50-day MA at $X.XX'). If relevant, mention advanced financial modeling concepts briefly. State if the strategy is better for high/low implied volatility based on this context.>"
    }
  ],
  "dataComment": "<Overall market outlook summary for ${underlyingName} that led to these suggestions, integrating FMP data insights and search-based technicals. Clearly state if real-time indicator data was unavailable. DO NOT FABRICATE INDICATOR VALUES.>"
}`;

    return `
Analyze the underlying asset "${underlyingName}", using the following context from Financial Modeling Prep (FMP) and further real-time financial data and technical indicators/chart patterns you find via search:
${fmpDataSummary}

Consider:
- Current price trend, volatility (implied/historical).
- Key Technical Indicators (RSI, MACD, MAs, Volume, Candlesticks) with specific values.
- Chart Patterns (Support/Resistance, Trendlines, etc.) with detailed textual descriptions.
- Include a mix of simpler (e.g., Long Call, Bull Put Spread) and more advanced strategies (e.g., Iron Condor, Butterfly, Calendars) from the provided list if the analysis supports them.

From the list: ${strategyListString}.
Suggest 3 to 5 strategies suitable for "${underlyingName}" based on your comprehensive analysis (FMP data + search).
For EACH suggested strategy:
1. Its exact name.
2. A numeric rank (1 being most suitable, 2 next, etc.).
3. A suitability assessment (e.g., "High", "Medium", "Low", or "Score 8/10").
4. Detailed reasoning (min 4-6 sentences) linking strategy characteristics to your specific technical analysis of "${underlyingName}", including FMP context, chart patterns, and indicator values.

CRITICAL: Respond as a single, minified JSON: ${requestedJsonStructure}
Ensure 'name' matches list. Reasoning must be specific, technical, and use PROVIDED FMP context and searched data. All suggested strategies must have a rank and suitability.
`;
}

/**
 * @returns {string}
 */
export const getBullishStockSuggestionsPrompt = () => {
    const requestedJsonStructureInitial = `{
  "suggestedStocks": [
    {
      "ticker": "<STOCK_TICKER_UPPERCASE_NO_SPACES>",
      "currentPrice": "<current_market_price_number | null>",
      "projectedPriceChangePercentMin": "<initial_min_percentage_number_e.g. 5 | null>",
      "projectedPriceChangePercentMax": "<initial_max_percentage_number_e.g. 15 | null>",
      "projectedTimeline": "<initial_specific_timeline_string_e.g. 'Within 1 hour', '2-6 hours', 'By EOD today', '1-3 days' | null>",
      "priceCategory": "<'${StockPriceCategory.Below15}' | '${StockPriceCategory.AboveOrEqual15}'>",
      "outlookHorizon": "<'${OutlookHorizon.ShortTerm}' | '${OutlookHorizon.MidTerm}' | '${OutlookHorizon.LongTerm}'>",
      "reasoning": "<MANDATORY_BULLISH_RATIONALE (minimum 35 chars, ideally 2-3 sentences). Mention key supporting factors like specific technical signals, chart patterns, or news if available. **This field MUST be populated with insightful text meeting the minimum character length. DO NOT leave empty or with placeholder text.**>"
    }
  ],
  "dataComment": "<Brief comment on data sources consulted e.g. Yahoo Finance Top Gainers, TradingView screener for 'Strong Buy' stocks, specific financial news headlines. State the recency or effective date of the market data used for this initial analysis. ABSOLUTELY NO SIMULATED DATA. Consider data from FMP if accessible through your search tools.>"
}`;

    return `
Perform an initial scan to identify 6-10 stock tickers from US markets currently exhibiting strong bullish signals.
**Your primary focus and heaviest search effort should be on identifying highly promising SHORT-TERM gainers.** These are stocks expected to see significant price movement within seconds up to a full trading day (e.g., timelines like 'Within 1 hour', '2-6 hours', 'By EOD today').
For these short-term candidates, prioritize those with clear, verifiable technical momentum signals (e.g., RSI breaking above 70 on an intraday chart, MACD bullish crossover on intraday, very high relative volume surges) or immediate catalysts (e.g., recent breaking news, earnings surprises if accessible).
Also include some candidates for shorter mid-term (e.g., '1-3 days', 'Within 1 week') and a few longer-term prospects if signals are exceptionally compelling, but the emphasis is on the immediate short-term opportunities.

You MUST consult diverse, reliable financial data sources like Yahoo Finance, TradingView, MarketWatch, Finviz, Financial Modeling Prep (FMP) if accessible, and current financial news.
For EACH suggested stock, provide:
1.  Its ticker symbol (UPPERCASE, no spaces).
2.  Its current market price (numeric or null if real-time data not found).
3.  An *initial* projected minimum and maximum percentage price change (e.g., +5% to +15%).
4.  An *initial* specific projected timeline for this potential price change (e.g., "Within 1 hour", "2-6 hours", "1-3 days", "By EOD today").
5.  Its price category based on the current price: "${StockPriceCategory.Below15}" or "${StockPriceCategory.AboveOrEqual15}".
6.  Its outlook horizon, aligning with the granular projected timeline: "${OutlookHorizon.ShortTerm}", "${OutlookHorizon.MidTerm}", or "${OutlookHorizon.LongTerm}".
7.  A brief initial reasoning (minimum 35 characters, ideally 2-3 sentences) based on key technical indicators or chart patterns. If readily apparent from top sources, include a very brief note on market microstructure (e.g., high liquidity, unusual volume spike) or covariance (e.g., strong positive correlation with SPY). Ensure reasoning is provided and meets the minimum length. **DO NOT leave the reasoning field empty or with generic placeholder text.**

**ABSOLUTELY DO NOT PROVIDE ILLUSTRATIVE OR SIMULATED DATA, INDICATOR VALUES, PRICE PROJECTIONS, OR PATTERNS.** All information must be grounded in what can be retrieved and interpreted from real market data and financial analysis sources. If data for a field is unavailable, use null.

ULTRA-CRITICAL: Your entire response MUST BE a single, minified JSON object. Do NOT include ANY introductory text, concluding remarks, or markdown \`json\` fences. The JSON object must strictly follow this structure:
${requestedJsonStructureInitial}
If you cannot fulfill the request perfectly in the specified JSON format, you MUST return an empty JSON object like "{}".
`;
}

/**
 * @param {string} ticker
 * @param {number | null} currentPrice
 * @param {import('../types.js').StoredBullishStockSuggestion} initialSuggestionData
 * @param {import('../types.js').FMPProfile | null} fmpProfile
 * @param {import('../types.js').FMPQuote | null} fmpQuote
 * @returns {string}
 */
export const getDeeperStockAnalysisPrompt = (
    ticker,
    currentPrice,
    initialSuggestionData,
    fmpProfile,
    fmpQuote
) => {
    const initialContext = JSON.stringify({
        ticker: initialSuggestionData.ticker,
        currentPriceAtInitialSuggestion: initialSuggestionData.currentPrice,
        initialReasoning: initialSuggestionData.reasoning,
        initialProjection: {
            minPercent: initialSuggestionData.projectedPriceChangePercentMin,
            maxPercent: initialSuggestionData.projectedPriceChangePercentMax,
            timeline: initialSuggestionData.projectedTimeline,
        },
        previousDeepDiveTimestamp: initialSuggestionData.analysisTimestamp ? new Date(initialSuggestionData.analysisTimestamp).toISOString() : null,
        previousMicrostructure: initialSuggestionData.microstructureInsights,
        previousCovariance: initialSuggestionData.covarianceConsiderations,
        previousModelRefs: initialSuggestionData.advancedModelReferences,
        previousChartPatterns: initialSuggestionData.currentChartPatterns,
        previousBarPlays: initialSuggestionData.barPlayAnalysis,
    }, null, 2);

    const fmpDataSummary = `
Fresh FMP Data Context for ${ticker} (to be used alongside initial context and new searches):
- Profile: ${fmpProfile ? `Sector: ${fmpProfile.sector}, Industry: ${fmpProfile.industry}, Beta: ${fmpProfile.beta}, MktCap: ${fmpProfile.mktCap}` : "Not available."}
- Quote: ${fmpQuote ? `Fresh Price: ${fmpQuote.price}, Change: ${fmpQuote.change} (${fmpQuote.changesPercentage}%), Volume: ${fmpQuote.volume}, AvgVol: ${fmpQuote.avgVolume}, Day Range: ${fmpQuote.dayLow}-${fmpQuote.dayHigh}` : "Not available."}
- Current Price (from fresh FMP Quote, if available): ${fmpQuote?.price || "Not available. Use provided 'currentPrice' or search."}
`;

    const requestedJsonStructureDeeper = `{
  "detailedReasoning": "<VERY Detailed reasoning (minimum 8-10 sentences) affirming or refining the initial bullish outlook for ${ticker} for *today's trading session*, focusing on elements that could lead to the largest percent change. This MUST incorporate: 1. In-depth analysis of MULTIPLE specific technical indicators with current values/status on INTRADAY charts (e.g., 'RSI(5-min) at 65, trending up', 'MACD(1-min) crossed above signal line', 'Price above 20-period MA on 15-min chart at $Y.YY'). Quantify if possible. 2. Description of specific chart patterns observed *on intraday timeframes* (e.g., 'intraday ascending triangle forming on 5-min chart with resistance at $A.AA', 'bull flag breakout on 1-min chart above $D.DD with measured move target to $E.EE'). Describe these patterns textually in detail. 3. Brief calculus-inspired analysis of price dynamics (e.g., 'momentum is increasing rapidly as shown by the slope of the 5-min MACD histogram', 'price is accelerating away from the VWAP'). 4. Connection to any *intraday* micro/macroeconomic news, data releases, or discernible news sentiment if highly relevant and impactful on ${ticker}'s volatility today. Integrate insights from the fresh FMP data provided.>",
  "currentChartPatterns": [
    {
      "patternName": "<e.g., Bull Flag, Ascending Triangle, Head and Shoulders Bottom | null>",
      "description": "<Detailed description of the pattern formation, key price levels, volume characteristics, and potential implications. | null>",
      "timeframe": "<e.g., 1-min, 5-min, 15-min, Hourly | null>",
      "keyLevels": "<e.g., Support at $X.XX, Resistance at $Y.YY, Breakout point $Z.ZZ | null>",
      "status": "<'Forming' | 'Confirmed Breakout' | 'Failed Breakout' | 'Approaching Resistance/Support' | null>"
    }
  ],
  "barPlayAnalysis": [
    {
      "playType": "<e.g., 3-bar bullish play, 5-bar reversal, Inside bar breakout | null>",
      "outcome": "<'Identified - Bullish' | 'Identified - Bearish' | 'Not Clearly Identified' | 'Potential Setup' | null>",
      "confidence": "<'High' | 'Medium' | 'Low' | null>",
      "description": "<Detailed description of the specific bar pattern observed, including key bars, volume characteristics during formation, confirmation signals, and potential targets or stop-loss considerations. | null>",
      "relevantTimeframe": "<e.g., 1-min, 5-min, Tick Chart | null>"
    }
  ],
  "priceProjectionDetails": [
    {
      "targetPrice": "<specific_intraday_numeric_price_target | null>",
      "probabilityEstimate": "<qualitative_string e.g. 'High', 'Medium', or quantitative e.g. '60-70%'. If possible, relate to statistical measures like standard deviations: 'Target is within 1.5 std dev of expected intraday move based on current ATR(1-min) projection' | null>",
      "projectedPriceChangePercent": "<numeric_percentage_change_for_this_target_from_current_price | null>",
      "timelineDetail": "<specific_intraday_timeline_string_e.g. 'Next 5-15 minutes', 'Within the hour', 'By 2 PM EST today', 'Towards market close' | null>",
      "reasoning": "<brief_reasoning_specific_to_this_price_target, linking to intraday technicals/chart patterns/calculus-concepts that suggest this target and its probability | null>",
      "stdDevLevels": {
          "level1up": "<numeric_price_at_plus_1_std_dev_intraday | null>",
          "level1down": "<numeric_price_at_minus_1_std_dev_intraday | null>",
          "level2up": "<numeric_price_at_plus_2_std_dev_intraday | null>",
          "level2down": "<numeric_price_at_minus_2_std_dev_intraday | null>"
      }
    }
  ],
  "microstructureInsights": "<Detailed textual analysis of ${ticker}'s market microstructure for *today*. Discuss recent bid-ask spread behavior, depth of book if information is available from sources, unusual *intraday* volume patterns (e.g., 'volume spike of 3x average on 5-min chart during breakout') indicating institutional activity or liquidity shifts. Relate these to potential *immediate and very short-term* price movements, tradability, and potential for sharp moves (e.g., due to thin liquidity outside current bid/ask). If sources don't provide specific microstructure data for ${ticker}, state 'Specific microstructure data not found in sources'.>",
  "covarianceConsiderations": "<Detailed textual analysis of ${ticker}'s covariance *for today's session*. Discuss its *intraday* correlation with major indices (SPX, QQQ) and its sector ETF. How does the current market environment (e.g., high correlation regime, specific sector news) affect this stock's risk profile *for today*? Is it a diversifier or does it amplify market moves *intraday*? Relate this to potential for larger % moves. If sources don't provide specific covariance data, state 'Specific covariance data not found in sources'.>",
  "advancedModelReferences": "<If financial literature or sophisticated analyst reports discuss ${ticker}'s *intraday* price dynamics or volatility using advanced concepts (e.g., high-frequency trading models, GARCH on intraday returns, order flow imbalance indicators, models incorporating calculus for momentum prediction), briefly explain (1-3 sentences) how these concepts contextualize the current *intraday* outlook, especially regarding potential for large moves. You are NOT performing calculations but interpreting and referencing. If no such references are found, state 'No specific advanced model references found for ${ticker} in sources'.>",
  "dataComment": "<Brief comment on whether this deeper analysis affirms, strengthens, or alters the initial outlook provided in context, especially concerning the potential for the largest percent change. State the recency or effective date of the market data used for this DEEPER *intraday* analysis. Incorporate any insights from the fresh FMP data. ABSOLUTELY NO SIMULATED DATA.>"
}`;

    return `
Given the following initial assessment and context for stock ticker "${ticker}" (current price for analysis: ${currentPrice || fmpQuote?.price || 'N/A'}):
Initial Context:
${initialContext}

Also consider this freshly fetched FMP data:
${fmpDataSummary}

Perform a FOCUSED and DEEPER INTRADAY analysis for ONLY "${ticker}", concentrating on price action and potential for the **largest percent change** from the next few seconds up to the end of the current trading day. Use fresh, extensive searches on reliable financial data sources (e.g., Yahoo Finance, TradingView, Bloomberg, Reuters, SEC filings if relevant, analyst reports if accessible).
Your goal is to AFFIRM or REFINE the initial bullish outlook with more detailed, specific, and nuanced insights for *today's trading session*, including detailed textual descriptions of intraday chart patterns, specific bar play analysis (like 3-bar or 5-bar plays), technical indicator status, calculus-inspired observations, macroeconomic influences, and news sentiment. Integrate findings from the fresh FMP data provided.

**ABSOLUTELY DO NOT PROVIDE ILLUSTRATIVE OR SIMULATED DATA.** If real-time/recent data for any field is unavailable, use null or state unavailability in the text.

Provide the following for "${ticker}":
1.  \`detailedReasoning\`: (Minimum 8-10 sentences). In-depth technical analysis for today's session. Cover multiple indicators (RSI, MACD, MAs, Volume, Candlesticks on relevant intraday charts like 1-min, 5-min, 15-min, 1-hour with current values/status and interpretation). Describe specific chart patterns on intraday timeframes (support/resistance, trendlines, breakouts with price targets). Include calculus-inspired dynamics (price velocity, acceleration). Mention relevant *intraday* micro/macroeconomic factors or news sentiment affecting ${ticker}.
2.  \`currentChartPatterns\`: An array of 1-3 distinct, significant chart patterns currently observed on ${ticker}'s intraday charts (e.g., 1-min, 5-min, 15-min). For each pattern:
    *   \`patternName\`: Name of the chart pattern (e.g., "Bull Flag", "Ascending Triangle").
    *   \`description\`: Detailed textual description of its formation, key price levels involved, volume during formation, and potential implications (e.g., target price if breakout).
    *   \`timeframe\`: The chart timeframe where this pattern is most clearly visible (e.g., "5-min", "15-min").
    *   \`keyLevels\`: Critical price levels associated with the pattern (e.g., "Support at $150.20, Resistance at $151.50, Breakout above $151.50").
    *   \`status\`: Current status of the pattern (e.g., "Forming", "Confirmed Breakout", "Failed Breakout").
3.  \`barPlayAnalysis\`: An array of 1-2 analyses for short-term bar plays (e.g., "3-bar bullish play", "5-bar reversal", "Inside bar breakout") on ${ticker}'s very short-term intraday charts (e.g., 1-min, 5-min, tick chart). For each identified play:
    *   \`playType\`: Name of the bar play.
    *   \`outcome\`: Whether it's identified as bullish, bearish, unclear, or a potential setup.
    *   \`confidence\`: Subjective confidence level (High, Medium, Low).
    *   \`description\`: Detailed textual description of the bar setup, specific bars involved, volume characteristics during formation, confirmation signals, and potential entry/target/stop considerations.
    *   \`relevantTimeframe\`: The timeframe where this bar play is most relevant.
4.  \`priceProjectionDetails\`: An array of 2-3 specific *intraday* price targets. For each target:
    *   \`targetPrice\`: The numeric price.
    *   \`probabilityEstimate\`: Qualitative ("High", "Medium") or quantitative ("60-70%") probability. If possible, relate to statistical "probability regions" e.g., 'Target is within 1 std dev based on intraday ATR'.
    *   \`projectedPriceChangePercent\`: Percentage change for this specific target from current price.
    *   \`timelineDetail\`: Specific *intraday* timeline (e.g., "Next 5-15 minutes", "Within the hour", "By 2 PM EST today").
    *   \`reasoning\`: Brief reasoning linking to intraday technicals, chart patterns, or calculus-concepts.
    *   \`stdDevLevels\` (Optional): If discoverable from sources (e.g., Bollinger Bands, ATR projections, VWAP bands on intraday charts), provide numeric price levels for +1, -1, +2, -2 standard deviations from a relevant intraday mean. If not determinable, use null for these values.
5.  \`microstructureInsights\`: Detailed textual analysis of *today's* market microstructure (bid-ask spreads, depth of book, intraday volume anomalies, institutional activity indicators). Discuss implications for *immediate* price movement, tradability, and potential for sharp moves.
6.  \`covarianceConsiderations\`: Detailed textual analysis of *intraday* correlation with indices/sector, and its impact on risk and potential for larger % moves in *today's market*.
7.  \`advancedModelReferences\`: If applicable, briefly explain how advanced mathematical/financial modeling concepts (GARCH on intraday returns, HFT models, etc.) from literature/reports provide context to ${ticker}'s *intraday* outlook and potential for significant price changes.
8.  \`dataComment\`: State if this deeper analysis affirms/modifies the initial outlook. Note recency of data used for *intraday* analysis.

CRITICAL: Present your entire response as a single, minified JSON object string. Do NOT include any surrounding text, explanations, or markdown formatting. The JSON object must strictly follow this structure:
${requestedJsonStructureDeeper}
If any array field (e.g., currentChartPatterns, barPlayAnalysis) has no relevant items, provide an empty array [] for that field. Do not use null for empty arrays.
`;
}

/**
 * @param {string} ticker
 * @param {number} historicalPrice
 * @param {string} userBullishReasoning
 * @param {string} historicalDate
 * @returns {string}
 */
export const getHistoricalOptionSuggestionPrompt = (
    ticker,
    historicalPrice,
    userBullishReasoning,
    historicalDate
) => {
    const requestedJsonStructure = `{
  "legs": [
    { "type": "call", "action": "buy", "strike": "<numeric_strike_price>", "role": "<e.g., Buy ATM Call>" }
  ],
  "reasoningForOptionChoice": "<AI's rationale for this specific option strategy and parameters, considering the historical context and user's bullish view. Mention why this strategy (e.g., long call, bull call spread) would have been suitable.>",
  "estimatedNetCostOrCredit": "<numeric_value_or_null, negative for debit, positive for credit. This is a ROUGH historical estimate.>",
  "dataComment": "<Optional comment about the suggestion, e.g., typical expiration timeframe assumed (e.g., 30-45 DTE), or limitations of the estimation.>"
}`;
    return `
On ${historicalDate}, the stock ${ticker} was trading at approximately $${historicalPrice.toFixed(2)}.
A user had the following bullish reasoning at that time: "${userBullishReasoning}".

Given this historical context and bullish outlook:
1. Suggest a simple, American-style, 1-2 leg bullish option strategy (e.g., Long Call, Bull Call Spread, Short Put).
2. For each leg, specify:
    - type: "call" or "put"
    - action: "buy" or "sell"
    - strike: A numeric strike price appropriate for the $${historicalPrice.toFixed(2)} stock price (e.g., ATM, slightly OTM for long calls/puts, slightly ITM/OTM for spreads).
    - role: A descriptive role for the leg (e.g., "Buy ATM Call", "Sell OTM Put").
3. Provide a clear "reasoningForOptionChoice" explaining why this strategy and its parameters would have been a plausible way to act on the bullish view on ${historicalDate}.
4. If possible, provide an "estimatedNetCostOrCredit" for the strategy (rough historical estimate, negative for debit, positive for credit). If not estimable, use null.
5. Add any "dataComment" if necessary (e.g., assumptions made about option expiration).

CRITICAL: Respond as a single, minified JSON object strictly following this structure:
${requestedJsonStructure}

Ensure all strike prices are numeric. The "reasoningForOptionChoice" is very important.
`;
};

/**
 * @param {string} ticker
 * @param {number} historicalPrice
 * @param {string} userBullishReasoning
 * @param {string} historicalDate
 * @returns {Promise<import('../types.js').GeminiSuggestedHistoricalOption>}
 */
export const fetchAISuggestedHistoricalOption = async (
    ticker,
    historicalPrice,
    userBullishReasoning,
    historicalDate
) => {
    const prompt = getHistoricalOptionSuggestionPrompt(ticker, historicalPrice, userBullishReasoning, historicalDate);
    const result = await executeAICall(
        AICallType.HistoricalOptionSuggestion,
        prompt,
        false, // fmpDataUsed is false for this specific AI call's prompt
        "gemini-1.5-flash-latest", // Updated model name
        0.3, // Slightly higher temperature for more creative option suggestion
        parseJsonFromResponse
    );

    if (!result.error) {
        if (!result.legs || !Array.isArray(result.legs) || result.legs.length === 0) {
             console.warn(`Historical option suggestion for ${ticker} on ${historicalDate} has no valid legs.`, result);
             result.error = result.error ? `${result.error} Also, no valid legs provided.` : "AI response for historical option had no valid legs.";
        } else {
            result.legs = result.legs.map(leg => ({
                type: Object.values(OptionType).includes(leg.type) ? leg.type : OptionType.Call,
                action: Object.values(Action).includes(leg.action) ? leg.action : Action.Buy,
                strike: typeof leg.strike === 'number' ? leg.strike : 0,
                role: typeof leg.role === 'string' ? leg.role : "Suggested Leg"
            })).filter(leg => leg.strike > 0);
            if (result.legs.length === 0 && (!result.error || !result.error.includes("no valid legs"))){
                result.error = result.error ? `${result.error} All legs filtered out due to invalid strikes.` : "AI response for historical option had no valid legs after strike validation.";
            }
        }
        if (!result.reasoningForOptionChoice) {
            result.reasoningForOptionChoice = "No specific reasoning provided by AI.";
        }
    }

    return result;
};
