// Assuming React is available globally e.g. via CDN

/**
 * @typedef {Object} GeneralStatusMessage
 * @property {string} text
 * @property {'info' | 'success' | 'warning' | 'error'} type
 * @property {number} key
 */

/**
 * @typedef {Object} StatusTabContentProps
 * @property {GeneralStatusMessage | null} generalStatusMessage
 * @property {() => void} onCloseGeneralStatus
 * @property {boolean} isLoading // To show loading spinner with info messages
 */

/**
 * @param {StatusTabContentProps} props
 * @returns {React.ReactElement}
 */
const StatusTabContent = ({ generalStatusMessage, onCloseGeneralStatus, isLoading }) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. StatusTabContent component cannot render.");
        return null; 
    }

    if (!generalStatusMessage) {
        return React.createElement('p', { className: "p-4 text-sm text-gray-500" }, "No current status messages.");
    }

    let bgColorClass = '';
    let borderColorClass = '';
    let textColorClass = '';

    switch (generalStatusMessage.type) {
        case 'success':
            bgColorClass = 'bg-green-100';
            borderColorClass = 'border-green-300';
            textColorClass = 'text-green-700';
            break;
        case 'info':
            bgColorClass = 'bg-blue-100';
            borderColorClass = 'border-blue-300';
            textColorClass = 'text-blue-700';
            break;
        case 'warning':
            bgColorClass = 'bg-yellow-100';
            borderColorClass = 'border-yellow-300';
            textColorClass = 'text-yellow-700';
            break;
        case 'error':
            bgColorClass = 'bg-red-100';
            borderColorClass = 'border-red-300';
            textColorClass = 'text-red-700';
            break;
    }

    return React.createElement(
        'div',
        {
            className: `p-3 text-sm opacity-100 translate-y-0 ${bgColorClass} ${borderColorClass} ${textColorClass} border rounded-b-md`,
            role: "alert"
        },
        React.createElement(
            'div',
            { className: "flex items-start" },
            React.createElement('span', { className: `flex-grow whitespace-pre-wrap` }, generalStatusMessage.text),
            isLoading && generalStatusMessage.type === 'info' && React.createElement(
                'span',
                { className: "animate-spin rounded-full h-4 w-4 border-b-2 border-current inline-block ml-2 flex-shrink-0" }
            ),
            React.createElement(
                'button',
                {
                    onClick: onCloseGeneralStatus,
                    className: "ml-3 font-bold hover:text-opacity-70 transition-opacity flex-shrink-0",
                    'aria-label': "Close status message"
                },
                "X"
            )
        )
    );
};

export default StatusTabContent;
