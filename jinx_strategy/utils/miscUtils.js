// utils/miscUtils.js

/**
 * @returns {string}
 */
export const generateUniqueId = () => `leg_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;

/**
 * @param {number} [timestamp]
 * @returns {string}
 */
export const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
};

/**
 * @param {number | null} [price]
 * @returns {string}
 */
export const formatPrice = (price) => {
    if (price === null || price === undefined) return 'N/A';
    return `$${price.toFixed(2)}`;
};

// Add other miscellaneous utility functions here as needed.
