/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import {GoogleGenAI} from '@google/genai';
import * as marked from 'marked';

// Simple Error Logger Utility
const ErrorLogger = {
    logContainer: null,
    logContentElement: null,
    init: function() {
        this.logContainer = document.getElementById('error-log-container');
        this.logContentElement = document.getElementById('error-log-content');
        const toggleButton = document.getElementById('toggle-error-log-button');

        if (toggleButton && this.logContainer) {
            toggleButton.addEventListener('click', () => {
                const isHidden = this.logContainer.style.display === 'none';
                this.logContainer.style.display = isHidden ? 'block' : 'none';
            });
        } else {
            console.warn("ErrorLogger: UI elements for error log (button or container) not found during init.");
        }
    },
    logToUI: function(message, error = null) {
        console.error(message, error || ''); // Keep console logging

        if (!this.logContentElement) {
            // Fallback if UI elements not ready or found
            console.error("ErrorLogger: UI logContentElement not found for logging.");
            return;
        }

        const entry = document.createElement('div');
        entry.style.borderBottom = "1px solid #ccc";
        entry.style.paddingBottom = "5px";
        entry.style.marginBottom = "5px";

        const timestamp = new Date().toISOString();
        let content = `<strong>${timestamp}:</strong> ${message}`;
        if (error) {
            content += `<br><span style="color: red;">Error: ${error.message || String(error)}</span>`; // Handle non-Error objects
            if (error.stack) {
                content += `<br>Stack: ${error.stack.replace(/\n/g, '<br>')}`;
            }
        }
        entry.innerHTML = content;
        this.logContentElement.appendChild(entry);
        this.logContentElement.scrollTop = this.logContentElement.scrollHeight; // Scroll to bottom

        if (this.logContainer && this.logContainer.style.display === 'none' && error) {
             // Automatically show log if an error is logged
            this.logContainer.style.display = 'block';
        }
    }
};

// --- BSM Calculator Code ---
class BSMCalculator {
    static #CND(x) { // Made CND a private static method
        let a1 = 0.319381530, a2 = -0.356563782, a3 = 1.781477937;
        let a4 = -1.821255978, a5 = 1.330274429;
        let L = Math.abs(x);
        let k = 1.0 / (1.0 + 0.2316419 * L);
        let w = 1.0 - 1.0 / Math.sqrt(2 * Math.PI) * Math.exp(-L * L / 2) * (a1 * k + a2 * k * k + a3 * Math.pow(k, 3) + a4 * Math.pow(k, 4) + a5 * Math.pow(k, 5));
        if (x < 0) {
            w = 1.0 - w;
        }
        return w;
    }

    static calculate(S, K, T, v, r, optionType) {
        const d1 = (Math.log(S / K) + (r + (v * v) / 2) * T) / (v * Math.sqrt(T));
        const d2 = d1 - v * Math.sqrt(T);

        if (optionType.toLowerCase() === 'call') {
            return S * BSMCalculator.#CND(d1) - K * Math.exp(-r * T) * BSMCalculator.#CND(d2); // Use BSMCalculator.#CND
        } else if (optionType.toLowerCase() === 'put') {
            return K * Math.exp(-r * T) * BSMCalculator.#CND(-d2) - S * BSMCalculator.#CND(-d1); // Use BSMCalculator.#CND
        } else {
            console.error("BSM Error: Option type must be 'call' or 'put'. Got:", optionType);
            throw new Error("Option type must be 'call' or 'put'");
        }
    }
}
// --- End BSM Calculator Code ---

class UIController {
  #chatContainer; // Private property
  #userQuestionInput; // Private property
  #askButton; // Private property
  #thinkingMessageElement = null; // Private property

  constructor(chatContainerId, userInputId, askButtonId) {
    this.#chatContainer = document.getElementById(chatContainerId);
    this.#userQuestionInput = document.getElementById(userInputId);
    this.#askButton = document.getElementById(askButtonId);

    if (!this.#chatContainer || !this.#userQuestionInput || !this.#askButton) {
      console.error("One or more UI elements not found. Check IDs:", 
        {chatContainerId, userInputId, askButtonId});
    }
  }

  async displayMessage(message, role, thinkingElement = null) {
    const turn = document.createElement('div');
    turn.classList.add('message', `${role}-message`); 
    
    try {
      turn.innerHTML = await marked.parse(message || ''); 
    } catch (e) {
      console.error("Error parsing markdown:", e);
      turn.textContent = message || ''; 
    }

    if (thinkingElement && thinkingElement.parentNode === this.#chatContainer) {
      this.#chatContainer.replaceChild(turn, thinkingElement);
      if (this.#thinkingMessageElement === thinkingElement) {
        this.#thinkingMessageElement = null; 
      }
    } else {
      this.#chatContainer.appendChild(turn);
    }

    this.#chatContainer.scrollTop = this.#chatContainer.scrollHeight;
    return turn; 
  }

  getUserInput() {
    return this.#userQuestionInput ? this.#userQuestionInput.value.trim() : "";
  }

  clearUserInput() {
    if (this.#userQuestionInput) {
      this.#userQuestionInput.value = '';
    }
  }

  async showThinkingMessage() {
    if (this.#thinkingMessageElement && this.#thinkingMessageElement.parentNode === this.#chatContainer) {
        this.#chatContainer.removeChild(this.#thinkingMessageElement);
    }
    this.#thinkingMessageElement = await this.displayMessage("Thinking...", "model-thinking"); 
    return this.#thinkingMessageElement;
  }

  addAskButtonListener(callback) {
    if (this.#askButton) {
      this.#askButton.addEventListener('click', callback);
    } else {
      console.error("Ask button not found, cannot add listener.");
    }
  }

  // Public getter for askButton for ChatController to check existence
  get askButton() {
    return this.#askButton;
  }

  async renderPlot(plotData, layout) {
    const plotDivId = 'plot-container';
    const plotContainer = document.getElementById(plotDivId);
    if (!plotContainer) {
        console.error('Plot container not found!');
        // Optionally, display a message in the chat if the plot container is missing
        // await this.displayMessage("Plot container element is missing from the page.", "error");
        return;
    }
    try {
        await Plotly.newPlot(plotDivId, plotData, layout);
        // Optional: Notify user in chat. This can be repetitive if AI also confirms.
        // await this.displayMessage("A plot has been rendered below.", "system-info"); 
        console.log("Plot rendered successfully.");
    } catch (err) {
        console.error("Error rendering plot:", err);
        await this.displayMessage("Sorry, there was an error rendering the plot. Check console for details.", "error");
    }
  }
}

class ChatModel {
  DB_NAME = 'chatAppDB';
  HISTORY_STORE_NAME = 'chatHistory';
  #ai; // Private property
  #chat; // Private property
  #db = null; // Private property, initialized
  #cache = {}; // Private property
  #lastBSMResult = null; // For saving BSM results
  #lastPlotConfig = null; // For saving plot configurations
  #loadedModelData = null; // For context after loading data, not directly used in this diff but good for future

  constructor(apiKey, modelName = "gemini-1.5-flash-latest") { 
    this.#ai = new GoogleGenAI({apiKey});
    this.#chat = this.#ai.startChat({
      model: modelName, 
      history: [] 
    });
  }

  // Public method to allow ChatController to update this after AI generates plot params
  setLastPlotConfig(config) {
    this.#lastPlotConfig = config;
  }

  async #initDB() { // Private method
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.DB_NAME, 1);

      request.onupgradeneeded = (event) => {
        const dbInstance = event.target.result; 
        try {
            if (!dbInstance.objectStoreNames.contains(this.HISTORY_STORE_NAME)) {
              const historyStore = dbInstance.createObjectStore(this.HISTORY_STORE_NAME, { keyPath: 'id', autoIncrement: true });
              historyStore.createIndex('timestamp', 'timestamp', { unique: false });
              console.log('IndexedDB: Object store "chatHistory" created.');
            }
            const MODEL_PARAMS_STORE_NAME = 'modelParamsResults';
            if (!dbInstance.objectStoreNames.contains(MODEL_PARAMS_STORE_NAME)) {
              const paramsStore = dbInstance.createObjectStore(MODEL_PARAMS_STORE_NAME, { keyPath: 'id', autoIncrement: true });
              paramsStore.createIndex('type', 'type', { unique: false });
              paramsStore.createIndex('name', 'name', { unique: false }); 
              paramsStore.createIndex('timestamp', 'timestamp', { unique: false });
              console.log(`IndexedDB: Object store "${MODEL_PARAMS_STORE_NAME}" created.`);
            }
        } catch (error) {
            const errorMessage = "Error during onupgradeneeded while creating object stores.";
            console.error(errorMessage, error);
            ErrorLogger.logToUI(errorMessage, error);
            reject(error); 
        }
      };

      request.onsuccess = (event) => {
        this.#db = event.target.result;
        console.log('IndexedDB: Database initialized successfully.');
        resolve();
      };

      request.onerror = (event) => {
        const errorMessage = "IndexedDB: Error opening database.";
        console.error(errorMessage, event.target.error); 
        ErrorLogger.logToUI(errorMessage, event.target.error);
        reject(event.target.error);
      };

      request.onblocked = (event) => { 
        const warnMessage = "IndexedDB: Open request blocked. Close other connections to this database.";
        console.warn(warnMessage, event);
        ErrorLogger.logToUI(warnMessage, event);
        // Not rejecting here as onblocked is a state, not necessarily a final error.
      };
    });
  }
  
  static async create(apiKey, modelName) { 
    let model;
    try {
        model = new ChatModel(apiKey, modelName); 
    } catch (error) {
        const errorMessage = "Error instantiating ChatModel.";
        console.error(errorMessage, error);
        ErrorLogger.logToUI(errorMessage, error);
        throw error; 
    }
    try {
        await model.#initDB(); 
    } catch (error) {
        const errorMessage = "Error during ChatModel #initDB().";
        console.error(errorMessage, error);
        ErrorLogger.logToUI(errorMessage, error); // #initDB itself also logs, but this adds context.
        throw error; 
    }
    return model;
  }

  async saveModelData(type, data, name = null) {
    if (!this.#db) {
      console.error('IndexedDB: Database not initialized. Cannot save model data.');
      return false;
    }
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction('modelParamsResults', 'readwrite');
        const store = transaction.objectStore('modelParamsResults');
        const record = { type, name, data, timestamp: new Date() };
        const request = store.add(record);

        request.onsuccess = () => {
          console.log('IndexedDB: Model data saved successfully.', record);
          resolve(true);
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error saving model data', event.target.error);
          reject(false); // reject with false or an error object
        };
      } catch (error) {
        console.error('IndexedDB: Exception during saveModelData transaction', error);
        reject(false); // reject with false or an error object
      }
    });
  }

  async loadModelData(type, name = null) {
    if (!this.#db) {
      console.error('IndexedDB: Database not initialized. Cannot load model data.');
      return [];
    }
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction('modelParamsResults', 'readonly');
        const store = transaction.objectStore('modelParamsResults');
        let request;

        if (name !== null) {
          // If name is provided, use the 'name' index and filter by type client-side
          // Or, if we expect name to be unique per type, this is fine.
          // For more complex queries (type AND name), a compound index or client-side filter is needed.
          // Let's assume for now we get by name and then filter type from results if needed,
          // or that names are unique enough. The spec says "get specific items. Then filters by type."
          // A more efficient way for "type AND name" would be to get all by type, then filter by name.
          // Or get all by name, then filter by type.
          const nameIndex = store.index('name');
          request = nameIndex.getAll(IDBKeyRange.only(name));
        } else {
          const typeIndex = store.index('type');
          request = typeIndex.getAll(IDBKeyRange.only(type));
        }

        request.onsuccess = (event) => {
          let results = event.target.result || [];
          // If name was used for initial query, now filter by type.
          // If type was used for initial query, and name was also provided (though current logic doesn't do this), filter by name.
          // The current task implies either "type AND name" or just "type".
          if (name !== null && type) { // Filter by type if name was the primary query
            results = results.filter(item => item.type === type);
          }
          console.log('IndexedDB: Model data loaded.', results);
          resolve(results);
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error loading model data', event.target.error);
          reject(event.target.error);
        };
      } catch (error) {
        console.error('IndexedDB: Exception during loadModelData transaction', error);
        reject(error);
      }
    });
  }


  #analyzeUserInput(userInput) { // Private method
    const originalQuery = userInput;
    userInput = userInput.toLowerCase(); 
    const generalTickerMention = /\b([A-Z]{1,5})\b/i; // Used by multiple intents

    // Save model data intent
    const saveKeywords = /\b(save|store|remember)\b/i;
    // Regex tries to capture "bsm result", "plot settings", "cosh params", "damped oscillation params", or just "params"
    const saveDataPattern = /(?:save|store|remember)\s+(bsm result|bsm params|plot settings|cosh params|damped oscillation params|params|current plot|last result)\s+as\s+([A-Za-z0-9_\-\s]+)/i;
    if (saveKeywords.test(userInput)) {
        const match = originalQuery.match(saveDataPattern); // Use originalQuery for case-sensitive name
        if (match) {
            let saveTypeInput = match[1].toLowerCase().replace(/\s+/g, ''); // e.g., "bsmresult", "plotsettings"
            let saveType = saveTypeInput; // Default to what was captured
            
            // Normalize saveType based on keywords
            if (saveTypeInput.includes("bsm") && saveTypeInput.includes("result")) saveType = "bsmResult";
            else if (saveTypeInput.includes("bsm") && saveTypeInput.includes("param")) saveType = "bsmParameters";
            else if (saveTypeInput.includes("plot") || saveTypeInput.includes("setting")) saveType = "plotSettings";
            else if (saveTypeInput.includes("cosh") && saveTypeInput.includes("param")) saveType = "coshParameters";
            else if (saveTypeInput.includes("damped") && saveTypeInput.includes("param")) saveType = "dampedOscillationParameters";
            else if (saveTypeInput === "params" || saveTypeInput === "parameters") saveType = "genericParameters"; // AI will need to clarify context
            else if (saveTypeInput === "lastresult") saveType = "lastResult"; // AI will need to clarify context

            const saveName = match[2].trim();
            return { intent: 'save_model_data', saveType, saveName, originalQuery };
        }
    }

    // Load model data intent
    const loadKeywords = /\b(load|get|retrieve|recall|fetch saved)\b/i;
    // Regex tries to capture name and optional type.
    const loadDataPattern = /(?:load|get|retrieve|recall|fetch saved)\s+([A-Za-z0-9_\-\s]+)(?:\s+as\s+|\s+for\s+|\s+being\s+|\s+of type\s+)?(bsm result|bsm params|plot settings|cosh params|damped oscillation params|params)?/i;
    if (loadKeywords.test(userInput)) {
        const match = originalQuery.match(loadDataPattern); // Use originalQuery for case-sensitive name
        if (match) {
            const loadName = match[1].trim();
            let loadType = null;
            if (match[2]) { // If a type was specified
                loadType = match[2].toLowerCase().replace(/\s+/g, '');
                if (loadType === "bsmparams") loadType = "bsmParameters";
                else if (loadType === "coshparams") loadType = "coshParameters";
                else if (loadType === "dampedoscillationparams") loadType = "dampedOscillationParameters";
                else if (loadType === "plotsettings") loadType = "plotSettings";
                else if (loadType === "bsmresult") loadType = "bsmResult";
                else if (loadType === "params") loadType = "genericParameters";
            }
            return { intent: 'load_model_data', loadName, loadType, originalQuery };
        }
    }

    // Plotting intent
    const plotKeywords = /\b(plot|graph|chart)\b/i;
    const mathFunctionKeywordsForPlot = /\b(cosh|hyperbolic cosine|damped oscillation|damping)\b/i;

    if (plotKeywords.test(userInput) && mathFunctionKeywordsForPlot.test(userInput)) {
        let functionName = "";
        if (userInput.includes("cosh") || userInput.includes("hyperbolic cosine")) {
            functionName = "calculateCosh"; 
        } else if (userInput.includes("damping") || userInput.includes("damped oscillation")) {
            functionName = "calculateDampedOscillation"; 
        }

        let plotRangeString = "not specified";
        const rangeMatch = userInput.match(/(?:from|between|range)\s*(-?\d+\.?\d*)\s*(?:to|and)\s*(-?\d+\.?\d*)/i);
        if (rangeMatch) {
            plotRangeString = `start: ${rangeMatch[1]}, end: ${rangeMatch[2]}`;
        }
        
        let functionParamsString = "not specified";
        const paramsMatch = userInput.match(/with params? (.*)/i) || userInput.match(/parameters? (.*)/i);
        if (paramsMatch && paramsMatch[1]) {
            functionParamsString = paramsMatch[1].replace(/\?$/, '').trim();
        }
        
        return { intent: 'plot_math_function', functionName, plotRangeString, functionParamsString, originalQuery};
    }

    // General Math function discussion intent
    const mathFunctionKeywords = /\b(cosh|hyperbolic cosine|damping|damped oscillation|mathematical function)\b/i;
    if (mathFunctionKeywords.test(userInput)) {
        let functionName = "";
        if (userInput.includes("cosh") || userInput.includes("hyperbolic cosine")) {
            functionName = "calculateCosh";
        } else if (userInput.includes("damping") || userInput.includes("damped oscillation")) {
            functionName = "calculateDampedOscillation";
        } else {
            functionName = "unspecified function";
        }
        
        const paramsMatch = userInput.match(/with params (.+)/i) || userInput.match(/parameters (.+)/i);
        const paramsString = paramsMatch && paramsMatch[1] ? paramsMatch[1].replace(/\?$/, '').trim() : "not specified";

        return { intent: 'math_function_discussion', functionName, paramsString, originalQuery };
    }

    const bsmKeywords = /\b(bsm|black scholes|calculate bsm|bsm price)\b/i;
    if (bsmKeywords.test(userInput)) {
        const params = {};
        const sMatch = userInput.match(/stock price of (\d+\.?\d*)/i) || userInput.match(/s[=:]\s*(\d+\.?\d*)/i);
        if (sMatch) params.S = parseFloat(sMatch[1]);
        const kMatch = userInput.match(/strike price of (\d+\.?\d*)/i) || userInput.match(/k[=:]\s*(\d+\.?\d*)/i);
        if (kMatch) params.K = parseFloat(kMatch[1]);
        const tMatch = userInput.match(/time to expir(?:y|ation) of (\d+\.?\d*)/i) || userInput.match(/t[=:]\s*(\d+\.?\d*)/i);
        if (tMatch) params.T = parseFloat(tMatch[1]);
        const vMatch = userInput.match(/volatility of (\d+\.?\d*)/i) || userInput.match(/v[=:]\s*(\d+\.?\d*)/i);
        if (vMatch) params.v = parseFloat(vMatch[1]);
        const rMatch = userInput.match(/risk free rate of (\d+\.?\d*)/i) || userInput.match(/r[=:]\s*(\d+\.?\d*)/i);
        if (rMatch) params.r = parseFloat(rMatch[1]);
        const typeMatch = userInput.match(/option type (call|put)/i) || userInput.match(/\b(call|put)\b/i);
        if (typeMatch) params.optionType = typeMatch[1].toLowerCase();
        
        if (Object.keys(params).length > 2 || bsmKeywords.test(userInput)) { 
             return { intent: 'bsm_calculation', params, originalQuery };
        }
    }

    const optionsKeywords = /\b(options?|strateg(y|ies)|call|put)\b/i;

    if (optionsKeywords.test(userInput)) {
      const tickerMatch = userInput.match(generalTickerMention);
      if (tickerMatch) {
        const ticker = tickerMatch[0].toUpperCase();
        return { intent: 'options_strategy', ticker, originalQuery };
      }
    }

    const marketAnalysisKeywords = /\b(market movers?|top gainers?|market sentiment|market overview|sector perform)\b/i;
    if (marketAnalysisKeywords.test(userInput)) {
      return { intent: 'market_analysis', originalQuery };
    }

    // Simulated search intent (placed before general stock quotes if query is broader)
    // Keywords that strongly imply a search/information gathering need
    const searchKeywords = /\b(news|latest news|developments?|analyst ratings?|summarize|information on|what is|who is|tell me about|explain)\b/i;
    // Try to capture the main topic/entity of the search after the keywords
    const searchTopicPattern = /(?:news about|latest news on|developments for|analyst ratings for|summarize|information on|what is|who is|tell me about|explain)\s+(.+)/i;

    if (searchKeywords.test(userInput)) {
      let topic = originalQuery; // Default to the whole query
      const topicMatch = originalQuery.match(searchTopicPattern);
      if (topicMatch && topicMatch[1]) {
        topic = topicMatch[1].replace(/\?$/, '').trim(); // Clean up the extracted topic
      } else {
        // If specific keywords aren't followed by a clear topic, the keywords themselves might be part of the topic
        // e.g., "market sentiment" - here "market sentiment" is the topic.
        // We can try a broader capture if the specific pattern fails.
        const generalSearchMatch = userInput.match(searchKeywords);
        if(generalSearchMatch && generalSearchMatch.input){
            // Attempt to get a more refined topic if possible, otherwise, the original query is fine.
            // This part could be further improved with more sophisticated NLP if available.
            // For now, if a ticker is mentioned, that's a strong candidate for the topic.
            const tickerInSearch = originalQuery.match(generalTickerMention);
            if (tickerInSearch) {
                topic = tickerInSearch[0].toUpperCase();
            }
            // If not, the original query as topic is a safe fallback.
        }
      }
      return { intent: 'simulated_search', topic, originalQuery };
    }
    
    const stockQuotePatterns = [
      { regex: /stock price of ([A-Z]{1,5})/i, tickerIndex: 1, exchange: "NASDAQ" },
      { regex: /([A-Z]{1,5}) stock/i, tickerIndex: 1, exchange: "NASDAQ" },
      { regex: /price of ([A-Z]{1,5})/i, tickerIndex: 1, exchange: "NASDAQ" },
      { regex: /([A-Z]{1,5}):([A-Z]+)/i, tickerIndex: 1, exchangeIndex: 2 }, 
      { regex: /^([A-Z]{1,5})$/i, tickerIndex: 1, exchange: "NASDAQ" } 
    ];

    for (const pattern of stockQuotePatterns) {
      const match = userInput.match(pattern.regex);
      if (match) {
        const ticker = match[pattern.tickerIndex].toUpperCase();
        const exchange = pattern.exchangeIndex ? match[pattern.exchangeIndex].toUpperCase() : pattern.exchange;
        return { intent: 'stock_quote', ticker, exchange, originalQuery };
      }
    }
    return { intent: 'general_chat', originalQuery };
  }

  async saveMessage(role, content) {
    if (!this.#db) {
      console.error('IndexedDB: Database not initialized. Cannot save message.');
      return Promise.reject('Database not initialized.');
    }
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction(this.HISTORY_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(this.HISTORY_STORE_NAME);
        const message = { role, content, timestamp: new Date() };
        const request = store.add(message);
        request.onsuccess = () => {
          console.log('IndexedDB: Message saved successfully.', message);
          resolve();
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error saving message', event.target.error);
          reject(event.target.error);
        };
      } catch (error) {
        console.error('IndexedDB: Exception during saveMessage transaction', error);
        reject(error);
      }
    });
  }

  async loadHistory() {
    if (!this.#db) {
      console.error('IndexedDB: Database not initialized. Cannot load history.');
      return Promise.resolve([]); 
    }
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.#db.transaction(this.HISTORY_STORE_NAME, 'readonly');
        const store = transaction.objectStore(this.HISTORY_STORE_NAME);
        const request = store.getAll();
        request.onsuccess = (event) => {
          console.log('IndexedDB: History loaded successfully.');
          resolve(event.target.result || []);
        };
        request.onerror = (event) => {
          console.error('IndexedDB: Error loading history', event.target.error);
          reject(event.target.error);
        };
      } catch (error) {
        console.error('IndexedDB: Exception during loadHistory transaction', error);
        reject(error);
      }
    });
  }

  async fetchAIResponse(userInput) {
    if (this.#cache[userInput]) { 
      console.log("Cache hit for in-memory cache!");
      return this.#cache[userInput];
    }
    console.log("Cache miss for in-memory cache!");
    
    const analysis = this.#analyzeUserInput(userInput); // Call private method
    let messageToSend = "";

    switch (analysis.intent) {
      case 'save_model_data':
        let contextForSave = "No specific data in immediate context.";
        let dataToSave = null;
        let dataTypeToSave = analysis.saveType; // Use normalized type from analysis

        if (dataTypeToSave === "bsmResult" && this.#lastBSMResult) {
            contextForSave = `Last BSM calculation result: ${JSON.stringify(this.#lastBSMResult)}`;
            dataToSave = this.#lastBSMResult;
        } else if (dataTypeToSave === "plotSettings" && this.#lastPlotConfig) {
            contextForSave = `Last plot settings: ${JSON.stringify(this.#lastPlotConfig)}`;
            dataToSave = this.#lastPlotConfig;
        } else if (dataTypeToSave === "bsmParameters" && this.#lastBSMResult) {
            const {S, K, T, v, r, optionType} = this.#lastBSMResult; // Destructure to get only params
            dataToSave = {S, K, T, v, r, optionType};
            contextForSave = `Parameters from last BSM calculation: ${JSON.stringify(dataToSave)}`;
        } else if (dataTypeToSave === "coshParameters" && this.#lastPlotConfig && this.#lastPlotConfig.functionName === 'calculateCosh') {
            dataToSave = this.#lastPlotConfig.functionParams; // Assuming functionParams is the relevant part
            contextForSave = `Parameters from last Cosh plot: ${JSON.stringify(dataToSave)}`;
        } else if (dataTypeToSave === "dampedOscillationParameters" && this.#lastPlotConfig && this.#lastPlotConfig.functionName === 'calculateDampedOscillation') {
            dataToSave = this.#lastPlotConfig.functionParams; // Assuming functionParams is the relevant part
            contextForSave = `Parameters from last Damped Oscillation plot: ${JSON.stringify(dataToSave)}`;
        } else if (dataTypeToSave === "genericParameters" || dataTypeToSave === "lastResult") {
             // Requires AI to be more specific or use broader context. For now, check BSM then Plot.
            if (this.#lastBSMResult) {
                dataToSave = this.#lastBSMResult;
                dataTypeToSave = "bsmResult"; // Be specific about what's being saved
                contextForSave = `Last BSM calculation result: ${JSON.stringify(this.#lastBSMResult)}`;
            } else if (this.#lastPlotConfig) {
                dataToSave = this.#lastPlotConfig;
                dataTypeToSave = "plotSettings"; // Be specific
                contextForSave = `Last plot settings: ${JSON.stringify(this.#lastPlotConfig)}`;
            }
        }

        if (dataToSave) {
            messageToSend = `User wants to save data as type '${dataTypeToSave}' with name '${analysis.saveName}'.
Context: ${contextForSave}.
Please confirm by generating a SAVE_DATA_TRIGGER::${JSON.stringify({type: dataTypeToSave, name: analysis.saveName, data: dataToSave})}::SAVE_DATA_TRIGGER.
Also provide a confirmation message to the user (e.g., "Okay, I've saved [data description] as '${analysis.saveName}'.")`;
        } else {
            messageToSend = `User wants to save data as type '${analysis.saveType}' with name '${analysis.saveName}', but I don't have any specific data of that type in my immediate context, or the type was too generic (e.g., 'params', 'last result') and no recent specific context was found. Please specify the data more clearly. For example, 'save last bsm result as [name]' or 'save current plot settings as [name]'. Original query: '${analysis.originalQuery}'`;
        }
        break;

      case 'load_model_data':
        const loadedItems = await this.loadModelData(analysis.loadType, analysis.loadName); 
        if (loadedItems && loadedItems.length > 0) {
            loadedItems.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)); // Most recent first
            const itemToDiscuss = loadedItems[0];
            this.#loadedModelData = itemToDiscuss.data; // Store for context

            let dataSummary = JSON.stringify(itemToDiscuss.data);
            if (dataSummary.length > 200) dataSummary = dataSummary.substring(0, 197) + "..."; // Truncate for prompt

            messageToSend = `Successfully loaded '${itemToDiscuss.name}' (type: ${itemToDiscuss.type}, saved: ${itemToDiscuss.timestamp}).
Data: ${dataSummary}.
What would you like to do with this loaded data (e.g., explain it, use it for a new calculation, plot it if applicable)?
Original user query: '${analysis.originalQuery}'`;
        } else {
            messageToSend = `Sorry, I couldn't find any saved data named '${analysis.loadName}'` + 
                            (analysis.loadType ? ` of type '${analysis.loadType}'.` : '.') +
                            ` Please ensure the name and type are correct. Original user query: '${analysis.originalQuery}'`;
        }
        break;

      case 'plot_math_function':
        this.#lastPlotConfig = { // Store plot config for potential save
            functionName: analysis.functionName, 
            functionParams: analysis.functionParamsString, 
            plotRange: analysis.plotRangeString 
        };
        messageToSend = `The user wants to plot the function '${analysis.functionName}'.
User's raw parameter string for the function: '${analysis.functionParamsString || 'not specified'}'.
User's raw range string: '${analysis.plotRangeString || 'not specified'}'.
Available JS functions: calculateCosh(x, params={scale?, xShift?}), calculateDampedOscillation(t, params={amplitude?, dampingFactor?, frequency?, phase?}).

Your task is to:
1. Identify the core parameters for the specified JS function (e.g., for cosh: scale, xShift; for dampedOscillation: amplitude, dampingFactor, frequency, phase).
2. If the user provided parameters, try to map them to the JS function's parameters. If parameters are ambiguous or missing, use sensible defaults (e.g., scale: 1, amplitude: 1, dampingFactor: 0.1, frequency: 1, phase: 0).
3. Determine a reasonable plotting range (e.g., x from -5 to 5 for cosh, or t from 0 to 20 for dampedOscillation) and number of points (e.g., 100-200) IF THE USER DID NOT SPECIFY THEM or if their specification is unclear. Use typical values for the function.
4. Output a structured JSON string for the client to plot, wrapped like this: PLOT_TRIGGER::{"functionName": "${analysis.functionName}", "functionParams": {"param1": val1, ...}, "plotRange": {"start": val_start, "end": val_end, "points": num_points}}::PLOT_TRIGGER
Example for cosh: PLOT_TRIGGER::{"functionName": "calculateCosh", "functionParams": {"scale": 1, "xShift": 0}, "plotRange": {"start": -3, "end": 3, "points": 100}}::PLOT_TRIGGER
Example for damped oscillation: PLOT_TRIGGER::{"functionName": "calculateDampedOscillation", "functionParams": {"amplitude": 1, "dampingFactor": 0.1, "frequency": 1, "phase": 0}, "plotRange": {"start": 0, "end": 20, "points": 200}}::PLOT_TRIGGER
Only include parameters relevant to the specific JS function. Ensure the JSON is valid.
Also, provide a short textual confirmation or suggestion to the user (e.g., 'Okay, I'll plot ${analysis.functionName} with parameters [your chosen/parsed params] over range [your chosen/parsed range].'). This text will be displayed in the chat. After the plot is generated, you can tell the user: "You can save these plot settings by typing 'save plot settings as [your_name]'."`;
        break;
      case 'math_function_discussion':
        messageToSend = `The user is asking about the mathematical function: '${analysis.functionName}'. Their query was: '${analysis.originalQuery}'.
This system has access to JavaScript implementations:
- calculateCosh(x, {scale?, xShift?})
- calculateDampedOscillation(t, {amplitude?, dampingFactor?, frequency?, phase?})
Please explain the function '${analysis.functionName}', its typical parameters, and how it behaves. If the user provided specific parameters in their query ('${analysis.paramsString}'), discuss how those parameters would affect the function's output. Do not execute the JavaScript functions yourself or generate numerical plots directly. Describe the function conceptually. If the user asks to plot, you can suggest a range and typical parameters if they haven't provided them, and inform them to explicitly ask to 'plot' if they wish to see a graph.`;
        break;
      case 'bsm_calculation':
        const { S, K, T, v, r, optionType } = analysis.params;
        if (S !== undefined && K !== undefined && T !== undefined && v !== undefined && r !== undefined && optionType !== undefined) {
          try {
            const bsmPrice = BSMCalculator.calculate(S, K, T, v, r, optionType);
            this.#lastBSMResult = { S, K, T, v, r, optionType, price: bsmPrice, name: "Last BSM Calculation" }; // Store result
            messageToSend = `The Black-Scholes option price for a ${optionType} option with Stock Price=${S}, Strike=${K}, Time to Expiry=${T} years, Volatility=${v}, Risk-Free Rate=${r} was calculated by the system as ${bsmPrice.toFixed(4)}. Please explain this result, its underlying assumptions (like European option, no dividends, constant volatility/interest rate), and how it might be interpreted by a trader. You can save this result by typing 'save bsm result as [your_name]'. Original user query: '${analysis.originalQuery}'`;
          } catch (error) {
            console.error("BSM Calculation Error:", error);
            messageToSend = `There was an error during the BSM calculation: ${error.message}. Please ensure all parameters are correct. Original user query: '${analysis.originalQuery}'`;
          }
        } else {
          messageToSend = `The user wants to calculate an option price using the Black-Scholes model, but some parameters are missing or unclear from their query. Please ask the user to provide all necessary parameters: current stock price (S), strike price (K), time to expiration in years (T), annualized volatility (v, e.g., 0.2 for 20%), annualized risk-free interest rate (r, e.g., 0.05 for 5%), and option type (call/put). Original user query: '${analysis.originalQuery}'`;
        }
        break;
      case 'simulated_search':
        messageToSend = `The user is asking the following question about '${analysis.topic}': '${analysis.originalQuery}'. While I cannot perform live web searches, I will synthesize a response based on the kind of information typically found in search results for such a query, drawing upon my general knowledge up to my last training update. My response will be a summary of what might be found. Remember to state that this information is based on your training data and not real-time search results.`;
        break;
      case 'stock_quote':
        messageToSend = `User is asking for a stock quote for ${analysis.ticker}. Please provide the current stock price and related information for ${analysis.ticker} (exchange: ${analysis.exchange}) using data typically found on Google Finance (e.g., google.com/finance/quote/${analysis.ticker}:${analysis.exchange}). Do not attempt to fetch live data or access external websites. Use your existing knowledge. When discussing the stock, you can mention how technical indicators like Simple Moving Averages (SMA) or Relative Strength Index (RSI) might be used for its analysis. The system understands conceptually how these are calculated from price data. You do not need to perform the calculations yourself, but explain their relevance or what data would be needed. When discussing potential trading or investment considerations for ${analysis.ticker}, you might also briefly explain relevant risk management tools like trailing stops for exits, or OCO (One-Cancels-the-Other) orders for setting up conditional trades. If discussing portfolio aspects, the concept of covariance with other assets could be mentioned. Original question: '${analysis.originalQuery}'`;
        break;
      case 'options_strategy':
        messageToSend = `User is asking for options strategy recommendations for ${analysis.ticker}. Based on your understanding of financial markets and options (concepts like strike prices, bid/ask, volume, open interest, implied volatility, for various expiration dates, similar to data on WSJ market data options pages), what are some potential call, put, or multi-leg options strategies that could be considered for ${analysis.ticker}? Briefly discuss the general risk/reward profile or typical market view for each suggested strategy. When discussing these strategies, consider Black-Scholes Model (BSM) principles like the impact of implied volatility, time decay (theta), and interest rates on option pricing, where relevant. You do not need to perform BSM calculations. Also, consider how common technical indicators (e.g., Moving Averages, RSI, MACD) might conceptually be applied to the underlying asset's price chart to inform strategy selection. The system also has a conceptual understanding of how indicators like Simple Moving Averages (SMA) and Relative Strength Index (RSI) are calculated from price data. You can refer to how such indicators might be applied or interpreted when discussing strategies. Furthermore, if relevant to the strategy, you can discuss risk management techniques such as trailing stops or the use of OCO (One-Cancels-the-Other) orders. In a broader portfolio context, you might also touch upon the concept of covariance between underlying assets and options positions. This is for informational purposes only and not financial advice. Do not attempt to give specific buy/sell recommendations or exact prices. Do not attempt to fetch live data or access external websites. Use your existing knowledge. Original question: '${analysis.originalQuery}'`;
        break;
      case 'market_analysis':
        messageToSend = `User is asking for a market analysis (e.g., movers, sentiment). Based on your understanding of how financial markets behave and how data like top gainers, losers, most active stocks, sector performance, and overall market sentiment (similar to what's presented on TradingView market overview pages) is interpreted, provide a general overview. Do not attempt to fetch live data or access external websites. Focus on explaining common patterns or interpretations using your existing knowledge. When discussing market trends, you can mention how technical indicators like Simple Moving Averages (SMA) or Relative Strength Index (RSI) might be used. The system understands conceptually how these are calculated from price data. You do not need to perform the calculations yourself, but explain their relevance or what data would be needed. When discussing potential trading or investment considerations for the market in general, you might also briefly explain relevant risk management tools like trailing stops for exits, or OCO orders for setting up conditional trades. If discussing portfolio aspects, the concept of covariance between different assets or sectors could be mentioned. Original question: '${analysis.originalQuery}'`;
        break;
      case 'general_chat':
      default:
        messageToSend = analysis.originalQuery;
        break;
    }

    const result = await this.#chat.sendMessage(messageToSend); // Use private #chat
    const response = result.response;
    const responseText = await response.text();
    
    try {
      await this.saveMessage('model', responseText); // saveMessage is public, so this.saveMessage
    } catch (error) {
      console.error("Failed to save model's response to IndexedDB", error);
    }
    
    this.#cache[userInput] = responseText; 
    return responseText;
  }
}

class ChatController {
  #apiKey; // Private property
  #config; // Private property
  #model; // Private property
  #view; // Private property

  constructor(apiKey, config, model, view) { 
    this.#apiKey = apiKey; 
    this.#config = config; 
    this.#model = model;
    this.#view = view;
    this.#initializeEventListeners(); // Call private method
    this.#loadAndDisplayHistory(); // Call private method
  }
  
  static async create(apiKey) {
    let config = { 
        apiConfig: { modelName: "gemini-1.5-flash-latest" },
        ui: { defaultGreeting: "Welcome! Ask me anything." }
    };
    try {
        const response = await fetch('./index.json'); 
        if (response.ok) {
            try {
                config = await response.json();
                console.log("Successfully loaded configuration from index.json", config);
            } catch (error) {
                const errorMessage = "Error parsing index.json.";
                console.error(errorMessage, error);
                ErrorLogger.logToUI(errorMessage, error);
            }
        } else {
            const errorMessage = `Failed to load index.json, using default config. Status: ${response.status}`;
            console.error(errorMessage);
            ErrorLogger.logToUI(errorMessage);
        }
    } catch (error) {
        const errorMessage = "Error fetching index.json.";
        console.error(errorMessage, error);
        ErrorLogger.logToUI(errorMessage, error);
    }

    let model, view, controller;
    try {
        model = await ChatModel.create(apiKey, config.apiConfig.modelName); 
    } catch (error) {
        const errorMessage = "Error creating ChatModel in ChatController.create.";
        console.error(errorMessage, error);
        ErrorLogger.logToUI(errorMessage, error);
        throw error; 
    }
    try {
        view = new UIController('chat-container', 'user-question', 'ask-button');
        ErrorLogger.init(); // Initialize ErrorLogger after UIController (and its DOM elements) are ready
    } catch (error) {
        const errorMessage = "Error creating UIController in ChatController.create.";
        console.error(errorMessage, error);
        ErrorLogger.logToUI(errorMessage, error); // ErrorLogger might not be fully initted if this fails
        throw error; 
    }
    try {
        controller = new ChatController(apiKey, config, model, view);
    } catch (error) {
        const errorMessage = "Error creating ChatController instance in ChatController.create.";
        console.error(errorMessage, error);
        ErrorLogger.logToUI(errorMessage, error);
        throw error; 
    }
    return controller; 
  }

  async #loadAndDisplayHistory() { // Private method
    let historyLoaded = false;
    try {
      const history = await this.#model.loadHistory(); // Use private #model
      if (history && history.length > 0) {
        history.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)); 
        for (const message of history) {
          await this.#view.displayMessage(message.content, message.role); // Use private #view
        }
        historyLoaded = true;
        console.log("Chat history loaded and displayed.");
      } else {
        console.log("No chat history found in IndexedDB.");
      }
    } catch (error) {
      console.error("Error loading and displaying chat history:", error);
    }

    if (!historyLoaded && this.#config && this.#config.ui && this.#config.ui.defaultGreeting) { // Use private #config
      try {
        await this.#view.displayMessage(this.#config.ui.defaultGreeting, 'model'); // Use private #view and #config
        console.log("Displayed default greeting.");
      } catch (error) {
        console.error("Error displaying default greeting:", error);
      }
    }
  }

  async #handleUserQuery() { // Private method
    const userInput = this.#view.getUserInput(); 
    if (!userInput) {
      return;
    }

    try {
      await this.#model.saveMessage('user', userInput); 
    } catch (error) {
      console.error("Failed to save user's message to IndexedDB", error);
    }

    await this.#view.displayMessage(userInput, 'user'); 
    this.#view.clearUserInput(); 

    const thinkingElement = await this.#view.showThinkingMessage(); 

    try {
      const aiResponseText = await this.#model.fetchAIResponse(userInput); 
      
      const plotTriggerRegex = /PLOT_TRIGGER::(.*?)::PLOT_TRIGGER/s;
      const saveTriggerRegex = /SAVE_DATA_TRIGGER::(.*?)::SAVE_DATA_TRIGGER/s;

      let textForDisplay = aiResponseText;
      let plotDataForDisplay = null; 

      const plotMatch = textForDisplay.match(plotTriggerRegex);
      if (plotMatch) {
        plotDataForDisplay = plotMatch[1]; 
        textForDisplay = textForDisplay.replace(plotTriggerRegex, '').trim(); 
      }

      const saveMatch = textForDisplay.match(saveTriggerRegex);
      if (saveMatch) {
        const saveJsonString = saveMatch[1];
        try {
            const saveDataConfig = JSON.parse(saveJsonString);
            const saved = await this.#model.saveModelData(saveDataConfig.type, saveDataConfig.data, saveDataConfig.name);
            if (saved) {
                console.log("Data saved successfully via AI trigger:", saveDataConfig);
            } else {
                // If save failed, the AI's confirmation might be misleading. 
                // We might want to prepend an error message or rely on the AI's textual response.
                // For now, we'll let the AI's text (which should ideally not confirm if save failed on its end) be the primary message.
                 await this.#view.displayMessage("Note: There was an issue saving the data to the database, but the AI might have generated a confirmation.", "error");
            }
        } catch (e) {
            console.error("Error parsing save JSON from AI or saving data:", e);
            await this.#view.displayMessage("Error processing save data command from AI.", "error");
        }
        textForDisplay = textForDisplay.replace(saveTriggerRegex, '').trim(); 
      }
      
      if (textForDisplay) {
          await this.#view.displayMessage(textForDisplay, 'model', thinkingElement);
      } else if (!plotDataForDisplay && !saveMatch && thinkingElement) { 
          this.#view.displayMessage("Okay.", 'model', thinkingElement);
      } else if (thinkingElement && (plotDataForDisplay || saveMatch) && !textForDisplay) {
          thinkingElement.remove();
      }


      if (plotDataForDisplay) { 
        try {
          const plotConfig = JSON.parse(plotDataForDisplay);
          this.#model.setLastPlotConfig(plotConfig); // Store for potential save
          
          const xValues = [];
          const step = (plotConfig.plotRange.end - plotConfig.plotRange.start) / (plotConfig.plotRange.points - 1);
          for (let i = 0; i < plotConfig.plotRange.points; i++) {
            xValues.push(plotConfig.plotRange.start + i * step);
          }

          let yValues = [];
          const funcToCall = callableMathFunctions[plotConfig.functionName];

          if (funcToCall) {
            yValues = xValues.map(x => funcToCall(x, plotConfig.functionParams || {}));
            const plotData = [{ x: xValues, y: yValues, type: 'scatter', mode: 'lines' }];
            const layout = { 
              title: `Plot of ${plotConfig.functionName.replace("calculate", "")}`, 
              xaxis: { title: (plotConfig.functionName === "calculateDampedOscillation" ? 't (time)' : 'x') }, 
              yaxis: { title: 'y' } 
            };
            await this.#view.renderPlot(plotData, layout);
          } else {
            console.error("Plotting error: Unknown function name provided by AI:", plotConfig.functionName);
            await this.#view.displayMessage(`Error: AI suggested plotting an unknown function: ${plotConfig.functionName}.`, "error");
          }
        } catch (e) {
          console.error("Error parsing plot JSON from AI or generating plot data:", e);
          await this.#view.displayMessage("Error processing plot data from AI. See console for details.", "error");
        }
      }

    } catch (error) {
      console.error("Error in #handleUserQuery:", error); 
      if(thinkingElement && thinkingElement.parentNode) thinkingElement.remove();
      const errorMessage = error && error.message ? error.message : "An unknown error occurred.";
      await this.#view.displayMessage('Error: ' + errorMessage, 'error'); 
    }
  }

  #initializeEventListeners() { // Private method
    if (this.#view.askButton) { 
      this.#view.addAskButtonListener(this.#handleUserQuery.bind(this)); // Use private #view and #handleUserQuery
    } else {
      console.error("ChatController: Ask button not found in UIController, cannot initialize listener.");
    }
  }
}

// --- Main Script Logic ---

// IMPORTANT: Replace "YOUR_API_KEY" with your actual Gemini API key.
const API_KEY = "YOUR_API_KEY";

// Helper for mapping function name to function in ChatController
const callableMathFunctions = {
    calculateCosh: window.calculateCosh, 
    calculateDampedOscillation: window.calculateDampedOscillation
};

// Initialize the application by creating the controller
// Using an immediately-invoked async function to handle async initialization
(async () => {
  try {
    await ChatController.create(API_KEY);
    console.log("Chat application initialized successfully.");
    ErrorLogger.logToUI("Chat application initialized successfully."); // Also log success to UI log
  } catch (error) {
    const criticalMessage = "CRITICAL: Failed to initialize chat application.";
    // ErrorLogger.logToUI would have been called by deeper functions, but this is the top-level catch.
    // We ensure it's logged to UI here as well, in case earlier attempts failed due to uninitialized logger.
    if (typeof ErrorLogger !== 'undefined' && ErrorLogger.logToUI) {
        ErrorLogger.logToUI(criticalMessage, error);
    } else {
        console.error(criticalMessage, error); // Fallback if logger itself failed
    }
    
    const chatContainer = document.getElementById('chat-container');
    const errorLogContainer = document.getElementById('error-log-container'); // Check if error log itself is there

    if (chatContainer) {
        chatContainer.innerHTML = '<div class="error-message w3-panel w3-red"><strong>Initialization Failed!</strong> Please expand the "Toggle Error Log" section (if available) or check the browser console for details, then refresh the page.</div>';
    } else { // Very basic fallback if even chat container is missing
        document.body.innerHTML = '<div style="color: red; padding: 20px; font-family: sans-serif;"><strong>CRITICAL ERROR: Application Initialization Failed!</strong><p>The chat interface could not be loaded. Please check the browser console for detailed error messages and ensure all files are correctly placed and accessible.</p> <p>Try refreshing the page. If the problem persists, contact support or check the application setup instructions.</p></div>';
        if(errorLogContainer) errorLogContainer.style.display = 'block'; // Try to show log
    }
  }
})();
