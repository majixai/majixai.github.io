// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { HistoricalBullishSuggestionEntry, ReasoningModalInfo, StockInsightModalData } from '../../types.js';

/**
 * @typedef {import('../../types.js').HistoricalBullishSuggestionEntry} HistoricalBullishSuggestionEntry
 * @typedef {import('../../types.js').ReasoningModalInfo} ReasoningModalInfo
 * @typedef {import('../../types.js').StockInsightModalData} StockInsightModalData
 */

/**
 * @typedef {Object} HistoryTabContentProps
 * @property {HistoricalBullishSuggestionEntry[] | null} historicalBullishSuggestions
 * @property {(info: ReasoningModalInfo) => void} onOpenReasoningModal
 * @property {(suggestion: HistoricalBullishSuggestionEntry, isHistorical: boolean) => Promise<void>} onTriggerStockInsightModal
 * @property {boolean} isLoading // General loading state
 * @property {StockInsightModalData | null} currentStockForInsightModal // To show loading specific to a ticker
 */

/**
 * @param {HistoryTabContentProps} props
 * @returns {React.ReactElement}
 */
const HistoryTabContent = ({
    historicalBullishSuggestions, onOpenReasoningModal, onTriggerStockInsightModal, isLoading, currentStockForInsightModal
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. HistoryTabContent component cannot render.");
        return null;
    }

    const isFetchingDeepDiveForThisTicker = (ticker) =>
        currentStockForInsightModal?.isLoadingDeepDive && currentStockForInsightModal.suggestion.ticker === ticker;

    if (!historicalBullishSuggestions || historicalBullishSuggestions.length === 0) {
        return React.createElement(
            'p',
            { className: "p-4 text-sm text-gray-500" },
            "No historical bullish ticker suggestions found. Suggestions will appear here after using the \"AI Suggest Bullish Underlyings\" feature."
        );
    }

    return React.createElement(
        'div',
        { className: "p-4 space-y-3 max-h-96 overflow-y-auto" },
        React.createElement(
            'p',
            { className: "text-sm text-gray-600 mb-2" },
            `Showing ${historicalBullishSuggestions.length} historical bullish suggestions. Click to re-evaluate & view detailed analysis/chart.`
        ),
        historicalBullishSuggestions.map(hist => {
            const tickerButtonContent = [
                `${hist.ticker} (${hist.priceAtSuggestion?.toFixed(2) || 'N/A'})`,
                isFetchingDeepDiveForThisTicker(hist.ticker) && React.createElement(
                    'span',
                    { className: "animate-spin rounded-full h-3 w-3 border-b-2 border-current inline-block ml-1.5", key: "spinner" }
                )
            ].filter(Boolean);
            
            const reasoningButton = hist.reasoning && React.createElement(
                'button',
                {
                    onClick: () => onOpenReasoningModal({ title: `Historical Insight: ${hist.ticker} (${new Date(hist.initialTimestamp).toLocaleDateString()})`, reasoning: hist.reasoning }),
                    className: "text-xs text-gray-500 hover:underline mt-0.5"
                },
                "Read Initial Reasoning..."
            );

            return React.createElement(
                'div',
                { key: hist.id, className: "p-3 border border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors shadow-sm" },
                React.createElement(
                    'div',
                    { className: "flex justify-between items-start mb-1" },
                    React.createElement(
                        'button',
                        {
                            onClick: () => onTriggerStockInsightModal(hist, true),
                            disabled: isLoading,
                            className: "font-semibold text-gray-700 hover:text-blue-600 text-md disabled:opacity-50 flex items-center",
                            title: `Re-evaluate ${hist.ticker} from ${new Date(hist.initialTimestamp).toLocaleDateString()}`
                        },
                        ...tickerButtonContent
                    ),
                    React.createElement(
                        'span',
                        { className: "text-xs text-gray-500" },
                        new Date(hist.initialTimestamp).toLocaleString()
                    )
                ),
                React.createElement(
                    'p',
                    { className: "text-xs text-green-600" },
                    `Initial Proj: +${hist.projectedPriceChangePercentMin ?? 'N/A'}% to +${hist.projectedPriceChangePercentMax ?? 'N/A'}%` +
                    (hist.projectedTimeline ? ` (⏳ ${hist.projectedTimeline})` : "")
                ),
                reasoningButton
            );
        })
    );
};

export default HistoryTabContent;
