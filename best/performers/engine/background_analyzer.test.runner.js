/**
 * @file Tests for BackgroundImageAnalyzer and GPU recognition config changes.
 * @description Unit tests for background image analysis, feedback loops, and relevance scoring.
 * Usage: node best/performers/engine/background_analyzer.test.runner.js
 */

const vm = require('vm');
const fs = require('fs');
const path = require('path');

// Read source files
const configCode = fs.readFileSync(path.join(__dirname, 'config.js'), 'utf8');
const uiCode = fs.readFileSync(path.join(__dirname, 'ui.js'), 'utf8');

// --- Minimal Test Framework ---
const TestSuite = {
    tests: [],
    totalTests: 0,
    passed: 0,
    failed: 0,
    currentGroup: '',

    group(name, fn) {
        this.currentGroup = name;
        console.log(`%c--- Test Group: ${name} ---`, 'color: blue; font-weight: bold;');
        fn();
        this.currentGroup = '';
    },

    test(name, fn) {
        this.totalTests++;
        const fullName = this.currentGroup ? `${this.currentGroup} > ${name}` : name;
        try {
            fn();
            console.log(`%c  [PASS] ${fullName}`, 'color: green;');
            this.passed++;
        } catch (e) {
            console.error(`%c  [FAIL] ${fullName}`, 'color: red;');
            console.error(e);
            this.failed++;
        }
    },

    assertEquals(expected, actual, message = 'assertEquals') {
        if (expected !== actual) {
            throw new Error(`${message}: Expected "${expected}" but got "${actual}"`);
        }
    },

    assertTrue(condition, message = 'assertTrue') {
        if (!condition) {
            throw new Error(`${message}: Expected true but got false`);
        }
    },

    assertFalse(condition, message = 'assertFalse') {
        if (condition) {
            throw new Error(`${message}: Expected false but got true`);
        }
    },

    summary() {
        console.log('\n========== Test Summary ==========');
        console.log(`  Total: ${this.totalTests}`);
        console.log(`  Passed: ${this.passed}`);
        console.log(`  Failed: ${this.failed}`);
        console.log('==================================');
        if (this.failed > 0) process.exitCode = 1;
    }
};

// --- Mock CacheManager ---
const recognitionStore = new Map();
const MockCacheManager = {
    saveRecognitionResult: async (result) => {
        recognitionStore.set(result.username, { ...result });
    },
    getRecognitionResult: async (username) => {
        return recognitionStore.get(username) || null;
    },
    getAllRecognitionResults: async (limit = 100) => {
        const results = Array.from(recognitionStore.values());
        results.sort((a, b) => (b.feedbackScore || 0) - (a.feedbackScore || 0));
        return results.slice(0, limit);
    },
    updateRecognitionFeedback: async (username, scoreDelta) => {
        const existing = recognitionStore.get(username);
        if (existing) {
            existing.feedbackScore = (existing.feedbackScore || 0) + scoreDelta;
            recognitionStore.set(username, existing);
        }
    },
    pruneRecognitionResults: async (maxEntries) => {
        if (recognitionStore.size <= maxEntries) return 0;
        const sorted = Array.from(recognitionStore.entries())
            .sort((a, b) => a[1].analyzedAt - b[1].analyzedAt);
        const toDelete = recognitionStore.size - maxEntries;
        for (let i = 0; i < toDelete; i++) {
            recognitionStore.delete(sorted[i][0]);
        }
        return toDelete;
    }
};

// --- Mock DOM/browser APIs ---
function createMockElement(tag = 'div') {
    const children = [];
    const dataset = {};
    const style = {};

    return {
        tagName: tag.toUpperCase(),
        style,
        dataset,
        children,
        childNodes: children,
        className: '',
        textContent: '',
        parentNode: null,
        querySelector: () => null,
        querySelectorAll: () => [],
        appendChild: (child) => { children.push(child); return child; },
        removeChild: (child) => { const idx = children.indexOf(child); if (idx > -1) children.splice(idx, 1); return child; },
        addEventListener: () => {},
        getBoundingClientRect: () => ({ width: 200, height: 150, top: 0, left: 0, right: 200, bottom: 150 }),
        set innerHTML(html) { children.length = 0; },
        get innerHTML() { return ''; }
    };
}

// Create sandbox
const sandbox = vm.createContext({
    console,
    window: {
        getComputedStyle: () => ({ position: 'relative' }),
        location: { href: 'http://localhost' }
    },
    document: {
        createElement: (tag) => createMockElement(tag),
        body: createMockElement('body'),
        querySelector: () => null,
        querySelectorAll: () => [],
        addEventListener: () => {},
        referrer: ''
    },
    navigator: {
        userAgent: 'test',
        sendBeacon: () => true
    },
    indexedDB: null,
    fetch: async () => ({ ok: false }),
    pako: { inflate: () => '' },
    requestAnimationFrame: (cb) => { setTimeout(cb, 0); return 1; },
    cancelAnimationFrame: () => {},
    performance: { now: () => Date.now() },
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
    Math,
    Object,
    Map,
    Set,
    Array,
    JSON,
    parseInt,
    parseFloat,
    Boolean,
    String,
    Number,
    Error,
    Promise,
    Date,
    Image: function() { this.crossOrigin = ''; this.src = ''; this.onload = null; this.onerror = null; },
    process: { exit: (code) => { process.exitCode = code; } },
    CacheManager: MockCacheManager
});

// Load config (provides AppConfig)
vm.runInContext(configCode + '\nthis.AppConfig = AppConfig;', sandbox);

// Extract only the BackgroundImageAnalyzer class from ui.js
// We need to skip UIManager which has DOM dependencies
const bgAnalyzerCode = uiCode.substring(uiCode.indexOf('/**\n * @class BackgroundImageAnalyzer'));
vm.runInContext(bgAnalyzerCode + '\nthis.BackgroundImageAnalyzer = BackgroundImageAnalyzer;', sandbox);

// --- Tests ---
const testCode = `
(function() {
    const T = ${JSON.stringify(null)};

    // ==================== Config Tests ====================
    
    TestSuite.group('AppConfig ML_CONFIG', () => {
        TestSuite.test('has backgroundAnalysisInterval set to 60000ms', () => {
            TestSuite.assertEquals(60000, AppConfig.ML_CONFIG.backgroundAnalysisInterval);
        });

        TestSuite.test('has backgroundBatchSize set to 10', () => {
            TestSuite.assertEquals(10, AppConfig.ML_CONFIG.backgroundBatchSize);
        });

        TestSuite.test('has similarityThreshold', () => {
            TestSuite.assertEquals(0.5, AppConfig.ML_CONFIG.similarityThreshold);
        });

        TestSuite.test('has feedbackDecayFactor', () => {
            TestSuite.assertEquals(0.95, AppConfig.ML_CONFIG.feedbackDecayFactor);
        });

        TestSuite.test('has maxCachedResults', () => {
            TestSuite.assertEquals(500, AppConfig.ML_CONFIG.maxCachedResults);
        });
    });

    TestSuite.group('AppConfig IMAGE_RECOGNITION_STORE', () => {
        TestSuite.test('IMAGE_RECOGNITION_STORE is defined', () => {
            TestSuite.assertEquals('imageRecognition', AppConfig.IMAGE_RECOGNITION_STORE);
        });
    });

    TestSuite.group('AppConfig RANKING_WEIGHTS', () => {
        TestSuite.test('includes imageRecognition weight', () => {
            TestSuite.assertEquals(0.15, AppConfig.RANKING_WEIGHTS.imageRecognition);
        });

        TestSuite.test('all weights sum to approximately 1.0', () => {
            const weights = AppConfig.RANKING_WEIGHTS;
            const sum = weights.viewers + weights.isNew + weights.age18Bonus + 
                        weights.recentlyViewed + weights.favorited + weights.imageRecognition;
            TestSuite.assertTrue(Math.abs(sum - 1.0) < 0.01, 'Weights should sum to 1.0, got ' + sum);
        });
    });

    TestSuite.group('AppConfig calculateRankScore with imageRecognition', () => {
        TestSuite.test('includes image recognition score in ranking', () => {
            const performer = { num_viewers: 100, is_new: false, age: 25, username: 'test' };
            const context = { imageRecognitionScore: 80 };
            const score = AppConfig.calculateRankScore(performer, context);
            TestSuite.assertTrue(score > 0, 'Score should be positive');
            
            // Compare with no recognition context
            const scoreWithout = AppConfig.calculateRankScore(performer, {});
            TestSuite.assertTrue(score > scoreWithout, 'Score with recognition should be higher');
        });

        TestSuite.test('handles null imageRecognitionScore gracefully', () => {
            const performer = { num_viewers: 50, username: 'test2' };
            const score = AppConfig.calculateRankScore(performer, { imageRecognitionScore: null });
            TestSuite.assertTrue(score >= 0, 'Score should be non-negative');
        });
    });

    // ==================== BackgroundImageAnalyzer Tests ====================

    TestSuite.group('BackgroundImageAnalyzer Constructor', () => {
        TestSuite.test('creates instance with default options', () => {
            const analyzer = new BackgroundImageAnalyzer();
            TestSuite.assertFalse(analyzer.isActive, 'Should not be active initially');
            TestSuite.assertEquals(0, analyzer.analysisCount, 'Should have 0 analysis count');
        });

        TestSuite.test('accepts onResults callback', () => {
            let called = false;
            const analyzer = new BackgroundImageAnalyzer({ onResults: () => { called = true; } });
            TestSuite.assertFalse(analyzer.isActive);
        });
    });

    TestSuite.group('BackgroundImageAnalyzer start/stop', () => {
        TestSuite.test('start activates the analyzer', () => {
            const analyzer = new BackgroundImageAnalyzer();
            analyzer.start();
            TestSuite.assertTrue(analyzer.isActive, 'Should be active after start');
            analyzer.stop();
        });

        TestSuite.test('stop deactivates the analyzer', () => {
            const analyzer = new BackgroundImageAnalyzer();
            analyzer.start();
            analyzer.stop();
            TestSuite.assertFalse(analyzer.isActive, 'Should not be active after stop');
        });

        TestSuite.test('multiple starts do not create multiple intervals', () => {
            const analyzer = new BackgroundImageAnalyzer();
            analyzer.start();
            analyzer.start(); // Should not create a second interval
            TestSuite.assertTrue(analyzer.isActive);
            analyzer.stop();
        });
    });

    TestSuite.group('BackgroundImageAnalyzer setModel', () => {
        TestSuite.test('accepts a model reference', () => {
            const analyzer = new BackgroundImageAnalyzer();
            const mockModel = { infer: () => {}, classify: () => {} };
            analyzer.setModel(mockModel);
            // Should not throw
            TestSuite.assertTrue(true);
        });
    });

    TestSuite.group('BackgroundImageAnalyzer feedback loop', () => {
        TestSuite.test('recordFeedback updates feedback score in store', async () => {
            // Seed a recognition result
            await CacheManager.saveRecognitionResult({
                username: 'testuser',
                predictions: [],
                featureVector: null,
                analyzedAt: Date.now(),
                feedbackScore: 0,
                imageUrl: 'http://example.com/img.jpg'
            });

            const analyzer = new BackgroundImageAnalyzer();
            await analyzer.recordFeedback('testuser', 5);

            const result = await CacheManager.getRecognitionResult('testuser');
            TestSuite.assertEquals(5, result.feedbackScore, 'Feedback score should be 5');
        });

        TestSuite.test('recordFeedback accumulates', async () => {
            await CacheManager.saveRecognitionResult({
                username: 'testuser2',
                predictions: [],
                featureVector: null,
                analyzedAt: Date.now(),
                feedbackScore: 10,
                imageUrl: ''
            });

            const analyzer = new BackgroundImageAnalyzer();
            await analyzer.recordFeedback('testuser2', 3);
            await analyzer.recordFeedback('testuser2', 2);

            const result = await CacheManager.getRecognitionResult('testuser2');
            TestSuite.assertEquals(15, result.feedbackScore, 'Feedback score should be 15');
        });

        TestSuite.test('recordFeedback silently ignores unknown users', async () => {
            const analyzer = new BackgroundImageAnalyzer();
            await analyzer.recordFeedback('nonexistent', 10);
            // Should not throw
            TestSuite.assertTrue(true);
        });
    });

    TestSuite.group('BackgroundImageAnalyzer relevance scoring', () => {
        TestSuite.test('getRelevanceScore returns 0 for unknown user', async () => {
            const analyzer = new BackgroundImageAnalyzer();
            const score = await analyzer.getRelevanceScore('nobody');
            TestSuite.assertEquals(0, score, 'Unknown user should have 0 relevance');
        });

        TestSuite.test('getRelevanceScore returns positive score for analyzed user', async () => {
            await CacheManager.saveRecognitionResult({
                username: 'scored_user',
                predictions: [{ label: 'test', confidence: 80 }],
                featureVector: [0.5, 0.3],
                analyzedAt: Date.now(),
                feedbackScore: 5,
                imageUrl: ''
            });

            const analyzer = new BackgroundImageAnalyzer();
            const score = await analyzer.getRelevanceScore('scored_user');
            TestSuite.assertTrue(score > 0, 'Analyzed user should have positive relevance score');
            TestSuite.assertTrue(score <= 100, 'Score should not exceed 100');
        });

        TestSuite.test('higher feedback score yields higher relevance', async () => {
            await CacheManager.saveRecognitionResult({
                username: 'low_fb',
                predictions: [{ label: 'a', confidence: 50 }],
                featureVector: null,
                analyzedAt: Date.now(),
                feedbackScore: 1,
                imageUrl: ''
            });
            await CacheManager.saveRecognitionResult({
                username: 'high_fb',
                predictions: [{ label: 'a', confidence: 50 }],
                featureVector: null,
                analyzedAt: Date.now(),
                feedbackScore: 10,
                imageUrl: ''
            });

            const analyzer = new BackgroundImageAnalyzer();
            const lowScore = await analyzer.getRelevanceScore('low_fb');
            const highScore = await analyzer.getRelevanceScore('high_fb');
            TestSuite.assertTrue(highScore > lowScore, 'Higher feedback should yield higher relevance');
        });
    });

    TestSuite.summary();
})();
`;

// Inject TestSuite into sandbox and run tests
sandbox.TestSuite = TestSuite;
vm.runInContext(testCode, sandbox);
