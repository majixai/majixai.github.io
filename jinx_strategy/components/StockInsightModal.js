// Assuming React is available globally e.g. via CDN
// Other imports like TradingViewWidget, FMPPlotlyChart, PayoffChart will also need to be JS and assume their dependencies (e.g., Plotly) are global.
// Types are for JSDoc
// import { StockInsightModalData, PriceProjectionDetail, OutlookHorizon, StoredBullishStockSuggestion, HistoricalBullishSuggestionEntry, ChartPatternInfo, BarPlayAnalysisInfo, FMHistoricalPrice, GeminiSuggestedHistoricalOption, ChartData, OptionLeg, Action, OptionType, PlotOptions } from '../types.js';
import TradingViewWidget from './TradingViewWidget.js';
import FMPPlotlyChart from './FMPPlotlyChart.js';
import PayoffChart from './PayoffChart.js';
import { generatePlotData } from '../services/optionCalculationService.js';
import { getHistoricalCandlesFMP } from '../services/fmpService.js';
import { fetchAISuggestedHistoricalOption } from '../services/geminiService.js';
import { generateMarkdownFromInsightData, generatePdfFromInsightData } from '../utils/exportUtils.js';
import { isValidTicker } from '../utils/validationUtils.js';
import { BrainIcon, MessageIcon, STANFORD_CARDINAL_RED, DUKE_BLUE, OREGON_GREEN, OREGON_YELLOW, TEXT_COLOR_PRIMARY, TEXT_COLOR_SECONDARY, BORDER_COLOR, DownloadIcon, PANEL_BACKGROUND, LoadingSpinner } from '../constants.js';
import { formatDate, formatPrice, generateUniqueId } from '../utils/miscUtils.js'; // Changed path
import { Action, OptionType, OutlookHorizon } from '../types.js'; // Import runtime values

/**
 * @typedef {import('../types.js').StockInsightModalData} StockInsightModalData
 * @typedef {import('../types.js').PriceProjectionDetail} PriceProjectionDetail
 * @typedef {import('../types.js').StoredBullishStockSuggestion} StoredBullishStockSuggestion
 * @typedef {import('../types.js').HistoricalBullishSuggestionEntry} HistoricalBullishSuggestionEntry
 * @typedef {import('../types.js').ChartPatternInfo} ChartPatternInfo
 * @typedef {import('../types.js').BarPlayAnalysisInfo} BarPlayAnalysisInfo
 * @typedef {import('../types.js').FMHistoricalPrice} FMHistoricalPrice
 * @typedef {import('../types.js').GeminiSuggestedHistoricalOption} GeminiSuggestedHistoricalOption
 * @typedef {import('../types.js').ChartData} ChartData
 * @typedef {import('../types.js').OptionLeg} OptionLeg
 * @typedef {import('../types.js').PlotOptions} PlotOptions
 */

/**
 * @typedef {Object} StockInsightModalProps
 * @property {boolean} isOpen
 * @property {() => void} onClose
 * @property {StockInsightModalData | null} modalData
 * @property {(historicalSuggestion: HistoricalBullishSuggestionEntry, historicalOptionPlay: GeminiSuggestedHistoricalOption | null) => void} [onSetHistoricalContextForStrategy]
 */

/**
 * @param {StockInsightModalProps} props
 * @returns {React.ReactElement | null}
 */
const StockInsightModal = ({ isOpen, onClose, modalData, onSetHistoricalContextForStrategy }) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. StockInsightModal component cannot render.");
    return null;
  }
  const { useEffect, useState, useCallback } = React;

  const [fmpChartData, setFmpChartData] = useState(/** @type {{ daily?: FMHistoricalPrice[], intraday?: FMHistoricalPrice[] }} */ ({}));
  const [isLoadingFMPCharts, setIsLoadingFMPCharts] = useState(false);
  const [chartError, setChartError] = useState(/** @type {string | null} */ (null));
  const [suggestedHistoricalOptionData, setSuggestedHistoricalOptionData] = useState(/** @type {GeminiSuggestedHistoricalOption | null} */ (null));
  const [isLoadingSuggestedHistoricalOptionData, setIsLoadingSuggestedHistoricalOptionData] = useState(false);
  const [historicalOptionStrategyChartData, setHistoricalOptionStrategyChartData] = useState(/** @type {ChartData | null} */ (null));
  const [isHistoricalOptionChartVisible, setIsHistoricalOptionChartVisible] = useState(false);

  const fetchAllModalData = useCallback(async (currentModalData) => {
    if (!currentModalData || !currentModalData.suggestion) return;
    const ticker = currentModalData.suggestion.ticker;
    if (!isValidTicker(ticker)) {
        console.error(`StockInsightModal: Invalid ticker "${ticker}" provided.`);
        setChartError(`Invalid ticker symbol: ${ticker}. Cannot load charts or suggestions.`);
        setIsLoadingFMPCharts(false); setIsLoadingSuggestedHistoricalOptionData(false); setFmpChartData({}); setSuggestedHistoricalOptionData(null); setHistoricalOptionStrategyChartData(null);
        return;
    }

    setIsLoadingFMPCharts(true); setIsLoadingSuggestedHistoricalOptionData(currentModalData.isHistorical); setFmpChartData({}); setSuggestedHistoricalOptionData(null); setHistoricalOptionStrategyChartData(null); setChartError(null);
    const { suggestion, isHistorical } = currentModalData;
    const analysisOrSuggestionDate = suggestion.analysisTimestamp || suggestion.initialTimestamp || Date.now();
    const toDate = new Date(analysisOrSuggestionDate);
    const fromDateDaily = new Date(toDate); fromDateDaily.setMonth(fromDateDaily.getMonth() - 6);
    const dailyDataPromise = getHistoricalCandlesFMP(ticker, fromDateDaily.toISOString().split('T')[0], toDate.toISOString().split('T')[0], '1day');
    let intradayDataPromise = Promise.resolve(null);
    if (suggestion.outlookHorizon === OutlookHorizon.ShortTerm || (currentModalData.deepDiveAnalysis?.barPlayAnalysis && currentModalData.deepDiveAnalysis.barPlayAnalysis.length > 0)) {
        const fromDateIntraday = new Date(toDate); fromDateIntraday.setDate(fromDateIntraday.getDate() - (suggestion.outlookHorizon === OutlookHorizon.ShortTerm ? 2 : 1));
        if (isHistorical || suggestion.outlookHorizon === OutlookHorizon.ShortTerm) await new Promise(resolve => setTimeout(resolve, 4000));
        intradayDataPromise = getHistoricalCandlesFMP(ticker, fromDateIntraday.toISOString().split('T')[0], toDate.toISOString().split('T')[0], '5min');
    }
    let historicalOptionPromise = Promise.resolve(null);
    if (isHistorical && suggestion) {
        const histSuggestion = /** @type {HistoricalBullishSuggestionEntry} */ (suggestion);
        if (histSuggestion.priceAtSuggestion && histSuggestion.reasoning) {
            historicalOptionPromise = fetchAISuggestedHistoricalOption(histSuggestion.ticker, histSuggestion.priceAtSuggestion, histSuggestion.reasoning, new Date(histSuggestion.initialTimestamp).toISOString());
        }
    }
    try {
        const [dailyResult, intradayResult, historicalOptionResult] = await Promise.all([dailyDataPromise, intradayDataPromise, historicalOptionPromise]);
        if (dailyResult === null && intradayResult === null) setChartError(`Failed to load historical chart data for ${ticker}. API limit may be reached or data unavailable.`);
        setFmpChartData({ daily: dailyResult || undefined, intraday: intradayResult || undefined });
        if (isHistorical) {
            if (historicalOptionResult && !historicalOptionResult.error) {
                setSuggestedHistoricalOptionData(historicalOptionResult);
                if (historicalOptionResult.legs && historicalOptionResult.legs.length > 0) {
                    const histSugg = /** @type {HistoricalBullishSuggestionEntry} */ (suggestion);
                    const tempLegs = historicalOptionResult.legs.map(aiLeg => {
                        let premiumValue = "0.00"; let premiumIsMissing = true;
                        if (historicalOptionResult.legs.length === 1 && historicalOptionResult.estimatedNetCostOrCredit !== undefined && historicalOptionResult.estimatedNetCostOrCredit !== null) {
                            if (aiLeg.action === Action.Buy && historicalOptionResult.estimatedNetCostOrCredit < 0) { premiumValue = Math.abs(historicalOptionResult.estimatedNetCostOrCredit).toFixed(2); premiumIsMissing = false; }
                            else if (aiLeg.action === Action.Sell && historicalOptionResult.estimatedNetCostOrCredit > 0) { premiumValue = historicalOptionResult.estimatedNetCostOrCredit.toFixed(2); premiumIsMissing = false; }
                            else if (historicalOptionResult.estimatedNetCostOrCredit === 0) { premiumValue = "0.00"; premiumIsMissing = false; }
                            else { premiumValue = aiLeg.action === Action.Buy ? "0.01" : "0.00"; premiumIsMissing = true; }
                        } else { premiumValue = aiLeg.action === Action.Buy ? "0.01" : "0.00"; premiumIsMissing = true; }
                        return { id: generateUniqueId(), type: aiLeg.type, action: aiLeg.action, strike: aiLeg.strike.toString(), premium: premiumValue, quantity: "1", role: aiLeg.role || `Hist Leg ${aiLeg.strike}`, premiumMissing: premiumIsMissing };
                    });
                    const tempPlotOptions = { id: 'historical-modal-plot', underlyingName: histSugg.ticker, currentS: histSugg.priceAtSuggestion?.toString() || '', pointValue: '100', numPoints: '100', minST: '', maxST: '', showIndividualLegs: false };
                    const payoffResult = generatePlotData(tempLegs, tempPlotOptions);
                    if ('error' in payoffResult) { console.warn("Error generating historical option payoff chart:", payoffResult.error); setHistoricalOptionStrategyChartData(null); }
                    else setHistoricalOptionStrategyChartData(payoffResult);
                }
            } else if (historicalOptionResult?.error) { console.warn(`Error fetching historical option suggestion for ${ticker}: ${historicalOptionResult.error}`); setChartError(prev => prev ? `${prev} Historical option suggestion failed.` : `Historical option suggestion failed for ${ticker}.`); }
        }
    } catch (error) { console.error("Error fetching modal data (charts/historical option):", error); setChartError(`Error fetching data for ${ticker}: ${error instanceof Error ? error.message : "Unknown error"}`); setFmpChartData({ daily: undefined, intraday: undefined }); setSuggestedHistoricalOptionData(null); setHistoricalOptionStrategyChartData(null); }
    finally { setIsLoadingFMPCharts(false); setIsLoadingSuggestedHistoricalOptionData(false); }
  }, []);

  useEffect(() => { if (isOpen && modalData) fetchAllModalData(modalData); }, [isOpen, modalData, fetchAllModalData]);

  if (!isOpen || !modalData) return null;
  const { suggestion, isHistorical, deepDiveAnalysis, isLoadingDeepDive } = modalData;
  const ticker = suggestion.ticker;
  const currentPrice = isHistorical ? (/** @type {HistoricalBullishSuggestionEntry} */ (suggestion)).priceAtSuggestion : (/** @type {StoredBullishStockSuggestion} */ (suggestion)).currentPrice;

  const handleSaveMarkdown = () => { const markdownContent = generateMarkdownFromInsightData(modalData); const blob = new Blob([markdownContent], { type: 'text/markdown' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${ticker}_StockAnalysis_${new Date().toISOString().split('T')[0]}.md`; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); };
  const handleSavePdf = async () => { await generatePdfFromInsightData(modalData); };
  const handleSetContextAndClose = () => { if (onSetHistoricalContextForStrategy && isHistorical) { onSetHistoricalContextForStrategy(/** @type {HistoricalBullishSuggestionEntry} */ (suggestion), suggestedHistoricalOptionData); } onClose(); };

  const renderDetailSection = (title, content, titleColor = TEXT_COLOR_PRIMARY) => { if (!content || content.trim() === '') return null; return React.createElement('div', { className: "mb-4", key: title }, React.createElement('h4', { className: `text-sm font-semibold ${titleColor} mb-1 border-b pb-1`, style: { borderColor: BORDER_COLOR } }, title), React.createElement('p', { className: "text-xs whitespace-pre-wrap", style: { color: TEXT_COLOR_SECONDARY } }, content)); };
  const renderPriceProjections = (projections) => { if (!projections || projections.length === 0) return null; return React.createElement('div', { className: "mb-3", key: "price-proj" }, React.createElement('h4', { className: "text-sm font-semibold mb-1.5 border-b pb-1", style: { color: OREGON_GREEN, borderColor: BORDER_COLOR } }, "Price Projections"), React.createElement('div', { className: "space-y-2" }, projections.map((p, idx) => React.createElement('div', { key: idx, className: "p-2 border rounded-md", style: { borderColor: `${OREGON_GREEN}4D`, backgroundColor: `${OREGON_GREEN}1A` } }, React.createElement('p', { className: "text-xs font-medium", style: { color: OREGON_GREEN } }, `Target: $${p.targetPrice.toFixed(2)} (+${p.projectedPriceChangePercent.toFixed(1)}%)`), React.createElement('p', { className: "text-xs", style: { color: `${OREGON_GREEN}B3` } }, `Timeline: ${p.timelineDetail} (Prob: ${p.probabilityEstimate || 'N/A'})`), p.reasoning && React.createElement('p', { className: "text-xs italic mt-0.5", style: { color: `${OREGON_GREEN}99` } }, ` \u21AA ${p.reasoning}`))))); };
  const renderChartPatterns = (patterns) => { if (!patterns || patterns.length === 0) return null; return React.createElement('div', { className: "mb-3", key: "chart-patt" }, React.createElement('h4', { className: "text-sm font-semibold mb-1.5 border-b pb-1", style: { color: DUKE_BLUE, borderColor: BORDER_COLOR } }, "Current Intraday Chart Patterns"), React.createElement('div', { className: "space-y-2" }, patterns.map((p, idx) => React.createElement('div', { key: idx, className: "p-2 border rounded-md", style: { borderColor: `${DUKE_BLUE}4D`, backgroundColor: `${DUKE_BLUE}1A` } }, React.createElement('p', { className: "text-xs font-medium", style: { color: DUKE_BLUE } }, `${p.patternName || 'N/A'} `, React.createElement('span', {style:{color: `${DUKE_BLUE}B3`}}, `(${p.timeframe || 'N/A'})`), ` - Status: `, React.createElement('span', {className:"font-normal"}, `${p.status || 'N/A'}`)), p.keyLevels && React.createElement('p', { className: "text-xs", style: { color: `${DUKE_BLUE}CC` } }, `Levels: ${p.keyLevels}`), React.createElement('p', { className: "text-xs italic mt-0.5", style: { color: `${DUKE_BLUE}99` } }, p.description || 'No description.'))))); };
  const renderBarPlays = (plays) => { if (!plays || plays.length === 0) return null; return React.createElement('div', { className: "mb-3", key: "bar-plays" }, React.createElement('h4', { className: "text-sm font-semibold mb-1.5 border-b pb-1", style: { color: OREGON_YELLOW, borderColor: BORDER_COLOR } }, "Short-Term Bar Play Analysis"), React.createElement('div', { className: "space-y-2" }, plays.map((p, idx) => React.createElement('div', { key: idx, className: "p-2 border rounded-md", style: { borderColor: `${OREGON_YELLOW}4D`, backgroundColor: `${OREGON_YELLOW}1A` } }, React.createElement('p', { className: "text-xs font-medium", style: { color: OREGON_YELLOW } }, `${p.playType || 'N/A'} `, React.createElement('span', {style:{color: `${OREGON_YELLOW}B3`}}, `(${p.relevantTimeframe || 'N/A'})`)), React.createElement('p', { className: "text-xs", style: { color: `${OREGON_YELLOW}CC` } }, `Outcome: ${p.outcome || 'N/A'} (Confidence: ${p.confidence || 'N/A'})`), React.createElement('p', { className: "text-xs italic mt-0.5", style: { color: `${OREGON_YELLOW}99` } }, p.description || 'No description.'))))); };
  const renderHistoricalOptionSuggestionAndChart = () => { if (isLoadingSuggestedHistoricalOptionData) return React.createElement('div', { className: "flex items-center justify-center my-3 p-2 text-xs border rounded-md", style: { backgroundColor: `${DUKE_BLUE}0D`, borderColor: `${DUKE_BLUE}33`, color: `${DUKE_BLUE}CC` } }, React.createElement(LoadingSpinner, { className: "h-4 w-4 mr-2" }), " Fetching AI example historical option..."); if (!suggestedHistoricalOptionData || !suggestedHistoricalOptionData.legs || suggestedHistoricalOptionData.legs.length === 0) { if (suggestedHistoricalOptionData?.error) return React.createElement('div', { className: "my-3 p-2 text-xs border rounded-md", style: { backgroundColor: `${STANFORD_CARDINAL_RED}0D`, borderColor: `${STANFORD_CARDINAL_RED}33`, color: `${STANFORD_CARDINAL_RED}CC` } }, `Error fetching historical option: ${suggestedHistoricalOptionData.error}`); return null; } return React.createElement('div', { className: "mb-3 p-2 border rounded-md", style: { backgroundColor: `${DUKE_BLUE}0D`, borderColor: `${DUKE_BLUE}33` } }, React.createElement('div', { className: "flex justify-between items-center" }, React.createElement('h4', { className: "text-sm font-semibold", style: { color: DUKE_BLUE } }, "AI Example Historical Payoff"), React.createElement('button', { onClick: () => setIsHistoricalOptionChartVisible(prev => !prev), className: "text-xs px-2 py-1 rounded", style: { color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}26` } }, isHistoricalOptionChartVisible ? 'Hide Chart' : 'View Chart')), React.createElement('div', { className: "space-y-1 mt-1.5 mb-1.5" }, suggestedHistoricalOptionData.legs.map((leg, idx) => React.createElement('p', { key: idx, className: "text-xs", style: { color: DUKE_BLUE } }, `Leg ${idx + 1}: ${leg.action.toUpperCase()} ${leg.type.toUpperCase()} @ ${leg.strike} (${leg.role || 'N/A'})`)), suggestedHistoricalOptionData.estimatedNetCostOrCredit !== undefined && React.createElement('p', { className: "text-xs", style: { color: DUKE_BLUE } }, `Est. Net Cost/Credit: ${formatPrice(suggestedHistoricalOptionData.estimatedNetCostOrCredit)}`)), suggestedHistoricalOptionData.reasoningForOptionChoice && React.createElement('p', { className: "text-xs italic mt-1", style: { color: `${DUKE_BLUE}99` } }, `AI Reasoning: ${suggestedHistoricalOptionData.reasoningForOptionChoice}`), suggestedHistoricalOptionData.dataComment && React.createElement('p', { className: "text-xs italic mt-1", style: { color: `${DUKE_BLUE}77` } }, `AI Comment: ${suggestedHistoricalOptionData.dataComment}`), isHistoricalOptionChartVisible && historicalOptionStrategyChartData && React.createElement('div', { className: "mt-2 -mx-2 sm:mx-0" }, React.createElement(PayoffChart, { chartData: historicalOptionStrategyChartData, showIndividualLegs: false })), isHistoricalOptionChartVisible && !historicalOptionStrategyChartData && React.createElement('p', { className: "text-xs text-center mt-2", style: { color: `${DUKE_BLUE}99` } }, "Chart data for historical option play could not be generated.")); };
  let widgetInterval = "D"; if (suggestion.outlookHorizon === OutlookHorizon.ShortTerm) widgetInterval = "60"; else if (suggestion.outlookHorizon === OutlookHorizon.MidTerm) widgetInterval = "240";

  return React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-70 backdrop-blur-md flex justify-center items-center z-[70] p-2 sm:p-4", onClick: onClose, 'aria-modal': "true", role: "dialog", 'aria-labelledby': "stock-insight-modal-title" },
    React.createElement('div', { className: "bg-slate-50 rounded-xl shadow-2xl w-full max-w-5xl h-[95vh] max-h-[1000px] flex flex-col transform transition-all duration-300 scale-100 opacity-100", onClick: (e) => e.stopPropagation(), id: "stockInsightModalContent" },
      React.createElement('div', { className: "flex justify-between items-center p-3 sm:p-4 border-b rounded-t-xl", style: { borderColor: BORDER_COLOR, backgroundColor: `${DUKE_BLUE}1A` } },
        React.createElement('div', null, React.createElement('h2', { id: "stock-insight-modal-title", className: "text-lg sm:text-xl font-bold", style: { color: DUKE_BLUE } }, `${ticker.toUpperCase()} - Detailed Analysis`), React.createElement('p', { className: "text-xs", style: { color: TEXT_COLOR_SECONDARY } }, `Current Price (at suggestion): $${currentPrice?.toFixed(2) || 'N/A'}`, isHistorical && ` (Suggested on: ${formatDate(/** @type {HistoricalBullishSuggestionEntry} */(suggestion).initialTimestamp)})`)),
        React.createElement('div', { className: "flex items-center space-x-2" }, React.createElement('button', { onClick: handleSaveMarkdown, title: "Save as Markdown", className: "p-1.5 rounded-md hover:bg-opacity-20 focus:outline-none focus:ring-2", style: { color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A`, outlineColor: DUKE_BLUE } }, React.createElement(DownloadIcon, { className: "w-4 h-4" }), React.createElement('span', {className:"sr-only"}, "Save MD")), React.createElement('button', { onClick: handleSavePdf, title: "Save as PDF", className: "p-1.5 rounded-md hover:bg-opacity-20 focus:outline-none focus:ring-2", style: { color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A`, outlineColor: DUKE_BLUE } }, React.createElement(DownloadIcon, { className: "w-4 h-4" }), React.createElement('span', {className:"sr-only"}, "Save PDF")), React.createElement('button', { onClick: onClose, className: "p-1 rounded-full focus:outline-none focus:ring-2", style: { color: TEXT_COLOR_SECONDARY, outlineColor: DUKE_BLUE }, 'aria-label': "Close detailed insight modal" }, React.createElement('svg', { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6 sm:h-7 sm:w-7", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor", strokeWidth: 2 }, React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", d: "M6 18L18 6M6 6l12 12" }))))),
      React.createElement('div', { className: "flex flex-col md:flex-row flex-grow overflow-hidden" },
        React.createElement('div', { className: "w-full md:w-3/5 h-1/2 md:h-full border-b md:border-b-0 md:border-r flex flex-col overflow-y-auto", style: { borderColor: BORDER_COLOR } }, React.createElement('div', { className: "h-1/2 md:h-2/5 border-b", style: { borderColor: BORDER_COLOR } }, typeof ticker === 'string' && isValidTicker(ticker) ? React.createElement(TradingViewWidget, { symbol: ticker, interval: widgetInterval, range: suggestion.outlookHorizon === OutlookHorizon.ShortTerm ? "5D" : "6M" }) : React.createElement('div', { className: "flex items-center justify-center h-full", style: { color: TEXT_COLOR_SECONDARY } }, "Invalid Ticker for TradingView Chart.")), React.createElement('div', { className: "flex-grow p-2 space-y-2 overflow-y-auto" }, React.createElement('h4', { className: "text-sm font-semibold text-center sticky top-0 bg-slate-100 py-1 z-10", style: { color: DUKE_BLUE } }, "Historical Context (FMP Data)"), chartError && React.createElement('div', { className: "p-2 text-xs text-center text-red-600 bg-red-50 border border-red-200 rounded-md" }, chartError), React.createElement(FMPPlotlyChart, { prices: fmpChartData.daily, title: `${ticker} Daily Chart (6 Months Prior)`, ticker: ticker, isLoading: isLoadingFMPCharts && !chartError }), fmpChartData.intraday && fmpChartData.intraday.length > 0 && React.createElement(FMPPlotlyChart, { prices: fmpChartData.intraday, title: `${ticker} Intraday Chart (5-min)`, ticker: ticker, isLoading: isLoadingFMPCharts && !chartError }), isLoadingFMPCharts && !chartError && (!fmpChartData.daily && !fmpChartData.intraday) && React.createElement('div', { className: "flex items-center justify-center h-24 text-sm", style: { color: TEXT_COLOR_SECONDARY } }, React.createElement(LoadingSpinner, { className: "h-5 w-5 mr-2" }), "Loading FMP charts..."))),
        React.createElement('div', { className: "w-full md:w-2/5 h-1/2 md:h-full overflow-y-auto p-3 sm:p-4" }, isLoadingDeepDive && !deepDiveAnalysis ? React.createElement('div', { className: "flex flex-col items-center justify-center h-full" }, React.createElement(LoadingSpinner, { className: "h-10 w-10 mb-3" }), React.createElement('p', { style: { color: DUKE_BLUE }, className: "text-sm" }, `Loading detailed AI analysis for ${ticker}...`)) : !isLoadingDeepDive && deepDiveAnalysis?.error ? React.createElement('div', { className: "p-3 border rounded-md text-sm", style: { backgroundColor: `${STANFORD_CARDINAL_RED}1A`, borderColor: `${STANFORD_CARDINAL_RED}4D`, color: STANFORD_CARDINAL_RED } }, React.createElement('p', { className: "font-semibold" }, "Error loading detailed analysis:"), React.createElement('p', null, deepDiveAnalysis.error)) : !isLoadingDeepDive && !deepDiveAnalysis?.error ? React.createElement(React.Fragment, null, deepDiveAnalysis?.dataComment && React.createElement('div', { className: "mb-3 p-2 text-xs border rounded-md italic", style: { backgroundColor: `${DUKE_BLUE}0D`, borderColor: `${DUKE_BLUE}33`, color: `${DUKE_BLUE}CC` } }, React.createElement(MessageIcon, { className: "inline w-3 h-3 mr-1" }), " ", deepDiveAnalysis.dataComment), isHistorical && renderHistoricalOptionSuggestionAndChart(), renderChartPatterns(deepDiveAnalysis?.currentChartPatterns || suggestion.currentChartPatterns), renderBarPlays(deepDiveAnalysis?.barPlayAnalysis || suggestion.barPlayAnalysis), renderPriceProjections(deepDiveAnalysis?.priceProjectionDetails || suggestion.priceProjectionDetails), renderDetailSection("Detailed Reasoning", deepDiveAnalysis?.detailedReasoning || suggestion.detailedReasoning, DUKE_BLUE), renderDetailSection("Microstructure Insights", deepDiveAnalysis?.microstructureInsights || (/** @type {StoredBullishStockSuggestion} */(suggestion)).microstructureInsights, DUKE_BLUE), renderDetailSection("Covariance Considerations", deepDiveAnalysis?.covarianceConsiderations || (/** @type {StoredBullishStockSuggestion} */(suggestion)).covarianceConsiderations, DUKE_BLUE), renderDetailSection("Advanced Model References", deepDiveAnalysis?.advancedModelReferences || (/** @type {StoredBullishStockSuggestion} */(suggestion)).advancedModelReferences, DUKE_BLUE), (!deepDiveAnalysis?.detailedReasoning && !(/** @type {HistoricalBullishSuggestionEntry} */(suggestion)).detailedReasoning && suggestion.reasoning) && renderDetailSection("Initial Reasoning (Fallback)", suggestion.reasoning, TEXT_COLOR_PRIMARY), deepDiveAnalysis?.sources && deepDiveAnalysis.sources.length > 0 && React.createElement('div', { className: "mt-3 pt-2 border-t", style: { borderColor: BORDER_COLOR } }, React.createElement('h5', { className: "text-xs font-semibold mb-1", style: { color: TEXT_COLOR_SECONDARY } }, "AI Sources:"), React.createElement('ul', { className: "list-disc list-inside text-xs space-y-0.5", style: { color: TEXT_COLOR_SECONDARY } }, deepDiveAnalysis.sources.map((s, i) => React.createElement('li', { key: i, className: "truncate" }, React.createElement('a', { href: s.uri, target: "_blank", rel: "noopener noreferrer", className: "hover:underline", style: { color: DUKE_BLUE }, title: s.title }, s.title || new URL(s.uri).hostname)))))) : null)),
      React.createElement('div', { className: "p-3 border-t flex justify-between items-center rounded-b-xl", style: { borderColor: BORDER_COLOR, backgroundColor: `${DUKE_BLUE}0A` } }, isHistorical && onSetHistoricalContextForStrategy ? React.createElement('button', { onClick: handleSetContextAndClose, className: "font-semibold py-2 px-4 rounded-md shadow-sm transition-colors text-sm", style: { backgroundColor: OREGON_GREEN, color: 'white' } }, "Use Historical Context in Main App") : React.createElement('div', {}), /* Placeholder to keep button to the right */ React.createElement('button', { onClick: onClose, className: `font-semibold py-2 px-4 rounded-md shadow-sm transition-colors ${!isHistorical || !onSetHistoricalContextForStrategy ? 'ml-auto' : ''}`, style: { backgroundColor: DUKE_BLUE, color: 'white' } }, "Close"))
    )
  );
};

export default StockInsightModal;
