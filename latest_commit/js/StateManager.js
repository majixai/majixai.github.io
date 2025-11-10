/**
 * @typedef {object} AppState
 * @property {Array<Commit>} commits
 * @property {boolean} isLoading
 * @property {string|null} error
 * @property {string} searchQuery
 */

/**
 * A singleton class for managing the application's central state.
 * Implements a publisher/subscriber pattern to notify components of state changes.
 */
class StateManager {
    /** @type {StateManager} */
    static #instance;

    /** @type {AppState} */
    #state = {
        commits: [],
        isLoading: true,
        error: null,
        searchQuery: '',
    };

    /** @type {Array<Function>} */
    #subscribers = [];

    /**
     * The constructor is private to enforce the singleton pattern.
     */
    constructor() {
        if (StateManager.#instance) {
            return StateManager.#instance;
        }
        StateManager.#instance = this;
    }

    /**
     * Returns the singleton instance of the StateManager.
     * @returns {StateManager} The singleton instance.
     */
    static getInstance() {
        if (!StateManager.#instance) {
            StateManager.#instance = new StateManager();
        }
        return StateManager.#instance;
    }

    /**
     * Returns the current state.
     * @returns {AppState} The current application state.
     */
    getState() {
        return this.#state;
    }

    /**
     * Returns a filtered list of commits based on the current search query.
     * @returns {Array<Commit>} The filtered list of commits.
     */
    getFilteredCommits() {
        const { commits, searchQuery } = this.#state;
        if (!searchQuery) {
            return commits;
        }
        return commits.filter(commit =>
            commit.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            commit.author.name.toLowerCase().includes(searchQuery.toLowerCase())
        );
    }

    /**
     * Updates the state and notifies all subscribers.
     * @param {Partial<AppState>} newState - An object with the new state values.
     */
    setState(newState) {
        this.#state = { ...this.#state, ...newState };
        this.#notify();
    }

    /**
     * Adds a listener function to be called on state changes.
     * @param {Function} callback - The function to call when the state changes.
     */
    subscribe(callback) {
        this.#subscribers.push(callback);
    }

    /**
     * Removes a listener function.
     * @param {Function} callback - The listener function to remove.
     */
    unsubscribe(callback) {
        this.#subscribers = this.#subscribers.filter(sub => sub !== callback);
    }

    /**
     * Notifies all subscribers of a state change.
     * @private
     */
    #notify() {
        this.#subscribers.forEach(callback => callback(this.#state));
    }
}
