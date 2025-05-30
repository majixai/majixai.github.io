// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
import {
    PREDEFINED_STRATEGIES,
    FetchIcon, InfoIcon, AISuggestIcon,
    DUKE_BLUE, STANFORD_CARDINAL_RED, OREGON_GREEN, TEXT_COLOR_PRIMARY, TEXT_COLOR_SECONDARY, BORDER_COLOR, LoadingSpinner,
    BrainIcon
} from '../constants.js'; // Assuming .js
import { InputField, SelectField } from './SharedControls.js'; // Assuming .js
import { isValidTicker } from '../utils/validationUtils.js'; // Assuming .js
// Enums are now const objects in types.js, so direct import for values might be needed if used directly.
// For this component, StockPriceCategory and OutlookHorizon values are used as string literals, which is fine.

/**
 * @typedef {import('../types.js').PlotOptions} PlotOptions
 * @typedef {import('../types.js').StoredAISuggestion} StoredAISuggestion
 * @typedef {import('../types.js').PredefinedStrategy} PredefinedStrategy
 * @typedef {import('../types.js').AppDBState} AppDBState
 * @typedef {import('../types.js').HistoricalBullishSuggestionEntry} HistoricalBullishSuggestionEntry
 * @typedef {import('../types.js').ReasoningModalInfo} ReasoningModalInfo
 * @typedef {import('../types.js').StoredBullishStockSuggestion} StoredBullishStockSuggestion
 */

/**
 * @typedef {Object} ConfigurationPanelProps
 * @property {PlotOptions} plotOptions
 * @property {(field: keyof PlotOptions, value: string | boolean) => void} onPlotOptionsChange
 * @property {string} selectedStrategyName
 * @property {(strategyName: string, autoFetchLiveData?: boolean, underlyingForFetch?: string) => Promise<void>} onStrategySelectChange
 * @property {string[]} suggestedStrategyNamesForDropdown
 * @property {AppDBState} appDBState
 * @property {StoredAISuggestion[]} currentAIStrategyInsights
 * @property {HistoricalBullishSuggestionEntry[] | null} historicalBullishSuggestions
 * @property {(suggestion: StoredAISuggestion) => Promise<void>} onApplyAIStrategySuggestion
 * @property {(info: ReasoningModalInfo | null) => void} onSetReasoningModalInfo
 * @property {(underlying: string) => Promise<void>} onSuggestStrategies
 * @property {(currentPlotOptionsOverride?: PlotOptions, strategyToFetch?: string) => Promise<void>} onFetchLiveData
 * @property {(strategyName?: string) => Promise<void>} onExplainStrategy
 * @property {boolean} isFetchingAIStrategySuggestions
 * @property {boolean} isFetchingLiveData
 * @property {boolean} isFetchingStrategyExplanation
 * @property {boolean} anyAppLoading
 * @property {(suggestion: StoredBullishStockSuggestion | HistoricalBullishSuggestionEntry, isHistorical: boolean) => Promise<void>} onTriggerStockInsightModal
 */

/**
 * @param {ConfigurationPanelProps} props
 * @returns {React.ReactElement}
 */
const ConfigurationPanel = ({
    plotOptions, onPlotOptionsChange, selectedStrategyName, onStrategySelectChange,
    suggestedStrategyNamesForDropdown, appDBState, currentAIStrategyInsights, historicalBullishSuggestions,
    onApplyAIStrategySuggestion,
    onSetReasoningModalInfo, onSuggestStrategies,
    onFetchLiveData, onExplainStrategy,
    isFetchingAIStrategySuggestions, isFetchingLiveData, isFetchingStrategyExplanation,
    anyAppLoading,
    onTriggerStockInsightModal
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. ConfigurationPanel component cannot render.");
        return null;
    }

    const underlyingDatalistId = "underlyingNameDatalist";
    const uniqueHistoricTickers = Array.from(new Set([
        ...(appDBState.currentAIBullishStockSuggestions?.map(s => s.ticker) || []),
        ...(historicalBullishSuggestions?.map(s => s.ticker) || [])
    ])).sort();

    const pointValueOptions = [
        { value: "1", label: "1" }, { value: "10", label: "10" },
        { value: "50", label: "50" }, { value: "100", label: "100 (Standard Stocks/ETFs)" },
        { value: "1000", label: "1000" },
    ];

    const numPointsOptions = [
        { value: "50", label: "50" }, { value: "100", label: "100" },
        { value: "200", label: "200 (Default)" }, { value: "300", label: "300" },
        { value: "500", label: "500" },
    ];

    const handleAnalyzeTickerFromStrategy = (suggestion) => {
        if (!isValidTicker(suggestion.underlyingName)) {
            console.error(`ConfigurationPanel: Invalid ticker in AI Strategy suggestion: ${suggestion.underlyingName}`);
            return;
        }

        const bullishSuggestion = appDBState.currentAIBullishStockSuggestions?.find(s => s.ticker === suggestion.underlyingName) ||
                                  historicalBullishSuggestions?.find(h => h.ticker === suggestion.underlyingName);

        if (bullishSuggestion) {
             const isHistorical = historicalBullishSuggestions?.some(h => h.id === bullishSuggestion.id && h.ticker === bullishSuggestion.ticker) || false;
            onTriggerStockInsightModal(bullishSuggestion, isHistorical);
        } else {
            /** @type {StoredBullishStockSuggestion} */
            const minimalSuggestion = {
                id: `temp-${suggestion.underlyingName}-${Date.now()}`,
                ticker: suggestion.underlyingName,
                currentPrice: null,
                reasoning: `Triggered from strategy suggestion: ${suggestion.name}`,
                priceCategory: plotOptions.currentS && parseFloat(plotOptions.currentS) < 15 ? 'Below $15' : 'Above/Equal $15',
                outlookHorizon: 'Mid-Term',
                timestamp: Date.now(),
            };
            onTriggerStockInsightModal(minimalSuggestion, false);
        }
    };
    
    const aiSuggestionsSection = currentAIStrategyInsights && currentAIStrategyInsights.length > 0 && plotOptions.underlyingName.toUpperCase() === (appDBState.lastUnderlyingForStrategySuggestions || '').toUpperCase()
        ? React.createElement(
            'div',
            { className: "mb-4 p-3 rounded-lg max-h-60 overflow-y-auto", style: { backgroundColor: `${DUKE_BLUE}1A`, borderColor: `${DUKE_BLUE}33`, borderWidth: '1px' }, key: "ai-suggestions-section" },
            React.createElement(
                'p',
                { className: "text-xs font-semibold mb-2 sticky top-0 py-1 z-10", style: { color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A` } },
                `AI Suggested Strategies for ${plotOptions.underlyingName} (Ranked):`
            ),
            React.createElement(
                'div',
                { className: "space-y-2" },
                currentAIStrategyInsights.map(suggestion => React.createElement(
                    'div',
                    { key: suggestion.id, className: "p-1.5 rounded-md bg-white shadow-sm hover:bg-slate-50 transition-colors" },
                    React.createElement(
                        'div',
                        { className: "flex items-center justify-between" },
                        React.createElement(
                            'button',
                            {
                                onClick: () => onApplyAIStrategySuggestion(suggestion),
                                disabled: anyAppLoading,
                                title: suggestion.reasoning || `Apply ${suggestion.name}`,
                                className: "text-xs font-medium py-1 px-2 rounded-md shadow-sm disabled:opacity-60 transition-all truncate max-w-[120px] sm:max-w-[150px] flex-grow text-left",
                                style: { backgroundColor: DUKE_BLUE, color: 'white' }
                            },
                            suggestion.rank && React.createElement('span', { className: "font-bold mr-1" }, `#${suggestion.rank}`),
                            suggestion.name,
                            suggestion.suitability && React.createElement('span', { className: "text-xs opacity-80 ml-1" }, `(${suggestion.suitability})`)
                        ),
                        React.createElement(
                            'div',
                            { className: "flex items-center ml-1 flex-shrink-0" },
                            suggestion.reasoning && React.createElement(
                                'button',
                                {
                                    onClick: () => onSetReasoningModalInfo({ title: `Reasoning for ${suggestion.name} on ${suggestion.underlyingName}`, reasoning: suggestion.reasoning || "" }),
                                    className: "p-1 rounded-full hover:bg-opacity-20 focus:outline-none",
                                    style: { color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A` },
                                    title: "Read more reasoning"
                                },
                                React.createElement(InfoIcon, { size: 14 })
                            ),
                            React.createElement(
                                'button',
                                {
                                    onClick: () => handleAnalyzeTickerFromStrategy(suggestion),
                                    disabled: anyAppLoading,
                                    className: "p-1 rounded-full hover:bg-opacity-20 focus:outline-none ml-0.5",
                                    style: { color: OREGON_GREEN, backgroundColor: `${OREGON_GREEN}1A` },
                                    title: `Analyze Ticker: ${suggestion.underlyingName}`
                                },
                                React.createElement(BrainIcon, { className: "w-3.5 h-3.5" })
                            )
                        )
                    ),
                    React.createElement('p', { className: "text-[0.65rem] italic mt-0.5", style: {color: TEXT_COLOR_SECONDARY}}, "Applying also loads ticker analysis.")
                ))
            )
          )
        : null;

    return React.createElement(
        React.Fragment,
        null,
        aiSuggestionsSection,
        React.createElement(
            'div',
            { className: "grid grid-cols-1 sm:grid-cols-2 gap-x-4", key: "inputs-grid" },
            React.createElement(InputField, {
                label: "Underlying Name",
                id: "underlyingName",
                value: plotOptions.underlyingName,
                onChange: e => onPlotOptionsChange('underlyingName', e.target.value.toUpperCase()),
                placeholder: "e.g., SPY",
                disabled: anyAppLoading,
                list: underlyingDatalistId
            }),
            React.createElement('datalist', { id: underlyingDatalistId }, uniqueHistoricTickers.map(ticker => React.createElement('option', { key: ticker, value: ticker }))),
            React.createElement(InputField, { label: "Current Price (S)", id: "currentS", type: "number", value: plotOptions.currentS, onChange: e => onPlotOptionsChange('currentS', e.target.value), placeholder: "e.g., 450.50", disabled: anyAppLoading, required: true }),
            React.createElement(SelectField, {
                label: "Point Value ($)",
                id: "pointValue",
                value: plotOptions.pointValue,
                onChange: e => onPlotOptionsChange('pointValue', e.target.value),
                options: pointValueOptions,
                disabled: anyAppLoading
            }),
            React.createElement(SelectField, {
                label: "Plot Points",
                id: "numPoints",
                value: plotOptions.numPoints,
                onChange: e => onPlotOptionsChange('numPoints', e.target.value),
                options: numPointsOptions,
                disabled: anyAppLoading
            }),
            React.createElement(InputField, { label: "Min S\u209C (Plot)", id: "minST", type: "number", value: plotOptions.minST, onChange: e => onPlotOptionsChange('minST', e.target.value), placeholder: "Auto", disabled: anyAppLoading }),
            React.createElement(InputField, { label: "Max S\u209C (Plot)", id: "maxST", type: "number", value: plotOptions.maxST, onChange: e => onPlotOptionsChange('maxST', e.target.value), placeholder: "Auto", disabled: anyAppLoading })
        ),
        React.createElement(
            'button',
            {
                onClick: () => onSuggestStrategies(plotOptions.underlyingName),
                disabled: anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions,
                style: { backgroundColor: (anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions) ? '' : STANFORD_CARDINAL_RED, borderColor: STANFORD_CARDINAL_RED },
                onMouseOver: e => { if (!(anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions)) e.currentTarget.style.backgroundColor = '#A80000'; },
                onMouseOut: e => { if (!(anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions)) e.currentTarget.style.backgroundColor = STANFORD_CARDINAL_RED; },
                className: "mt-3 w-full flex items-center justify-center text-white text-sm font-medium py-2.5 px-3 rounded-lg shadow-md disabled:opacity-60 transition-all duration-150 ease-in-out hover:scale-103 active:scale-98 active:brightness-90",
                key: "suggest-strat-btn"
            },
            isFetchingAIStrategySuggestions ? React.createElement(LoadingSpinner, { className: "h-4 w-4 mr-2" }) : React.createElement(AISuggestIcon, { className: "w-4 h-4 mr-1.5" }),
            isFetchingAIStrategySuggestions ? 'AI Thinking...' : 'AI Suggest Strategies'
        ),
        React.createElement(
            'div',
            { className: "mt-4 flex items-center space-x-2", key: "strategy-select-div" },
            React.createElement(
                'div', { className: "flex-grow" },
                React.createElement(SelectField, {
                    label: "Predefined Strategy", id: "predefinedStrategy", value: selectedStrategyName,
                    onChange: e => onStrategySelectChange(e.target.value, false),
                    options: PREDEFINED_STRATEGIES.map(s => ({ value: s.name, label: `${s.name}${suggestedStrategyNamesForDropdown.includes(s.name) && plotOptions.underlyingName.toUpperCase() === (appDBState.lastUnderlyingForStrategySuggestions || '').toUpperCase() ? ' (AI ✨)' : ''}` })),
                    disabled: anyAppLoading
                })
            ),
            selectedStrategyName !== PREDEFINED_STRATEGIES[0].name && React.createElement(
                'button',
                {
                    onClick: () => onExplainStrategy(selectedStrategyName), disabled: anyAppLoading || isFetchingStrategyExplanation,
                    className: "ml-1 mt-5 p-2.5 disabled:opacity-50 rounded-full hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors",
                    style: { color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A`, outlineColor: DUKE_BLUE },
                    title: `Explain ${selectedStrategyName} (details in Strategy Insights tab)`, 'aria-label': `Get explanation for ${selectedStrategyName} strategy`
                },
                isFetchingStrategyExplanation ? React.createElement(LoadingSpinner, { className: `h-5 w-5 text-[${DUKE_BLUE}]` }) : React.createElement(InfoIcon, { size: 20 })
            )
        ),
        React.createElement(
            'div',
            { className: "mt-3", key: "fetch-live-data-div" },
            React.createElement(
                'button',
                {
                    onClick: () => onFetchLiveData(),
                    disabled: anyAppLoading || !plotOptions.underlyingName || selectedStrategyName === PREDEFINED_STRATEGIES[0].name || isFetchingLiveData,
                    style: { backgroundColor: OREGON_GREEN },
                    className: "w-full flex items-center justify-center text-white text-sm font-medium py-2.5 px-3 rounded-lg shadow-md disabled:opacity-60 transition-all"
                },
                isFetchingLiveData ? React.createElement(LoadingSpinner, { className: "h-4 w-4 mr-2" }) : React.createElement(FetchIcon, { className: "w-4 h-4 mr-1.5" }),
                isFetchingLiveData ? 'Fetching...' : 'Fetch Live Data & Auto-Fill Legs'
            )
        ),
        React.createElement(
            'div',
            { className: "mt-4 flex items-center", key: "show-legs-div" },
            React.createElement('input', {
                type: "checkbox", id: "showIndividualLegs", checked: plotOptions.showIndividualLegs, onChange: e => onPlotOptionsChange('showIndividualLegs', e.target.checked),
                className: "h-4 w-4 border rounded focus:ring-2",
                style: { borderColor: BORDER_COLOR, color: DUKE_BLUE, accentColor: DUKE_BLUE },
                disabled: anyAppLoading
            }),
            React.createElement('label', { htmlFor: "showIndividualLegs", className: "ml-2 block text-sm", style: { color: TEXT_COLOR_PRIMARY } }, "Show Individual Legs on Plot")
        )
    );
};

export default ConfigurationPanel;
