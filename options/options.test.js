// --- Basic Test Framework (matches existing pattern from jinx_strategy/menu/menu.test.js) ---
const TestSuite = {
    tests: [],
    totalTests: 0,
    passed: 0,
    failed: 0,
    currentGroup: '',

    group(name, fn) {
        this.currentGroup = name;
        console.log(`--- Test Group: ${name} ---`);
        fn();
        this.currentGroup = '';
    },

    test(name, fn) {
        this.totalTests++;
        const fullName = this.currentGroup ? `${this.currentGroup} > ${name}` : name;
        try {
            fn();
            console.log(`  [PASS] ${fullName}`);
            this.passed++;
        } catch (e) {
            console.error(`  [FAIL] ${fullName}`);
            console.error(e.message);
            this.failed++;
        }
    },

    assertEquals(expected, actual, message = 'assertEquals') {
        if (expected !== actual) {
            throw new Error(`${message}: Expected "${expected}" but got "${actual}"`);
        }
    },

    assertDeepEquals(expected, actual, message = 'assertDeepEquals') {
        if (JSON.stringify(expected) !== JSON.stringify(actual)) {
            throw new Error(`${message}: Expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
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

    assertNotNull(value, message = 'assertNotNull') {
        if (value === null || value === undefined) {
            throw new Error(`${message}: Expected not null but got ${value}`);
        }
    },

    assertApprox(expected, actual, tolerance = 0.01, message = 'assertApprox') {
        if (Math.abs(expected - actual) > tolerance) {
            throw new Error(`${message}: Expected ~${expected} but got ${actual} (tolerance: ${tolerance})`);
        }
    },

    summarize() {
        console.log('\n--- Test Summary ---');
        console.log(`Total Tests: ${this.totalTests}`);
        console.log(`Passed: ${this.passed}`);
        console.log(`Failed: ${this.failed}`);
        if (this.failed > 0) {
            console.warn("Some tests failed!");
            process.exit(1);
        } else {
            console.log("All tests passed!");
        }
    }
};

// --- Extract testable functions from script.js ---
// These are standalone pure functions that can be tested without DOM/Plotly

/**
 * calculateLegPayoff - copied from script.js for unit testing
 */
function calculateLegPayoff(price, type, position, strike, premium) {
    let intrinsicValue = 0;
    const numericPrice = parseFloat(price) || 0;
    const numericStrike = parseFloat(strike) || 0;
    const numericPremium = parseFloat(premium) || 0;

    if (numericPrice <= 0 || numericStrike <= 0 || numericPremium < 0) {
        return 0;
    }

    if (type === 'call') {
        intrinsicValue = Math.max(0, numericPrice - numericStrike);
    } else if (type === 'put') {
        intrinsicValue = Math.max(0, numericStrike - numericPrice);
    } else {
        return 0;
    }

    if (position === 'long') {
        return intrinsicValue - numericPremium;
    } else if (position === 'short') {
        return numericPremium - intrinsicValue;
    }
    return 0;
}

/**
 * generatePriceRange - copied from script.js for unit testing
 */
const CURRENT_UNDERLYING_PRICE = 5975.50;
function generatePriceRange(center, rangePct = 0.15, steps = 200) {
    let numericCenter = parseFloat(center);
    if (isNaN(numericCenter) || numericCenter <= 0) {
        numericCenter = CURRENT_UNDERLYING_PRICE;
    }
    const minP = numericCenter * (1 - rangePct);
    const maxP = numericCenter * (1 + rangePct);
    const step = (maxP - minP) / steps;
    if (step <= 0 || !isFinite(step)) {
        const fallbackMin = numericCenter * 0.85;
        const fallbackStep = (numericCenter * 0.30) / steps;
        return Array.from({ length: steps + 1 }, (_, i) => fallbackMin + i * fallbackStep);
    }
    return Array.from({ length: steps + 1 }, (_, i) => minP + i * step);
}

/**
 * Mock plotLogic functions for testing return patterns
 */
const logger = {
    log: () => {},
    warn: () => {},
    error: () => {},
    info: () => {}
};

const plotLogic = {
    plotBasicOption: (params, strategy) => {
        const { type, position, strike, premium } = params;
        const cleanStrike = parseFloat(strike) || 0;
        const cleanPremium = parseFloat(premium) || 0;
        if (cleanStrike <= 0 || cleanPremium < 0) return { trace: { x: [], y: [] }, title: `${(strategy && strategy.name) || 'Unknown'} (Invalid Parameters)` };
        const prices = generatePriceRange(cleanStrike);
        const profits = prices.map(price => calculateLegPayoff(price, type, position, cleanStrike, cleanPremium));
        const trace = { x: prices, y: profits, type: 'scatter', mode: 'lines', line: { color: position === 'long' ? (type === 'call' ? 'green' : 'blue') : 'red', width: 2.5 } };
        const posText = position.charAt(0).toUpperCase() + position.slice(1);
        const typeText = type.charAt(0).toUpperCase() + type.slice(1);
        const title = `${posText} ${cleanStrike.toFixed(2)} ${typeText} (Premium: ${cleanPremium.toFixed(2)})`;
        return { trace, title };
    }
};


// ========================================================================
// Tests
// ========================================================================

TestSuite.group('calculateLegPayoff', () => {

    TestSuite.test('Long Call - ITM', () => {
        // Price 6100, Strike 5980, Premium 83
        // Intrinsic = max(0, 6100 - 5980) = 120
        // Payoff = 120 - 83 = 37
        const result = calculateLegPayoff(6100, 'call', 'long', 5980, 83);
        TestSuite.assertApprox(37, result, 0.01, 'Long call ITM payoff');
    });

    TestSuite.test('Long Call - OTM', () => {
        // Price 5900, Strike 5980, Premium 83
        // Intrinsic = max(0, 5900 - 5980) = 0
        // Payoff = 0 - 83 = -83
        const result = calculateLegPayoff(5900, 'call', 'long', 5980, 83);
        TestSuite.assertApprox(-83, result, 0.01, 'Long call OTM payoff');
    });

    TestSuite.test('Long Call - ATM', () => {
        // Price 5980, Strike 5980, Premium 83
        // Intrinsic = max(0, 5980 - 5980) = 0
        // Payoff = 0 - 83 = -83
        const result = calculateLegPayoff(5980, 'call', 'long', 5980, 83);
        TestSuite.assertApprox(-83, result, 0.01, 'Long call ATM payoff');
    });

    TestSuite.test('Short Put - OTM', () => {
        // Price 6000, Strike 5970, Premium 104.50
        // Intrinsic = max(0, 5970 - 6000) = 0
        // Payoff = 104.50 - 0 = 104.50
        const result = calculateLegPayoff(6000, 'put', 'short', 5970, 104.50);
        TestSuite.assertApprox(104.50, result, 0.01, 'Short put OTM payoff');
    });

    TestSuite.test('Short Put - ITM', () => {
        // Price 5800, Strike 5970, Premium 104.50
        // Intrinsic = max(0, 5970 - 5800) = 170
        // Payoff = 104.50 - 170 = -65.50
        const result = calculateLegPayoff(5800, 'put', 'short', 5970, 104.50);
        TestSuite.assertApprox(-65.50, result, 0.01, 'Short put ITM payoff');
    });

    TestSuite.test('Long Put - ITM', () => {
        // Price 5800, Strike 5970, Premium 109.50
        // Intrinsic = max(0, 5970 - 5800) = 170
        // Payoff = 170 - 109.50 = 60.50
        const result = calculateLegPayoff(5800, 'put', 'long', 5970, 109.50);
        TestSuite.assertApprox(60.50, result, 0.01, 'Long put ITM payoff');
    });

    TestSuite.test('Long Put - OTM', () => {
        // Price 6100, Strike 5970, Premium 109.50
        // Intrinsic = max(0, 5970 - 6100) = 0
        // Payoff = 0 - 109.50 = -109.50
        const result = calculateLegPayoff(6100, 'put', 'long', 5970, 109.50);
        TestSuite.assertApprox(-109.50, result, 0.01, 'Long put OTM payoff');
    });

    TestSuite.test('Short Call - OTM', () => {
        // Price 5900, Strike 5970, Premium 83.25
        // Intrinsic = max(0, 5900 - 5970) = 0
        // Payoff = 83.25 - 0 = 83.25
        const result = calculateLegPayoff(5900, 'call', 'short', 5970, 83.25);
        TestSuite.assertApprox(83.25, result, 0.01, 'Short call OTM payoff');
    });

    TestSuite.test('Short Call - ITM', () => {
        // Price 6200, Strike 5970, Premium 83.25
        // Intrinsic = max(0, 6200 - 5970) = 230
        // Payoff = 83.25 - 230 = -146.75
        const result = calculateLegPayoff(6200, 'call', 'short', 5970, 83.25);
        TestSuite.assertApprox(-146.75, result, 0.01, 'Short call ITM payoff');
    });

    TestSuite.test('Invalid type returns 0', () => {
        const result = calculateLegPayoff(6000, 'invalid', 'long', 5970, 83);
        TestSuite.assertEquals(0, result, 'Invalid type');
    });

    TestSuite.test('Invalid position returns 0', () => {
        const result = calculateLegPayoff(6000, 'call', 'invalid', 5970, 83);
        TestSuite.assertEquals(0, result, 'Invalid position');
    });

    TestSuite.test('Negative strike returns 0', () => {
        const result = calculateLegPayoff(6000, 'call', 'long', -100, 83);
        TestSuite.assertEquals(0, result, 'Negative strike');
    });

    TestSuite.test('Zero price returns 0', () => {
        const result = calculateLegPayoff(0, 'call', 'long', 5970, 83);
        TestSuite.assertEquals(0, result, 'Zero price');
    });

    TestSuite.test('Breakeven for Long Call', () => {
        // At breakeven: price = strike + premium = 5980 + 83 = 6063
        const result = calculateLegPayoff(6063, 'call', 'long', 5980, 83);
        TestSuite.assertApprox(0, result, 0.01, 'Long call breakeven');
    });

    TestSuite.test('Breakeven for Short Put', () => {
        // At breakeven: price = strike - premium = 5970 - 104.50 = 5865.50
        const result = calculateLegPayoff(5865.50, 'put', 'short', 5970, 104.50);
        TestSuite.assertApprox(0, result, 0.01, 'Short put breakeven');
    });
});


TestSuite.group('generatePriceRange', () => {

    TestSuite.test('Generates correct number of points', () => {
        const prices = generatePriceRange(6000, 0.15, 200);
        TestSuite.assertEquals(201, prices.length, 'Should generate steps+1 prices');
    });

    TestSuite.test('Range centered around given price', () => {
        const center = 6000;
        const rangePct = 0.15;
        const prices = generatePriceRange(center, rangePct, 200);
        const expectedMin = center * (1 - rangePct);
        const expectedMax = center * (1 + rangePct);
        TestSuite.assertApprox(expectedMin, prices[0], 0.1, 'Min price');
        TestSuite.assertApprox(expectedMax, prices[prices.length - 1], 0.1, 'Max price');
    });

    TestSuite.test('Handles invalid center (uses fallback)', () => {
        const prices = generatePriceRange(0, 0.15, 200);
        TestSuite.assertEquals(201, prices.length, 'Should still generate prices with fallback');
        TestSuite.assertTrue(prices[0] > 0, 'First price should be positive');
    });

    TestSuite.test('Prices are in ascending order', () => {
        const prices = generatePriceRange(6000, 0.15, 100);
        for (let i = 1; i < prices.length; i++) {
            TestSuite.assertTrue(prices[i] > prices[i - 1], `Price at ${i} should be > price at ${i - 1}`);
        }
    });
});


TestSuite.group('plotLogic.plotBasicOption', () => {

    TestSuite.test('Returns trace and title for long call', () => {
        const result = plotLogic.plotBasicOption(
            { type: 'call', position: 'long', strike: 5980, premium: 83 },
            { name: 'Long Call', id: 'long-call' }
        );
        TestSuite.assertNotNull(result, 'Result should not be null');
        TestSuite.assertNotNull(result.trace, 'trace should not be null');
        TestSuite.assertNotNull(result.title, 'title should not be null');
        TestSuite.assertTrue(result.trace.x.length > 0, 'trace.x should have data');
        TestSuite.assertTrue(result.trace.y.length > 0, 'trace.y should have data');
        TestSuite.assertTrue(result.title.includes('Long'), 'Title should include Long');
        TestSuite.assertTrue(result.title.includes('Call'), 'Title should include Call');
    });

    TestSuite.test('Returns trace and title for short put', () => {
        const result = plotLogic.plotBasicOption(
            { type: 'put', position: 'short', strike: 5970, premium: 104.50 },
            { name: 'Short Put', id: 'short-put' }
        );
        TestSuite.assertNotNull(result, 'Result should not be null');
        TestSuite.assertNotNull(result.trace, 'trace should not be null');
        TestSuite.assertTrue(result.title.includes('Short'), 'Title should include Short');
        TestSuite.assertTrue(result.title.includes('Put'), 'Title should include Put');
    });

    TestSuite.test('Handles zero strike gracefully', () => {
        const result = plotLogic.plotBasicOption(
            { type: 'call', position: 'long', strike: 0, premium: 83 },
            { name: 'Test', id: 'test' }
        );
        TestSuite.assertNotNull(result, 'Result should not be null even with invalid params');
        TestSuite.assertTrue(result.title.includes('Invalid Parameters'), 'Title should indicate invalid');
    });
});


TestSuite.group('Strategy JSON validation', () => {

    TestSuite.test('strategies.json is valid JSON', () => {
        const fs = require('fs');
        const path = require('path');
        const jsonPath = path.join(__dirname, 'strategies.json');
        const rawData = fs.readFileSync(jsonPath, 'utf8');
        let parsed;
        try {
            parsed = JSON.parse(rawData);
        } catch (e) {
            throw new Error(`strategies.json is not valid JSON: ${e.message}`);
        }
        TestSuite.assertNotNull(parsed, 'Parsed data should not be null');
    });

    TestSuite.test('strategies.json has expected section keys', () => {
        const fs = require('fs');
        const path = require('path');
        const jsonPath = path.join(__dirname, 'strategies.json');
        const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        TestSuite.assertNotNull(parsed.oneLeg, 'Should have oneLeg section');
        TestSuite.assertTrue(Array.isArray(parsed.oneLeg), 'oneLeg should be an array');
        TestSuite.assertTrue(parsed.oneLeg.length > 0, 'oneLeg should have strategies');
    });

    TestSuite.test('Each strategy has required fields', () => {
        const fs = require('fs');
        const path = require('path');
        const jsonPath = path.join(__dirname, 'strategies.json');
        const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        const requiredFields = ['id', 'name', 'plotFunction', 'plotlyDivId', 'parameters'];
        const sections = ['oneLeg', 'twoLeg', 'threeLeg', 'fourLeg'];

        sections.forEach(section => {
            if (parsed[section]) {
                parsed[section].forEach(strategy => {
                    requiredFields.forEach(field => {
                        if (!strategy[field]) {
                            throw new Error(`Strategy "${strategy.name || strategy.id}" in section "${section}" missing required field "${field}"`);
                        }
                    });
                });
            }
        });
        TestSuite.assertTrue(true, 'All strategies have required fields');
    });

    TestSuite.test('All plotFunction names reference known functions', () => {
        const fs = require('fs');
        const path = require('path');
        const jsonPath = path.join(__dirname, 'strategies.json');
        const parsed = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

        const knownFunctions = [
            'plotBasicOption', 'plotCoveredCall', 'plotProtectivePut',
            'plotVerticalSpread', 'plotButterfly', 'plotIronCondor',
            'plotIronButterfly', 'plotReverseIronCondor', 'plotReverseIronButterfly',
            'plotStraddleStrangle', 'plotBoxSpread', 'plotCalendarSpread',
            'plotDiagonalSpread', 'plotRatioSpread', 'plotCondor', 'plotComplexStrategy'
        ];

        const sections = ['oneLeg', 'twoLeg', 'threeLeg', 'fourLeg', 'multiLeg'];
        sections.forEach(section => {
            if (parsed[section]) {
                parsed[section].forEach(strategy => {
                    if (strategy.plotFunction && !knownFunctions.includes(strategy.plotFunction)) {
                        throw new Error(`Strategy "${strategy.name}" uses unknown plotFunction "${strategy.plotFunction}"`);
                    }
                });
            }
        });
        TestSuite.assertTrue(true, 'All plotFunction names are valid');
    });
});


TestSuite.group('CSS file reference', () => {

    TestSuite.test('index.html references existing style.css file', () => {
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(__dirname, 'index.html');
        const html = fs.readFileSync(htmlPath, 'utf8');
        TestSuite.assertTrue(html.includes('href="style.css"'), 'Should reference style.css (not styles.css)');
        TestSuite.assertFalse(html.includes('href="styles.css"'), 'Should not reference styles.css');
    });

    TestSuite.test('style.css file exists', () => {
        const fs = require('fs');
        const path = require('path');
        const cssPath = path.join(__dirname, 'style.css');
        TestSuite.assertTrue(fs.existsSync(cssPath), 'style.css should exist');
    });
});


TestSuite.group('script.js syntax and structure', () => {

    TestSuite.test('script.js has no stray markdown backticks', () => {
        const fs = require('fs');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'script.js');
        const script = fs.readFileSync(scriptPath, 'utf8');
        const lines = script.split('\n');
        lines.forEach((line, i) => {
            if (line.trim() === '```') {
                throw new Error(`Stray markdown backtick found on line ${i + 1}`);
            }
        });
        TestSuite.assertTrue(true, 'No stray backticks found');
    });

    TestSuite.test('script.js defines replotStrategy function', () => {
        const fs = require('fs');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'script.js');
        const script = fs.readFileSync(scriptPath, 'utf8');
        TestSuite.assertTrue(script.includes('function replotStrategy'), 'Should define replotStrategy');
    });

    TestSuite.test('script.js defines w3_open and w3_close functions', () => {
        const fs = require('fs');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'script.js');
        const script = fs.readFileSync(scriptPath, 'utf8');
        TestSuite.assertTrue(script.includes('function w3_open'), 'Should define w3_open');
        TestSuite.assertTrue(script.includes('function w3_close'), 'Should define w3_close');
    });

    TestSuite.test('plotCondor uses cleanStrike4 (not cleanStrikeC4)', () => {
        const fs = require('fs');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'script.js');
        const script = fs.readFileSync(scriptPath, 'utf8');

        // Extract the plotCondor block
        const condorStart = script.indexOf('plotCondor: (params, id)');
        const condorEnd = script.indexOf('plotComplexStrategy:', condorStart);
        const condorBlock = script.substring(condorStart, condorEnd);
        TestSuite.assertFalse(
            condorBlock.includes('cleanStrikeC4'),
            'plotCondor should use cleanStrike4, not cleanStrikeC4'
        );
    });

    TestSuite.test('plotLogic functions consistently return { trace, title }', () => {
        const fs = require('fs');
        const path = require('path');
        const scriptPath = path.join(__dirname, 'script.js');
        const script = fs.readFileSync(scriptPath, 'utf8');

        // Ensure no plotLogic function directly calls Plotly.newPlot
        const startMarker = 'const plotLogic = {';
        const endMarker = '}; // End plotFunctions map';
        const startIdx = script.indexOf(startMarker);
        const endIdx = script.indexOf(endMarker);
        if (startIdx === -1 || endIdx === -1) {
            throw new Error('Could not find plotLogic block boundaries');
        }
        const plotLogicBlock = script.substring(startIdx, endIdx + endMarker.length);
        TestSuite.assertFalse(
            plotLogicBlock.includes('Plotly.newPlot'),
            'plotLogic functions should not directly call Plotly.newPlot (replotStrategy handles it)'
        );
    });
});


// Run tests
TestSuite.summarize();
