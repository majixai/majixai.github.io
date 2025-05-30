import React from 'react';
import {
    PlotOptions, StoredAISuggestion, 
    PredefinedStrategy, AppDBState, HistoricalBullishSuggestionEntry,
    ReasoningModalInfo, StoredBullishStockSuggestion, StockPriceCategory, OutlookHorizon // Added Enums
} from '../types';
import {
    PREDEFINED_STRATEGIES, 
    FetchIcon, InfoIcon, AISuggestIcon, 
    DUKE_BLUE, STANFORD_CARDINAL_RED, OREGON_GREEN, TEXT_COLOR_PRIMARY, TEXT_COLOR_SECONDARY, BORDER_COLOR, LoadingSpinner,
    BrainIcon 
} from '../constants';
import { InputField, SelectField } from './SharedControls'; 
import { isValidTicker } from '../utils/validationUtils'; // Import ticker validation

interface ConfigurationPanelProps {
    plotOptions: PlotOptions;
    onPlotOptionsChange: (field: keyof PlotOptions, value: string | boolean) => void;
    selectedStrategyName: string;
    onStrategySelectChange: (strategyName: string, autoFetchLiveData?: boolean, underlyingForFetch?: string) => Promise<void>;
    suggestedStrategyNamesForDropdown: string[];
    appDBState: AppDBState;
    currentAIStrategyInsights: StoredAISuggestion[];
    historicalBullishSuggestions: HistoricalBullishSuggestionEntry[] | null; 
    onApplyAIStrategySuggestion: (suggestion: StoredAISuggestion) => Promise<void>;
    onSetReasoningModalInfo: (info: ReasoningModalInfo | null) => void;
    onSuggestStrategies: (underlying: string) => Promise<void>;
    onFetchLiveData: (currentPlotOptionsOverride?: PlotOptions, strategyToFetch?: string) => Promise<void>;
    onExplainStrategy: (strategyName?: string) => Promise<void>;
    isFetchingAIStrategySuggestions: boolean;
    isFetchingLiveData: boolean;
    isFetchingStrategyExplanation: boolean;
    anyAppLoading: boolean; 
    onTriggerStockInsightModal: (suggestion: StoredBullishStockSuggestion | HistoricalBullishSuggestionEntry, isHistorical: boolean) => Promise<void>; 
}

const ConfigurationPanel: React.FC<ConfigurationPanelProps> = ({
    plotOptions, onPlotOptionsChange, selectedStrategyName, onStrategySelectChange,
    suggestedStrategyNamesForDropdown, appDBState, currentAIStrategyInsights, historicalBullishSuggestions,
    onApplyAIStrategySuggestion,
    onSetReasoningModalInfo, onSuggestStrategies,
    onFetchLiveData, onExplainStrategy,
    isFetchingAIStrategySuggestions, isFetchingLiveData, isFetchingStrategyExplanation,
    anyAppLoading,
    onTriggerStockInsightModal 
}) => {

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
    
    const handleAnalyzeTickerFromStrategy = (suggestion: StoredAISuggestion) => {
        if (!isValidTicker(suggestion.underlyingName)) {
            // This case should ideally be prevented by AI suggestion validation earlier,
            // but as a safeguard for manually created/edited suggestions:
            console.error(`ConfigurationPanel: Invalid ticker in AI Strategy suggestion: ${suggestion.underlyingName}`);
            // Optionally: showStatus(`Cannot analyze invalid ticker: ${suggestion.underlyingName}`, 'error');
            return;
        }

        const bullishSuggestion = appDBState.currentAIBullishStockSuggestions?.find(s => s.ticker === suggestion.underlyingName) || 
                                  historicalBullishSuggestions?.find(h => h.ticker === suggestion.underlyingName);
        
        if (bullishSuggestion) {
             const isHistorical = historicalBullishSuggestions?.some(h => h.id === bullishSuggestion.id && h.ticker === bullishSuggestion.ticker) || false;
            onTriggerStockInsightModal(bullishSuggestion, isHistorical);
        } else {
            const minimalSuggestion: StoredBullishStockSuggestion = {
                id: `temp-${suggestion.underlyingName}-${Date.now()}`,
                ticker: suggestion.underlyingName,
                currentPrice: null, 
                reasoning: `Triggered from strategy suggestion: ${suggestion.name}`,
                priceCategory: plotOptions.currentS && parseFloat(plotOptions.currentS) < 15 ? StockPriceCategory.Below15 : StockPriceCategory.AboveOrEqual15,
                outlookHorizon: OutlookHorizon.MidTerm, 
                timestamp: Date.now(),
            };
            onTriggerStockInsightModal(minimalSuggestion, false);
        }
    };


    return (
        <>
            {currentAIStrategyInsights && currentAIStrategyInsights.length > 0 && plotOptions.underlyingName.toUpperCase() === (appDBState.lastUnderlyingForStrategySuggestions || '').toUpperCase() && (
                <div className="mb-4 p-3 rounded-lg max-h-60 overflow-y-auto" style={{backgroundColor: `${DUKE_BLUE}1A`, borderColor: `${DUKE_BLUE}33`, borderWidth: '1px'}}>
                    <p className="text-xs font-semibold mb-2 sticky top-0 py-1 z-10" style={{color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A`}}>
                        AI Suggested Strategies for {plotOptions.underlyingName} (Ranked):
                    </p>
                    <div className="space-y-2">
                        {currentAIStrategyInsights.map(suggestion => (
                            <div key={suggestion.id} className="p-1.5 rounded-md bg-white shadow-sm hover:bg-slate-50 transition-colors">
                                <div className="flex items-center justify-between">
                                    <button
                                        onClick={() => onApplyAIStrategySuggestion(suggestion)}
                                        disabled={anyAppLoading}
                                        title={suggestion.reasoning || `Apply ${suggestion.name}`}
                                        className="text-xs font-medium py-1 px-2 rounded-md shadow-sm disabled:opacity-60 transition-all truncate max-w-[120px] sm:max-w-[150px] flex-grow text-left"
                                        style={{backgroundColor: DUKE_BLUE, color: 'white'}}
                                    >
                                        {suggestion.rank && <span className="font-bold mr-1">#{suggestion.rank}</span>}
                                        {suggestion.name}
                                        {suggestion.suitability && <span className="text-xs opacity-80 ml-1">({suggestion.suitability})</span>}
                                    </button>
                                    <div className="flex items-center ml-1 flex-shrink-0">
                                        {suggestion.reasoning && (
                                            <button
                                                onClick={() => onSetReasoningModalInfo({ title: `Reasoning for ${suggestion.name} on ${suggestion.underlyingName}`, reasoning: suggestion.reasoning || "" })}
                                                className="p-1 rounded-full hover:bg-opacity-20 focus:outline-none"
                                                style={{color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A`}}
                                                title="Read more reasoning"
                                            >
                                                <InfoIcon size={14} />
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleAnalyzeTickerFromStrategy(suggestion)}
                                            disabled={anyAppLoading}
                                            className="p-1 rounded-full hover:bg-opacity-20 focus:outline-none ml-0.5"
                                            style={{color: OREGON_GREEN, backgroundColor: `${OREGON_GREEN}1A`}}
                                            title={`Analyze Ticker: ${suggestion.underlyingName}`}
                                        >
                                            <BrainIcon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-[0.65rem] italic mt-0.5" style={{color: TEXT_COLOR_SECONDARY}}>Applying also loads ticker analysis.</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                <InputField 
                    label="Underlying Name" 
                    id="underlyingName" 
                    value={plotOptions.underlyingName} 
                    onChange={e => onPlotOptionsChange('underlyingName', e.target.value.toUpperCase())} 
                    placeholder="e.g., SPY" 
                    disabled={anyAppLoading}
                    list={underlyingDatalistId}
                />
                <datalist id={underlyingDatalistId}>
                    {uniqueHistoricTickers.map(ticker => <option key={ticker} value={ticker} />)}
                </datalist>

                <InputField label="Current Price (S)" id="currentS" type="number" value={plotOptions.currentS} onChange={e => onPlotOptionsChange('currentS', e.target.value)} placeholder="e.g., 450.50" disabled={anyAppLoading} required />
                
                <SelectField 
                    label="Point Value ($)" 
                    id="pointValue" 
                    value={plotOptions.pointValue} 
                    onChange={e => onPlotOptionsChange('pointValue', e.target.value)}
                    options={pointValueOptions}
                    disabled={anyAppLoading}
                />
                <SelectField 
                    label="Plot Points" 
                    id="numPoints" 
                    value={plotOptions.numPoints} 
                    onChange={e => onPlotOptionsChange('numPoints', e.target.value)}
                    options={numPointsOptions}
                    disabled={anyAppLoading}
                />

                <InputField label="Min S&#x209C; (Plot)" id="minST" type="number" value={plotOptions.minST} onChange={e => onPlotOptionsChange('minST', e.target.value)} placeholder="Auto" disabled={anyAppLoading} />
                <InputField label="Max S&#x209C; (Plot)" id="maxST" type="number" value={plotOptions.maxST} onChange={e => onPlotOptionsChange('maxST', e.target.value)} placeholder="Auto" disabled={anyAppLoading} />
            </div>
            <button onClick={() => onSuggestStrategies(plotOptions.underlyingName)}
                disabled={anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions}
                style={{ backgroundColor: (anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions) ? '' : STANFORD_CARDINAL_RED, borderColor: STANFORD_CARDINAL_RED }}
                onMouseOver={e => { if (!(anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions)) (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#A80000'; }}
                onMouseOut={e => { if (!(anyAppLoading || !plotOptions.underlyingName || isFetchingAIStrategySuggestions)) (e.currentTarget as HTMLButtonElement).style.backgroundColor = STANFORD_CARDINAL_RED; }}
                className="mt-3 w-full flex items-center justify-center text-white text-sm font-medium py-2.5 px-3 rounded-lg shadow-md disabled:opacity-60 transition-all duration-150 ease-in-out hover:scale-103 active:scale-98 active:brightness-90"
            >
                {isFetchingAIStrategySuggestions ? <LoadingSpinner className="h-4 w-4 mr-2"/> : <AISuggestIcon className="w-4 h-4 mr-1.5"/>}
                {isFetchingAIStrategySuggestions ? 'AI Thinking...' : 'AI Suggest Strategies'}
            </button>
            <div className="mt-4 flex items-center space-x-2">
                <div className="flex-grow">
                    <SelectField label="Predefined Strategy" id="predefinedStrategy" value={selectedStrategyName}
                        onChange={e => onStrategySelectChange(e.target.value, false)}
                        options={PREDEFINED_STRATEGIES.map(s => ({ value: s.name, label: `${s.name}${suggestedStrategyNamesForDropdown.includes(s.name) && plotOptions.underlyingName.toUpperCase() === (appDBState.lastUnderlyingForStrategySuggestions || '').toUpperCase() ? ' (AI ✨)' : ''}` }))}
                        disabled={anyAppLoading}
                    />
                </div>
                {selectedStrategyName !== PREDEFINED_STRATEGIES[0].name && (
                    <button onClick={() => onExplainStrategy(selectedStrategyName)} disabled={anyAppLoading || isFetchingStrategyExplanation}
                        className="ml-1 mt-5 p-2.5 disabled:opacity-50 rounded-full hover:bg-opacity-20 focus:outline-none focus:ring-2 focus:ring-opacity-50 transition-colors"
                        style={{color: DUKE_BLUE, backgroundColor: `${DUKE_BLUE}1A`, outlineColor: DUKE_BLUE}}
                        title={`Explain ${selectedStrategyName} (details in Strategy Insights tab)`} aria-label={`Get explanation for ${selectedStrategyName} strategy`}
                    >
                        {isFetchingStrategyExplanation ? <LoadingSpinner className={`h-5 w-5 text-[${DUKE_BLUE}]`}/> : <InfoIcon size={20}/>}
                    </button>
                )}
            </div>
            <div className="mt-3">
                <button onClick={() => onFetchLiveData()}
                    disabled={anyAppLoading || !plotOptions.underlyingName || selectedStrategyName === PREDEFINED_STRATEGIES[0].name || isFetchingLiveData}
                    style={{backgroundColor: OREGON_GREEN}}
                    className="w-full flex items-center justify-center text-white text-sm font-medium py-2.5 px-3 rounded-lg shadow-md disabled:opacity-60 transition-all"
                >
                    {isFetchingLiveData ? <LoadingSpinner className="h-4 w-4 mr-2"/> : <FetchIcon className="w-4 h-4 mr-1.5"/>}
                    {isFetchingLiveData ? 'Fetching...' : 'Fetch Live Data & Auto-Fill Legs'}
                </button>
            </div>
            <div className="mt-4 flex items-center">
                <input type="checkbox" id="showIndividualLegs" checked={plotOptions.showIndividualLegs} onChange={e => onPlotOptionsChange('showIndividualLegs', e.target.checked)} 
                className="h-4 w-4 border rounded focus:ring-2" 
                style={{borderColor: BORDER_COLOR, color: DUKE_BLUE, accentColor: DUKE_BLUE }}
                disabled={anyAppLoading} />
                <label htmlFor="showIndividualLegs" className="ml-2 block text-sm" style={{color: TEXT_COLOR_PRIMARY}}>Show Individual Legs on Plot</label>
            </div>
        </>
    );
};

export default ConfigurationPanel;