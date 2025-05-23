# Gemini Financial Modeling Chat

## Description
Gemini Financial Modeling Chat is an interactive chat application that leverages Google's Gemini model to provide responses to user queries and engage in financial modeling discussions. It includes specialized features for stock quote guidance, informational options strategy suggestions, client-side Black-Scholes Model (BSM) calculations, market analysis discussions, conceptual AI search, exploration of parameterizable mathematical functions with plotting, and persistent storage for parameters. The application is designed with a user-friendly, responsive interface and stores chat history locally for persistence.

## Key Features
*   **Interactive Chat**: Engage in conversations with Google's advanced Gemini AI model.
*   **Stock Quote Guidance**: Ask for stock prices (e.g., "price of GOOG", "MSFT stock"). The AI provides information conceptually sourced from Google Finance and can discuss the conceptual application of technical indicators (SMA, RSI) and risk management tools (trailing stops, OCO orders, covariance) for stock analysis.
*   **Options Strategy Suggestions**: Request informational options strategies for specific tickers (e.g., "options strategy for AAPL"). The AI provides potential strategies based on general market data concepts, BSM principles, conceptual technical indicator application, and relevant risk management tools, with a clear disclaimer that this is not financial advice.
*   **Market Analysis Discussions**: Request general market analysis (e.g., "market movers", "market sentiment"). The AI discusses these based on its conceptual understanding of how such data is interpreted, including how technical indicators and risk management concepts might be used.
*   **Client-Side Black-Scholes Model (BSM) Calculations**: User-prompted BSM calculations for European options. The system calculates the price, and the AI explains the result and its assumptions. Parameters and results can be saved.
*   **Conceptual AI Search**: AI can provide synthesized information based on its training data for queries requiring general knowledge or 'search-like' information retrieval, with transparency about not performing live searches.
*   **Parameterizable Mathematical Functions**: Includes interactive discussion of mathematical functions like hyperbolic cosine (`cosh`) and damped oscillations (`calculateDampedOscillation`). Users can explore how parameters affect these functions conceptually.
*   **Plotly.js Visualization**: Basic integration of Plotly.js to visualize outputs of the defined mathematical functions (`cosh`, `dampedOscillation`) based on AI-guided or user-specified parameters. Plot configurations can be saved.
*   **Persistent Parameter Storage**: Ability to save and load parameters for BSM calculations and mathematical function plots using IndexedDB, managed via chat interaction (e.g., "save last bsm result as MyBSM", "load MyBSM").
*   **Advanced Financial Concepts**: Enhanced AI understanding and discussion of concepts like covariance, trailing stops, and OCO (One-Cancels-the-Other) orders in relevant financial contexts.
*   **Persistent Chat History**: Conversations are saved locally using IndexedDB, allowing users to retain their chat history across sessions.
*   **In-Memory Caching**: Repeated queries within the same session are served from an in-memory cache for faster responses.
*   **External Configuration**: Key application settings, such as the Gemini model to be used, the default greeting message, and feature toggles, are configured via the `index.json` file.
*   **Responsive UI**: The user interface is styled with W3.CSS, ensuring a responsive and accessible experience across different devices.

## Technical Overview
The application's client-side logic is structured following a Model-View-Controller (MVC) architecture within `script.js`:
*   **Model (`ChatModel`)**: Manages data, API interactions with Gemini, caching, IndexedDB operations (for chat history and saved parameters/results), intent analysis, and integration with the BSM calculator and conceptual technical/math functions.
*   **View (`UIController`)**: Handles all DOM manipulations, displaying messages, user input, and rendering plots via Plotly.js.
*   **Controller (`ChatController`)**: Orchestrates the application flow, acting as an intermediary between the Model and the View.

**Key Technologies Used**:
*   HTML5
*   CSS3 (including W3.CSS)
*   JavaScript (ES Modules)
    *   `script.js`: Main application logic (MVC), including BSM calculator.
    *   `indicators.js`: Contains classes for conceptual `MovingAverage` and `RSIIndicator`.
    *   `mathUtils.js`: Contains `calculateCosh` and `calculateDampedOscillation` functions.
*   Google Gemini API (via `@google/genai` ESM module)
*   Marked.js (for rendering Markdown in chat responses)
*   Plotly.js (for rendering 2D plots; CDN)
*   IndexedDB (for client-side storage of chat history and saved parameters/results)

## Setup and Usage

### Prerequisites
*   A modern web browser that supports JavaScript Modules, IndexedDB, Fetch API, and WebGL (for Plotly.js).

### Getting Started
1.  **Files**: Ensure you have all the necessary files in the `chat` directory:
    *   `index.html` (references Plotly.js CDN, `mathUtils.js`, `indicators.js`, and `script.js`)
    *   `script.js`
    *   `style.css`
    *   `index.json`
    *   `indicators.js`
    *   `mathUtils.js`
2.  **API Key**: This is crucial. You need to obtain a Google Gemini API Key.
    *   Visit the [Google AI Studio](https://aistudio.google.com/app/apikey) (or the relevant Google Cloud project page) to generate your API key.
3.  **Configure API Key**: Open `chat/script.js` in a text editor. Find the line:
    ```javascript
    const API_KEY = "YOUR_API_KEY";
    ```
    Replace `"YOUR_API_KEY"` with your actual Gemini API key.
4.  **Launch**: Open the `chat/index.html` file in your web browser.

### Customization
The application can be customized via the `chat/index.json` file. You can modify:
*   The specific Gemini model used.
*   The default greeting message.
*   Application name and version.
*   Feature flags to enable/disable certain functionalities (though programmatic enforcement of these flags in `script.js` is not fully implemented for all flags; features are generally active based on AI understanding).

## `index.json` Structure
The `index.json` file allows for basic configuration of the application. Here's its current structure:

```json
{
  "appName": "Gemini Financial Modeling Chat",
  "appVersion": "1.3.0",
  "apiConfig": {
    "modelName": "gemini-1.5-flash-latest",
    "apiKeyPlaceholder": "YOUR_API_KEY_HERE"
  },
  "ui": {
    "defaultGreeting": "Hello! I'm your AI assistant for financial exploration. Ask about markets, stocks, options, BSM, math functions, or save your parameters. Plots available for functions!",
    "enableW3CSS": true
  },
  "featureFlags": {
    "enableBSMCalculator": true,
    "enableIndicatorAwareness": true,
    "enableMarketAnalysis": true,
    "enableSimulatedSearch": true,
    "enableMathFunctionDiscussion": true,
    "enablePlotly": true,
    "enableParameterSaving": true
  }
}
```

**Field Explanations**:
*   `appName`: The name of the application (e.g., "Gemini Financial Modeling Chat").
*   `appVersion`: The current version of the application (e.g., "1.3.0").
*   `apiConfig.modelName`: Specifies the Gemini model to be used.
*   `apiConfig.apiKeyPlaceholder`: A reminder for where the API key is set (actual key is in `script.js`).
*   `ui.defaultGreeting`: The initial message displayed by the AI.
*   `ui.enableW3CSS`: A flag that could be used to toggle W3.CSS styling (currently, styling is always applied).
*   `featureFlags`: An object to conceptually toggle specific features:
    *   `enableBSMCalculator`: Enables BSM calculation and related discussions.
    *   `enableIndicatorAwareness`: Enables AI discussion of conceptual technical indicators (SMA, RSI).
    *   `enableMarketAnalysis`: Enables AI discussion of market analysis topics.
    *   `enableSimulatedSearch`: Enables the AI's simulated search capability for general queries.
    *   `enableMathFunctionDiscussion`: Enables conceptual discussion of math functions in `mathUtils.js`.
    *   `enablePlotly`: Enables client-side plotting of math functions using Plotly.js.
    *   `enableParameterSaving`: Enables saving/loading of BSM parameters/results and plot configurations via IndexedDB.
    (Note: Programmatic enforcement of these flags to fully disable corresponding JavaScript logic or AI intents is not comprehensively implemented in the current version; features are generally active if the AI understands the prompt.)

## Disclaimer
The information provided by this application, especially any content related to financial instruments such as stocks, options strategies, Black-Scholes Model (BSM) calculations, or market analysis, is for informational and illustrative purposes only. It should not be construed as financial advice, investment recommendations, or an offer or solicitation to buy or sell any securities.

BSM calculations are based on a theoretical model with inherent assumptions and may not reflect actual market prices or conditions. All AI-generated content is based on its existing knowledge and the prompts provided; it does not have access to live financial data or perform real-time analysis. Mathematical function plots are based on the provided JavaScript implementations.

Users should consult with a qualified financial advisor or other professional before making any investment decisions. The creators of this application are not liable for any financial losses or damages incurred as a result of using the information provided herein. Always do your own research and due diligence.
