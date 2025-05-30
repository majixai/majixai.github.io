// Assuming React is available globally e.g. via CDN
import { PANEL_BACKGROUND, BORDER_COLOR, DUKE_BLUE, TEXT_COLOR_SECONDARY, TEXT_COLOR_PRIMARY } from '../constants.js';

/**
 * @typedef {Object} ReasoningModalInfo
 * @property {string} title
 * @property {string} reasoning
 */

/**
 * @typedef {Object} ReasoningModalProps
 * @property {ReasoningModalInfo | null} info
 * @property {() => void} onClose
 */

/**
 * @param {ReasoningModalProps} props
 * @returns {React.ReactElement | null}
 */
const ReasoningModal = ({ info, onClose }) => {
  if (!info) return null;

  // Ensure React is available
  if (typeof React === 'undefined') {
    console.error("React is not loaded. ReasoningModal component cannot render.");
    // In a real app, you might have a more sophisticated way to handle this,
    // like a global error boundary or a fallback UI. For now, returning null.
    return null; 
  }

  return React.createElement(
    'div',
    { className: "fixed inset-0 bg-black bg-opacity-75 backdrop-blur-sm flex justify-center items-center z-[60] p-4" },
    React.createElement(
      'div',
      { style: { backgroundColor: PANEL_BACKGROUND }, className: "rounded-lg shadow-xl w-full max-w-lg max-h-[80vh] flex flex-col" },
      React.createElement(
        'div',
        { style: { borderColor: BORDER_COLOR }, className: "flex justify-between items-center p-4 border-b" },
        React.createElement(
          'h3',
          { style: { color: DUKE_BLUE }, className: "text-lg font-semibold truncate" },
          info.title
        ),
        React.createElement(
          'button',
          { onClick: onClose, style: { color: TEXT_COLOR_SECONDARY }, className: "hover:text-red-600 p-1 rounded-full" },
          React.createElement(
            'svg',
            { xmlns: "http://www.w3.org/2000/svg", className: "h-6 w-6", fill: "none", viewBox: "0 0 24 24", stroke: "currentColor" },
            React.createElement('path', { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M6 18L18 6M6 6l12 12" })
          )
        )
      ),
      React.createElement(
        'div',
        { className: "p-4 overflow-y-auto" },
        React.createElement(
          'p',
          { style: { color: TEXT_COLOR_PRIMARY }, className: "text-sm whitespace-pre-wrap" },
          info.reasoning
        )
      ),
      React.createElement(
        'div',
        { style: { borderColor: BORDER_COLOR }, className: "p-3 border-t flex justify-end" },
        React.createElement(
          'button',
          {
            onClick: onClose,
            style: { backgroundColor: DUKE_BLUE },
            className: "hover:opacity-90 text-white font-semibold py-2 px-4 rounded-md shadow-sm"
          },
          "Close"
        )
      )
    )
  );
};

export default ReasoningModal;
