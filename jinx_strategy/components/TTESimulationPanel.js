// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { PlotOptions } from '../types.js';
import { ClearIcon } from '../constants.js'; // Assuming .js
import { InputField } from './SharedControls.js'; // Assuming .js

/**
 * @typedef {import('../types.js').PlotOptions} PlotOptions
 */

/**
 * @typedef {Object} TTESimulationPanelProps
 * @property {PlotOptions} plotOptions
 * @property {number} currentSimulatedTTEDays
 * @property {string} simulationSigmaInput
 * @property {string} simulationRInput
 * @property {boolean} isTTESimulationActive
 * @property {() => void} onToggleTTESimulation
 * @property {() => void} onSet0DTESimulation
 * @property {() => void} onResetTTESimulation
 * @property {(days: number) => void} onCurrentSimulatedTTEDaysChange
 * @property {(value: string) => void} onSimulationSigmaInputChange
 * @property {(value: string) => void} onSimulationRInputChange
 * @property {boolean} anyAppLoading
 */

/**
 * @param {TTESimulationPanelProps} props
 * @returns {React.ReactElement}
 */
const TTESimulationPanel = ({
    plotOptions, currentSimulatedTTEDays, simulationSigmaInput, simulationRInput,
    isTTESimulationActive, onToggleTTESimulation, onSet0DTESimulation, onResetTTESimulation,
    onCurrentSimulatedTTEDaysChange, onSimulationSigmaInputChange, onSimulationRInputChange,
    anyAppLoading
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. TTESimulationPanel component cannot render.");
        return null;
    }

    const currentSIsValid = plotOptions.currentS && parseFloat(plotOptions.currentS) > 0;

    return React.createElement(
        React.Fragment,
        null,
        React.createElement('p', { className: "text-xs text-gray-500 mb-3" }, "Simulate option premiums and P/L at a future Time To Expiration (TTE). Uses Black-Scholes for premium calculation. ", React.createElement('strong', {className: "text-red-600"}, "Requires a valid Current Stock Price in main config.")),
        React.createElement(
            'div',
            { className: "grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-3" },
            React.createElement(
                'div',
                null,
                React.createElement('label', { htmlFor: "tteDaysSim", className: "block text-xs font-medium text-[#555555] mb-1" }, `Simulate at TTE (Days): ${currentSimulatedTTEDays} days`),
                React.createElement('input', {
                    type: "range", id: "tteDaysSim", name: "tteDaysSim",
                    min: "0", max: plotOptions.initialTTEForSimulation ? Math.max(30, Math.round(plotOptions.initialTTEForSimulation * 365 * 1.2)) : 90,
                    value: currentSimulatedTTEDays,
                    onChange: e => onCurrentSimulatedTTEDaysChange(parseInt(e.target.value, 10)),
                    className: "w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#00539B]",
                    disabled: anyAppLoading || !currentSIsValid
                })
            ),
            React.createElement(InputField, { label: "Sim Volatility (σ, decimal)", id: "simulationSigma", type: "number", step: "0.001", value: simulationSigmaInput, onChange: e => onSimulationSigmaInputChange(e.target.value), placeholder: "e.g., 0.20", disabled: anyAppLoading || !currentSIsValid }),
            React.createElement(InputField, { label: "Sim Risk-Free Rate (r, decimal)", id: "simulationR", type: "number", step: "0.001", value: simulationRInput, onChange: e => onSimulationRInputChange(e.target.value), placeholder: "e.g., 0.05", disabled: anyAppLoading || !currentSIsValid }),
            React.createElement(
                'button',
                {
                    onClick: onSet0DTESimulation,
                    disabled: anyAppLoading || !currentSIsValid,
                    className: "sm:col-span-2 flex items-center justify-center bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium py-2 px-3 rounded-md shadow-sm disabled:opacity-50 transition-all"
                },
                "Set 0 DTE Simulation"
            )
        ),
        React.createElement(
            'div',
            { className: "mt-4 flex space-x-2" },
            React.createElement(
                'button',
                {
                    onClick: onToggleTTESimulation,
                    disabled: anyAppLoading || !currentSIsValid,
                    className: `flex-1 flex items-center justify-center text-sm font-medium py-2 px-3 rounded-md shadow-sm transition-all ${isTTESimulationActive
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-green-600 hover:bg-green-700 text-white disabled:opacity-50'
                        }`
                },
                isTTESimulationActive ? 'Deactivate Simulation' : 'Activate & Apply Simulation'
            ),
            React.createElement(
                'button',
                {
                    onClick: onResetTTESimulation,
                    disabled: anyAppLoading || !currentSIsValid,
                    className: "flex-shrink-0 flex items-center justify-center bg-gray-200 hover:bg-gray-300 text-gray-700 text-sm font-medium py-2 px-3 rounded-md shadow-sm disabled:opacity-50 transition-all"
                },
                React.createElement(ClearIcon, null), " Reset Sim"
            )
        ),
        isTTESimulationActive && currentSIsValid && React.createElement(
            'p', { className: "text-xs text-green-700 mt-2 italic" },
            `Simulation is active. Premiums on legs and plot are simulated values for ${currentSimulatedTTEDays} days TTE.`
        ),
        !currentSIsValid && React.createElement(
            'p', { className: "text-xs text-red-600 mt-2 italic" },
            "Current Stock Price is required to use TTE Simulation."
        )
    );
};

export default TTESimulationPanel;
