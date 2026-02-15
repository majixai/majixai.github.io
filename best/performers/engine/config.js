/**
 * @file Configuration for the Enhanced Best Performers Engine.
 * @description Centralized configuration for API, filtering, ranking, and UI settings.
 */

const AppConfig = (() => {
    'use strict';

    // Database Configuration
    const _DB_NAME = 'BestPerformerDB';
    const _DB_VERSION = 3;
    const _PERFORMER_STORE = 'performers';
    const _SETTINGS_STORE = 'settings';
    const _SNIPPETS_STORE = 'snippets';
    const _RECORDINGS_STORE = 'recordings';
    const _DATA_PATH = '../'; // Relative path to the .dat files

    // API Configuration
    const _AFFILIATE_TOUR = 'dU9X';
    const _AFFILIATE_CAMPAIGN = '9cg6A';
    const _API_URL_BASE = `https://chaturbate.com/api/public/affiliates/onlinerooms/?tour=${_AFFILIATE_TOUR}&wm=${_AFFILIATE_CAMPAIGN}&disable_sound=1&client_ip=request_ip`;
    const _API_LIMIT = 500;
    const _API_TIMEOUT = 25000;
    const _MAX_API_FETCH_LIMIT = 5000;
    const _FETCH_INTERVAL = 120000; // 2 minutes

    // Data files to fetch for cached/favorite performers
    const _DAT_FILES = [
        'all_performers_v3.dat',
        'favorite_performers.dat',
        'history_performers.dat',
        'performers_cache.dat',
        'performers_cache_v2.dat',
        'selected_performers_usernames.dat'
    ];

    // UI Configuration
    const _MAX_IFRAMES = 9;
    const _DEFAULT_LAYOUT = 4;
    const _PERFORMERS_PER_PAGE = 50;
    const _MAX_PERFORMERS_DISPLAY = 1000; // Maximum performers to keep in memory for performance

    // Ranking Weights (used for calculating rank score)
    const _RANKING_WEIGHTS = {
        viewers: 0.4,      // Higher viewers = higher score
        isNew: 0.15,       // New performers get a bonus
        age18Bonus: 0.1,   // Age 18 bonus
        recentlyViewed: 0.15, // Recently viewed by user
        favorited: 0.2     // Favorited performers
    };

    // Default Filter Settings
    const _DEFAULT_FILTERS = {
        gender: 'f',
        ageMin: 18,
        ageMax: 99,
        tags: [],
        sortBy: 'viewers_desc',
        onlyPublic: true // Only show performers in public shows
    };

    // Logging Service (for analytics)
    const _LOGGING_SERVICE_URL = 'https://script.google.com/macros/s/AKfycbzr5jBpyz_6w94lOZotEoYpVa9kDY603A_6QAB4FLRSnI5GDlgzfRb8FOCR8uTdoGGc/exec';

    // Public interface
    const publicInterface = {
        // Database
        DB_NAME: _DB_NAME,
        DB_VERSION: _DB_VERSION,
        PERFORMER_STORE: _PERFORMER_STORE,
        SETTINGS_STORE: _SETTINGS_STORE,
        SNIPPETS_STORE: _SNIPPETS_STORE,
        RECORDINGS_STORE: _RECORDINGS_STORE,
        DATA_PATH: _DATA_PATH,
        DAT_FILES: Object.freeze([..._DAT_FILES]),

        // API
        API_URL_BASE: _API_URL_BASE,
        API_LIMIT: _API_LIMIT,
        API_TIMEOUT: _API_TIMEOUT,
        MAX_API_FETCH_LIMIT: _MAX_API_FETCH_LIMIT,
        FETCH_INTERVAL: _FETCH_INTERVAL,

        // UI
        MAX_IFRAMES: _MAX_IFRAMES,
        DEFAULT_LAYOUT: _DEFAULT_LAYOUT,
        PERFORMERS_PER_PAGE: _PERFORMERS_PER_PAGE,
        MAX_PERFORMERS_DISPLAY: _MAX_PERFORMERS_DISPLAY,

        // Ranking
        RANKING_WEIGHTS: Object.freeze({ ..._RANKING_WEIGHTS }),

        // Filters
        DEFAULT_FILTERS: Object.freeze({ ..._DEFAULT_FILTERS }),

        // Analytics
        LOGGING_SERVICE_URL: _LOGGING_SERVICE_URL,

        /**
         * Build API URL with parameters
         * @param {Object} params - Filter parameters
         * @returns {string} Full API URL
         */
        buildApiUrl(params = {}) {
            let url = _API_URL_BASE;
            if (params.gender) url += `&gender=${params.gender}`;
            if (params.limit) url += `&limit=${params.limit}`;
            if (params.offset) url += `&offset=${params.offset}`;
            return url;
        },

        /**
         * Build iframe embed URL for a performer
         * @param {string} username - Performer username
         * @returns {string} Iframe embed URL, or empty string if username is invalid
         */
        buildIframeUrl(username) {
            if (!username || typeof username !== 'string' || !username.trim()) {
                return '';
            }
            return `https://chaturbate.com/fullvideo/?campaign=${_AFFILIATE_CAMPAIGN}&disable_sound=1&b=${encodeURIComponent(username.trim())}&tour=${_AFFILIATE_TOUR}`;
        },

        /**
         * Calculate ranking score for a performer
         * @param {Object} performer - Performer data
         * @param {Object} context - Context data (favorites, history, etc.)
         * @returns {number} Ranking score (0-100)
         */
        calculateRankScore(performer, context = {}) {
            let score = 0;
            const weights = _RANKING_WEIGHTS;

            // Viewer count score (normalized to 0-100)
            const viewerScore = Math.min(100, (performer.num_viewers || 0) / 50);
            score += viewerScore * weights.viewers;

            // New performer bonus
            if (performer.is_new) {
                score += 100 * weights.isNew;
            }

            // Age 18 bonus
            if (performer.age === 18) {
                score += 100 * weights.age18Bonus;
            }

            // Recently viewed bonus
            if (context.recentlyViewed && context.recentlyViewed.has(performer.username)) {
                score += 100 * weights.recentlyViewed;
            }

            // Favorited bonus
            if (context.favorites && context.favorites.has(performer.username)) {
                score += 100 * weights.favorited;
            }

            return Math.round(score);
        }
    };

    return Object.freeze(publicInterface);
})();