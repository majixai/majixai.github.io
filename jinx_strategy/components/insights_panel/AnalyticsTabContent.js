// Assuming React is available globally e.g. via CDN
import { ClipboardIcon } from '../../constants.js'; // Assuming .js extension

/**
 * @typedef {Object} AnalyticsTabContentProps
 * @property {string[]} allLoggedErrors
 * @property {() => Promise<void>} onCopyErrorsToClipboard
 * @property {boolean} anyAppLoading // To disable copy button during other operations
 */

/**
 * @param {AnalyticsTabContentProps} props
 * @returns {React.ReactElement}
 */
const AnalyticsTabContent = ({
    allLoggedErrors,
    onCopyErrorsToClipboard,
    anyAppLoading
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. AnalyticsTabContent component cannot render.");
        return null;
    }

    const errorLogElements = allLoggedErrors.length > 0
        ? [
            React.createElement(
                'div',
                { key: 'error-log-container', className: "max-h-60 overflow-y-auto bg-red-50 border border-red-200 p-3 rounded-md text-xs text-red-800 mb-2 shadow-sm" },
                allLoggedErrors.map((err, idx) =>
                    React.createElement(
                        'p',
                        { key: idx, className: "mb-1 pb-1 border-b border-red-100 last:border-b-0 last:pb-0 last:mb-0 break-words" },
                        err
                    )
                )
            ),
            React.createElement(
                'button',
                {
                    key: 'copy-errors-btn',
                    onClick: onCopyErrorsToClipboard,
                    disabled: anyAppLoading,
                    className: "flex items-center bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-medium py-1.5 px-3 rounded-md shadow-sm disabled:opacity-50 transition-colors"
                },
                React.createElement(ClipboardIcon, { className: "mr-1.5" }),
                " Copy All Errors to Clipboard"
            )
          ]
        : [React.createElement('p', { key: 'no-errors', className: "text-sm text-gray-500" }, "No errors logged yet. Great!")];


    return React.createElement(
        'div',
        { className: "p-4 space-y-4 max-h-96 overflow-y-auto" },
        React.createElement(
            'div',
            null,
            React.createElement(
                'h3',
                { className: "text-md font-semibold text-slate-700 mb-2" },
                `Application Error Log (${allLoggedErrors.length})`
            ),
            ...errorLogElements
        )
        // Placeholder for future analytics - not implemented yet
        // React.createElement('div', null,
        //  React.createElement('h3', {className: "text-md font-semibold text-slate-700 mb-2"}, "User Flow Analytics (Placeholder)"),
        //  React.createElement('p', {className: "text-sm text-gray-500"}, "User action tracking and flow visualization would appear here.")
        // )
    );
};

export default AnalyticsTabContent;
