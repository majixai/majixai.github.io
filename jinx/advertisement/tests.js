// Test Suite for Jinx AI Advertisement Page

// Simple Test Runner
let testsRun = 0;
let testsPassed = 0;

function describe(description, callback) {
    console.log(`%c--- ${description} ---`, 'font-weight: bold; color: blue;');
    callback();
}

function it(description, callback) {
    testsRun++;
    try {
        callback();
        console.log(`%c  ✓ ${description}`, 'color: green;');
        testsPassed++;
    } catch (error) {
        console.error(`%c  ✗ ${description}`, 'color: red;');
        console.error(error);
    }
}

function assertEquals(expected, actual, message = 'Values are not equal') {
    if (expected !== actual) {
        throw new Error(`Assertion failed: ${message}. Expected "${expected}" but got "${actual}".`);
    }
}

function assert(condition, message = 'Assertion failed') {
    if (!condition) {
        throw new Error(message);
    }
}


function runAllTests() {
    testsRun = 0;
    testsPassed = 0;

    describe('AutoinvestExamples Class', () => {
        const examples = new AutoinvestExamples('examples');

        it('should correctly calculate investment projection', () => {
            const projection = examples.calculateProjection(1000, 0.10, 1); // 10% annual rate for 1 year
            // Simple interest for comparison, but our function uses monthly compound
            // FV = P (1 + r/n)^(nt) -> 1000 * (1 + 0.10/12)^(12*1)
            const expected = 1000 * Math.pow((1 + 0.10 / 12), 12);
            assertEquals(expected.toFixed(2), projection.toFixed(2));
        });

        it('should handle zero initial investment', () => {
            const projection = examples.calculateProjection(0);
            assertEquals(0, projection);
        });
    });

    describe('UserInteraction Class - Contact Form', () => {
        const interaction = new UserInteraction('contact');

        it('should validate a complete contact form successfully', () => {
            const error = interaction._validateContactForm('John Doe', 'john.doe@example.com', 'General Question', 'Hello there!');
            assertEquals(null, error);
        });

        it('should return an error for a missing name in contact form', () => {
            const error = interaction._validateContactForm('', 'john.doe@example.com', 'General Question', 'Hello there!');
            assertEquals('Name is required.', error);
        });

        it('should return an error for an invalid email in contact form', () => {
            const error = interaction._validateContactForm('John Doe', 'john.doe', 'General Question', 'Hello!');
            assertEquals('Please enter a valid email address.', error);
        });

        it('should return an error for a missing reason in contact form', () => {
            const error = interaction._validateContactForm('John Doe', 'john.doe@example.com', '', 'Hello!');
            assertEquals('Please select a reason for your inquiry.', error);
        });
    });

    describe('UserInteraction Class - Demo Form', () => {
        const interaction = new UserInteraction('contact'); // The container ID is not used for validation logic

        it('should validate a complete demo form successfully', () => {
            const error = interaction._validateDemoForm('Jane Doe', 'jane.doe@example.com');
            assertEquals(null, error);
        });

        it('should return an error for a missing name in demo form', () => {
            const error = interaction._validateDemoForm('', 'jane.doe@example.com');
            assertEquals('Name is required.', error);
        });

        it('should return an error for an invalid email in demo form', () => {
            const error = interaction._validateDemoForm('Jane Doe', 'jane.doe');
            assertEquals('Please enter a valid email address.', error);
        });
    });

    describe('UserInteraction Class - Newsletter Form', () => {
        const interaction = new UserInteraction('contact');

        it('should validate a complete newsletter form successfully', () => {
            const error = interaction._validateNewsletterForm('test@example.com');
            assertEquals(null, error);
        });

        it('should return an error for an invalid email in newsletter form', () => {
            const error = interaction._validateNewsletterForm('test');
            assertEquals('Please enter a valid email address.', error);
        });
    });

    console.log(`\n--- Test Summary ---`);
    console.log(`Total Tests: ${testsRun}`);
    console.log(`%cPassed: ${testsPassed}`, 'color: green;');
    if (testsRun > testsPassed) {
        console.log(`%cFailed: ${testsRun - testsPassed}`, 'color: red;');
    } else {
        console.log('All tests passed! 🎉');
    }
}
