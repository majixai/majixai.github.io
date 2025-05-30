// utils/validationUtils.js

/**
 * Checks if the provided ticker string is a potentially valid stock ticker symbol.
 * This is a basic check and might not cover all edge cases for all exchanges.
 * Allows 1-10 uppercase letters, numbers, dots, or hyphens.
 * @param {string} ticker The ticker string to validate.
 * @returns {boolean} True if the ticker seems valid, false otherwise.
 */
export const isValidTicker = (ticker) => {
  if (!ticker || typeof ticker !== 'string') return false;
  // Basic check: 1-10 chars, uppercase letters, numbers, '.', '-'
  // Examples: AAPL, BRK.A, GOOG, BF-B, CSL.AX
  return /^[A-Z0-9.-]{1,10}$/.test(ticker.toUpperCase());
};
