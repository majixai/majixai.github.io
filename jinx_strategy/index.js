// Assuming React and ReactDOM are available globally e.g. via CDN
// import React from 'react'; // No longer needed if React is global
// import ReactDOM from 'react-dom/client'; // No longer needed if ReactDOM is global

import { App } from './App.js'; // Ensure .js extension

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Ensure ReactDOM is available
if (typeof ReactDOM === 'undefined' || typeof ReactDOM.createRoot === 'undefined') {
    console.error("ReactDOM or ReactDOM.createRoot is not loaded. The application cannot start.");
    // Fallback or error display
    rootElement.innerHTML = '<div style="color: red; padding: 20px; text-align: center; font-family: sans-serif;">Error: ReactDOM library not loaded. Application cannot start. Please check your script tags.</div>';
} else {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(App, null)
      )
    );
}
