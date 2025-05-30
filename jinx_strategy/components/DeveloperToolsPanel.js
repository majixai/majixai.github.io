// Assuming React is available globally e.g. via CDN
// Types are for JSDoc
// import { GroundingSource, AppDBState } from '../types.js';

/**
 * @typedef {import('../types.js').GroundingSource} GroundingSource
 * @typedef {import('../types.js').AppDBState} AppDBState
 */

/**
 * @typedef {Object} DeveloperToolsPanelProps
 * @property {boolean} showAIDataProvenance
 * @property {(checked: boolean) => void} onToggleAIDataProvenance
 * @property {GroundingSource[]} allAccumulatedAISources
 * @property {AppDBState['aiCallDurations']} aiCallDurations
 * @property {boolean} anyAppLoading
 */

/**
 * @param {DeveloperToolsPanelProps} props
 * @returns {React.ReactElement}
 */
const DeveloperToolsPanel = ({
    showAIDataProvenance, onToggleAIDataProvenance, allAccumulatedAISources,
    aiCallDurations, anyAppLoading
}) => {
    if (typeof React === 'undefined') {
        console.error("React is not loaded. DeveloperToolsPanel component cannot render.");
        return null;
    }

    const provenanceSection = showAIDataProvenance
        ? React.createElement(
            React.Fragment,
            { key: "provenance-section" },
            React.createElement(
                'h4',
                { className: "text-md font-semibold text-[#00539B] mt-4 mb-2" },
                `All Accumulated AI Sources (${allAccumulatedAISources.length})`
            ),
            allAccumulatedAISources.length > 0
                ? React.createElement(
                    'div',
                    { className: "max-h-48 overflow-y-auto bg-blue-50 border border-blue-200 p-2 rounded text-xs text-blue-800" },
                    allAccumulatedAISources.map((source, idx) => React.createElement(
                        'p',
                        { key: idx, className: "truncate" },
                        React.createElement(
                            'a',
                            { href: source.uri, target: "_blank", rel: "noopener noreferrer", title: source.title, className: "hover:underline" },
                            `${idx + 1}. ${source.title || new URL(source.uri).hostname}`
                        )
                    ))
                  )
                : React.createElement('p', { className: "text-xs text-gray-500" }, "No AI sources accumulated yet.")
          )
        : null;

    const durationsSection = React.createElement(
        React.Fragment,
        { key: "durations-section" },
        React.createElement(
            'h4',
            { className: "text-md font-semibold text-[#00539B] mt-4 mb-2" },
            "AI Call Durations (ms)"
        ),
        aiCallDurations && Object.keys(aiCallDurations).length > 0
            ? React.createElement(
                'pre',
                { className: "text-xs bg-gray-100 p-2 rounded max-h-32 overflow-y-auto" },
                JSON.stringify(aiCallDurations, null, 2)
              )
            : React.createElement('p', { className: "text-xs text-gray-500" }, "No AI call durations recorded yet.")
    );

    return React.createElement(
        React.Fragment,
        null,
        React.createElement('h3', { className: "text-lg font-semibold text-[#00407A] mb-3" }, "Developer Information"),
        React.createElement(
            'div',
            { className: "flex items-center mb-3" },
            React.createElement('input', {
                type: "checkbox",
                id: "showAIDataProvenance",
                checked: showAIDataProvenance,
                onChange: e => onToggleAIDataProvenance(e.target.checked),
                className: "h-4 w-4 text-[#00539B] border-[#D1D5DB] rounded focus:ring-[#00539B]",
                disabled: anyAppLoading
            }),
            React.createElement(
                'label',
                { htmlFor: "showAIDataProvenance", className: "ml-2 block text-sm text-[#333333]" },
                "Show AI Data Provenance (Accumulated Sources)"
            )
        ),
        provenanceSection,
        durationsSection
    );
};

export default DeveloperToolsPanel;
