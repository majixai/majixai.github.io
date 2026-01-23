/**
 * Actions and Hooks System
 * Provides backend-like functionality on frontend pages
 * Includes data fetching, caching, processing, and state management
 */

// ============================================
// ACTION TYPES
// ============================================
const ACTION_TYPES = {
    FETCH_TICKER_DATA: 'FETCH_TICKER_DATA',
    FETCH_REALTIME_PRICE: 'FETCH_REALTIME_PRICE',
    FETCH_OPTIONS_CHAIN: 'FETCH_OPTIONS_CHAIN',
    FETCH_FINANCIAL_DATA: 'FETCH_FINANCIAL_DATA',
    CALCULATE_ANALYSIS: 'CALCULATE_ANALYSIS',
    CACHE_DATA: 'CACHE_DATA',
    CLEAR_CACHE: 'CLEAR_CACHE',
    SYNC_TO_SERVER: 'SYNC_TO_SERVER',
    EXPORT_DATA: 'EXPORT_DATA',
    IMPORT_DATA: 'IMPORT_DATA'
};

// ============================================
// HOOKS REGISTRY
// ============================================
class HooksRegistry {
    constructor() {
        this.hooks = {
            beforeFetch: [],
            afterFetch: [],
            beforeCalculation: [],
            afterCalculation: [],
            onError: [],
            onCacheHit: [],
            onCacheMiss: [],
            beforeRender: [],
            afterRender: [],
            onDataUpdate: []
        };
        this.middlewares = [];
    }

    /**
     * Register a hook callback
     * @param {string} hookName - Name of the hook
     * @param {Function} callback - Callback function to execute
     * @param {number} priority - Execution priority (lower = earlier)
     */
    register(hookName, callback, priority = 10) {
        if (!this.hooks[hookName]) {
            console.warn(`Hook '${hookName}' does not exist. Creating it.`);
            this.hooks[hookName] = [];
        }
        
        this.hooks[hookName].push({ callback, priority });
        this.hooks[hookName].sort((a, b) => a.priority - b.priority);
        
        console.log(`✓ Registered hook: ${hookName} (priority: ${priority})`);
    }

    /**
     * Execute all callbacks for a hook
     * @param {string} hookName - Name of the hook to execute
     * @param {*} data - Data to pass to callbacks
     * @returns {Promise<*>} Modified data after all callbacks
     */
    async execute(hookName, data = null) {
        if (!this.hooks[hookName]) {
            console.warn(`Hook '${hookName}' not found`);
            return data;
        }

        let result = data;
        for (const hook of this.hooks[hookName]) {
            try {
                const hookResult = await hook.callback(result);
                if (hookResult !== undefined) {
                    result = hookResult;
                }
            } catch (error) {
                console.error(`Error in hook '${hookName}':`, error);
                await this.execute('onError', { hookName, error, data: result });
            }
        }

        return result;
    }

    /**
     * Add middleware for action processing
     * @param {Function} middleware - Middleware function
     */
    addMiddleware(middleware) {
        this.middlewares.push(middleware);
        console.log(`✓ Added middleware`);
    }

    /**
     * Clear all hooks for a specific hook name
     * @param {string} hookName - Name of the hook to clear
     */
    clear(hookName) {
        if (this.hooks[hookName]) {
            this.hooks[hookName] = [];
            console.log(`✓ Cleared hook: ${hookName}`);
        }
    }

    /**
     * Clear all hooks
     */
    clearAll() {
        Object.keys(this.hooks).forEach(key => {
            this.hooks[key] = [];
        });
        console.log(`✓ Cleared all hooks`);
    }
}

// ============================================
// ACTION DISPATCHER
// ============================================
class ActionDispatcher {
    constructor(hooksRegistry) {
        this.hooks = hooksRegistry;
        this.actionQueue = [];
        this.isProcessing = false;
        this.cache = new Map();
        this.workers = new Map();
    }

    /**
     * Dispatch an action
     * @param {string} type - Action type
     * @param {Object} payload - Action payload
     * @param {Object} options - Dispatch options
     * @returns {Promise<*>} Action result
     */
    async dispatch(type, payload = {}, options = {}) {
        const action = {
            type,
            payload,
            options,
            timestamp: Date.now(),
            id: this.generateActionId()
        };

        console.log(`🚀 Dispatching action: ${type}`, payload);

        // Apply middlewares
        let processedAction = action;
        for (const middleware of this.hooks.middlewares) {
            processedAction = await middleware(processedAction);
        }

        // Queue or process immediately
        if (options.queue) {
            return this.queueAction(processedAction);
        } else {
            return this.processAction(processedAction);
        }
    }

    /**
     * Process an action
     * @param {Object} action - Action to process
     * @returns {Promise<*>} Action result
     */
    async processAction(action) {
        try {
            await this.hooks.execute('beforeFetch', action);

            let result;

            switch (action.type) {
                case ACTION_TYPES.FETCH_TICKER_DATA:
                    result = await this.fetchTickerData(action.payload);
                    break;

                case ACTION_TYPES.FETCH_REALTIME_PRICE:
                    result = await this.fetchRealtimePrice(action.payload);
                    break;

                case ACTION_TYPES.FETCH_OPTIONS_CHAIN:
                    result = await this.fetchOptionsChain(action.payload);
                    break;

                case ACTION_TYPES.FETCH_FINANCIAL_DATA:
                    result = await this.fetchFinancialData(action.payload);
                    break;

                case ACTION_TYPES.CALCULATE_ANALYSIS:
                    result = await this.calculateAnalysis(action.payload);
                    break;

                case ACTION_TYPES.CACHE_DATA:
                    result = await this.cacheData(action.payload);
                    break;

                case ACTION_TYPES.CLEAR_CACHE:
                    result = await this.clearCache(action.payload);
                    break;

                case ACTION_TYPES.SYNC_TO_SERVER:
                    result = await this.syncToServer(action.payload);
                    break;

                case ACTION_TYPES.EXPORT_DATA:
                    result = await this.exportData(action.payload);
                    break;

                case ACTION_TYPES.IMPORT_DATA:
                    result = await this.importData(action.payload);
                    break;

                default:
                    throw new Error(`Unknown action type: ${action.type}`);
            }

            await this.hooks.execute('afterFetch', { action, result });

            console.log(`✓ Action completed: ${action.type}`);
            return result;

        } catch (error) {
            console.error(`✗ Action failed: ${action.type}`, error);
            await this.hooks.execute('onError', { action, error });
            throw error;
        }
    }

    /**
     * Queue an action for batch processing
     * @param {Object} action - Action to queue
     * @returns {Promise<*>} Promise that resolves when action is processed
     */
    queueAction(action) {
        return new Promise((resolve, reject) => {
            this.actionQueue.push({ action, resolve, reject });
            if (!this.isProcessing) {
                this.processQueue();
            }
        });
    }

    /**
     * Process queued actions
     */
    async processQueue() {
        if (this.actionQueue.length === 0) {
            this.isProcessing = false;
            return;
        }

        this.isProcessing = true;
        const { action, resolve, reject } = this.actionQueue.shift();

        try {
            const result = await this.processAction(action);
            resolve(result);
        } catch (error) {
            reject(error);
        }

        // Process next action
        setTimeout(() => this.processQueue(), 10);
    }

    /**
     * Fetch ticker data from database or API
     * @param {Object} payload - Contains ticker symbol and options
     * @returns {Promise<Object>} Ticker data
     */
    async fetchTickerData(payload) {
        const { ticker, options = {} } = payload;
        const cacheKey = `ticker_${ticker}_${JSON.stringify(options)}`;

        // Check cache first
        if (!options.skipCache && this.cache.has(cacheKey)) {
            console.log(`📦 Cache hit: ${ticker}`);
            await this.hooks.execute('onCacheHit', { ticker, data: this.cache.get(cacheKey) });
            return this.cache.get(cacheKey);
        }

        console.log(`🌐 Fetching data for: ${ticker}`);
        await this.hooks.execute('onCacheMiss', { ticker });

        // Try to fetch from local database
        try {
            const data = await this.fetchFromDatabase(ticker, options);
            this.cache.set(cacheKey, data);
            return data;
        } catch (error) {
            console.warn(`Failed to fetch from database, generating sample data`, error);
            // Fallback to sample data generation
            const sampleData = await this.generateSampleData(ticker, options);
            this.cache.set(cacheKey, sampleData);
            return sampleData;
        }
    }

    /**
     * Fetch real-time price data
     * @param {Object} payload - Contains ticker symbol
     * @returns {Promise<Object>} Real-time price data
     */
    async fetchRealtimePrice(payload) {
        const { ticker } = payload;
        
        // In production, this would fetch from a real-time API
        // For now, simulate with cache or sample data
        const cachedData = this.cache.get(`ticker_${ticker}_undefined`);
        
        if (cachedData && cachedData.length > 0) {
            const latestData = cachedData[cachedData.length - 1];
            return {
                ticker,
                price: latestData.close,
                change: latestData.close - (cachedData[cachedData.length - 2]?.close || latestData.close),
                changePercent: ((latestData.close - (cachedData[cachedData.length - 2]?.close || latestData.close)) / (cachedData[cachedData.length - 2]?.close || latestData.close) * 100),
                volume: latestData.volume,
                timestamp: new Date().toISOString()
            };
        }

        // Generate sample real-time data
        const basePrice = 100 + Math.random() * 400;
        return {
            ticker,
            price: basePrice,
            change: (Math.random() - 0.5) * 10,
            changePercent: (Math.random() - 0.5) * 5,
            volume: Math.floor(1000000 + Math.random() * 10000000),
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Fetch options chain data
     * @param {Object} payload - Contains ticker and expiration date
     * @returns {Promise<Object>} Options chain data
     */
    async fetchOptionsChain(payload) {
        const { ticker, expiration } = payload;
        
        // Generate sample options chain
        const currentPrice = 150 + Math.random() * 100;
        const chain = {
            ticker,
            expiration: expiration || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            calls: [],
            puts: []
        };

        // Generate strikes from 80% to 120% of current price
        for (let strike = currentPrice * 0.8; strike <= currentPrice * 1.2; strike += currentPrice * 0.05) {
            const roundedStrike = Math.round(strike);
            
            chain.calls.push({
                strike: roundedStrike,
                bid: Math.max(0, currentPrice - roundedStrike + Math.random() * 5),
                ask: Math.max(0, currentPrice - roundedStrike + Math.random() * 5 + 0.5),
                volume: Math.floor(Math.random() * 10000),
                openInterest: Math.floor(Math.random() * 50000),
                impliedVolatility: 0.2 + Math.random() * 0.3
            });

            chain.puts.push({
                strike: roundedStrike,
                bid: Math.max(0, roundedStrike - currentPrice + Math.random() * 5),
                ask: Math.max(0, roundedStrike - currentPrice + Math.random() * 5 + 0.5),
                volume: Math.floor(Math.random() * 10000),
                openInterest: Math.floor(Math.random() * 50000),
                impliedVolatility: 0.2 + Math.random() * 0.3
            });
        }

        return chain;
    }

    /**
     * Fetch fundamental financial data
     * @param {Object} payload - Contains ticker
     * @returns {Promise<Object>} Financial data
     */
    async fetchFinancialData(payload) {
        const { ticker } = payload;
        
        return {
            ticker,
            marketCap: (50 + Math.random() * 2000) * 1e9,
            revenue: (10 + Math.random() * 500) * 1e9,
            netIncome: (1 + Math.random() * 50) * 1e9,
            eps: 2 + Math.random() * 20,
            peRatio: 10 + Math.random() * 40,
            pbRatio: 1 + Math.random() * 5,
            dividendYield: Math.random() * 5,
            beta: 0.5 + Math.random() * 1.5,
            sector: ['Technology', 'Healthcare', 'Finance', 'Energy', 'Consumer'][Math.floor(Math.random() * 5)],
            industry: ['Software', 'Hardware', 'Biotech', 'Banks', 'Oil & Gas'][Math.floor(Math.random() * 5)]
        };
    }

    /**
     * Calculate analysis using Web Worker
     * @param {Object} payload - Analysis parameters
     * @returns {Promise<Object>} Analysis result
     */
    async calculateAnalysis(payload) {
        const { type, data, params } = payload;

        await this.hooks.execute('beforeCalculation', { type, data, params });

        // Use Web Worker for heavy calculations if available
        if (window.Worker && this.workers.has('calculation')) {
            const result = await this.runInWorker('calculation', { type, data, params });
            await this.hooks.execute('afterCalculation', { type, result });
            return result;
        }

        // Fallback to main thread calculation
        const result = await this.calculateInMainThread(type, data, params);
        await this.hooks.execute('afterCalculation', { type, result });
        return result;
    }

    /**
     * Calculate in main thread (fallback)
     * @param {string} type - Analysis type
     * @param {*} data - Input data
     * @param {Object} params - Parameters
     * @returns {Promise<*>} Calculation result
     */
    async calculateInMainThread(type, data, params) {
        // This would call the appropriate calculation function
        console.log(`Computing ${type} in main thread...`);
        return { type, computed: true, data, params };
    }

    /**
     * Run calculation in Web Worker
     * @param {string} workerName - Worker identifier
     * @param {Object} data - Data to send to worker
     * @returns {Promise<*>} Worker result
     */
    async runInWorker(workerName, data) {
        return new Promise((resolve, reject) => {
            const worker = this.workers.get(workerName);
            
            const handler = (e) => {
                worker.removeEventListener('message', handler);
                resolve(e.data);
            };

            const errorHandler = (e) => {
                worker.removeEventListener('error', errorHandler);
                reject(e);
            };

            worker.addEventListener('message', handler);
            worker.addEventListener('error', errorHandler);
            worker.postMessage(data);
        });
    }

    /**
     * Cache data locally
     * @param {Object} payload - Data to cache
     * @returns {Promise<boolean>} Success status
     */
    async cacheData(payload) {
        const { key, data, ttl } = payload;
        
        this.cache.set(key, data);
        
        if (ttl) {
            setTimeout(() => this.cache.delete(key), ttl * 1000);
        }

        // Also store in IndexedDB for persistence
        await this.storeInIndexedDB(key, data, ttl);
        
        console.log(`✓ Cached data: ${key} (TTL: ${ttl || 'none'})`);
        return true;
    }

    /**
     * Clear cache
     * @param {Object} payload - Cache clear options
     * @returns {Promise<boolean>} Success status
     */
    async clearCache(payload) {
        const { pattern } = payload;

        if (pattern) {
            // Clear matching keys
            const regex = new RegExp(pattern);
            for (const key of this.cache.keys()) {
                if (regex.test(key)) {
                    this.cache.delete(key);
                }
            }
        } else {
            // Clear all
            this.cache.clear();
        }

        console.log(`✓ Cleared cache${pattern ? ` (pattern: ${pattern})` : ''}`);
        return true;
    }

    /**
     * Sync data to server
     * @param {Object} payload - Data to sync
     * @returns {Promise<Object>} Sync result
     */
    async syncToServer(payload) {
        const { data, endpoint } = payload;

        console.log(`🔄 Syncing to server: ${endpoint}`);

        // In production, this would POST to your backend
        // For now, simulate sync
        return {
            success: true,
            syncedAt: new Date().toISOString(),
            records: Object.keys(data).length
        };
    }

    /**
     * Export data
     * @param {Object} payload - Export options
     * @returns {Promise<Object>} Export result
     */
    async exportData(payload) {
        const { format = 'json', data, filename } = payload;

        let exportData;
        let mimeType;

        switch (format) {
            case 'json':
                exportData = JSON.stringify(data, null, 2);
                mimeType = 'application/json';
                break;

            case 'csv':
                exportData = this.convertToCSV(data);
                mimeType = 'text/csv';
                break;

            case 'xlsx':
                console.warn('XLSX export not yet implemented');
                return { success: false, error: 'Format not supported' };

            default:
                throw new Error(`Unknown export format: ${format}`);
        }

        // Create download
        const blob = new Blob([exportData], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename || `export_${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log(`✓ Exported data as ${format}`);
        return { success: true, filename: a.download };
    }

    /**
     * Import data
     * @param {Object} payload - Import options
     * @returns {Promise<Object>} Imported data
     */
    async importData(payload) {
        const { file } = payload;

        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    console.log(`✓ Imported data (${Object.keys(data).length} records)`);
                    resolve(data);
                } catch (error) {
                    reject(new Error('Failed to parse imported file'));
                }
            };

            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    /**
     * Fetch from database (placeholder - implement with SQL.js)
     */
    async fetchFromDatabase(ticker, options) {
        // This would use SQL.js to query the database
        throw new Error('Database not available');
    }

    /**
     * Generate sample data
     */
    async generateSampleData(ticker, options) {
        const data = [];
        let price = 100 + Math.random() * 400;
        const days = options.days || 252;

        for (let i = 0; i < days; i++) {
            const change = (Math.random() - 0.48) * price * 0.02;
            price = Math.max(price + change, 1);

            const volatility = 0.015;
            const open = price * (1 + (Math.random() - 0.5) * volatility);
            const close = price * (1 + (Math.random() - 0.5) * volatility);
            const high = Math.max(open, close) * (1 + Math.random() * volatility);
            const low = Math.min(open, close) * (1 - Math.random() * volatility);
            const volume = Math.floor(1000000 + Math.random() * 5000000);

            data.push({
                date: new Date(2025, 0, 1 + i).toISOString().split('T')[0],
                open: open,
                high: high,
                low: low,
                close: close,
                volume: volume
            });
        }

        return data;
    }

    /**
     * Store in IndexedDB
     */
    async storeInIndexedDB(key, data, ttl) {
        // Placeholder - implement IndexedDB storage
        console.log(`📦 Would store in IndexedDB: ${key}`);
    }

    /**
     * Convert data to CSV format
     */
    convertToCSV(data) {
        if (Array.isArray(data) && data.length > 0) {
            const headers = Object.keys(data[0]);
            const rows = data.map(row => headers.map(h => row[h]).join(','));
            return [headers.join(','), ...rows].join('\n');
        }
        return '';
    }

    /**
     * Generate unique action ID
     */
    generateActionId() {
        return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Register a Web Worker
     */
    registerWorker(name, worker) {
        this.workers.set(name, worker);
        console.log(`✓ Registered worker: ${name}`);
    }
}

// ============================================
// GLOBAL INSTANCES
// ============================================
const hooksRegistry = new HooksRegistry();
const actionDispatcher = new ActionDispatcher(hooksRegistry);

// ============================================
// PREDEFINED HOOKS
// ============================================

// Log all fetches
hooksRegistry.register('beforeFetch', async (data) => {
    console.log('📡 Before fetch:', data);
    return data;
});

// Cache successful fetches
hooksRegistry.register('afterFetch', async (data) => {
    console.log('✅ After fetch:', data);
    return data;
});

// Log all errors
hooksRegistry.register('onError', async (errorData) => {
    console.error('❌ Error occurred:', errorData);
    // Could send to error tracking service
});

// Performance tracking
hooksRegistry.register('beforeCalculation', async (data) => {
    data.startTime = performance.now();
    return data;
});

hooksRegistry.register('afterCalculation', async (data) => {
    if (data.startTime) {
        const duration = performance.now() - data.startTime;
        console.log(`⏱️ Calculation completed in ${duration.toFixed(2)}ms`);
    }
    return data;
});

// ============================================
// EXPORTS
// ============================================
window.ActionSystem = {
    ACTION_TYPES,
    hooks: hooksRegistry,
    dispatch: (type, payload, options) => actionDispatcher.dispatch(type, payload, options),
    dispatcher: actionDispatcher
};

console.log('✓ Actions and Hooks System initialized');
