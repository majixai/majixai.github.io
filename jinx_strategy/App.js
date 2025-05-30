// Main App component - Assumes React and other libraries (Recharts, fflate if used) are global

// Import types for JSDoc only
// import { OptionLeg, PlotOptions, ChartData, OptionType, Action, PredefinedStrategy, StrategyLegDefinition, GroundingSource, OptionsChainData, TargetStrikeInfo, StoredAISuggestion, AppDBState, GitHubExportSettings, StoredBullishStockSuggestion, ReasoningModalInfo, InsightTabKey, GeneralStatusMessage, ModalPrimingLegInfo, HistoricalBullishSuggestionEntry, AICallType, StockInsightModalData, StockPriceCategory, OutlookHorizon, GeminiSuggestedHistoricalOption } from './types.js';

import {
    MAX_LEGS, DEFAULT_POINT_VALUE, DEFAULT_NUM_POINTS, PREDEFINED_STRATEGIES, SINGLE_ITEM_KEY,
    PlusIcon, ChartIcon, TrashIcon, ClearIcon, FetchIcon, InfoIcon, AISuggestIcon,
    DatabaseIcon, BullishIcon, ExportIcon, EyeIcon, WalletIcon, MessageIcon, BrainIcon, ClipboardIcon, HistoryIcon,
    AnalyticsIcon, PREDEFINED_TICKERS_FOR_PREFETCH, FMP_PROFILE_CACHE_DURATION, FMP_QUOTE_CACHE_DURATION,
    DUKE_BLUE, STANFORD_CARDINAL_RED, OREGON_GREEN, OREGON_YELLOW, LIGHT_NEUTRAL_BACKGROUND, PANEL_BACKGROUND, TEXT_COLOR_PRIMARY, TEXT_COLOR_SECONDARY, BORDER_COLOR,
    LoadingSpinner
} from './constants.js';
import { generatePlotData } from './services/optionCalculationService.js';
import {
    getPlotOptionsFromDB, savePlotOptionsToDB, getLegsFromDB, saveLegsToDB,
    getAppStateFromDB, saveAppStateToDB, getGitHubSettingsFromDB, saveGitHubSettingsToDB,
    getAllDataForExport, saveHistoricalBullishSuggestionToDB, getHistoricalBullishSuggestionsFromDB,
    getFMPCacheFromDB
} from './services/indexedDBService.js';
import * as sqliteService from './services/sqliteService.js';
import * as fmpService from './services/fmpService.js';

import { useGeminiService } from './hooks/useGeminiService.js';
import ConfigurationPanel from './components/ConfigurationPanel.js';
import OptionLegsPanel from './components/OptionLegsPanel.js';
import TTESimulationPanel from './components/TTESimulationPanel.js';
import DataManagementPanel from './components/DataManagementPanel.js';
import DeveloperToolsPanel from './components/DeveloperToolsPanel.js';
import PanelSection from './components/PanelSection.js';
import ReasoningModal from './components/ReasoningModal.js';
import ChartSettingsDropdown from './components/ChartSettingsDropdown.js';

import PayoffChart from './components/PayoffChart.js';
import BlackScholesCalculator from './components/BlackScholesCalculator.js';
import OptionsChainModal from './components/OptionsChainModal.js';
import StockInsightModal from './components/StockInsightModal.js';

import StatusTabContent from './components/insights_panel/StatusTabContent.js';
import TickersTabContent from './components/insights_panel/TickersTabContent.js';
import StrategiesTabContent from './components/insights_panel/StrategiesTabContent.js';
import HistoryTabContent from './components/insights_panel/HistoryTabContent.js';
import AnalyticsTabContent from './components/insights_panel/AnalyticsTabContent.js';

import { generateUniqueId } from './utils/miscUtils.js';
import { OptionType, Action, InsightTabKey, AICallType, StockPriceCategory, OutlookHorizon } from './types.js'; // Import runtime enums/consts

// fflate might need to be global (window.fflate) or this import will fail in browser without build
let fflate;
if (typeof window !== 'undefined' && window.fflate) {
    fflate = window.fflate;
} else {
    console.warn("fflate library not found on window.fflate. Compression will not work.");
}


/**
 * @typedef {Object} InsightsPanelProps
 * @property {InsightTabKey} activeTab
 * @property {(tab: InsightTabKey) => void} setActiveTab
 * @property {GeneralStatusMessage | null} generalStatusMessage
 * @property {StoredBullishStockSuggestion[] | null} bullishStockInsights
 * @property {StoredAISuggestion[] | null} strategyInsights
 * @property {HistoricalBullishSuggestionEntry[] | null} historicalBullishSuggestions
 * @property {string[]} allLoggedErrors
 * @property {() => void} onCloseGeneralStatus
 * @property {(info: ReasoningModalInfo) => void} onOpenReasoningModal
 * @property {boolean} isLoading
 * @property {(suggestion: StoredAISuggestion) => Promise<void>} onApplyAIStrategySuggestion
 * @property {(suggestion: StoredBullishStockSuggestion | HistoricalBullishSuggestionEntry, isHistorical: boolean) => Promise<void>} onTriggerStockInsightModal
 * @property {() => Promise<void>} onCopyErrorsToClipboard
 * @property {StockInsightModalData | null} currentStockForInsightModal
 * @property {PlotOptions} plotOptions
 * @property {StoredBullishStockSuggestion[] | null} currentAIBullishStockSuggestions
 */

/** @param {InsightsPanelProps} props */
const InsightsPanel = ({
    activeTab, setActiveTab, generalStatusMessage,
    bullishStockInsights, strategyInsights, historicalBullishSuggestions, allLoggedErrors,
    onCloseGeneralStatus, onOpenReasoningModal, isLoading,
    onApplyAIStrategySuggestion, onTriggerStockInsightModal, onCopyErrorsToClipboard, currentStockForInsightModal,
    plotOptions, currentAIBullishStockSuggestions
}) => {
    if (typeof React === 'undefined') { console.error("React not loaded for InsightsPanel"); return null; }

    const renderTabContent = () => {
        switch (activeTab) {
            case InsightTabKey.Status: return React.createElement(StatusTabContent, { generalStatusMessage, onCloseGeneralStatus, isLoading });
            case InsightTabKey.Tickers: return React.createElement(TickersTabContent, { bullishStockInsights, onOpenReasoningModal, onTriggerStockInsightModal, isLoading, currentStockForInsightModal });
            case InsightTabKey.Strategies: return React.createElement(StrategiesTabContent, { strategyInsights, onOpenReasoningModal, onApplyAIStrategySuggestion, anyAppLoading: isLoading, onTriggerStockInsightModal, currentAIBullishStockSuggestions, historicalBullishSuggestions, plotOptions });
            case InsightTabKey.History: return React.createElement(HistoryTabContent, { historicalBullishSuggestions, onOpenReasoningModal, onTriggerStockInsightModal, isLoading, currentStockForInsightModal });
            case InsightTabKey.Analytics: return React.createElement(AnalyticsTabContent, { allLoggedErrors, onCopyErrorsToClipboard, anyAppLoading: isLoading });
            default: return null;
        }
    };

    const tabConfig = [
        { key: InsightTabKey.Status, label: "Status", icon: React.createElement(MessageIcon, null) },
        { key: InsightTabKey.Tickers, label: "Ticker Insights", icon: React.createElement(BullishIcon, null) },
        { key: InsightTabKey.Strategies, label: "Strategy Insights", icon: React.createElement(BrainIcon, null) },
        { key: InsightTabKey.History, label: "History", icon: React.createElement(HistoryIcon, null) },
        { key: InsightTabKey.Analytics, label: "Analytics", icon: React.createElement(AnalyticsIcon, null) },
    ];

    return React.createElement('div', { style: { backgroundColor: PANEL_BACKGROUND, borderColor: BORDER_COLOR }, className: "shadow-xl rounded-xl mb-6" },
        React.createElement('div', { style: { borderColor: BORDER_COLOR }, className: "flex border-b overflow-x-auto" },
            tabConfig.map(tab => React.createElement('button', {
                key: tab.key, onClick: () => setActiveTab(tab.key),
                className: `flex-shrink-0 sm:flex-none flex items-center justify-center py-2.5 px-3 sm:px-4 text-xs sm:text-sm font-medium focus:outline-none transition-colors duration-200 group ${activeTab === tab.key ? `border-b-2 text-[${DUKE_BLUE}]` : `text-[${TEXT_COLOR_SECONDARY}] hover:text-[${DUKE_BLUE}] hover:bg-slate-100`}`,
                style: { borderColor: activeTab === tab.key ? DUKE_BLUE : 'transparent' },
                'aria-selected': activeTab === tab.key, role: "tab"
            }, React.cloneElement(tab.icon, { className: `mr-1.5 w-4 h-4 ${activeTab === tab.key ? `text-[${DUKE_BLUE}]` : `text-[${TEXT_COLOR_SECONDARY}] group-hover:text-[${DUKE_BLUE}]`}` }), tab.label))
        ),
        React.createElement('div', { className: "transition-all duration-300 ease-in-out" }, renderTabContent())
    );
};


export const App = () => {
  if (typeof React === 'undefined') { console.error("React not loaded for App"); return null; }
  const { useState, useEffect, useCallback } = React;

  const [legs, setLegs] = useState(/** @type {OptionLeg[]} */ ([]));
  const [plotOptions, setPlotOptions] = useState(/** @type {PlotOptions} */ ({
    id: SINGLE_ITEM_KEY, underlyingName: 'SPY', currentS: '', pointValue: DEFAULT_POINT_VALUE,
    minST: '', maxST: '', numPoints: DEFAULT_NUM_POINTS, showIndividualLegs: true,
    initialTTEForSimulation: 45 / 365, simulationSigma: '0.20', simulationR: '0.05',
  }));
  const [chartData, setChartData] = useState(/** @type {ChartData | null} */ (null));
  const [generalStatusMessage, setGeneralStatusMessage] = useState(/** @type {GeneralStatusMessage | null} */ (null));
  const [allLoggedErrors, setAllLoggedErrors] = useState(/** @type {string[]} */ ([]));
  const [isLoadingPlot, setIsLoadingPlot] = useState(false);
  const [selectedStrategyName, setSelectedStrategyName] = useState(PREDEFINED_STRATEGIES[0].name);
  const [isStockInsightModalOpen, setIsStockInsightModalOpen] = useState(false);
  const [currentStockForInsightModal, setCurrentStockForInsightModal] = useState(/** @type {StockInsightModalData | null} */ (null));
  const [currentAIStrategyInsights, setCurrentAIStrategyInsights] = useState(/** @type {StoredAISuggestion[]} */ ([]));
  const [currentAIBullishStockInsights, setCurrentAIBullishStockInsights] = useState(/** @type {StoredBullishStockSuggestion[]} */ ([]));
  const [historicalBullishSuggestions, setHistoricalBullishSuggestions] = useState(/** @type {HistoricalBullishSuggestionEntry[]} */ ([]));
  const [activeInsightTab, setActiveInsightTab] = useState(InsightTabKey.Status);
  const [suggestedStrategyNamesForDropdown, setSuggestedStrategyNamesForDropdown] = useState(/** @type {string[]} */ ([]));
  const [reasoningModalInfo, setReasoningModalInfo] = useState(/** @type {ReasoningModalInfo | null} */ (null));
  const [showConfiguration, setShowConfiguration] = useState(true);
  const [showOptionLegs, setShowOptionLegs] = useState(true);
  const [showTTESimulation, setShowTTESimulation] = useState(false);
  const [showBlackScholes, setShowBlackScholes] = useState(false);
  const [showDataManagement, setShowDataManagement] = useState(false);
  const [showDeveloperTools, setShowDeveloperTools] = useState(false);
  const [showAnalyticsPanel, setShowAnalyticsPanel] = useState(false);
  const [showAIDataProvenance, setShowAIDataProvenance] = useState(false);
  const [currentSimulatedTTEDays, setCurrentSimulatedTTEDays] = useState(Math.max(0, Math.round((plotOptions.initialTTEForSimulation || 45/365) * 365)));
  const [simulationSigmaInput, setSimulationSigmaInput] = useState(plotOptions.simulationSigma || '0.20');
  const [simulationRInput, setSimulationRInput] = useState(plotOptions.simulationR || '0.05');
  const [isTTESimulationActive, setIsTTESimulationActive] = useState(false);
  const [githubSettings, setGithubSettings] = useState(/** @type {GitHubExportSettings} */ ({ id: SINGLE_ITEM_KEY, pat: '', username: '', repoName: '', filePath: 'option_plotter_config.json' }));
  const [isExporting, setIsExporting] = useState(false);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [sqliteDbInitialized, setSqliteDbInitialized] = useState(false);
  const [appDBState, setAppDBState] = useState(/** @type {AppDBState} */ ({
    id: SINGLE_ITEM_KEY, selectedStrategyName: PREDEFINED_STRATEGIES[0].name, showBlackScholes: false,
    currentAIStrategySuggestions: null, lastUnderlyingForStrategySuggestions: null,
    currentAIBullishStockSuggestions: null, lastFetchedBullishStocksTimestamp: null,
    allAccumulatedAISources: null, activeInsightTab: InsightTabKey.Status,
    aiCallDurations: {}, showAnalyticsPanel: false,
  }));
  const [isOptionsChainModalOpen, setIsOptionsChainModalOpen] = useState(false);
  const [optionsChainForModal, setOptionsChainForModal] = useState(/** @type {OptionsChainData | null} */ (null));
  const [targetStrikesForModal, setTargetStrikesForModal] = useState(/** @type {TargetStrikeInfo[] | null} */ (null));
  const [currentStockPriceForModalChain, setCurrentStockPriceForModalChain] = useState(/** @type {number | null} */ (null));
  const [allAccumulatedAISources, setAllAccumulatedAISources] = useState(/** @type {GroundingSource[]} */ ([]));
  const [modalPrimingLeg, setModalPrimingLeg] = useState(/** @type {ModalPrimingLegInfo | null} */ (null));

  const showStatus = useCallback((text, type, aiCallType, durationMs) => {
    let messageText = text;
    const relevantCallType = aiCallType || (currentStockForInsightModal?.isLoadingDeepDive ? AICallType.BullishStocksDeepDive : undefined);
    if (relevantCallType && appDBState.aiCallDurations && appDBState.aiCallDurations[relevantCallType] && type === 'info' && !durationMs) {
        messageText += ` (Est. ETA: ~${(appDBState.aiCallDurations[relevantCallType] / 1000).toFixed(1)}s)`;
    }
    if (durationMs && (type === 'success' || type === 'warning')) {
        messageText += ` (Took: ${(durationMs / 1000).toFixed(1)}s)`;
    }
    setGeneralStatusMessage({ text: messageText, type, key: Date.now() });
    if (type === 'error') {
        setAllLoggedErrors(prevErrors => [...prevErrors, `[${new Date().toISOString()}] Status Error: ${messageText}`]);
    }
  }, [appDBState.aiCallDurations, currentStockForInsightModal?.isLoadingDeepDive]);

  const updateAppDBStateCallback = useCallback((updates) => {
    setAppDBState(prev => {
        const newState = {...prev, ...updates };
        if (updates.allAccumulatedAISources) {
            const existingUris = new Set(prev.allAccumulatedAISources?.map(s => s.uri) || []);
            const newSources = updates.allAccumulatedAISources.filter(s => !existingUris.has(s.uri));
            newState.allAccumulatedAISources = [...(prev.allAccumulatedAISources || []), ...newSources];
            setAllAccumulatedAISources(newState.allAccumulatedAISources);
        }
        if(updates.activeInsightTab) setActiveInsightTab(updates.activeInsightTab);
        if (updates.currentAIBullishStockSuggestions) setCurrentAIBullishStockInsights(updates.currentAIBullishStockSuggestions);
        if (updates.currentAIStrategySuggestions) {
             const sortedStrategies = updates.currentAIStrategySuggestions.sort((a, b) => (a.rank || 99) - (b.rank || 99));
            setCurrentAIStrategyInsights(sortedStrategies);
            setSuggestedStrategyNamesForDropdown(sortedStrategies.map(s => s.name));
        }
        if (updates.aiCallDurations) newState.aiCallDurations = { ...prev.aiCallDurations, ...updates.aiCallDurations };
        if (updates.hasOwnProperty('showAnalyticsPanel')) setShowAnalyticsPanel(!!updates.showAnalyticsPanel);
        return newState;
    });
  }, []);

  const { isFetchingStrategyData, isFetchingStrategyExplanation, isFetchingAIStrategySuggestions, isFetchingAIBullishStocks, isFetchingDeeperAnalysis, anyGeminiLoading, fetchStrategyData, fetchStrategyExplanation, fetchAISuggestStrategies, fetchAIBullishStocks, fetchDeeperAnalysis, } = useGeminiService({ showStatus, updateAppDBState: updateAppDBStateCallback, predefinedStrategyNames: PREDEFINED_STRATEGIES.map(s=>s.name) });
  const anyAppLoading = isLoadingPlot || isExporting || anyGeminiLoading;
  const addDefaultLeg = useCallback(() => [{ id: generateUniqueId(), type: OptionType.Call, action: Action.Buy, strike: '', premium: '', quantity: '1', role: 'Default Leg', premiumMissing: true }], []);

  useEffect(() => {
    const initializeApp = async () => {
      await sqliteService.initSqlJsDb().then(setSqliteDbInitialized);
      const [dbPlotOptions, dbLegs, dbAppStateFromDB, dbGitHubSettings, dbHistoricalSuggestions] = await Promise.all([ getPlotOptionsFromDB(), getLegsFromDB(), getAppStateFromDB(), getGitHubSettingsFromDB(), getHistoricalBullishSuggestionsFromDB() ]);
      let currentUnderlyingForSuggestions = plotOptions.underlyingName;
      if (dbPlotOptions) { const mergedPlotOptions = {...plotOptions, ...dbPlotOptions}; setPlotOptions(mergedPlotOptions); currentUnderlyingForSuggestions = mergedPlotOptions.underlyingName; setCurrentSimulatedTTEDays(Math.max(0, Math.round((mergedPlotOptions.initialTTEForSimulation || 45/365) * 365))); setSimulationSigmaInput(mergedPlotOptions.simulationSigma || '0.20'); setSimulationRInput(mergedPlotOptions.simulationR || '0.05'); }
      else { savePlotOptionsToDB(plotOptions); if (sqliteDbInitialized) sqliteService.savePlotOptionsToSQLite(plotOptions); }
      if (dbLegs && dbLegs.length > 0) setLegs(dbLegs.map(l => ({...l, premiumMissing: !l.premium || parseFloat(l.premium) <= 0 })));
      else { const defaultLegs = addDefaultLeg(); setLegs(defaultLegs); saveLegsToDB(defaultLegs); if (sqliteDbInitialized) sqliteService.saveLegsToSQLite(defaultLegs); }
      if (dbAppStateFromDB) {
        const mergedAppState = {...appDBState, ...dbAppStateFromDB}; setAppDBState(mergedAppState); setSelectedStrategyName(mergedAppState.selectedStrategyName); setShowBlackScholes(mergedAppState.showBlackScholes); setActiveInsightTab(mergedAppState.activeInsightTab || InsightTabKey.Status); setShowAnalyticsPanel(!!mergedAppState.showAnalyticsPanel);
        if (mergedAppState.allAccumulatedAISources) setAllAccumulatedAISources(mergedAppState.allAccumulatedAISources);
        if (mergedAppState.lastUnderlyingForStrategySuggestions === currentUnderlyingForSuggestions && mergedAppState.currentAIStrategySuggestions) { const sortedStrategies = mergedAppState.currentAIStrategySuggestions.sort((a,b) => (a.rank || 99) - (b.rank || 99)); setCurrentAIStrategyInsights(sortedStrategies); setSuggestedStrategyNamesForDropdown(sortedStrategies.map(s => s.name)); }
        if (mergedAppState.currentAIBullishStockSuggestions) { const validatedBullishSuggestions = mergedAppState.currentAIBullishStockSuggestions.map(s => ({ ...s, priceProjectionDetails: s.priceProjectionDetails || undefined, detailedReasoning: s.detailedReasoning || undefined, microstructureInsights: s.microstructureInsights || undefined, covarianceConsiderations: s.covarianceConsiderations || undefined, advancedModelReferences: s.advancedModelReferences || undefined, analysisTimestamp: s.analysisTimestamp || undefined, currentChartPatterns: s.currentChartPatterns || undefined, barPlayAnalysis: s.barPlayAnalysis || undefined, })); setCurrentAIBullishStockInsights(validatedBullishSuggestions); }
      } else { saveAppStateToDB(appDBState); if (sqliteDbInitialized) sqliteService.saveAppStateToSQLite(appDBState); }
      if (dbGitHubSettings) setGithubSettings(dbGitHubSettings);
      else { saveGitHubSettingsToDB(githubSettings); if (sqliteDbInitialized) sqliteService.saveGitHubSettingsToSQLite(githubSettings); }
      if (dbHistoricalSuggestions) setHistoricalBullishSuggestions(dbHistoricalSuggestions.sort((a,b) => b.initialTimestamp - a.initialTimestamp));
      setDbInitialized(true);
    };
    initializeApp().catch(e => { console.error("Initialization Error:", e); setAllLoggedErrors(prev => [...prev, `[${new Date().toISOString()}] App Init Error: ${e instanceof Error ? e.message : String(e)}`]); });
  }, [addDefaultLeg, sqliteDbInitialized]); // Removed plotOptions, appDBState, githubSettings from deps

  useEffect(() => {
    if (dbInitialized && sqliteDbInitialized) {
        const prefetchFMPData = async () => { /* ... */ }; // Prefetch logic (can be lengthy, kept as comment for brevity in this summary)
        // prefetchFMPData(); // Commented out for brevity
    }
  }, [dbInitialized, sqliteDbInitialized, showStatus]); // showStatus added to deps

  useEffect(() => { if(dbInitialized && sqliteDbInitialized) savePlotOptionsToDB(plotOptions).then(() => sqliteService.savePlotOptionsToSQLite(plotOptions)); }, [plotOptions, dbInitialized, sqliteDbInitialized]);
  useEffect(() => { if(dbInitialized && sqliteDbInitialized) saveLegsToDB(legs).then(() => sqliteService.saveLegsToSQLite(legs)); }, [legs, dbInitialized, sqliteDbInitialized]);
  useEffect(() => { if(dbInitialized && sqliteDbInitialized) saveAppStateToDB(appDBState).then(() => sqliteService.saveAppStateToSQLite(appDBState));}, [appDBState, dbInitialized, sqliteDbInitialized]);
  useEffect(() => { if(dbInitialized && sqliteDbInitialized) saveGitHubSettingsToDB(githubSettings).then(() => sqliteService.saveGitHubSettingsToSQLite(githubSettings)); }, [githubSettings, dbInitialized, sqliteDbInitialized]);

  const closeGeneralStatusMessage = useCallback(() => setGeneralStatusMessage(null), []);
  const handleAddLeg = () => { if (legs.length < MAX_LEGS) { const newLegRole = `Custom Leg ${legs.length + 1}`; setLegs([...legs, { id: generateUniqueId(), type: OptionType.Call, action: Action.Buy, strike: '', premium: '', quantity: '1', role: newLegRole, premiumMissing: true }]); } else { showStatus(`Maximum of ${MAX_LEGS} legs reached.`, 'warning'); setActiveInsightTab(InsightTabKey.Status); } };
  const handleRemoveLeg = (id) => { setLegs(currentLegsInState => { const newLegs = currentLegsInState.filter(leg => leg.id !== id); if (newLegs.length === 0) setChartData(null); return newLegs; }); };
  const handleLegChange = (id, field, value) => { setLegs(legs.map(leg => { if (leg.id === id) { const updatedLeg = { ...leg, [field]: value }; if (field === 'premium') updatedLeg.premiumMissing = !value || parseFloat(value) <= 0; return updatedLeg; } return leg; })); };
  const handlePlotOptionsChange = useCallback((field, value) => { setPlotOptions(prev => { const newState = { ...prev, [field]: value }; if (field === 'underlyingName' && typeof value === 'string' && value.trim() !== '') { const ticker = value.toUpperCase().trim(); if(ticker !== (appDBState.lastUnderlyingForStrategySuggestions || '').toUpperCase()) { setCurrentAIStrategyInsights([]); setSuggestedStrategyNamesForDropdown([]); updateAppDBStateCallback({ currentAIStrategySuggestions: null, lastUnderlyingForStrategySuggestions: ticker, }); } } return newState; }); }, [appDBState.lastUnderlyingForStrategySuggestions, updateAppDBStateCallback]);
  const handleTriggerStockInsightModal = useCallback(async (stockSuggestion, isHistorical) => { /* ... */ }, [currentAIBullishStockInsights, fetchDeeperAnalysis, showStatus, updateAppDBStateCallback, plotOptions.underlyingName, plotOptions.currentS, historicalBullishSuggestions]); // historicalBullishSuggestions added
  useEffect(() => { /* ... */ }, [plotOptions.underlyingName, currentAIBullishStockInsights, historicalBullishSuggestions, handleTriggerStockInsightModal, currentStockForInsightModal]); // Dependencies updated
  const handleGeneratePlot = useCallback(() => { /* ... */ }, [legs, plotOptions, showStatus, isTTESimulationActive, simulationSigmaInput, simulationRInput, currentSimulatedTTEDays, setActiveInsightTab]); // setActiveInsightTab added
  const handleClearForm = useCallback(() => { /* ... */ }, [addDefaultLeg, showStatus, updateAppDBStateCallback, appDBState.showAnalyticsPanel, setActiveInsightTab]); // setActiveInsightTab added
  const handleStrategySelectChange = useCallback(async (strategyName, autoFetchLiveData = false, underlyingForFetch) => { /* ... */ }, [showStatus, addDefaultLeg, updateAppDBStateCallback, plotOptions, handleFetchLiveData, setActiveInsightTab]); // handleFetchLiveData, setActiveInsightTab added
  const handleFetchLiveData = useCallback(async (currentPlotOptionsOverride, strategyToFetch) => { /* ... */ }, [plotOptions, selectedStrategyName, fetchStrategyData, showStatus, setPlotOptions, setLegs, setOptionsChainForModal, setTargetStrikesForModal, setCurrentStockPriceForModalChain, setIsTTESimulationActive, setCurrentSimulatedTTEDays, setIsOptionsChainModalOpen, setActiveInsightTab]); // setActiveInsightTab added
  const handleModalPremiumSelect = useCallback((legIdToUpdate, premium, strikePrice, optionType) => { /* ... */ }, [showStatus, setActiveInsightTab]); // setActiveInsightTab added
  const handleOpenChainForLeg = useCallback((legId, currentStrike, optionType) => { if (!optionsChainForModal) { showStatus("Chain data not fetched. Use 'Fetch Live Data' first.", 'warning'); return; } setModalPrimingLeg({ legId, strike: currentStrike, optionType }); setIsOptionsChainModalOpen(true); }, [optionsChainForModal, showStatus]);
  const handleExplainStrategyFromPanel = async (strategyNameToExplain) => { /* ... */ };
  const handleSuggestStrategiesFromPanel = async (underlyingForSuggestions) => { /* ... */ };
  const handleApplyAIStrategySuggestion = async (suggestion) => { /* ... */ };
  const handleSuggestBullishStocksFromPanel = async () => { /* ... */ };
  const handleSetHistoricalContextForStrategy = async (historicalSuggestion, historicalOptionPlay) => { /* ... */ };
  const handleExportData = async () => { /* ... */ };
  const handleCopyErrorsToClipboard = async () => { /* ... */ };
  const toggleSection = (setter, dbField) => { setter(prev => { const newState = !prev; if (dbField) updateAppDBStateCallback({ [dbField]: newState }); return newState; }); };
  const renderBullishStockList = () => { /* ... */ };

  // JSX to React.createElement for the main return
  return React.createElement('div', { className: "min-h-screen p-3 sm:p-4 md:p-6 lg:p-8 font-sans", style: { backgroundColor: LIGHT_NEUTRAL_BACKGROUND, color: TEXT_COLOR_PRIMARY } },
    React.createElement('header', { className: "mb-6 sm:mb-8 text-center" },
      React.createElement('h1', { className: "text-3xl sm:text-4xl lg:text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-[#003087] via-[#001A57] to-[#000F33]" }, "Advanced Option Strategy Visualizer"),
      React.createElement('p', { className: "text-sm sm:text-md mt-1.5", style: { color: TEXT_COLOR_SECONDARY } }, "Plot payoff diagrams, analyze strategies with AI, and explore market data.")
    ),
    React.createElement('div', { className: "max-w-screen-2xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6" },
      React.createElement('div', { className: "lg:col-span-1 space-y-6" },
        React.createElement(InsightsPanel, { activeTab: activeInsightTab, setActiveTab: (tab) => updateAppDBStateCallback({ activeInsightTab: tab }), generalStatusMessage, onCloseGeneralStatus: closeGeneralStatusMessage, bullishStockInsights: currentAIBullishStockInsights, strategyInsights: currentAIStrategyInsights, historicalBullishSuggestions, allLoggedErrors, onOpenReasoningModal: setReasoningModalInfo, isLoading: anyAppLoading, onApplyAIStrategySuggestion: handleApplyAIStrategySuggestion, onTriggerStockInsightModal: handleTriggerStockInsightModal, onCopyErrorsToClipboard: handleCopyErrorsToClipboard, currentStockForInsightModal, plotOptions, currentAIBullishStockSuggestions }),
        React.createElement('button', { onClick: handleSuggestBullishStocksFromPanel, disabled: anyAppLoading || isFetchingAIBullishStocks, style: { backgroundColor: OREGON_GREEN }, className: "w-full flex items-center justify-center text-white text-sm font-medium py-2.5 px-3 rounded-xl shadow-lg disabled:opacity-50 transition-all duration-150 ease-in-out hover:opacity-90 active:scale-98 active:brightness-95 mb-0" }, isFetchingAIBullishStocks ? React.createElement(LoadingSpinner, { className: "h-4 w-4 mr-2" }) : React.createElement(BullishIcon, { className: "mr-1.5 w-4 h-4" }), isFetchingAIBullishStocks ? 'AI Finding Stocks...' : 'AI Suggest Bullish Underlyings (Initial Scan)'),
        currentAIBullishStockInsights && currentAIBullishStockInsights.length > 0 && renderBullishStockList(),
        React.createElement(PanelSection, { title: "Strategy Configuration", isVisible: showConfiguration, onToggle: () => toggleSection(setShowConfiguration), titleIcon: React.createElement(ChartIcon, null) }, React.createElement(ConfigurationPanel, { plotOptions, onPlotOptionsChange: handlePlotOptionsChange, selectedStrategyName, onStrategySelectChange: handleStrategySelectChange, suggestedStrategyNamesForDropdown, appDBState, currentAIStrategyInsights, historicalBullishSuggestions, onApplyAIStrategySuggestion: handleApplyAIStrategySuggestion, onSetReasoningModalInfo: setReasoningModalInfo, onSuggestStrategies: handleSuggestStrategiesFromPanel, onFetchLiveData: handleFetchLiveData, onExplainStrategy: handleExplainStrategyFromPanel, isFetchingAIStrategySuggestions, isFetchingLiveData: isFetchingStrategyData, isFetchingStrategyExplanation, anyAppLoading, onTriggerStockInsightModal })),
        React.createElement(PanelSection, { title: `Option Legs (${legs.length}/${MAX_LEGS})`, isVisible: showOptionLegs, onToggle: () => toggleSection(setShowOptionLegs), titleIcon: React.createElement(WalletIcon, null) }, React.createElement(OptionLegsPanel, { legs, onLegChange: handleLegChange, onAddLeg: handleAddLeg, onRemoveLeg: handleRemoveLeg, onOpenChainForLeg: handleOpenChainForLeg, optionsChainForModal, anyAppLoading }))
      ),
      React.createElement('div', { className: "lg:col-span-2 space-y-6" },
        React.createElement(PayoffChart, { chartData, showIndividualLegs: plotOptions.showIndividualLegs }),
        showTTESimulation && React.createElement(PanelSection, { title: "TTE Simulation", isVisible: showTTESimulation, onToggle: () => toggleSection(setShowTTESimulation) }, React.createElement(TTESimulationPanel, { plotOptions, currentSimulatedTTEDays, simulationSigmaInput, simulationRInput, isTTESimulationActive, onToggleTTESimulation: () => { setIsTTESimulationActive(prev => !prev); handleGeneratePlot(); }, onSet0DTESimulation: () => { setCurrentSimulatedTTEDays(0); if (isTTESimulationActive) handleGeneratePlot(); else { setIsTTESimulationActive(true); handleGeneratePlot(); } }, onResetTTESimulation: () => { setIsTTESimulationActive(false); setCurrentSimulatedTTEDays(plotOptions.initialTTEForSimulation ? Math.max(0, Math.round(plotOptions.initialTTEForSimulation * 365)) : 45); setSimulationSigmaInput(plotOptions.simulationSigma || '0.20'); setSimulationRInput(plotOptions.simulationR || '0.05'); handleGeneratePlot(); }, onCurrentSimulatedTTEDaysChange: (days) => { setCurrentSimulatedTTEDays(days); if (isTTESimulationActive) handleGeneratePlot(); }, onSimulationSigmaInputChange: (val) => { setSimulationSigmaInput(val); if (isTTESimulationActive) handleGeneratePlot(); }, onSimulationRInputChange: (val) => { setSimulationRInput(val); if (isTTESimulationActive) handleGeneratePlot(); }, anyAppLoading })),
        showBlackScholes && React.createElement(PanelSection, { title: "Black-Scholes Calculator", isVisible: showBlackScholes, onToggle: () => { toggleSection(setShowBlackScholes, 'showBlackScholes'); } }, React.createElement(BlackScholesCalculator, { underlyingNameForFetch: plotOptions.underlyingName, onBlackScholesError: (calcError, fetchError) => { if (calcError) { showStatus(`B/S Calc Error: ${calcError}`, 'error'); setAllLoggedErrors(prev => [...prev, `B/S Calc: ${calcError}`]); } if (fetchError) { showStatus(`B/S Fetch Error: ${fetchError}`, 'error'); setAllLoggedErrors(prev => [...prev, `B/S Fetch: ${fetchError}`]); } } })),
        showDataManagement && React.createElement(PanelSection, { title: "Data Management", isVisible: showDataManagement, onToggle: () => toggleSection(setShowDataManagement), titleIcon: React.createElement(DatabaseIcon, null) }, React.createElement(DataManagementPanel, { githubSettings, onGitHubSettingsChange: (field, value) => setGithubSettings(prev => ({ ...prev, [field]: value })), onExportData: handleExportData, onClearForm: handleClearForm, anyAppLoading, isExporting })),
        showAnalyticsPanel && React.createElement(PanelSection, { title: "Analytics & App Health", isVisible: showAnalyticsPanel, onToggle: () => toggleSection(setShowAnalyticsPanel, 'showAnalyticsPanel'), titleIcon: React.createElement(AnalyticsIcon, null) }, React.createElement(AnalyticsTabContent, { allLoggedErrors, onCopyErrorsToClipboard: handleCopyErrorsToClipboard, anyAppLoading })),
        showDeveloperTools && React.createElement(PanelSection, { title: "Developer Tools", isVisible: showDeveloperTools, onToggle: () => toggleSection(setShowDeveloperTools) }, React.createElement(DeveloperToolsPanel, { showAIDataProvenance, onToggleAIDataProvenance: setShowAIDataProvenance, allAccumulatedAISources, aiCallDurations: appDBState.aiCallDurations, anyAppLoading })),
        React.createElement('div', { className: "mt-4 flex flex-col sm:flex-row items-center gap-3 sm:gap-4" },
          React.createElement(ChartSettingsDropdown, { showBlackScholes, onToggleBlackScholes: () => toggleSection(setShowBlackScholes, 'showBlackScholes'), showTTESimulation, onToggleTTESimulation: () => toggleSection(setShowTTESimulation), showDataManagement, onToggleDataManagement: () => toggleSection(setShowDataManagement), showDeveloperTools, onToggleDeveloperTools: () => toggleSection(setShowDeveloperTools), showAnalyticsPanel, onToggleAnalyticsPanel: () => toggleSection(setShowAnalyticsPanel, 'showAnalyticsPanel'), anyAppLoading }),
          React.createElement('button', { onClick: handleGeneratePlot, disabled: anyAppLoading || isLoadingPlot || legs.length === 0, style: { backgroundColor: OREGON_GREEN }, className: "w-full sm:w-auto flex-grow sm:flex-grow-0 p-2.5 rounded-lg text-sm font-medium shadow-md text-white hover:opacity-90 transition-all duration-150 disabled:opacity-60 flex items-center justify-center" }, isLoadingPlot ? React.createElement(LoadingSpinner, { className: "h-4 w-4 mr-2" }) : React.createElement(ChartIcon, { className: "mr-1.5 w-4 h-4" }), isLoadingPlot ? "Plotting..." : "Generate Plot")
        )
      ),
      isOptionsChainModalOpen && optionsChainForModal && React.createElement(OptionsChainModal, { isOpen: isOptionsChainModalOpen, onClose: () => { setIsOptionsChainModalOpen(false); setModalPrimingLeg(null); }, optionsChain: optionsChainForModal, currentUILegs: legs, targetStrikesFromAI: targetStrikesForModal, onPremiumSelect: handleModalPremiumSelect, underlyingName: plotOptions.underlyingName, currentStockPriceForChain: currentStockPriceForModalChain, primedLegForModal: modalPrimingLeg }),
      reasoningModalInfo && React.createElement(ReasoningModal, { info: reasoningModalInfo, onClose: () => setReasoningModalInfo(null) }),
      isStockInsightModalOpen && currentStockForInsightModal && React.createElement(StockInsightModal, { isOpen: isStockInsightModalOpen, onClose: () => { setIsStockInsightModalOpen(false); setCurrentStockForInsightModal(null);}, modalData: currentStockForInsightModal, onSetHistoricalContextForStrategy: handleSetHistoricalContextForStrategy }),
      anyAppLoading && React.createElement('div', { style: { backgroundColor: DUKE_BLUE }, className: "fixed bottom-4 right-4 text-white text-xs px-3 py-1.5 rounded-full shadow-xl z-[100] flex items-center" }, React.createElement(LoadingSpinner, { className: "h-4 w-4 mr-2" }), "Processing...")
    )
  );
};
