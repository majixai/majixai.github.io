/**
 * Lightweight publish/subscribe event bus for decoupled
 * component communication.
 */
class EventBus {
    /** @type {Map<string, Set<Function>>} */
    #listeners;

    constructor() {
        this.#listeners = new Map();
    }

    /**
     * Register a listener for the given event.
     * @param {string} event - Event name.
     * @param {Function} callback - Function to invoke when the event fires.
     */
    on(event, callback) {
        if (typeof callback !== 'function') {
            console.warn(`EventBus: listener for "${event}" is not a function.`);
            return;
        }
        if (!this.#listeners.has(event)) {
            this.#listeners.set(event, new Set());
        }
        this.#listeners.get(event).add(callback);
    }

    /**
     * Remove a specific listener for the given event.
     * @param {string} event - Event name.
     * @param {Function} callback - The exact function reference passed to {@link on}.
     */
    off(event, callback) {
        const set = this.#listeners.get(event);
        if (!set) return;
        set.delete(callback);
        if (set.size === 0) this.#listeners.delete(event);
    }

    /**
     * Fire an event, invoking every registered listener with the supplied data.
     * @param {string} event - Event name.
     * @param {...*} data - Arguments forwarded to each listener.
     */
    emit(event, ...data) {
        const set = this.#listeners.get(event);
        if (!set) return;
        for (const cb of set) {
            try {
                cb(...data);
            } catch (err) {
                console.error(`EventBus: error in "${event}" listener:`, err);
            }
        }
    }

    /**
     * Register a one-time listener that automatically unregisters itself
     * after the first invocation.
     * @param {string} event - Event name.
     * @param {Function} callback - Function to invoke once.
     */
    once(event, callback) {
        const wrapper = (...data) => {
            this.off(event, wrapper);
            callback(...data);
        };
        this.on(event, wrapper);
    }
}

// The class is now defined. If not using ES modules, it will be available globally.
// window.EventBus = EventBus;
