// React needs to be available globally or via a module system.
// For pure JS in browser, this means including React and ReactDOM via <script> tags.
// const { useState, useCallback, useEffect } = React; // Assuming React is on window

import {
    AICallType,
    StockPriceCategory,
    OutlookHorizon,
    // GeminiStrategyDataResponse, GeminiBlackScholesInputsResponse, GeminiStrategySuggestionResponse,
    // GeminiBullishStockSuggestionResponse, GeminiDeeperAnalysisResponse, GroundingSource,
    // GeneralStatusMessage, AppDBState, OptionType, OptionChainEntry, OptionsChainData,
    // BullishStockSuggestion, StoredBullishStockSuggestion, PriceProjectionDetail,
    // SuggestedStrategyInfo, FMPProfile, FMPQuote, GeminiSuggestedHistoricalOption
    // These are effectively JSDoc types now
} from '../types.js'; // Assuming .js extension
import {
    executeAICall,
    parseJsonFromResponse,
    getStrategyDataPrompt,
    getStrategyExplanationPrompt,
    // getBlackScholesInputsPrompt, // Not directly called by this hook's exported functions
    getStrategySuggestionsPrompt,
    getBullishStockSuggestionsPrompt,
    getDeeperStockAnalysisPrompt,
    // fetchAISuggestedHistoricalOption // Not directly called by this hook's exported functions
} from '../services/geminiService.js'; // Assuming .js extension
import { getCompanyProfileFMP, getQuoteFMP, getOptionsChainFMP } from '../services/fmpService.js'; // Assuming .js
import { logAIInteraction, initSqlJsDb } from '../services/sqliteService.js'; // Assuming .js

/**
 * @typedef {Object} UseGeminiServiceProps
 * @property {(text: string, type: import('../types.js').GeneralStatusMessage['type'], aiCallType?: AICallType, durationMs?: number) => void} showStatus
 * @property {(updates: Partial<import('../types.js').AppDBState>) => void} updateAppDBState
 * @property {string[]} predefinedStrategyNames
 */

/**
 * @param {UseGeminiServiceProps} props
 */
export const useGeminiService = ({ showStatus, updateAppDBState, predefinedStrategyNames }) => {
  const { useState, useCallback, useEffect } = React; // Destructure from global React

  const [isFetchingStrategyData, setIsFetchingStrategyData] = useState(false);
  const [isFetchingBsInputs, setIsFetchingBsInputs] = useState(false);
  const [isFetchingStrategyExplanation, setIsFetchingStrategyExplanation] = useState(false);
  const [isFetchingAIStrategySuggestions, setIsFetchingAIStrategySuggestions] = useState(false);
  const [isFetchingAIBullishStocks, setIsFetchingAIBullishStocks] = useState(false);
  const [isFetchingDeeperAnalysis, setIsFetchingDeeperAnalysis] = useState(false);

  useEffect(() => {
    initSqlJsDb();
  }, []);

  const anyGeminiLoading = isFetchingStrategyData || isFetchingBsInputs || isFetchingStrategyExplanation || isFetchingAIStrategySuggestions || isFetchingAIBullishStocks || isFetchingDeeperAnalysis;

  const handleAiCallCompletion = useCallback(async (
        callType,
        durationMs,
        sources,
        fmpDataUsed,
        errorPresent,
        underlyingName,
        strategyName
    ) => {
        if (durationMs) {
            updateAppDBState({ aiCallDurations: { [callType]: durationMs } });
        }
        if (sources && sources.length > 0) {
            updateAppDBState({ allAccumulatedAISources: sources });
        }
        await logAIInteraction({
            call_type: callType,
            underlying_name: underlyingName,
            strategy_name: strategyName,
            fmp_data_used: fmpDataUsed ? 1 : 0,
            error_present: errorPresent ? 1 : 0,
            duration_ms: durationMs || 0
        });
  }, [updateAppDBState]);

  /** @type {(underlyingName: string, strategyName: string, legRolesDescription: string) => Promise<import('../types.js').GeminiStrategyDataResponse>} */
  const fetchStrategyData = useCallback(async (underlyingName, strategyName, legRolesDescription) => {
    setIsFetchingStrategyData(true);
    showStatus(`Fetching FMP & AI data for ${underlyingName} - ${strategyName}...`, 'info', AICallType.StrategyData);
    let fmpDataUsed = false;
    let fmpErrorOccurred = false;

    const fmpProfilePromise = getCompanyProfileFMP(underlyingName);
    const fmpQuotePromise = getQuoteFMP(underlyingName);
    const fmpOptionsChainPromise = getOptionsChainFMP(underlyingName);

    const [fmpProfile, fmpQuote, fmpOptionsChainData] = await Promise.all([fmpProfilePromise, fmpQuotePromise, fmpOptionsChainPromise]);

    if (fmpProfile || fmpQuote || fmpOptionsChainData) fmpDataUsed = true;

    if (!fmpQuote && !fmpProfile) {
        const errorMsg = `FMP Error: Failed to fetch essential FMP profile/quote data for ${underlyingName}. Cannot reliably suggest strategy parameters.`;
        showStatus(errorMsg, 'error', AICallType.StrategyData);
        fmpErrorOccurred = true;
    }
    if (!fmpOptionsChainData) {
        const errorMsg = `FMP Error: Options chain data not found for ${underlyingName}. AI cannot select strikes or auto-fill legs.`;
        showStatus(errorMsg, 'error', AICallType.StrategyData);
        fmpErrorOccurred = true;
    }

    if (fmpErrorOccurred) {
        setIsFetchingStrategyData(false);
        await handleAiCallCompletion(AICallType.StrategyData, 0, [], false, true, underlyingName, strategyName);
        return { error: `Critical FMP data missing for ${underlyingName}. Strategy auto-fill aborted. Please check FMP API status or ticker.`, fmpDataUsed: false };
    }

    const prompt = getStrategyDataPrompt(underlyingName, strategyName, legRolesDescription, fmpProfile, fmpQuote, fmpOptionsChainData);
    const result = await executeAICall(AICallType.StrategyData, prompt, fmpDataUsed, "gemini-1.5-flash-latest", 0.0, parseJsonFromResponse);

    await handleAiCallCompletion(AICallType.StrategyData, result.durationMs, result.sources, fmpDataUsed, !!result.error, underlyingName, strategyName);

    if (result.error) {
      setIsFetchingStrategyData(false);
      return { ...result, fmpDataUsed };
    }
    if (!result) {
      setIsFetchingStrategyData(false);
      // @ts-ignore
      return { error: "No data returned from AI for strategy data.", durationMs: result.durationMs, fmpDataUsed };
    }
    /** @type {import('../types.js').GeminiStrategyDataResponse} */
    const finalResponse = { ...result, fmpDataUsed };
    finalResponse.currentStockPrice = fmpQuote?.price || fmpProfile?.price || result.currentStockPrice || null;

    if (fmpOptionsChainData && finalResponse.currentStockPrice) {
        const stockP = finalResponse.currentStockPrice;
        fmpOptionsChainData.currentStockPriceForChain = stockP;
        fmpOptionsChainData.calls.forEach(o => { o.parity = parseFloat(Math.max(0, stockP - o.strike).toFixed(2)); });
        fmpOptionsChainData.puts.forEach(o => { o.parity = parseFloat(Math.max(0, o.strike - stockP).toFixed(2)); });
        finalResponse.optionsChain = fmpOptionsChainData;
    } else {
        finalResponse.optionsChain = null;
    }

    if (finalResponse.targetStrikesByRole && !Array.isArray(finalResponse.targetStrikesByRole)) {
        console.warn("Parsed targetStrikesByRole from Gemini is not an array.", finalResponse.targetStrikesByRole);
        finalResponse.targetStrikesByRole = undefined;
    }
    if (finalResponse.suggestedPointValue === undefined) finalResponse.suggestedPointValue = null;
    if (finalResponse.suggestedNumPoints === undefined) finalResponse.suggestedNumPoints = null;

    setIsFetchingStrategyData(false);
    return finalResponse;
  }, [showStatus, handleAiCallCompletion]);

  /** @type {(strategyName: string) => Promise<{text?: string, error?: string, sources?: import('../types.js').GroundingSource[], durationMs?: number}>} */
  const fetchStrategyExplanation = useCallback(async (strategyName) => {
    setIsFetchingStrategyExplanation(true);
    showStatus(`Fetching explanation for ${strategyName}...`, 'info', AICallType.StrategyExplanation);

    const prompt = getStrategyExplanationPrompt(strategyName);
    const result = await executeAICall(
      AICallType.StrategyExplanation, prompt, false, "gemini-1.5-flash-latest", 0.3
    );

    await handleAiCallCompletion(AICallType.StrategyExplanation, result.durationMs, result.sources, false, !!result.error, undefined, strategyName);

    if (result.error) {
        setIsFetchingStrategyExplanation(false);
        return result;
    }
    // @ts-ignore
    if (!result.text) {
        setIsFetchingStrategyExplanation(false);
        // @ts-ignore
        return { error: "AI returned an empty explanation.", sources: result.sources, durationMs: result.durationMs };
    }
    setIsFetchingStrategyExplanation(false);
    return result;
  }, [showStatus, handleAiCallCompletion]);

  /** @type {(underlyingName: string) => Promise<import('../types.js').GeminiStrategySuggestionResponse>} */
  const fetchAISuggestStrategies = useCallback(async (underlyingName) => {
    setIsFetchingAIStrategySuggestions(true);
    let fmpDataUsed = false;
    /** @type {import('../types.js').FMPProfile | null} */
    let fmpProfile = null;
    /** @type {import('../types.js').FMPQuote | null} */
    let fmpQuote = null;

    showStatus(`Fetching FMP data for ${underlyingName} to inform AI strategy suggestions...`, 'info', AICallType.StrategySuggestions);
    try {
        fmpProfile = await getCompanyProfileFMP(underlyingName);
        fmpQuote = await getQuoteFMP(underlyingName);
        if (fmpProfile || fmpQuote) fmpDataUsed = true;

        if (!fmpQuote && !fmpProfile) {
            showStatus(`Warning: Could not fetch FMP profile/quote for ${underlyingName}. AI suggestions will rely on general search and may be less targeted.`, 'warning', AICallType.StrategySuggestions);
        } else {
            showStatus(`FMP data fetched for ${underlyingName}. Proceeding with AI...`, 'info', AICallType.StrategySuggestions);
        }
    } catch (fmpError) {
        console.error("FMP Fetch Error in fetchAISuggestStrategies:", fmpError);
        showStatus(`FMP data fetch failed for ${underlyingName}. AI will proceed with limited context. Error: ${fmpError instanceof Error ? fmpError.message : String(fmpError)}`, 'warning', AICallType.StrategySuggestions);
        fmpDataUsed = false;
    }

    const prompt = getStrategySuggestionsPrompt(underlyingName, predefinedStrategyNames, fmpProfile, fmpQuote);
    const result = await executeAICall(AICallType.StrategySuggestions, prompt, fmpDataUsed, "gemini-1.5-flash-latest", 0.45, parseJsonFromResponse);

    await handleAiCallCompletion(AICallType.StrategySuggestions, result.durationMs, result.sources, fmpDataUsed, !!result.error, underlyingName);
    /** @type {import('../types.js').GeminiStrategySuggestionResponse} */
    const finalResult = {...result, fmpDataUsed};

    if (finalResult.error) {
        setIsFetchingAIStrategySuggestions(false);
        return finalResult;
    }
    if (!finalResult || !finalResult.suggestedStrategies) {
        setIsFetchingAIStrategySuggestions(false);
        // @ts-ignore
        return { error: "AI returned an empty or unparsable response for strategy suggestions.", sources: finalResult?.sources, durationMs: finalResult?.durationMs, fmpDataUsed };
    }
    if (finalResult.suggestedStrategies) {
        finalResult.suggestedStrategies = finalResult.suggestedStrategies.filter((suggestion) =>
            predefinedStrategyNames.includes(suggestion.name) && suggestion.reasoning && suggestion.reasoning.length > 50
        );
    }
    setIsFetchingAIStrategySuggestions(false);
    return finalResult;
  }, [showStatus, predefinedStrategyNames, handleAiCallCompletion]);

  /** @type {() => Promise<import('../types.js').GeminiBullishStockSuggestionResponse>} */
  const fetchAIBullishStocks = useCallback(async () => {
    setIsFetchingAIBullishStocks(true);
    showStatus('AI is searching for bullish stock suggestions (Initial Scan)...', 'info', AICallType.BullishStocksInitial);
    let fmpDataUsed = false;

    const prompt = getBullishStockSuggestionsPrompt();
    const result = await executeAICall(
        AICallType.BullishStocksInitial,
        prompt,
        fmpDataUsed,
        "gemini-1.5-flash-latest",
        0.1,
        parseJsonFromResponse
    );

    await handleAiCallCompletion(AICallType.BullishStocksInitial, result.durationMs, result.sources, fmpDataUsed, !!result.error);
    /** @type {import('../types.js').GeminiBullishStockSuggestionResponse} */
    const finalResult = {...result, fmpDataUsed};

    if (finalResult.error) {
        setIsFetchingAIBullishStocks(false);
        if (result.error?.includes("AI returned an unparsable JSON response") ||
            (result.error?.includes("AI returned an empty or unparsable response") && result.error?.includes("despite receiving text"))) {
            return {
                ...finalResult,
                error: "AI response format error for bullish stock suggestions. The AI did not return the expected JSON structure."
            };
        }
        return finalResult;
    }
    if (!finalResult || !finalResult.suggestedStocks || finalResult.suggestedStocks.length === 0) {
        setIsFetchingAIBullishStocks(false);
        // @ts-ignore
        if (finalResult.suggestedStocks && Object.keys(finalResult.suggestedStocks).length === 0 && !Array.isArray(finalResult.suggestedStocks)) {
             // @ts-ignore
             return { error: "AI indicated it could not fulfill the bullish stock suggestion request in the required format.", sources: finalResult?.sources, durationMs: finalResult?.durationMs, fmpDataUsed };
        }
        // @ts-ignore
        return { error: "AI returned no valid bullish stock suggestions or an unparsable response for initial scan.", sources: finalResult?.sources, durationMs: finalResult?.durationMs, fmpDataUsed };
    }
    if (finalResult.suggestedStocks) {
        finalResult.suggestedStocks = finalResult.suggestedStocks
            .map((stock) => {
                const currentPriceNum = typeof stock.currentPrice === 'number' && stock.currentPrice > 0 ? stock.currentPrice : null;
                return {
                    ...stock,
                    ticker: stock.ticker.toUpperCase().replace(/\s+/g, ''),
                    currentPrice: currentPriceNum,
                    projectedPriceChangePercentMin: typeof stock.projectedPriceChangePercentMin === 'number' ? stock.projectedPriceChangePercentMin : null,
                    projectedPriceChangePercentMax: typeof stock.projectedPriceChangePercentMax === 'number' ? stock.projectedPriceChangePercentMax : null,
                    projectedTimeline: typeof stock.projectedTimeline === 'string' && stock.projectedTimeline.length > 3 ? stock.projectedTimeline : null,
                    priceCategory: currentPriceNum !== null ? (currentPriceNum < 15 ? StockPriceCategory.Below15 : StockPriceCategory.AboveOrEqual15) : StockPriceCategory.AboveOrEqual15,
                    outlookHorizon: Object.values(OutlookHorizon).includes(stock.outlookHorizon) ? stock.outlookHorizon : OutlookHorizon.MidTerm,
                };
            })
            .filter(stock =>
                stock.ticker.length > 0 &&
                stock.ticker.length < 7 &&
                /^[A-Z0-9.-]+$/.test(stock.ticker) &&
                stock.reasoning && stock.reasoning.length > 30
            );
    }
    if(!finalResult.suggestedStocks || finalResult.suggestedStocks.length === 0) {
        setIsFetchingAIBullishStocks(false);
        // @ts-ignore
        return { error: "AI suggestions (initial scan) did not meet formatting or detail requirements after filtering.", sources: finalResult.sources, durationMs: finalResult.durationMs, fmpDataUsed };
    }
    setIsFetchingAIBullishStocks(false);
    return finalResult;
  }, [showStatus, handleAiCallCompletion]);

  /** @type {(ticker: string, currentPrice: number | null, initialSuggestionData: import('../types.js').StoredBullishStockSuggestion) => Promise<import('../types.js').GeminiDeeperAnalysisResponse>} */
  const fetchDeeperAnalysis = useCallback(async (ticker, currentPrice, initialSuggestionData) => {
    setIsFetchingDeeperAnalysis(true);
    showStatus(`Fetching deeper analysis for ${ticker}... (includes FMP)`, 'info', AICallType.BullishStocksDeepDive);
    let fmpDataUsed = false;
    /** @type {import('../types.js').FMPProfile | null} */
    let fmpProfile = null;
    /** @type {import('../types.js').FMPQuote | null} */
    let fmpQuote = null;

    try {
        fmpProfile = await getCompanyProfileFMP(ticker);
        fmpQuote = await getQuoteFMP(ticker);
        if (fmpProfile || fmpQuote) {
            fmpDataUsed = true;
            showStatus(`FMP data fetched for ${ticker} for deeper analysis. Proceeding with AI...`, 'info', AICallType.BullishStocksDeepDive);
        } else {
             showStatus(`Warning: Could not fetch fresh FMP profile/quote for ${ticker}. AI deeper analysis will rely on initial context and general search.`, 'warning', AICallType.BullishStocksDeepDive);
        }
    } catch (fmpError) {
        console.error(`FMP Fetch Error in fetchDeeperAnalysis for ${ticker}:`, fmpError);
        showStatus(`FMP data fetch failed for ${ticker}. AI will proceed with limited context. Error: ${fmpError instanceof Error ? fmpError.message : String(fmpError)}`, 'warning', AICallType.BullishStocksDeepDive);
        fmpDataUsed = false;
    }

    const prompt = getDeeperStockAnalysisPrompt(ticker, currentPrice, initialSuggestionData, fmpProfile, fmpQuote);
    const result = await executeAICall(AICallType.BullishStocksDeepDive, prompt, fmpDataUsed, "gemini-1.5-flash-latest", 0.2, parseJsonFromResponse);

    await handleAiCallCompletion(AICallType.BullishStocksDeepDive, result.durationMs, result.sources, fmpDataUsed, !!result.error, ticker);
    /** @type {import('../types.js').GeminiDeeperAnalysisResponse} */
    const finalResult = {...result, fmpDataUsed, analysisTimestamp: Date.now()};

    if (finalResult.error) {
        setIsFetchingDeeperAnalysis(false);
        return finalResult;
    }
    if (!finalResult) {
        setIsFetchingDeeperAnalysis(false);
        // @ts-ignore
        return { error: `No data returned from AI for deeper analysis of ${ticker}.`, durationMs: finalResult.durationMs, fmpDataUsed };
    }
    if (finalResult.priceProjectionDetails && Array.isArray(finalResult.priceProjectionDetails)) {
        finalResult.priceProjectionDetails = finalResult.priceProjectionDetails.map((detail) => ({
            targetPrice: typeof detail.targetPrice === 'number' ? detail.targetPrice : 0,
            probabilityEstimate: detail.probabilityEstimate,
            projectedPriceChangePercent: typeof detail.projectedPriceChangePercent === 'number' ? detail.projectedPriceChangePercent : 0,
            timelineDetail: detail.timelineDetail,
            reasoning: detail.reasoning,
            stdDevLevels: detail.stdDevLevels,
        })).filter(detail => detail.targetPrice > 0 && detail.timelineDetail && detail.probabilityEstimate);
    } else {
        // @ts-ignore
        finalResult.priceProjectionDetails = undefined;
    }
    setIsFetchingDeeperAnalysis(false);
    return finalResult;
  }, [showStatus, handleAiCallCompletion]);

  return {
    isFetchingStrategyData,
    isFetchingBsInputs,
    isFetchingStrategyExplanation,
    isFetchingAIStrategySuggestions,
    isFetchingAIBullishStocks,
    isFetchingDeeperAnalysis,
    anyGeminiLoading,
    fetchStrategyData,
    fetchStrategyExplanation,
    fetchAISuggestStrategies,
    fetchAIBullishStocks,
    fetchDeeperAnalysis,
  };
};
