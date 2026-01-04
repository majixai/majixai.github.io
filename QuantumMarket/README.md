# Quantum Market Pro

## 1. High-Level Overview

Quantum Market Pro is a sophisticated, fully automated market analysis and quantitative modeling engine built entirely within the Google Apps Script ecosystem. It leverages Google Sheets as a database and UI, Google Drive for persistent data storage, and the Google Gemini AI for advanced predictive analysis. This system is designed to run autonomously, providing real-time market insights, generating daily predictions, and even handling massive data transfers through a unique, resilient Email Data Loop.

---

## 2. Core Features

-   **Automated Minutely Heartbeat:** The core of the system runs every minute to fetch live market data, perform quantitative analysis, and update the database in near real-time.
-   **AI-Powered Daily Oracle:** Before the market opens, a specialized AI service analyzes the previous day's data to generate specific OPEN and CLOSE price predictions for all assets in the watchlist.
-   **Quantitative Modeling:** Utilizes advanced mathematical models, including Monte Carlo simulations based on Geometric Brownian Motion, Exponentially Weighted Moving Average (EWMA) for volatility, and Beta calculation for market risk.
-   **AI-Driven Watchlist Generation:** Users can provide a theme (e.g., "Semiconductor Stocks"), and the AI will automatically generate and populate a new watchlist of relevant assets.
-   **Resilient Email Data Loop:** A unique and powerful system for broadcasting and ingesting massive data payloads that exceed standard email size limits. It works by compressing, hashing (SHA-256), and sharding the data into a multi-part email series, ensuring 100% data integrity upon reassembly.
-   **Persistent Logging & Alerting:** Features a military-grade logging system and sends automated bullish alerts via Google Calendar events.
-   **Modular, Multi-Layered Architecture:** The entire codebase is professionally organized into a clean, maintainable, and scalable directory structure, separating concerns into distinct layers (API, Services, System, UI).

---

## 3. Architectural Deep-Dive

The project is organized into a robust, multi-layered architecture to ensure a clean separation of concerns, making the codebase scalable and easy to navigate.

```
/QuantumMarket
├── appsscript.json
├── src
│   ├── api
│   │   └── Gemini_API.gs
│   ├── email
│   │   ├── Email_Broadcast.gs
│   │   └── Email_Ingest.gs
│   ├── main
│   │   └── Main.gs
│   ├── services
│   │   ├── Service_AI.gs
│   │   ├── Service_Data.gs
│   │   ├── Service_Oracle.gs
│   │   └── Service_Quant.gs
│   ├── system
│   │   ├── System_Alerts.gs
│   │   ├── System_Config.gs
│   │   └── System_Logger.gs
│   └── ui_handlers
│       └── UI_Handlers.gs
└── ui
    ├── Help.html
    ├── Settings.html
    └── index.html
```

---

## 4. Module Breakdown & Code Snippets

This section provides a detailed look at every script file in the `src` directory.

### [`/src/main/Main.gs`](./src/main/Main.gs)

-   **Role:** The central orchestrator and entry point of the application. It initializes the spreadsheet menu and contains the top-level trigger functions (`minutelyHeartbeat`, etc.) that delegate tasks to the various specialized services.
-   **Key Snippet (The Heartbeat):**
    ```javascript
    function minutelyHeartbeat() {
      const lock = LockService.getScriptLock();
      if (!lock.tryLock(10000)) return; // Fail fast if clogged

      try {
        // 1. Fetch Cycle
        const liveData = Service_Data.fetchWatchlist();
        if (!liveData || liveData.length === 0) return;

        // 2. Math Cycle
        const projectedData = Service_Quant.runMonteCarloSimulation(liveData);
        const correctedData = Service_Quant.performErrorAnalysis(projectedData);

        // ... more steps
      } catch (e) {
        System_Logger.log("minutelyHeartbeat", e.stack || e.toString(), true);
      } finally {
        lock.releaseLock();
      }
    }
    ```

### [`/src/api/Gemini_API.gs`](./src/api/Gemini_API.gs)

-   **Role:** A low-level library that handles the direct, technical interaction with the Google Gemini API. Its sole responsibility is to construct the payload, make the `UrlFetchApp` call, and handle the raw response and errors.
-   **Key Snippet (API Fetch):**
    ```javascript
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const result = JSON.parse(response.getContentText());

    if (responseCode === 200) {
      // ... success handling
    } else {
      // ... error handling
    }
    ```

### [`/src/services/Service_AI.gs`](./src/services/Service_AI.gs)

-   **Role:** A high-level service that acts as the "prompt engineering" layer. It uses the `Gemini_API.gs` library to execute calls but is responsible for building the complex, context-rich prompts needed for financial analysis, watchlist generation, and daily predictions.
-   **Key Snippet (Prompt Engineering):**
    ```javascript
    const prompt = `
      You are a succinct financial analyst AI. Given the following high-performing tickers from a quantitative model, provide a brief, plausible, and unique reason for why each might be considered bullish...

      Market Data:
      ${marketContext}

      Format the output ONLY as a valid JSON array...
    `;
    const rawResponse = Gemini_API.generateContent(prompt, 0.7);
    const suggestions = Gemini_API.parseJsonResponse(rawResponse);
    ```

### [`/src/services/Service_Data.gs`](./src/services/Service_Data.gs)

-   **Role:** The backbone of all data I/O. This service manages everything related to Google Sheets (reading, writing, creating) and Google Drive (creating snapshots, pruning old files, managing folders).
-   **Key Snippet (Sheet Initialization):**
    ```javascript
    initEnvironment: function() {
      // ...
      // Set up or validate the Spreadsheet database
      const sheetId = System_Config.getSetting('SHEET_ID');
      let ss;
      if (sheetId) {
        try {
          ss = SpreadsheetApp.openById(sheetId);
        } catch (e) {
          ss = this.createNewSheet();
          System_Config.saveSetting('SHEID', ss.getId());
        }
      } else {
      // ...
    }
    ```

### [`/src/services/Service_Quant.gs`](./src/services/Service_Quant.gs)

-   **Role:** The mathematical core of the engine. This service contains all the complex quantitative models, including the Monte Carlo simulation, the EWMA volatility calculator, and the Beta calculation.
-   **Key Snippet (Monte Carlo Simulation):**
    ```javascript
    // Geometric Brownian Motion SDE: dS = μS dt + σS dW
    // Solved form: S_t = S_0 * exp((μ - σ^2/2)t + σ√t * Z)
    const randomShock = this.getNormalRandom();
    const driftComponent = (this.DRIFT - (sigma * sigma) / 2) * this.TIME_STEP;
    const diffusionComponent = sigma * Math.sqrt(this.TIME_STEP) * randomShock;
    const projectedPrice = stock.price * Math.exp(driftComponent + diffusionComponent);
    ```

### [`/src/email/Email_Broadcast.gs`](./src/email/Email_Broadcast.gs) & [`/src/email/Email_Ingest.gs`](./src/email/Email_Ingest.gs)

-   **Role:** These two services work together to form the Email Data Loop. `Email_Broadcast` is responsible for fetching unprocessed data, compressing it, generating a SHA-256 hash, sharding it, and sending it as a series of emails. `Email_Ingest` handles the other side: finding the email series, reassembling the shards, verifying the hash, and saving the final payload.
-   **Key Snippet (SHA-256 Hash Generation):**
    ```javascript
    generateUniqueHash: function(blob) {
      const hashBytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, blob.getBytes());
      return hashBytes.map(byte => ('0' + (byte & 0xFF).toString(16)).slice(-2)).join('');
    }
    ```

---

## 5. Step-by-Step Setup Guide

1.  **Create New Project:** Go to [script.google.com](https://script.google.com) and create a new project. Give it a name like "QuantumMarketPro".
2.  **Enable Services (Critical):**
    *   In the script editor, click the **+** button next to **Services**.
    *   Add the **Gmail API**, **Drive API**, and **Calendar API**.
3.  **Create Files & Directories:**
    *   Delete the default `Code.gs` file.
    *   You must manually create the entire directory structure and all the `.gs` and `.html` files exactly as shown in the **Architectural Deep-Dive** section above. Copy the contents of each file from the repository into your Apps Script project.
4.  **Initial Configuration:**
    *   Refresh the Spreadsheet associated with the script. A new "⚡ Quantum Market Pro" menu will appear.
    *   Go to **⚡ Quantum Market Pro > ⚙️ Settings & Logs**.
    *   Enter your **Gemini API Key**.
    *   Click **Save**. This will automatically create the necessary Google Sheet database and Google Drive folders.
5.  **Set Triggers (Automation):**
    *   In the script editor, click the **Triggers** (alarm clock) icon on the left.
    *   Click **Add Trigger** and create the following four triggers:
        1.  **Function:** `minutelyHeartbeat` -> **Event source:** `Time-driven` -> **Type:** `Minutes timer` -> **Interval:** `Every minute`.
        2.  **Function:** `runDailyPredictionRoutine` -> **Event source:** `Time-driven` -> **Type:** `Day timer` -> **Time:** `8am to 9am`.
        3.  **Function:** `generateMassiveDataEmail` -> **Event source:** `Time-driven` -> **Type:** `Hour timer` -> **Interval:** `Every 6 hours`.
        4.  **Function:** `processEmailIntel` -> **Event source:** `Time-driven` -> **Type:** `Hour timer` -> **Interval:** `Every 6 hours`. (Set this to run ~15 minutes *after* the broadcast trigger).

---

## 6. System Flow Explained

The engine operates in a continuous, autonomous loop orchestrated by the `minutelyHeartbeat` trigger.

1.  **Fetch:** `Service_Data` fetches the latest prices for all tickers in the `Watchlist` sheet.
2.  **Analyze:** `Service_Quant` takes this live data, calculates advanced metrics like EWMA volatility and Beta, and then runs a Monte Carlo simulation to project a price for the next minute.
3.  **Learn:** The system compares the new price to the *previous* projection to calculate an error term, allowing it to self-correct over time.
4.  **Persist:** `Service_Data` saves a compressed snapshot of the new data to Google Drive and updates the Google Sheet with the latest information.
5.  **Alert:** `System_Alerts` checks the new data for any highly bullish signals and creates a Google Calendar event if one is found.
6.  **AI Insight:** Every 15 minutes, `Service_AI` sends the top-performing tickers to the Gemini AI to get a qualitative reason for their bullish behavior, which is then saved to the `AI_Bulls` sheet.
