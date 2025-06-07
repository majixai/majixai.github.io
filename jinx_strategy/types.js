// Enums are typically represented as objects in JavaScript
export const OptionType = {
  Call: "call",
  Put: "put",
};

export const Action = {
  Buy: "buy",
  Sell: "sell",
};

// Interfaces are not directly representable in JavaScript.
// We'll rely on JSDoc comments for type hinting if needed,
// or assume dynamic typing. For simplicity, I'm removing them.
// If strong typing is essential, consider using a library like PropTypes
// or migrating to a typed JavaScript solution like Flow.

// Example of how an interface would be handled if we needed to
// represent its structure for documentation or runtime checks (not strictly necessary for pure JS conversion)
/**
 * @typedef {Object} OptionLeg
 * @property {string} id
 * @property {OptionType} type
 * @property {Action} action
 * @property {string} strike
 * @property {string} premium
 * @property {string} quantity
 * @property {string} [role]
 * @property {boolean} [premiumMissing]
 */

/**
 * @typedef {Object} PlotOptions
 * @property {string} id
 * @property {string} underlyingName
 * @property {string} currentS
 * @property {string} pointValue
 * @property {string} minST
 * @property {string} maxST
 * @property {string} numPoints
 * @property {boolean} showIndividualLegs
 * @property {number | null} [initialTTEForSimulation]
 * @property {string} [simulationSigma]
 * @property {string} [simulationR]
 */

/**
 * @typedef {Object} StrategyLegDefinition
 * @property {OptionType} type
 * @property {Action} action
 * @property {number} quantity
 * @property {string} role
 */

/**
 * @typedef {Object} PredefinedStrategy
 * @property {string} name
 * @property {StrategyLegDefinition[]} legs
 */

/**
 * @typedef {Object} PayoffPoint
 * @property {number} s_t
 * @property {number} p_l
 * @property {number} [key] // Adjusted for JS flexibility
 */

/**
 * @typedef {Object} ChartData
 * @property {number[]} sTArray
 * @property {number[]} totalPayoff
 * @property {number[][]} individualLegPayoffs
 * @property {string[]} legDescriptions
 * @property {number} minSTPlot
 * @property {number} maxSTPlot
 * @property {number} [currentSNum]
 * @property {string} underlyingName
 * @property {string} [strategyTitleShort]
 * @property {number} [maxProfit]
 * @property {number} [maxLoss]
 * @property {number | string} [riskRewardRatio]
 * @property {number} [profitZoneInPlot]
 */

/**
 * @typedef {Object} BlackScholesInputs
 * @property {string} stockPrice
 * @property {string} strikePrice
 * @property {string} timeToExpiration
 * @property {string} riskFreeRate
 * @property {string} volatility
 * @property {OptionType} optionType
 */

/**
 * @typedef {Object} BlackScholesResults
 * @property {number} [callPrice]
 * @property {number} [putPrice]
 * @property {number} [callDelta]
 * @property {number} [putDelta]
 * @property {number} [gamma]
 * @property {number} [vega]
 * @property {number} [callTheta]
 * @property {number} [putTheta]
 * @property {number} [callRho]
 * @property {number} [putRho]
 */

/**
 * @typedef {Object} GroundingSource
 * @property {string} uri
 * @property {string} title
 */

/**
 * @typedef {Object} OptionChainEntry
 * @property {number} strike
 * @property {number | null} bid
 * @property {number | null} ask
 * @property {number | null} last
 * @property {number | null} [mid]
 * @property {number | null} [openInterest]
 * @property {number | null} [volume]
 * @property {number | null} [parity]
 * @property {string} [expirationDate]
 * @property {number | null} [impliedVolatility]
 * @property {number | null} [delta]
 * @property {number | null} [gamma]
 * @property {number | null} [theta]
 * @property {number | null} [vega]
 */

/**
 * @typedef {Object} OptionsChainData
 * @property {string | null} expirationDate
 * @property {OptionChainEntry[]} calls
 * @property {OptionChainEntry[]} puts
 * @property {number | null} [currentStockPriceForChain]
 * @property {'gemini' | 'fmp'} [source]
 */

/**
 * @typedef {Object} TargetStrikeInfo
 * @property {string} role
 * @property {number | null} targetStrike
 */

/**
 * @typedef {Object} GeminiStrategyDataResponse
 * @property {number | null} [currentStockPrice]
 * @property {OptionsChainData | null} [optionsChain]
 * @property {TargetStrikeInfo[]} [targetStrikesByRole]
 * @property {number | null} [suggestedPointValue]
 * @property {number | null} [suggestedNumPoints]
 * @property {string} [dataComment]
 * @property {string} [error]
 * @property {GroundingSource[]} [sources]
 * @property {number} [durationMs]
 * @property {boolean} [fmpDataUsed]
 */

/**
 * @typedef {Object} GeminiBlackScholesInputsResponse
 * @property {number | null} [stockPrice]
 * @property {number | null} [strikePrice]
 * @property {number | null} [timeToExpiration]
 * @property {number | null} [riskFreeRate]
 * @property {number | null} [volatility]
 * @property {string} [dataComment]
 * @property {string} [error]
 * @property {GroundingSource[]} [sources]
 * @property {number} [durationMs]
 * @property {boolean} [fmpDataUsed]
 */

/**
 * @typedef {Object} BlackScholesFetchStatus
 * @property {string} message
 * @property {'info' | 'success' | 'warning' | 'error'} type
 * @property {number} key
 */

/**
 * @typedef {Object} SuggestedStrategyInfo
 * @property {string} name
 * @property {string} [reasoning]
 * @property {number} [rank]
 * @property {'High' | 'Medium' | 'Low' | string} [suitability]
 */

/**
 * @typedef {SuggestedStrategyInfo & { id: string, underlyingName: string, timestamp: number }} StoredAISuggestion
 */

/**
 * @typedef {Object} GeminiStrategySuggestionResponse
 * @property {SuggestedStrategyInfo[]} [suggestedStrategies]
 * @property {string} [dataComment]
 * @property {string} [error]
 * @property {GroundingSource[]} [sources]
 * @property {number} [durationMs]
 * @property {boolean} [fmpDataUsed]
 */

export const StockPriceCategory = {
    Below15: "Below $15",
    AboveOrEqual15: "Above/Equal $15",
};

export const OutlookHorizon = {
    ShortTerm: "Short-Term",
    MidTerm: "Mid-Term",
    LongTerm: "Long-Term",
};

/**
 * @typedef {Object} PriceProjectionDetail
 * @property {number} targetPrice
 * @property {string} [probabilityEstimate]
 * @property {number} projectedPriceChangePercent
 * @property {string} timelineDetail
 * @property {string} [reasoning]
 * @property {{ level1up: number, level1down: number, level2up: number, level2down: number }} [stdDevLevels]
 */

/**
 * @typedef {Object} ChartPatternInfo
 * @property {string} patternName
 * @property {string} description
 * @property {string} timeframe
 * @property {string} [keyLevels]
 * @property {"Forming" | "Confirmed Breakout" | "Failed Breakout" | "Approaching Resistance/Support"} [status]
 */

/**
 * @typedef {Object} BarPlayAnalysisInfo
 * @property {string} playType
 * @property {"Identified - Bullish" | "Identified - Bearish" | "Not Clearly Identified" | "Potential Setup"} [outcome]
 * @property {"High" | "Medium" | "Low"} [confidence]
 * @property {string} description
 * @property {string} [relevantTimeframe]
 */

/**
 * @typedef {Object} BullishStockSuggestion
 * @property {string} ticker
 * @property {number | null} currentPrice
 * @property {string} [reasoning]
 * @property {StockPriceCategory} priceCategory
 * @property {OutlookHorizon} outlookHorizon
 * @property {number | null} [projectedPriceChangePercentMin]
 * @property {number | null} [projectedPriceChangePercentMax]
 * @property {string | null} [projectedTimeline]
 * @property {string} [detailedReasoning]
 * @property {PriceProjectionDetail[]} [priceProjectionDetails]
 * @property {string} [microstructureInsights]
 * @property {string} [covarianceConsiderations]
 * @property {string} [advancedModelReferences]
 * @property {number} [analysisTimestamp]
 * @property {string} [dataComment]
 * @property {ChartPatternInfo[]} [currentChartPatterns]
 * @property {BarPlayAnalysisInfo[]} [barPlayAnalysis]
 */

/**
 * @typedef {BullishStockSuggestion & { id: string, timestamp: number }} StoredBullishStockSuggestion
 */

/**
 * @typedef {Object} GeminiBullishStockSuggestionResponse
 * @property {BullishStockSuggestion[]} [suggestedStocks]
 * @property {string} [dataComment]
 * @property {string} [error]
 * @property {GroundingSource[]} [sources]
 * @property {number} [durationMs]
 * @property {boolean} [fmpDataUsed]
 */

/**
 * @typedef {Partial<BullishStockSuggestion> & { sources?: GroundingSource[], error?: string, durationMs?: number, fmpDataUsed?: boolean, analysisTimestamp?: number, currentChartPatterns?: ChartPatternInfo[], barPlayAnalysis?: BarPlayAnalysisInfo[] }} GeminiDeeperAnalysisResponse
 */

/**
 * @typedef {Object} ReasoningModalInfo
 * @property {string} title
 * @property {string} reasoning
 */

export const InsightTabKey = {
    Status: "status",
    Tickers: "tickers",
    Strategies: "strategies",
    History: "history",
    Analytics: "analytics",
};

/**
 * @typedef {Object} GeneralStatusMessage
 * @property {string} text
 * @property {'info' | 'success' | 'warning' | 'error'} type
 * @property {number} key
 */

export const AICallType = {
    StrategyData: 'strategyData',
    BsInputs: 'bsInputs',
    StrategyExplanation: 'strategyExplanation',
    StrategySuggestions: 'strategySuggestions',
    BullishStocksInitial: 'bullishStocksInitial',
    BullishStocksDeepDive: 'bullishStocksDeepDive',
    HistoricalOptionSuggestion: 'historicalOptionSuggestion',
};

/**
 * @typedef {Object} AppDBState
 * @property {string} id
 * @property {string} selectedStrategyName
 * @property {boolean} showBlackScholes
 * @property {StoredAISuggestion[] | null} currentAIStrategySuggestions
 * @property {string | null} lastUnderlyingForStrategySuggestions
 * @property {StoredBullishStockSuggestion[] | null} currentAIBullishStockSuggestions
 * @property {number | null} lastFetchedBullishStocksTimestamp
 * @property {GroundingSource[] | null} [allAccumulatedAISources]
 * @property {InsightTabKey} [activeInsightTab]
 * @property {{ [key in AICallType]?: number }} [aiCallDurations]
 * @property {boolean} [showAnalyticsPanel]
 * @property {boolean} [showUserTrades] - Whether the user trades panel is visible
 */

/**
 * @typedef {Object} GitHubExportSettings
 * @property {string} id
 * @property {string} pat
 * @property {string} username
 * @property {string} repoName
 * @property {string} filePath
 */

/**
 * @typedef {Object} ModalPrimingLegInfo
 * @property {string} legId
 * @property {string} strike
 * @property {OptionType} optionType
 */

/**
 * @typedef {Object} HistoricalBullishSuggestionEntry
 * @property {string} id
 * @property {string} ticker
 * @property {number | null} priceAtSuggestion
 * @property {number} initialTimestamp
 * @property {number | null} projectedPriceChangePercentMin
 * @property {number | null} projectedPriceChangePercentMax
 * @property {string | null} projectedTimeline
 * @property {StockPriceCategory} priceCategory
 * @property {OutlookHorizon} outlookHorizon
 * @property {string | undefined} reasoning
 * @property {string} [detailedReasoning]
 * @property {number} [analysisTimestamp]
 * @property {PriceProjectionDetail[]} [priceProjectionDetails]
 * @property {ChartPatternInfo[]} [currentChartPatterns]
 * @property {BarPlayAnalysisInfo[]} [barPlayAnalysis]
 */

/**
 * @typedef {Object} TradingViewWidgetConfig
 * @property {string} symbol
 * @property {string} [theme]
 * @property {string} [interval]
 * @property {string[]} [studies]
 * @property {string[]} [compareSymbols]
 * @property {string} [timezone]
 * @property {string} [style]
 * @property {string} [locale]
 * @property {boolean} [withdateranges]
 * @property {string} [range]
 * @property {boolean} [allow_symbol_change]
 */

/**
 * @typedef {Object} FMHistoricalPrice
 * @property {string} date // "YYYY-MM-DD" or "YYYY-MM-DD HH:MM:SS" for intraday
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number} volume
 */

/**
 * @typedef {Object} StockInsightModalData
 * @property {StoredBullishStockSuggestion | HistoricalBullishSuggestionEntry} suggestion
 * @property {boolean} isHistorical
 * @property {GeminiDeeperAnalysisResponse | null} deepDiveAnalysis
 * @property {boolean} isLoadingDeepDive
 * @property {{ daily?: FMHistoricalPrice[], intraday?: FMHistoricalPrice[] }} [historicalChartData]
 * @property {boolean} [isLoadingChartData]
 */

/**
 * @typedef {Object} FMPApiKey
 * @property {string} key
 * @property {number} lastUsed
 * @property {number} requestsMade
 */

/**
 * @typedef {Object} FMPProfile
 * @property {string} symbol
 * @property {number} price
 * @property {number} beta
 * @property {number} volAvg
 * @property {number} mktCap
 * @property {number} lastDiv
 * @property {string} range
 * @property {number} changes
 * @property {string} companyName
 * @property {string} currency
 * @property {string} cik
 * @property {string} isin
 * @property {string} cusip
 * @property {string} exchange
 * @property {string} exchangeShortName
 * @property {string} industry
 * @property {string} website
 * @property {string} description
 * @property {string} ceo
 * @property {string} sector
 * @property {string} country
 * @property {string} fullTimeEmployees
 * @property {string} phone
 * @property {string} address
 * @property {string} city
 * @property {string} state
 * @property {string} zip
 * @property {number} dcfDiff
 * @property {number} dcf
 * @property {string} image
 * @property {string} ipoDate
 * @property {boolean} defaultImage
 * @property {boolean} isEtf
 * @property {boolean} isActivelyTrading
 * @property {boolean} isAdr
 * @property {boolean} isFund
 */

/**
 * @typedef {Object} FMPQuote
 * @property {string} symbol
 * @property {string} name
 * @property {number} price
 * @property {number} changesPercentage
 * @property {number} change
 * @property {number} dayLow
 * @property {number} dayHigh
 * @property {number} yearHigh
 * @property {number} yearLow
 * @property {number} marketCap
 * @property {number} priceAvg50
 * @property {number} priceAvg200
 * @property {string} exchange
 * @property {number} volume
 * @property {number} avgVolume
 * @property {number} open
 * @property {number} previousClose
 * @property {number} eps
 * @property {number} pe
 * @property {string} earningsAnnouncement
 * @property {number} sharesOutstanding
 * @property {number} timestamp
 */

/**
 * @typedef {Object} FMPOption
 * @property {string} optionSymbol
 * @property {number} strike
 * @property {number | null} bid
 * @property {number | null} ask
 * @property {number | null} lastPrice
 * @property {number | null} volume
 * @property {number | null} openInterest
 * @property {number | null} impliedVolatility
 * @property {number | null} delta
 * @property {number | null} gamma
 * @property {number | null} theta
 * @property {number | null} vega
 * @property {string} expirationDate
 * @property {number} updated
 */

/**
 * @typedef {Object} FMPOptionChain
 * @property {string} expirationDate
 * @property {FMPOption[]} options
 */

/**
 * @typedef {Object} AIInteractionLogEntry
 * @property {string} id
 * @property {number} timestamp
 * @property {AICallType} call_type
 * @property {string | null} [underlying_name]
 * @property {string | null} [strategy_name]
 * @property {0 | 1} fmp_data_used
 * @property {number | null} [prompt_token_count]
 * @property {number | null} [candidates_token_count]
 * @property {number | null} [total_token_count]
 * @property {0 | 1} error_present
 * @property {number} duration_ms
 */

/**
 * @typedef {Object} FMPCacheEntry
 * @property {string} id
 * @property {T} data
 * @property {number} timestamp
 * @template T
 */

/** @typedef {FMPCacheEntry<FMPProfile>} CachedFMPProfile */
/** @typedef {FMPCacheEntry<FMPQuote>} CachedFMPQuote */
/** @typedef {FMPCacheEntry<FMHistoricalPrice[]>} FMPCacheHistoricalEntry */

/**
 * @typedef {Object} PolygonAggregate
 * @property {number} v // volume
 * @property {number} [vw] // volume weighted average price
 * @property {number} o // open
 * @property {number} c // close
 * @property {number} h // high
 * @property {number} l // low
 * @property {number} t // timestamp (unix ms)
 * @property {number} [n] // number of transactions
 */

/**
 * @typedef {Object} PolygonAggregateResponse
 * @property {string} [ticker]
 * @property {number} [queryCount]
 * @property {number} [resultsCount]
 * @property {boolean} [adjusted]
 * @property {PolygonAggregate[]} [results]
 * @property {string} [status] // e.g., "OK", "ERROR"
 * @property {string} [request_id]
 * @property {number} [count] // For /v2/aggs/grouped/locale/us/market/stocks/{date}
 * @property {string} [error] // For API-level errors directly in JSON response
 */

/**
 * @typedef {Object} HistoricalOptionLegSuggestion
 * @property {OptionType} type
 * @property {Action} action
 * @property {number} strike
 * @property {string} role
 */

/**
 * @typedef {Object} GeminiSuggestedHistoricalOption
 * @property {HistoricalOptionLegSuggestion[]} [legs]
 * @property {string} [reasoningForOptionChoice]
 * @property {number} [estimatedNetCostOrCredit] // e.g. -0.5 for debit, 0.3 for credit
 * @property {string} [dataComment]
 * @property {string} [error]
 * @property {GroundingSource[]} [sources]
 * @property {number} [durationMs]
 * @property {boolean} [fmpDataUsed] // Will likely be false for this specific call
 */

// The `declare global` block is TypeScript specific for augmenting global scope.
// In JavaScript, you would typically assign to `window` or `globalThis` directly if needed,
// but often it's better to pass dependencies explicitly or use modules.
// For `window.initSqlJs` and `window.Plotly`, these are likely loaded via CDN.
// Their availability can be checked at runtime if necessary.
// Environment variables like `process.env.API_KEY` are typically handled
// during a build step (e.g., with Vite, Webpack) or set server-side.
// In a pure client-side JS context without a build process, these would
// need to be managed differently (e.g., hardcoded, fetched from a config file, or via a backend).

// Example for global declarations (if truly needed, though modules are preferred):
// if (typeof window !== 'undefined') {
//   // window.CSS_DUKE_BLUE = '#001A57'; // Example
//   // For CDN loaded libraries, you might do runtime checks:
//   // if (!window.Plotly) console.error("Plotly is not loaded!");
//   // if (!window.initSqlJs) console.error("sql.js is not loaded!");
// }

// For Node.js specific 'ProcessEnv', this is relevant if the code
// is also intended to run in a Node.js environment. For client-side JS, it's not directly applicable.
// If environment variables are needed client-side, they must be embedded or fetched.
// For example, a backend might provide an endpoint `/api/config` that returns necessary keys.

// It's important to note that converting `declare global` and `namespace NodeJS`
// directly to pure JavaScript for the browser is not straightforward because their
// purposes are tied to TypeScript's type system and module resolution.
// The actual way to handle these depends on how the application is built and deployed.
// Since we are aiming for pure JS without a build system initially, we'll remove these
// and assume that any global variables (like Plotly from a CDN) will be available
// when the scripts run. API keys would need to be handled securely, likely not hardcoded.

/**
 * @typedef {Object} UserTrade
 * @property {string} id - Unique identifier for the trade
 * @property {string} symbol
 * @property {string} date
 * @property {number} quantity
 * @property {number} price
 * @property {'buy' | 'sell'} type
 * @property {string} [notes] - Optional notes
 */
