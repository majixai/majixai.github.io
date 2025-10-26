// A simple logger utility

/**
 * A decorator function for logging the execution time of a method.
 * @param {Function} fn - The function to decorate.
 * @param {string} name - The name of the function for logging.
 * @returns {Function}
 */
export function timingDecorator(fn, name) {
    return async function(...args) {
        const start = performance.now();
        log(`[${name}] starting...`);
        const result = await fn.apply(this, args);
        const end = performance.now();
        log(`[${name}] finished in ${(end - start).toFixed(2)}ms.`);
        return result;
    };
}

/**
 * Logs a message to the console with a timestamp.
 * @param {string} message
 */
export function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}
