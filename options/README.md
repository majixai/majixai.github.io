
## ⚠️ Limitations and Future Work

*   **Theoretical Model:** Uses Black-Scholes, which assumes constant volatility/rates, no transaction costs, European exercise (though often applied to American-style /ES options as an approximation), etc. Real-world pricing differs.
*   **Data Source:** Relies on a static `strategies.json` for definitions. No real-time market data or options chain integration.
*   **Premium Calculation:** Premiums are purely theoretical based on BS inputs; they do not reflect actual market bid/ask spreads or skew.
*   **Breakevens:** Calculated breakevens are theoretical based on the calculated premiums.
*   **Greeks Display:** Currently simplifies Greeks display (e.g., showing only the first leg for multi-leg strategies). Net Greeks for complex strategies are not explicitly calculated/displayed.
*   **Dividends:** Assumes zero dividends (`q=0`), which is generally appropriate when using the futures price (/ES) as the underlying input (S).
*   **Performance:** Extensive DOM manipulation in Vanilla JS might become less performant than optimized framework approaches if the number of strategies displayed simultaneously becomes extremely large.
*   **Placeholders:** Google Calendar and full Google Analytics functionality require further implementation (OAuth, more detailed event tracking).
*   **No Saved State:** User modifications to strategy parameters (strikes, quantity) are lost on page reload unless manually saved/persisted (potential future feature using `localStorage` or extending IndexedDB).
*   **Error Handling:** While basic error handling is included, it could be made more robust for edge cases in calculations or storage operations.

**Potential Future Enhancements:**

*   Implement calculation and display of Net Greeks for multi-leg strategies.
*   Add volatility skew/smile modeling instead of single IV input.
*   Integrate a simple way to save/load user-modified strategy configurations.
*   Allow comparison of multiple strategy payoffs on a single chart.
*   Add options pricing models beyond Black-Scholes (e.g., Binomial).
*   Improve UI/UX for parameter input and display.

## 📜 Disclaimer

This application is intended for **educational and illustrative purposes only**. It does **not** constitute financial advice. Option trading involves substantial risk of loss and is not suitable for all investors. The theoretical calculations provided by the Black-Scholes model may differ significantly from actual market prices and outcomes. Always consult with a qualified financial professional before making any trading decisions.

## 📄 License

*(Placeholder: Specify a license, e.g., MIT, or remove if not applicable)*

This project is licensed under the MIT License - see the LICENSE.md file for details (if applicable).
