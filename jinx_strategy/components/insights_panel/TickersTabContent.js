// Assuming React is available globally e.g. via CDN
// Types are for JSDoc, actual type checking is not performed at runtime for pure JS
// import { StoredBullishStockSuggestion, ReasoningModalInfo, StockInsightModalData, OutlookHorizon } from '../../types.js';
import { BrainIcon } from '../../constants.js'; // Assuming .js extension

/**
 * @typedef {import('../../types.js').StoredBullishStockSuggestion} StoredBullishStockSuggestion
 * @typedef {import('../../types.js').ReasoningModalInfo} ReasoningModalInfo
 * @typedef {import('../../types.js').StockInsightModalData} StockInsightModalData
 * @typedef {import('../../types.js').OutlookHorizon} OutlookHorizon // Not directly used as value, but its values are
 */

/**
 * @typedef {Object} TickersTabContentProps
 * @property {StoredBullishStockSuggestion[] | null} bullishStockInsights
 * @property {(info: ReasoningModalInfo) => void} onOpenReasoningModal
 * @property {(suggestion: StoredBullishStockSuggestion, isHistorical: boolean) => Promise<void>} onTriggerStockInsightModal
 * @property {boolean} isLoading // General loading state for disabling buttons
 * @property {StockInsightModalData | null} currentStockForInsightModal // To show loading specific to a ticker
 */

/**
 * @param {TickersTabContentProps} props
 * @returns {React.ReactElement}
 */
const TickersTabContent = ({
    bullishStockInsights, onOpenReasoningModal, onTriggerStockInsightModal, isLoading, currentStockForInsightModal
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. TickersTabContent component cannot render.");
        return null;
    }

    const isFetchingDeepDiveForThisTicker = (ticker) =>
        currentStockForInsightModal?.isLoadingDeepDive && currentStockForInsightModal.suggestion.ticker === ticker;

    if (!bullishStockInsights || bullishStockInsights.length === 0) {
        return React.createElement('p', { className: "p-4 text-sm text-gray-500" }, "No bullish ticker insights available. Use \"AI Suggest Bullish Underlyings\" to populate.");
    }

    return React.createElement(
        'div',
        { className: "p-4 space-y-3 max-h-96 overflow-y-auto" },
        bullishStockInsights.map(stock => {
            // Assuming OutlookHorizon is an object with string values from types.js / constants.js
            const isShortTermStock = stock.outlookHorizon === 'Short-Term'; // Direct comparison with string value

            const tickerButtonContent = [
                isShortTermStock && React.createElement(BrainIcon, { className: "w-4 h-4 mr-1.5 text-orange-600", key: "brain" }),
                `${stock.ticker} (${stock.currentPrice?.toFixed(2) || 'N/A'})`,
                isShortTermStock && React.createElement('span', { className: "text-orange-500 ml-1", key: "flash" }, "⚡️"),
                isFetchingDeepDiveForThisTicker(stock.ticker) && React.createElement('span', { className: "animate-spin rounded-full h-3 w-3 border-b-2 border-current inline-block ml-1.5", key: "spinner" })
            ].filter(Boolean);


            const projectionElements = [];
            if ((stock.projectedPriceChangePercentMin !== null && stock.projectedPriceChangePercentMin !== undefined) || (stock.projectedPriceChangePercentMax !== null && stock.projectedPriceChangePercentMax !== undefined)) {
                projectionElements.push(
                    React.createElement(
                        'p',
                        { className: `text-xs mt-0.5 ${isShortTermStock ? 'text-green-700 font-medium' : 'text-green-600'}`, key: "projection-percent" },
                        `Initial Projection: 📈 +${stock.projectedPriceChangePercentMin ?? '?'}% to +${stock.projectedPriceChangePercentMax ?? '?'}%`
                    )
                );
            }
            if (stock.projectedTimeline) {
                projectionElements.push(
                    React.createElement(
                        'p',
                        { className: `text-xs mt-0.5 ${isShortTermStock ? 'text-green-700 font-medium' : 'text-green-600'}`, key: "projection-timeline" },
                        `⏳ ${stock.projectedTimeline}`
                    )
                );
            }

            const initialInsightButton = stock.reasoning && (!stock.detailedReasoning || stock.reasoning !== stock.detailedReasoning)
                ? React.createElement(
                    'div',
                    { className: "mt-1", key: "initial-insight-div" },
                    React.createElement(
                        'button',
                        {
                            onClick: () => onOpenReasoningModal({ title: `Initial Insight: ${stock.ticker}`, reasoning: stock.reasoning }),
                            className: `text-xs ${isShortTermStock ? 'text-orange-500 hover:underline' : 'text-sky-500 hover:underline'}`
                        },
                        "Read Initial Insight..."
                    )
                  )
                : null;


            return React.createElement(
                'div',
                { key: stock.id, className: `p-3 border ${isShortTermStock ? 'border-orange-300 bg-orange-50/80' : 'border-sky-200 bg-sky-50/70'} rounded-lg shadow-sm` },
                React.createElement(
                    'div',
                    { className: "flex justify-between items-start mb-1" },
                    React.createElement(
                        'button',
                        {
                            onClick: () => onTriggerStockInsightModal(stock, false),
                            disabled: isLoading,
                            className: `font-semibold ${isShortTermStock ? 'text-orange-700 hover:text-orange-600' : 'text-sky-700 hover:text-sky-600'} text-md disabled:opacity-50 flex items-center`,
                            title: `View Detailed Analysis & Chart for ${stock.ticker}`
                        },
                        ...tickerButtonContent
                    ),
                    React.createElement('span', { className: `text-xs ${isShortTermStock ? 'text-orange-500' : 'text-sky-500'}` }, `${stock.priceCategory}, ${stock.outlookHorizon}`)
                ),
                isFetchingDeepDiveForThisTicker(stock.ticker) && React.createElement(
                    'div',
                    { className: "text-xs text-sky-600 flex items-center my-1" },
                    React.createElement('span', { className: "animate-spin rounded-full h-3 w-3 border-b-2 border-sky-600 mr-1.5" }),
                    "Performing deeper analysis..."
                ),
                ...projectionElements,
                initialInsightButton
            );
        })
    );
};

export default TickersTabContent;
