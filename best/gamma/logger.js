/**
 * Centralized logging utility with configurable log levels
 * and an in-memory ring buffer for recent log entries.
 */
class Logger {
    /** @enum {number} */
    static Levels = {
        DEBUG: 0,
        INFO: 1,
        WARN: 2,
        ERROR: 3
    };

    /** @type {string[]} */
    static #levelNames = ['DEBUG', 'INFO', 'WARN', 'ERROR'];

    /** @type {Function[]} Console methods indexed by level */
    static #consoleMethods = [console.debug, console.info, console.warn, console.error];

    #minLevel;
    #maxEntries;
    #logs;
    #head;
    #count;

    /**
     * @param {number} [minLevel=Logger.Levels.INFO] - Minimum log level to record.
     * @param {number} [maxEntries=200] - Maximum number of log entries kept in memory.
     */
    constructor(minLevel = Logger.Levels.INFO, maxEntries = 200) {
        this.#minLevel = minLevel;
        this.#maxEntries = maxEntries;
        this.#logs = new Array(maxEntries);
        this.#head = 0;
        this.#count = 0;
    }

    /**
     * Set the minimum log level. Messages below this level are ignored.
     * @param {number} level - One of Logger.Levels (DEBUG, INFO, WARN, ERROR).
     */
    setLevel(level) {
        if (level < Logger.Levels.DEBUG || level > Logger.Levels.ERROR) {
            console.warn(`Logger: Invalid log level "${level}". Level not changed.`);
            return;
        }
        this.#minLevel = level;
    }

    /**
     * Return a copy of all stored log entries in chronological order.
     * @returns {{ timestamp: string, level: string, message: string }[]}
     */
    getLogs() {
        if (this.#count === 0) return [];

        const result = [];
        // When the buffer has wrapped, #head points to the oldest entry;
        // otherwise entries start at index 0.
        const start = this.#count < this.#maxEntries
            ? 0
            : this.#head;

        for (let i = 0; i < this.#count; i++) {
            const index = (start + i) % this.#maxEntries;
            result.push(this.#logs[index]);
        }
        return result;
    }

    /** Clear all stored log entries. */
    clearLogs() {
        this.#logs = new Array(this.#maxEntries);
        this.#head = 0;
        this.#count = 0;
    }

    /**
     * Log a message at DEBUG level.
     * @param {string} message
     */
    debug(message) {
        this.#log(Logger.Levels.DEBUG, message);
    }

    /**
     * Log a message at INFO level.
     * @param {string} message
     */
    info(message) {
        this.#log(Logger.Levels.INFO, message);
    }

    /**
     * Log a message at WARN level.
     * @param {string} message
     */
    warn(message) {
        this.#log(Logger.Levels.WARN, message);
    }

    /**
     * Log a message at ERROR level.
     * @param {string} message
     */
    error(message) {
        this.#log(Logger.Levels.ERROR, message);
    }

    /**
     * Internal method that creates and stores a log entry if the level meets
     * the configured minimum, and forwards it to the browser console.
     * @param {number} level
     * @param {string} message
     */
    #log(level, message) {
        if (level < this.#minLevel) return;

        const entry = {
            timestamp: new Date().toISOString(),
            level: Logger.#levelNames[level],
            message: message
        };

        // Write into the ring buffer
        this.#logs[this.#head] = entry;
        this.#head = (this.#head + 1) % this.#maxEntries;
        if (this.#count < this.#maxEntries) this.#count++;

        // Mirror to the browser console
        Logger.#consoleMethods[level](`[${entry.timestamp}] [${entry.level}] ${entry.message}`);
    }
}

// The class is now defined. If not using ES modules, it will be available globally.
// window.Logger = Logger;
