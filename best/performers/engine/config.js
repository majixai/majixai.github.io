/**
 * @file Configuration for the PerformerEngine.
 * @author Jules
 */

// Using an IIFE to create a global configuration object
// This avoids polluting the global scope and provides a clear namespace
const AppConfig = (() => {
    'use strict';

    // Private static members (conventionally prefixed with an underscore)
    const _DB_NAME = 'PerformerDB';
    const _DB_VERSION = 1;
    const _PERFORMER_STORE = 'performers';
    const _SETTINGS_STORE = 'settings';
    const _DATA_PATH = '../'; // Relative path to the .dat files

    // A list of performer data files to be fetched and processed.
    // This demonstrates a simple, centralized way to manage data sources.
    const _DAT_FILES = [
        'all_performers_v3.dat',
        'favorite_performers.dat',
        'history_performers.dat',
        'performers_cache.dat',
        'performers_cache_v2.dat',
        'selected_performers_usernames.dat'
    ];

    // Public interface of the configuration module
    // This exposes the configuration properties in a read-only manner.
    const publicInterface = {
        DB_NAME: _DB_NAME,
        DB_VERSION: _DB_VERSION,
        PERFORMER_STORE: _PERFORMER_STORE,
        SETTINGS_STORE: _SETTINGS_STORE,
        DATA_PATH: _DATA_PATH,
        DAT_FILES: Object.freeze([..._DAT_FILES]) // Expose a frozen, immutable copy
    };

    return Object.freeze(publicInterface);
})();