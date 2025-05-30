// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { StoredAISuggestion, ReasoningModalInfo, StoredBullishStockSuggestion, HistoricalBullishSuggestionEntry, PlotOptions, StockPriceCategory, OutlookHorizon } from '../../types.js';
import { DUKE_BLUE, STANFORD_CARDINAL_RED, OREGON_GREEN, OREGON_YELLOW, TEXT_COLOR_PRIMARY, TEXT_COLOR_SECONDARY, BrainIcon } from '../../constants.js'; // Assuming .js
import { isValidTicker } from '../../utils/validationUtils.js'; // Assuming .js

/**
 * @typedef {import('../../types.js').StoredAISuggestion} StoredAISuggestion
 * @typedef {import('../../types.js').ReasoningModalInfo} ReasoningModalInfo
 * @typedef {import('../../types.js').StoredBullishStockSuggestion} StoredBullishStockSuggestion
 * @typedef {import('../../types.js').HistoricalBullishSuggestionEntry} HistoricalBullishSuggestionEntry
 * @typedef {import('../../types.js').PlotOptions} PlotOptions
 * @typedef {import('../../types.js').StockPriceCategory} StockPriceCategoryType // For JSDoc
 * @typedef {import('../../types.js').OutlookHorizon} OutlookHorizonType // For JSDoc
 */

/**
 * @typedef {Object} StrategiesTabContentProps
 * @property {StoredAISuggestion[] | null} strategyInsights
 * @property {(info: ReasoningModalInfo) => void} onOpenReasoningModal
 * @property {(suggestion: StoredAISuggestion) => Promise<void>} onApplyAIStrategySuggestion
 * @property {boolean} anyAppLoading
 * @property {(suggestion: StoredBullishStockSuggestion | HistoricalBullishSuggestionEntry, isHistorical: boolean) => Promise<void>} onTriggerStockInsightModal
 * @property {StoredBullishStockSuggestion[] | null} currentAIBullishStockSuggestions
 * @property {HistoricalBullishSuggestionEntry[] | null} historicalBullishSuggestions
 * @property {PlotOptions} plotOptions
 */

/**
 * @param {StrategiesTabContentProps} props
 * @returns {React.ReactElement}
 */
const StrategiesTabContent = ({
    strategyInsights, onOpenReasoningModal, onApplyAIStrategySuggestion, anyAppLoading,
    onTriggerStockInsightModal, currentAIBullishStockSuggestions, historicalBullishSuggestions, plotOptions
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. StrategiesTabContent component cannot render.");
        return null;
    }

    if (!strategyInsights || strategyInsights.length === 0) {
        return React.createElement('p', { className: "p-4 text-sm", style: { color: TEXT_COLOR_SECONDARY } }, "No strategy insights available. Use \"AI Suggest Strategies\" or click the info icon next to a selected strategy.");
    }

    const sortedInsights = [...strategyInsights].sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));

    const getSuitabilityColor = (suitability) => {
        if (!suitability) return TEXT_COLOR_SECONDARY;
        const lowerSuitability = suitability.toLowerCase();
        if (lowerSuitability.includes('high')) return OREGON_GREEN;
        if (lowerSuitability.includes('medium')) return OREGON_YELLOW;
        if (lowerSuitability.includes('low')) return STANFORD_CARDINAL_RED;
        return TEXT_COLOR_SECONDARY;
    };

    const handleAnalyzeTickerFromStrategy = (suggestion) => {
        if (!isValidTicker(suggestion.underlyingName)) {
             console.error(`StrategiesTabContent: Invalid ticker in AI Strategy suggestion: ${suggestion.underlyingName}`);
            return;
        }

        const bullishSuggestion = currentAIBullishStockSuggestions?.find(s => s.ticker === suggestion.underlyingName) ||
                                  historicalBullishSuggestions?.find(h => h.ticker === suggestion.underlyingName);

        if (bullishSuggestion) {
            const isHistorical = historicalBullishSuggestions?.some(h => h.id === bullishSuggestion.id && h.ticker === bullishSuggestion.ticker) || false;
            onTriggerStockInsightModal(bullishSuggestion, isHistorical);
        } else {
            /** @type {StoredBullishStockSuggestion} */
            const minimalSuggestion = {
                id: `temp-${suggestion.underlyingName}-${Date.now()}`,
                ticker: suggestion.underlyingName,
                currentPrice: plotOptions.currentS ? parseFloat(plotOptions.currentS) : null,
                reasoning: `Triggered from strategy suggestion: ${suggestion.name}`,
                priceCategory: plotOptions.currentS && parseFloat(plotOptions.currentS) < 15 ? 'Below $15' : 'Above/Equal $15', // Using string literals from StockPriceCategory
                outlookHorizon: 'Mid-Term', // Using string literal from OutlookHorizon
                timestamp: Date.now(),
            };
            onTriggerStockInsightModal(minimalSuggestion, false);
        }
    };

    return React.createElement(
        'div',
        { className: "p-3 sm:p-4 space-y-3 max-h-96 overflow-y-auto" },
        sortedInsights.map(strat => {
            const rankElement = strat.rank && React.createElement(
                'span',
                { key: 'rank', className: "mr-1.5 text-xs p-0.5 px-1.5 rounded-full", style: { backgroundColor: DUKE_BLUE, color: 'white' } },
                `#${strat.rank}`
            );

            const suitabilityElement = strat.suitability && React.createElement(
                'span',
                { key: 'suitability', className: "text-xs font-medium ml-0 sm:ml-2 px-1.5 py-0.5 rounded", style: { backgroundColor: `${getSuitabilityColor(strat.suitability)}26`, color: getSuitabilityColor(strat.suitability) } },
                `Suitability: ${strat.suitability}`
            );
            
            const reasoningButton = strat.reasoning && React.createElement(
                'button',
                {
                    key: 'reasoning-btn',
                    onClick: () => onOpenReasoningModal({ title: `Insight for ${strat.name}`, reasoning: strat.reasoning }),
                    className: "text-xs hover:underline mt-1",
                    style: { color: DUKE_BLUE, opacity: 0.9 }
                },
                "Read more reasoning"
            );

            return React.createElement(
                'div',
                { key: strat.id, className: "p-3 border rounded-lg shadow-sm hover:shadow-md transition-shadow duration-200", style: { borderColor: `${DUKE_BLUE}4D`, backgroundColor: `${DUKE_BLUE}0D` } },
                React.createElement(
                    'div',
                    { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center mb-1.5" },
                    React.createElement(
                        'div',
                        { className: "mb-1 sm:mb-0" },
                        React.createElement(
                            'h4',
                            { className: "font-semibold text-sm sm:text-base", style: { color: DUKE_BLUE } },
                            rankElement,
                            `${strat.name} (for ${strat.underlyingName})`
                        ),
                        suitabilityElement
                    ),
                    React.createElement(
                        'div',
                        { className: "flex items-center space-x-2 self-start sm:self-center mt-1 sm:mt-0" },
                        React.createElement(
                            'button',
                            {
                                onClick: () => handleAnalyzeTickerFromStrategy(strat),
                                disabled: anyAppLoading,
                                className: "text-xs font-medium py-1.5 px-3 rounded-md shadow-sm disabled:opacity-60 transition-colors flex items-center",
                                style: { backgroundColor: `${OREGON_GREEN}E6`, color: 'white' },
                                title: `Analyze Ticker: ${strat.underlyingName}`
                            },
                            React.createElement(BrainIcon, { className: "mr-1 w-3.5 h-3.5" }),
                            " Analyze"
                        ),
                        React.createElement(
                            'button',
                            {
                                onClick: () => onApplyAIStrategySuggestion(strat),
                                disabled: anyAppLoading,
                                className: "text-xs font-medium py-1.5 px-3 rounded-md shadow-sm disabled:opacity-60 transition-colors",
                                style: { backgroundColor: OREGON_GREEN, color: 'white' },
                                title: `Apply ${strat.name} for ${strat.underlyingName}`
                            },
                            "Apply Strategy"
                        )
                    )
                ),
                React.createElement('p', { className: "text-[0.65rem] italic", style: { color: TEXT_COLOR_SECONDARY } }, "Applying also loads ticker analysis."),
                React.createElement('p', { className: "text-xs truncate mt-1", style: { color: TEXT_COLOR_SECONDARY } },
                    strat.reasoning?.substring(0, 120) + (strat.reasoning && strat.reasoning.length > 120 ? "..." : "")
                ),
                reasoningButton
            );
        })
    );
};

export default StrategiesTabContent;
