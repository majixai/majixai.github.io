
# Stock Projection Analyzer (Jinx FinChat Alpha Jeremy Scott)

**Powered by Google Gemini API**

This application provides AI-powered stock analysis, price projections, options strategy insights, and market visualizations. It leverages the Gemini API for advanced financial analysis and integrates with various data sources and charting libraries to offer a comprehensive tool for stock market enthusiasts.

## Features

*   **AI-Powered Analysis:** Utilizes Google's Gemini API (`gemini-2.5-flash-preview-05-20` model) to generate:
    *   Stock price projections (short to long term).
    *   Price reversal timelines with detailed reasoning.
    *   Company information and factors influencing projections.
    *   Alternative ticker suggestions based on market movers.
    *   Statistical measures (Mean, Median, Mode, Standard Deviation).
    *   Analysis incorporating news, sentiment, and market data via Google Search grounding.
*   **Options Strategy Insights:**
    *   Direct fetching of options chain data from Nasdaq and Yahoo Finance APIs (primary methods).
    *   Fallback to AI-driven options data extraction from sources like Barchart, Nasdaq, Yahoo Finance, or WSJ if direct fetch fails.
    *   Suggestion of 2-3 multi-leg options strategies (e.g., Bull Call Spread, Bear Put Spread, Iron Condor).
    *   Textual description of strategy rationale, market outlook, and risk/reward.
    *   Dynamic payoff diagrams for suggested strategies using Plotly.js, based on live or AI-provided premium data.
    *   Calculation of net premium for strategies.
*   **Market Visualization:**
    *   **TradingView Advanced Chart:** Real-time stock chart with multiple studies (Volume, RSI, MACD, Bollinger Bands).
    *   **Projected OHLCV Chart:** 7-day projected Open, High, Low, Close, Volume candlestick and volume bar chart using Plotly.js, based on AI analysis (excludes weekends and market holidays).
    *   **Spot Price Display:** Shows current spot price, updated from direct API fetches or AI analysis, with visual cues for price changes.
*   **Data Management & Performance:**
    *   **IndexedDB Caching:** Caches detailed AI analysis (text, OHLCV, options data, spot price) for 1 hour to reduce API calls and enable faster recall.
    *   **localStorage:** Persists user's last queried ticker/exchange, API call timestamps (for rate limiting), current API key index, and last known spot price for quick view.
    *   **Service Worker:** Caches core application assets (HTML, CSS, JS, key libraries) for offline availability and faster load times.
*   **API Key Management:**
    *   Supports a primary API key via `process.env.API_KEY`.
    *   Allows a comma-separated list of fallback API keys (`USER_PROVIDED_KEYS_STRING` in `index.js`) for rotation.
    *   Automatic rotation of API keys upon rate limit errors (`429 RESOURCE_EXHAUSTED`) or other blocking issues.
*   **User Experience:**
    *   Responsive design for various screen sizes.
    *   Light/Dark theme support for TradingView widget based on system preference.
    *   Cooldown mechanism (60 seconds) for API calls to respect rate limits.
    *   Clear display of data sources (for analysis and options).
    *   Informative messages for loading states, errors, and cached data usage.
    *   Collapsible sections for API rate limit information, data storage details, and sources.
*   **Error Handling & Logging:**
    *   Robust error logging to the console.
    *   Client-side mechanism to copy logged errors for debugging.
    *   Graceful fallback to cached data when API errors or rate limits occur.

## Key Technologies

*   **Frontend:** HTML5, CSS3, JavaScript (ES6 Modules)
*   **AI:** Google Gemini API (`@google/genai` SDK) via `gemini-2.5-flash-preview-05-20` model with Google Search grounding.
*   **Charting:**
    *   TradingView (for live market charts)
    *   Plotly.js (for AI-projected OHLCV and options payoff diagrams)
*   **Data Storage:** IndexedDB, localStorage, Cache API (Service Worker)
*   **Styling:** Bootstrap 5.3, W3.CSS, Custom CSS
*   **Markdown Parsing:** `marked` library (for formatting AI responses)
*   **Financial Data APIs (Direct Fetch):**
    *   Nasdaq API (for options chain data and spot price)
    *   Yahoo Finance API (unofficial, for options chain data and spot price as fallback)

## Setup and Running

1.  **Clone the repository (if applicable) or ensure all files (`index.html`, `index.js`, `index.css`, `sw.js`, `metadata.json`) are in the same directory.**
2.  **API Key Configuration:**
    *   **Primary Method (Environment Variable):** The application expects the primary Gemini API key to be available as `process.env.API_KEY`. In a development environment (like a local server or a platform that supports environment variable injection), ensure this variable is set.
    *   **Fallback Method (Hardcoded List - For Development/Demo):** You can provide a list of API keys directly in `index.js` by modifying the `USER_PROVIDED_KEYS_STRING` constant.
        ```javascript
        // In index.js
        const USER_PROVIDED_KEYS_STRING = "YOUR_API_KEY_1,YOUR_API_KEY_2,YOUR_API_KEY_3";
        ```
        **Important:** Hardcoding API keys directly into client-side JavaScript is generally not recommended for production due to security risks. The `process.env.API_KEY` method is preferred.
3.  **Serve the `index.html` file:** Use a local web server. A simple way is to use `npx serve` in the project directory or Python's `http.server`.
    ```bash
    # Example using npx serve
    npx serve .
    ```
4.  Open the application in your web browser (e.g., `http://localhost:3000` or `http://localhost:8000`).

## Directory Structure (Simplified)

```
.
├── index.html         # Main HTML structure
├── index.js           # Core application logic, Gemini API interaction
├── index.css          # Styles for the application
├── sw.js              # Service worker for caching and offline support
├── metadata.json      # Application metadata
└── README.md          # This file
```

## Advanced Integrations & Future Enhancements

This section outlines potential advanced features and integrations that could further enhance the Stock Projection Analyzer:

1.  **Real-time Data Streaming:**
    *   **WebSockets:** Integrate with WebSocket providers (e.g., financial data APIs offering streams) for live, real-time updates of stock prices, order books, and news feeds, instead of relying solely on periodic refreshes or AI-driven spot price parsing.
    *   **Server-Sent Events (SSE):** For unidirectional updates from a backend if one is introduced.

2.  **Portfolio Management:**
    *   Allow users to create and track a virtual portfolio of stocks.
    *   Calculate portfolio value, daily P&L, and overall performance.
    *   Integrate AI analysis for portfolio holdings.

3.  **User Accounts & Personalization:**
    *   Implement user authentication (e.g., OAuth, Firebase Auth).
    *   Store user preferences, watchlists, and portfolio data in a cloud database (e.g., Firestore, Supabase).
    *   Personalized AI insights based on user's risk profile or investment goals.

4.  **Backend Services:**
    *   Develop a dedicated backend (e.g., Node.js/Express, Python/Flask) to:
        *   Securely manage API keys and make calls to Gemini and other financial APIs.
        *   Handle real-time data aggregation and streaming.
        *   Perform more complex computations or manage a persistent database.
        *   Cache API responses server-side to reduce client load and share common data.

5.  **Advanced Charting & Technical Analysis Tools:**
    *   Integrate more advanced charting libraries or enhance existing ones with more drawing tools, custom indicators, and strategy backtesting visualizations.
    *   Allow users to save and load chart layouts and indicator sets.

6.  **Sentiment Analysis from Social Media & News Aggregators:**
    *   Use Gemini's capabilities or integrate other NLP services to perform real-time sentiment analysis on stock-related news from various aggregators and social media platforms (e.g., Twitter, Reddit).
    *   Visualize sentiment trends over time.

7.  **Strategy Backtesting Engine:**
    *   Develop a module to backtest user-defined or AI-suggested trading strategies against historical stock and options data.
    *   Provide performance metrics (e.g., Sharpe ratio, max drawdown).

8.  **Brokerage Integration (Hypothetical & Complex):**
    *   (Requires significant security and regulatory compliance) Explore potential integrations with brokerage APIs (if available and permitted) to allow users to place trades directly from the application.

9.  **Personalized Alerts & Notifications:**
    *   Allow users to set up custom alerts for:
        *   Price targets (e.g., stock reaches $X).
        *   Volume spikes.
        *   Significant news events for watched stocks.
        *   Options nearing expiration or specific IV levels.
    *   Utilize Web Push Notifications.

10. **Machine Learning Model Enhancements:**
    *   **Fine-tuning (if available/applicable):** Explore fine-tuning Gemini or other models on specific financial datasets for more specialized predictions (subject to API capabilities).
    *   **Hybrid Models:** Combine Gemini's generative capabilities with custom-trained predictive models for specific tasks like volatility forecasting.

11. **Voice Control & Accessibility:**
    *   Integrate the Web Speech API for voice commands (e.g., "Get analysis for AAPL on NASDAQ").
    *   Further enhance ARIA attributes and keyboard navigation for improved accessibility.

12. **Export & Reporting Features:**
    *   Allow users to export AI analysis, chart data, or strategy details to formats like PDF or CSV.

13. **Enhanced Options Analytics:**
    *   **Volatility Surfaces & Skews:** Visualize implied volatility across different strikes and expirations.
    *   **Greeks Calculation:** Calculate and display option Greeks (Delta, Gamma, Theta, Vega, Rho) using the Black-Scholes model (already partially implemented) or from fetched data.
    *   **Probability of Profit:** Calculate and display the probability of profit for options strategies.

14. **Educational Content Integration:**
    *   Provide contextual help and educational snippets about financial terms, indicators, and options strategies, potentially generated or curated by Gemini.

These advanced integrations would require significant development effort, potentially a backend infrastructure, and careful consideration of data sources, security, and user experience.

## API Key Configuration Notes

*   The application prioritizes the `process.env.API_KEY` for the Gemini API. This is the recommended approach for security.
*   The `USER_PROVIDED_KEYS_STRING` in `index.js` serves as a fallback or a way to use multiple keys for rotation, especially useful during development or for distributing applications where individual users might provide their own keys.
*   API keys are rotated automatically if a rate limit error (429) or a blocking error is encountered from the Gemini API, cycling through the available keys. The index of the current key is stored in `localStorage` to persist across sessions.

## Contributing

Contributions are welcome! If you'd like to contribute:
1.  Fork the repository (if applicable).
2.  Create a new branch for your feature or bug fix.
3.  Make your changes.
4.  Ensure your code adheres to the project's coding style and guidelines.
5.  Test your changes thoroughly.
6.  Submit a pull request with a clear description of your changes.

## License

This project is licensed under the Apache License, Version 2.0. See the inline license text in `index.js` for more details.
(Note: If a separate `LICENSE` file is preferred, one should be created.)

---

*This README provides a comprehensive overview. Specific implementation details for advanced features would require further design and planning.*
