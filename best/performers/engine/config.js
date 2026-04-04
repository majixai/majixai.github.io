/**
 * @file Configuration for the Enhanced Best Performers Engine.
 * @description Centralized configuration for API, filtering, ranking, and UI settings.
 */

const AppConfig = (() => {
    'use strict';

    // Database Configuration
    const _DB_NAME = 'BestPerformerDB';
    const _DB_VERSION = 6;  // Incremented for IMAGE_RECOGNITION_STORE
    const _PERFORMER_STORE = 'performers';
    const _SETTINGS_STORE = 'settings';
    const _SNIPPETS_STORE = 'snippets';
    const _RECORDINGS_STORE = 'recordings';
    const _ANALYTICS_STORE = 'analytics';  // New store for click and rating tracking
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
        viewers: 0.35,         // Higher viewers = higher score
        isNew: 0.1,            // New performers get a bonus
        age18Bonus: 0.1,       // Age 18 bonus
        recentlyViewed: 0.15,  // Recently viewed by user
        favorited: 0.15,       // Favorited performers
        imageRecognition: 0.15 // GPU image recognition relevance score
    };  // Total: 1.0

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

    // ML Image Recognition Configuration
    const _ML_CONFIG = {
        modelVersion: 2,          // MobileNet version (1 or 2)
        modelAlpha: 1.0,          // Model size multiplier (0.25, 0.5, 0.75, 1.0)
        topPredictions: 3,        // Number of top predictions to display
        confidenceThreshold: 5,   // Minimum confidence % to display
        analyzeInterval: 30000,   // Re-analyze visible images every 30 seconds
        enableIframeCapture: true, // Enable frame capture from iframes (if same-origin)
        backgroundAnalysisInterval: 60000, // Background GPU analysis every 60 seconds (1 minute)
        backgroundBatchSize: 10,  // Number of images to analyze per background cycle
        similarityThreshold: 0.5, // Minimum cosine similarity to consider relevant
        feedbackDecayFactor: 0.95, // Decay factor for feedback scores over time
        maxCachedResults: 500,    // Maximum cached recognition results
        weightPrecision: 4        // Decimal places for similarity award weights
    };

    // IndexedDB store for GPU image recognition results
    const _IMAGE_RECOGNITION_STORE = 'imageRecognition';

    // Shape Engine Configuration
    const _SHAPE_ENGINE_CONFIG = {
        shapesEnabled: false,
        mlShapesEnabled: false,
        performerMode: 'many',    // 'none', 'single', 'many'
        complexity: 3,            // 1-10, determines shape variety and count
        maxShapesPerOverlay: 20,
        shapeOpacity: 0.35,
        animateShapes: true,
        colorPalette: ['#ff6b35', '#00539B', '#28a745', '#dc3545', '#ffc107', '#9c27b0', '#00bcd4']
    };

    // User Label Categories for image annotation
    const _LABEL_CATEGORIES = Object.freeze([
        { id: 'bigbs', label: 'Big Bs', shortLabel: 'BB', color: '#e91e63' },
        { id: 'fmachine', label: 'F Machine', shortLabel: 'FM', color: '#9c27b0' },
        { id: 'multiperformers', label: 'Multi Performers', shortLabel: 'MP', color: '#3f51b5' },
        { id: 'nked', label: 'N*ked', shortLabel: 'NK', color: '#f44336' },
        { id: 'toy', label: 'Toy', shortLabel: 'TY', color: '#ff9800' },
        { id: 'solo', label: 'Solo', shortLabel: 'SO', color: '#4caf50' },
        { id: 'couple', label: 'Couple', shortLabel: 'CP', color: '#00bcd4' },
        { id: 'group', label: 'Group', shortLabel: 'GP', color: '#795548' },
        { id: 'lingerie', label: 'Lingerie', shortLabel: 'LG', color: '#e91e63' },
        { id: 'custom', label: 'Custom...', shortLabel: '??', color: '#607d8b' }
    ]);

    // IndexedDB store for labels
    const _LABELS_STORE = 'imageLabels';

    // Public interface
    const publicInterface = {
        // Database
        DB_NAME: _DB_NAME,
        DB_VERSION: _DB_VERSION,
        PERFORMER_STORE: _PERFORMER_STORE,
        SETTINGS_STORE: _SETTINGS_STORE,
        SNIPPETS_STORE: _SNIPPETS_STORE,
        RECORDINGS_STORE: _RECORDINGS_STORE,
        LABELS_STORE: _LABELS_STORE,
        ANALYTICS_STORE: _ANALYTICS_STORE,
        IMAGE_RECOGNITION_STORE: _IMAGE_RECOGNITION_STORE,
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

        // ML Configuration
        ML_CONFIG: Object.freeze({ ..._ML_CONFIG }),

        // Shape Engine Configuration
        SHAPE_ENGINE_CONFIG: Object.freeze({ ..._SHAPE_ENGINE_CONFIG }),

        // Label Categories
        LABEL_CATEGORIES: _LABEL_CATEGORIES,

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
            return `https://chaturbate.com/embed/${encodeURIComponent(username.trim())}/?tour=${_AFFILIATE_TOUR}&campaign=${_AFFILIATE_CAMPAIGN}&disable_sound=1&bgcolor=black`;
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

            // GPU image recognition relevance bonus (from background analysis)
            if (context.imageRecognitionScore != null) {
                score += Math.min(100, context.imageRecognitionScore) * weights.imageRecognition;
            }

            return Math.round(score);
        }
    };

    return Object.freeze(publicInterface);
})();