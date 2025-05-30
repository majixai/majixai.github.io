// Assuming React is available globally e.g. via CDN
// import React from 'react'; // No longer needed if React is global
import { DUKE_BLUE, PANEL_BACKGROUND, BORDER_COLOR } from '../constants.js';

/**
 * @typedef {Object} PanelSectionProps
 * @property {string} title
 * @property {boolean} isVisible
 * @property {() => void} onToggle
 * @property {React.ReactNode} children
 * @property {React.ReactElement} [titleIcon]
 * @property {string} [contentClassName]
 */

/**
 * @param {PanelSectionProps} props
 * @returns {React.ReactElement}
 */
const PanelSection = ({
    title,
    isVisible,
    onToggle,
    children,
    titleIcon,
    contentClassName
}) => {
    // Check if React is available
    if (typeof React === 'undefined') {
        console.error("React is not loaded. PanelSection component cannot render.");
        // Fallback or error display if React is not loaded
        // This could be a simple div with an error message, or null
        // For now, let's return a basic div to avoid crashing if React is missing
        // and to make it obvious in the UI if there's an issue.
        const errorDiv = document.createElement('div');
        errorDiv.textContent = `Error: React not loaded. Cannot render PanelSection: ${title}`;
        errorDiv.style.color = 'red';
        errorDiv.style.border = '1px solid red';
        errorDiv.style.padding = '10px';
        // This direct DOM manipulation is a fallback. Ideally, React's absence should be handled at a higher level.
        // However, since we're converting a React component, returning a raw DOM element isn't standard.
        // A better pure JS fallback without React would be to not render anything or throw an error.
        // For the purpose of this refactoring, we will assume React IS loaded.
        // If it's not, the React.createElement calls below will fail.
    }
    
    const titleWithIcon = [];
    if (titleIcon && React.isValidElement(titleIcon)) {
        titleWithIcon.push(React.cloneElement(titleIcon, { className: `mr-2 w-5 h-5 text-[${DUKE_BLUE}]`, key: 'title-icon' }));
    }
    titleWithIcon.push(title);

    return React.createElement(
        'div',
        { style: { backgroundColor: PANEL_BACKGROUND, borderColor: BORDER_COLOR }, className: "shadow-xl rounded-xl mb-6" },
        React.createElement(
            'button',
            {
                onClick: onToggle,
                style: { color: DUKE_BLUE, backgroundColor: isVisible ? '#EBF5FF' : '#F9FAFB' },
                className: "w-full flex justify-between items-center p-4 text-left text-lg font-semibold rounded-t-xl focus:outline-none focus:ring-2 focus:ring-opacity-50",
                'aria-expanded': isVisible,
                'aria-controls': `panel-content-${title.replace(/\s+/g, '-')}`
            },
            React.createElement(
                'div',
                { className: "flex items-center" },
                ...titleWithIcon
            ),
            React.createElement(
                'span',
                { className: `transform transition-transform duration-300 ${isVisible ? 'rotate-180' : 'rotate-0'}` },
                React.createElement(
                    'svg',
                    { className: "w-6 h-6", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", xmlns: "http://www.w3.org/2000/svg" },
                    React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: "2", d: "M19 9l-7 7-7-7" })
                )
            )
        ),
        isVisible && React.createElement(
            'div',
            {
                id: `panel-content-${title.replace(/\s+/g, '-')}`,
                style: { borderColor: BORDER_COLOR },
                className: `p-4 sm:p-5 border-t bg-white rounded-b-xl ${contentClassName || ''} transition-all duration-500 ease-in-out max-h-[1000px] opacity-100 overflow-hidden`
            },
            children
        )
    );
};

export default PanelSection;
