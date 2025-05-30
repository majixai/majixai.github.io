// jinx/advertisement/tests.js - Unit Tests for Jinx AI Advertisement Page

// --- Simple Test Runner & Assertion Functions ---
let testsRun = 0;
let testsPassed = 0;

function assertEquals(expected, actual, message) {
    testsRun++;
    // Using a tolerance for floating point comparisons
    const tolerance = 1e-6; // Adjust tolerance as needed
    if (typeof expected === 'number' && typeof actual === 'number') {
        if (Math.abs(expected - actual) < tolerance) {
            console.log(`PASS: ${message}`);
            testsPassed++;
        } else {
            console.error(`FAIL: ${message}. Expected ${expected}, but got ${actual}.`);
        }
    } else if (expected === actual) {
        console.log(`PASS: ${message}`);
        testsPassed++;
    } else {
        console.error(`FAIL: ${message}. Expected "${expected}", but got "${actual}".`);
    }
}

function assertThrows(func, expectedErrorMessageSubstring, message) {
    testsRun++;
    try {
        func();
        console.error(`FAIL: ${message}. Expected function to throw an error, but it did not.`);
    } catch (e) {
        if (e.message.includes(expectedErrorMessageSubstring)) {
            console.log(`PASS: ${message}`);
            testsPassed++;
        } else {
            console.error(`FAIL: ${message}. Expected error message to include "${expectedErrorMessageSubstring}", but got "${e.message}".`);
        }
    }
}

function summarizeTests() {
    console.log("--- Test Summary ---");
    console.log(`Total tests run: ${testsRun}`);
    console.log(`Tests passed: ${testsPassed}`);
    console.log(`Tests failed: ${testsRun - testsPassed}`);
    if (testsRun === testsPassed) {
        console.log("All tests passed! 🎉");
    } else {
        console.error("Some tests failed. 🙁");
    }
}

// --- Test Cases for AutoinvestExamples.calculateProjection ---

function runAutoinvestExamplesTests() {
    console.log("--- Running AutoinvestExamples.calculateProjection Tests ---");

    // Test instance needed to call the method.
    // The constructor might log errors if DOM elements are not found, this is expected when testing in isolation.
    // We are only interested in testing the calculateProjection method here.
    // Temporarily mock parts of the constructor's expectations if needed, or ensure it's robust enough.
    // For now, we assume the AutoinvestExamples class can be instantiated without its DOM elements for this specific test.
    const examples = new AutoinvestExamples('examples'); // ID 'examples' is a placeholder here.

    // Test 1: Typical positive investment
    let principal = 1000;
    let rate = 0.10; // 10% annual rate
    let years = 1;
    // Expected: 1000 * (1 + 0.10/12)^12 = 1000 * (1.008333333)^12 ~= 1104.713066
    let expected = principal * Math.pow(1 + rate / 12, 12 * years);
    assertEquals(expected, examples.calculateProjection(principal, rate, years), "Test 1: Typical positive investment (1000, 10%, 1yr)");

    // Test 2: Different rate and years
    principal = 5000;
    rate = 0.05; // 5% annual rate
    years = 5;
    // Expected: 5000 * (1 + 0.05/12)^(12*5) ~= 6416.77
    expected = principal * Math.pow(1 + rate / 12, 12 * years);
    assertEquals(expected, examples.calculateProjection(principal, rate, years), "Test 2: Different rate and years (5000, 5%, 5yrs)");

    // Test 3: Zero investment amount
    // The method itself should handle this; UI validation is separate.
    // Current implementation should return 0 if initialAmount is 0.
    assertEquals(0, examples.calculateProjection(0, 0.08, 1), "Test 3: Zero investment amount");

    // Test 4: Very small investment amount
    principal = 0.01; // 1 cent
    rate = 0.10; // 10%
    years = 1;
    expected = principal * Math.pow(1 + rate / 12, 12 * years);
    assertEquals(expected, examples.calculateProjection(principal, rate, years), "Test 4: Very small investment (0.01, 10%, 1yr)");
    
    // Test 5: Zero interest rate
    principal = 1000;
    rate = 0.00; // 0%
    years = 10;
    expected = principal; // Should remain the same
    assertEquals(expected, examples.calculateProjection(principal, rate, years), "Test 5: Zero interest rate");

    // Test 6: Zero years
    principal = 1000;
    rate = 0.08; // 8%
    years = 0;
    expected = principal; // Should remain the same
    assertEquals(expected, examples.calculateProjection(principal, rate, years), "Test 6: Zero years");

    // Note: The calculateProjection method itself doesn't handle negative or non-numeric inputs directly.
    // That responsibility is typically with the input validation part of _handleProjectionCalculation.
    // If we wanted to test that, we'd test _handleProjectionCalculation or the UI directly.
    // For calculateProjection, we assume valid numeric inputs as per its design.
    // If calculateProjection were to have its own input validation, we'd add tests for that.
    // e.g., assertThrows(() => examples.calculateProjection(-100), "some error", "Test X: Negative input");

    console.log("--- AutoinvestExamples Tests Finished ---");
}


// --- Main Test Execution ---
// This function will be called by a button or automatically.
function runAllTests() {
    testsRun = 0;
    testsPassed = 0;
    
    runAutoinvestExamplesTests();
    // Add calls to other test suites here if created

    summarizeTests();
}

// To run tests automatically when the script loads (optional):
// document.addEventListener('DOMContentLoaded', runAllTests);
// Or, it can be triggered by a button in index.html
