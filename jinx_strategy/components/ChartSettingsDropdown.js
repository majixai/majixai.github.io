// Assuming React is available globally e.g. via CDN
import { DUKE_BLUE, PANEL_BACKGROUND, TEXT_COLOR_PRIMARY, BORDER_COLOR } from '../constants.js';

/**
 * @typedef {Object} ChartSettingsDropdownProps
 * @property {boolean} showBlackScholes
 * @property {() => void} onToggleBlackScholes
 * @property {boolean} showTTESimulation
 * @property {() => void} onToggleTTESimulation
 * @property {boolean} showDataManagement
 * @property {() => void} onToggleDataManagement
 * @property {boolean} showDeveloperTools
 * @property {() => void} onToggleDeveloperTools
 * @property {boolean} showAnalyticsPanel
 * @property {() => void} onToggleAnalyticsPanel
 * @property {boolean} showUserTrades
 * @property {() => void} onToggleUserTrades
 * @property {boolean} anyAppLoading
 */

/**
 * @param {ChartSettingsDropdownProps} props
 * @returns {React.ReactElement}
 */
const ChartSettingsDropdown = ({
    showBlackScholes, onToggleBlackScholes,
    showTTESimulation, onToggleTTESimulation,
    showDataManagement, onToggleDataManagement,
    showDeveloperTools, onToggleDeveloperTools,
    showAnalyticsPanel, onToggleAnalyticsPanel,
    showUserTrades, onToggleUserTrades,
    anyAppLoading
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. ChartSettingsDropdown component cannot render.");
        return null; 
    }
    const { useState, useRef, useEffect } = React; // Destructure from global React

    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    const toggleItem = (label, checked, onToggle) => {
        const inputId = `toggle-${label.replace(/\s+/g, '-')}`;
        return React.createElement(
            'label',
            { htmlFor: inputId, className: "flex items-center justify-between px-3 py-2 text-sm hover:bg-slate-100 cursor-pointer transition-colors" },
            React.createElement('span', { style: { color: TEXT_COLOR_PRIMARY } }, label),
            React.createElement('input', {
                type: "checkbox",
                id: inputId,
                checked: checked,
                onChange: onToggle,
                disabled: anyAppLoading,
                className: "h-4 w-4 rounded focus:ring-2",
                style: { borderColor: BORDER_COLOR, color: DUKE_BLUE, accentColor: DUKE_BLUE }
            })
        );
    };

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return React.createElement(
        'div',
        { className: "relative inline-block text-left w-full", ref: dropdownRef },
        React.createElement(
            'div',
            null,
            React.createElement(
                'button',
                {
                    type: "button",
                    onClick: () => setIsOpen(!isOpen),
                    disabled: anyAppLoading,
                    className: "w-full flex items-center justify-center p-2.5 rounded-lg text-sm sm:text-sm font-medium shadow-md text-white hover:opacity-90 transition-all duration-150 disabled:opacity-60",
                    style: { backgroundColor: DUKE_BLUE },
                    'aria-haspopup': "true",
                    'aria-expanded': isOpen
                },
                "Chart Settings & Advanced Panels",
                React.createElement(
                    'svg',
                    { className: `ml-2 h-5 w-5 transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`, xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 20 20", fill: "currentColor", 'aria-hidden': "true" },
                    React.createElement('path', { fillRule: "evenodd", d: "M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z", clipRule: "evenodd" })
                )
            )
        ),
        isOpen && React.createElement(
            'div',
            {
                className: "origin-top-right absolute right-0 mt-2 w-full rounded-md shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none z-50",
                role: "menu",
                'aria-orientation': "vertical",
                'aria-labelledby': "menu-button",
                style: { backgroundColor: PANEL_BACKGROUND, borderColor: BORDER_COLOR }
            },
            React.createElement(
                'div',
                { className: "py-1 divide-y", style: { borderColor: BORDER_COLOR }, role: "none" },
                toggleItem("Black-Scholes Calc", showBlackScholes, onToggleBlackScholes),
                toggleItem("TTE Simulation Panel", showTTESimulation, onToggleTTESimulation),
                toggleItem("Data Management", showDataManagement, onToggleDataManagement),
                toggleItem("Analytics Panel", showAnalyticsPanel, onToggleAnalyticsPanel),
                toggleItem("User Trades", showUserTrades, onToggleUserTrades),
                toggleItem("Developer Tools", showDeveloperTools, onToggleDeveloperTools)
            )
        )
    );
};

export default ChartSettingsDropdown;
