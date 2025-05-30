// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { BlackScholesInputs, BlackScholesResults, OptionType, GroundingSource, BlackScholesFetchStatus } from '../types.js';
import { calculateBlackScholes } from '../services/blackScholesService.js';
import { fetchBlackScholesInputsFromGemini } from '../services/geminiService.js';
import { FetchIcon } from '../constants.js'; // Assuming .js extension
import { OptionType } from '../types.js'; // Import OptionType for runtime comparison

/**
 * @typedef {import('../types.js').BlackScholesInputs} BlackScholesInputs
 * @typedef {import('../types.js').BlackScholesResults} BlackScholesResults
 * @typedef {import('../types.js').GroundingSource} GroundingSource
 * @typedef {import('../types.js').BlackScholesFetchStatus} BlackScholesFetchStatus
 */

/**
 * @typedef {Object} BlackScholesCalculatorProps
 * @property {string} underlyingNameForFetch
 * @property {(calculationError: string | null, fetchError: string | null) => void} [onBlackScholesError]
 */

/**
 * @param {BlackScholesCalculatorProps} props
 * @returns {React.ReactElement}
 */
const BlackScholesCalculator = ({ underlyingNameForFetch, onBlackScholesError }) => {
  if (typeof React === 'undefined') {
    console.error("React is not loaded. BlackScholesCalculator component cannot render.");
    return null;
  }
  const { useState, useCallback, useEffect } = React; // Destructure from global React

  const [inputs, setInputs] = useState(/** @type {BlackScholesInputs} */ ({
    stockPrice: '100',
    strikePrice: '100',
    timeToExpiration: '0.25',
    riskFreeRate: '0.05',
    volatility: '0.20',
    optionType: OptionType.Call, // Use imported enum value
  }));
  const [results, setResults] = useState(/** @type {BlackScholesResults | null} */ (null));
  const [error, setError] = useState(/** @type {string | null} */ (null));
  const [isFetchingInputs, setIsFetchingInputs] = useState(false);
  const [fetchStatus, setFetchStatus] = useState(/** @type {BlackScholesFetchStatus | null} */ (null));
  const [fetchedBSSources, setFetchedBSSources] = useState(/** @type {GroundingSource[]} */ ([]));
  const [statusTimeoutId, setStatusTimeoutId] = useState(/** @type {NodeJS.Timeout | null} */ (null));

  const showStatus = useCallback((message, type, duration = 7000) => {
    if (statusTimeoutId) clearTimeout(statusTimeoutId);
    setFetchStatus({ message, type, key: Date.now() });
    if (type === 'error' && onBlackScholesError) {
        onBlackScholesError(null, message);
    }
    if (duration > 0) {
      const newTimeoutId = setTimeout(() => setFetchStatus(null), duration);
      setStatusTimeoutId(newTimeoutId);
    }
  }, [statusTimeoutId, onBlackScholesError]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setInputs(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = useCallback(() => {
    setError(null);
    if (onBlackScholesError) onBlackScholesError(null, null);
    setResults(null);
    const calcResults = calculateBlackScholes(inputs);
    if ('error' in calcResults) {
      setError(calcResults.error);
      if (onBlackScholesError) onBlackScholesError(calcResults.error, null);
    } else {
      setResults(calcResults);
    }
  }, [inputs, onBlackScholesError]);

  const handleFetchBSInputs = async () => {
    if (!underlyingNameForFetch) {
        showStatus('Underlying name from main configuration is needed to fetch B/S inputs.', 'warning');
        return;
    }
    setIsFetchingInputs(true);
    setFetchedBSSources([]);
    if (statusTimeoutId) clearTimeout(statusTimeoutId);
    setFetchStatus(null);
    if (onBlackScholesError) onBlackScholesError(null, null);
    showStatus(`Fetching suggested inputs for ${underlyingNameForFetch}...`, 'info', 0);

    const result = await fetchBlackScholesInputsFromGemini(underlyingNameForFetch);
    setIsFetchingInputs(false);

    if (result.error) {
        showStatus(result.error, 'error', 10000);
    } else {
        let updateDetails = "";
        let allDataFound = true;
        const newInputs = { ...inputs };

        if (result.stockPrice !== undefined && result.stockPrice !== null) newInputs.stockPrice = result.stockPrice.toString();
        else { updateDetails += " Current stock price not found."; allDataFound = false; }
        if (result.strikePrice !== undefined && result.strikePrice !== null) newInputs.strikePrice = result.strikePrice.toString();
        else { updateDetails += " Suggested strike price not found."; allDataFound = false; }
        if (result.timeToExpiration !== undefined && result.timeToExpiration !== null) newInputs.timeToExpiration = result.timeToExpiration.toString();
        else { updateDetails += " Typical time to expiration not found."; allDataFound = false; }
        if (result.riskFreeRate !== undefined && result.riskFreeRate !== null) newInputs.riskFreeRate = result.riskFreeRate.toString();
        else { updateDetails += " Risk-free rate not found."; allDataFound = false; }
        if (result.volatility !== undefined && result.volatility !== null) newInputs.volatility = result.volatility.toString();
        else { updateDetails += " Volatility not found."; allDataFound = false; }
        setInputs(newInputs);

        let message = `Suggested inputs for ${underlyingNameForFetch} processed.`;
        if (result.dataComment) message += ` AI Note: ${result.dataComment}`;
        if (!allDataFound) message += ` Details: Some data points were not found by AI and existing or default values were kept.${updateDetails}`;
        showStatus(message, allDataFound ? 'success' : 'warning', allDataFound ? 7000 : 12000);
        if (result.sources && result.sources.length > 0) setFetchedBSSources(result.sources);
    }
  };

  useEffect(() => {
    return () => {
      if (statusTimeoutId) clearTimeout(statusTimeoutId);
    };
  }, [statusTimeoutId]);

  const renderResultField = (label, value, digits = 4, unit) => {
    if (value === undefined) return null;
    return React.createElement(
      'div', { key: label, className: "flex justify-between py-1" },
      React.createElement('span', { className: "text-sm text-[#555555]" }, `${label}:`),
      React.createElement('span', { className: "text-sm font-medium text-[#333333]" }, `${value.toFixed(digits)}${unit || ''}`)
    );
  };

  const inputFields = [
    { label: "Stock Price (S)", name: "stockPrice", type: "number", placeholder: "e.g., 100" },
    { label: "Strike Price (K)", name: "strikePrice", type: "number", placeholder: "e.g., 100" },
    { label: "Time to Expiration (T, years)", name: "timeToExpiration", type: "number", step: "0.01", placeholder: "e.g., 0.25" },
    { label: "Risk-Free Rate (r, decimal)", name: "riskFreeRate", type: "number", step: "0.001", placeholder: "e.g., 0.05" },
    { label: "Volatility (σ, decimal)", name: "volatility", type: "number", step: "0.01", placeholder: "e.g., 0.20" },
  ];

  return React.createElement(
    'div', { className: "bg-white p-6 w-full" },
    React.createElement('h3', { className: "text-xl font-semibold text-center text-[#00407A] mb-1" }, "Black-Scholes Calculator"),
    React.createElement('p', { className: "text-xs text-center text-gray-500 mb-1" }, `Uses '${underlyingNameForFetch}' from main config for fetching.`),
    React.createElement('p', { className: "text-xs text-center text-slate-400 mb-3" }, "Note: This calculator uses the Black-Scholes model for European options. American option pricing may differ."),
    React.createElement(
      'div', { className: "mb-4 p-3 rounded-md bg-slate-50 border border-[#E5E7EB]" },
      React.createElement(
        'button',
        { onClick: handleFetchBSInputs, disabled: isFetchingInputs || !underlyingNameForFetch, className: "w-full flex items-center justify-center bg-sky-600 hover:bg-sky-700 text-white text-sm font-medium py-2 px-3 rounded-md shadow-sm disabled:opacity-50 transition-all duration-150 ease-in-out hover:scale-103 active:scale-98 active:brightness-90" },
        isFetchingInputs ? React.createElement('span', { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" }) : React.createElement(FetchIcon, null),
        isFetchingInputs ? 'Fetching Inputs...' : 'Fetch B/S Inputs via AI'
      ),
      fetchStatus && React.createElement(
        'div', { className: `mt-2 p-2 text-xs rounded ${fetchStatus.type === 'success' ? 'bg-green-50 text-green-700 border border-green-200' : fetchStatus.type === 'warning' ? 'bg-yellow-50 text-yellow-700 border border-yellow-200' : fetchStatus.type === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-blue-50 text-blue-700 border border-blue-200'}` },
        fetchStatus.message
      ),
      fetchedBSSources.length > 0 && React.createElement(
        'div', { className: "mt-2 pt-2 border-t border-[#E5E7EB]" },
        React.createElement('p', { className: "text-xs text-gray-500 mb-1" }, "AI suggestions based on:"),
        React.createElement(
          'ul', { className: "list-disc list-inside max-h-20 overflow-y-auto text-xs" },
          fetchedBSSources.map((source, idx) => React.createElement(
            'li', { key: idx, className: "text-gray-500 truncate" },
            React.createElement('a', { href: source.uri, target: "_blank", rel: "noopener noreferrer", title: source.title, className: "hover:text-sky-600 underline" }, source.title || new URL(source.uri).hostname)
          ))
        )
      )
    ),
    React.createElement(
      'div', { className: "grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6" },
      inputFields.map(field => React.createElement(
        'div', { key: field.name },
        React.createElement('label', { htmlFor: `bs${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`, className: "block text-sm font-medium text-[#555555]" }, field.label),
        React.createElement('input', { type: field.type, name: field.name, id: `bs${field.name.charAt(0).toUpperCase() + field.name.slice(1)}`, value: inputs[field.name], onChange: handleInputChange, disabled: isFetchingInputs, className: "mt-1 block w-full px-3 py-2 border border-[#D1D5DB] rounded-md shadow-sm focus:outline-none focus:ring-[#00539B] focus:border-[#00539B] sm:text-sm disabled:bg-gray-100", placeholder: field.placeholder, step: field.step })
      )),
      React.createElement(
        'div', null,
        React.createElement('label', { htmlFor: "bsOptionType", className: "block text-sm font-medium text-[#555555]" }, "Option Type"),
        React.createElement(
          'select', { name: "optionType", id: "bsOptionType", value: inputs.optionType, onChange: handleInputChange, disabled: isFetchingInputs, className: "mt-1 block w-full px-3 py-2 border border-[#D1D5DB] bg-white rounded-md shadow-sm focus:outline-none focus:ring-[#00539B] focus:border-[#00539B] sm:text-sm disabled:bg-gray-100" },
          React.createElement('option', { value: OptionType.Call }, "Call"),
          React.createElement('option', { value: OptionType.Put }, "Put")
        )
      )
    ),
    React.createElement(
      'div', { className: "flex justify-center mb-6" },
      React.createElement(
        'button', { onClick: handleSubmit, disabled: isFetchingInputs, className: "px-6 py-2 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-[#00539B] hover:bg-[#00407A] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#00539B] disabled:opacity-50" },
        "Calculate"
      )
    ),
    error && React.createElement('p', { className: "text-red-600 text-sm text-center mb-4" }, error),
    results && React.createElement(
      'div', { className: "mt-6 border-t border-[#E5E7EB] pt-6" },
      React.createElement('h3', { className: "text-lg font-medium leading-6 text-[#333333] text-center mb-4" }, "Results"),
      React.createElement(
        'div', { className: "grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 bg-slate-50 p-4 rounded-md" },
        React.createElement(
          'div', null,
          React.createElement('p', { className: "text-md font-semibold text-[#00539B] mb-1" }, "Option Prices:"),
          renderResultField("Call Price", results.callPrice, 2, "$"),
          renderResultField("Put Price", results.putPrice, 2, "$")
        ),
        React.createElement(
          'div', null,
          React.createElement('p', { className: "text-md font-semibold text-[#00539B] mb-1" }, "Greeks (Selected Type):"),
          inputs.optionType === OptionType.Call && renderResultField("Call Delta", results.callDelta),
          inputs.optionType === OptionType.Put && renderResultField("Put Delta", results.putDelta),
          renderResultField("Gamma", results.gamma),
          renderResultField("Vega (per 1% vol)", results.vega ? results.vega / 100 : undefined),
          inputs.optionType === OptionType.Call && renderResultField("Call Theta (daily)", results.callTheta),
          inputs.optionType === OptionType.Put && renderResultField("Put Theta (daily)", results.putTheta),
          inputs.optionType === OptionType.Call && renderResultField("Call Rho (per 1% rate)", results.callRho),
          inputs.optionType === OptionType.Put && renderResultField("Put Rho (per 1% rate)", results.putRho)
        )
      )
    )
  );
};

export default BlackScholesCalculator;
