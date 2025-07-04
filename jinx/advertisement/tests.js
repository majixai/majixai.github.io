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

// --- Tests for Decorators (logMethodCall) ---
function runDecoratorTests() {
    console.log("--- Running Decorator (logMethodCall) Tests ---");
    let originalConsoleLog = console.log;
    let logOutput = [];

    // Temporarily override console.log to capture its output
    console.log = (message, ...args) => {
        // originalConsoleLog(message, ...args); // Uncomment to see logs during test
        logOutput.push({ message, args: args.map(arg => JSON.stringify(arg)).join(' ') });
    };

    const testObj = {
        value: 0,
        // A simple method to be decorated
        method: function(a, b) {
            this.value = a + b; // 'this' context is important
            return this.value;
        }
    };

    // Decorate the method. Note: logMethodCall expects (originalMethod, methodName, contextObject)
    // We are testing the decorator function directly here.
    // The 'this' for originalMethod.apply inside the decorator will be contextObject.
    const decoratedMethod = logMethodCall(testObj.method, 'methodInTestObj', testObj);

    // Test 1: Method call logging and execution
    logOutput = []; // Clear log before call
    let result = decoratedMethod(5, 3); // Call the decorated method directly

    assertEquals(8, result, "Decorator Test 1: Result of decorated method");
    assertEquals(8, testObj.value, "Decorator Test 1: 'this' context correctly applied (value updated)");

    // Check log messages (simplified check for inclusion)
    let callLogged = logOutput.some(log => log.message.includes('Calling method "methodInTestObj" on Object with arguments:'));
    // Note: contextObject.constructor.name might be tricky if contextObject is a simple literal.
    // For the actual implementation, it's `AutoinvestExamples`. Here, it's a generic Object.
    // args[0] for the log is an array [5,3]. So JSON.stringify(args[0]) might be more robust.
    // For simplicity, we're just checking parts of the message.
    let argsLoggedCorrectly = logOutput.some(log => log.args.includes('[5,3]'));

    assertEquals(true, callLogged, "Decorator Test 1: Logged call message");
    assertEquals(true, argsLoggedCorrectly, "Decorator Test 1: Logged call with correct args representation");

    let finishLogged = logOutput.some(log => log.message.includes('Method "methodInTestObj" finished execution.'));
    assertEquals(true, finishLogged, "Decorator Test 1: Logged finish message");

    // Reset console.log and clear output for next tests
    testObj.value = 0; // Reset internal state of testObj
    logOutput = [];

    console.log = originalConsoleLog; // Restore original console.log
    console.log("--- Decorator Tests Finished ---");
}


// --- Tests for Generators (investmentTipGenerator) ---
function runGeneratorTests() {
    console.log("--- Running Generator (investmentTipGenerator) Tests ---");

    // We need to ensure `investmentTipGenerator` is available in this scope.
    // If tests.js is loaded before script.js defines it, this will fail.
    // Assuming script.js is loaded and `investmentTipGenerator` is global or accessible.
    if (typeof investmentTipGenerator !== 'function') {
        console.error("FAIL: investmentTipGenerator is not defined. Ensure script.js is loaded before tests.js or the generator is made available.");
        testsRun++; // Count this as a failed test setup
        return;
    }
    const generator = investmentTipGenerator();
    const tips = [ // Must match the ones in script.js
        "Tip: Diversify your portfolio to manage risk.",
        "Tip: Invest for the long term; avoid emotional decisions.",
        "Tip: Understand your risk tolerance before investing.",
        "Tip: Regularly review and rebalance your investments.",
        "Tip: Start early and leverage the power of compounding.",
        "Tip: Research thoroughly or trust experts like Jinx AI!"
    ];

    // Test 1: Yields all tips in order
    for (let i = 0; i < tips.length; i++) {
        const { value, done } = generator.next();
        assertEquals(tips[i], value, `Generator Test 1.${i}: Yields correct tip #${i+1}`);
        assertEquals(false, done, `Generator Test 1.${i}: Not done yet`);
    }

    // Test 2: Loops back to the first tip
    let { value, done } = generator.next();
    assertEquals(tips[0], value, "Generator Test 2: Loops back to the first tip");
    assertEquals(false, done, "Generator Test 2: Still not done");

    // Test 3: Subsequent call yields second tip again
    ({ value, done } = generator.next());
    assertEquals(tips[1], value, "Generator Test 3: Yields second tip after looping");
    assertEquals(false, done, "Generator Test 3: Still not done after looping and getting next");

    // Test 4: Check type of yielded value
    const firstTipResult = investmentTipGenerator().next(); // Get the first result object
    assertEquals('string', typeof firstTipResult.value, "Generator Test 4: Yielded value is a string");
    assertEquals(false, firstTipResult.done, "Generator Test 4: Generator not done on first yield");


    console.log("--- Generator Tests Finished ---");
}


// --- Main Test Execution ---
// This function will be called by a button or automatically.
function runAllTests() {
    testsRun = 0;
    testsPassed = 0;
    
    console.log("--- Starting All Tests ---");
    runAutoinvestExamplesTests();
    runDecoratorTests();
    runGeneratorTests();

    summarizeTests();
    console.log("--- All Tests Finished ---");
}

// To run tests automatically when the script loads (optional):
// document.addEventListener('DOMContentLoaded', runAllTests);
// Or, it can be triggered by a button in index.html
