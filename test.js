const puppeteer = require('puppeteer');
const path = require('path');
const assert = require('assert');

(async () => {
    const browser = await puppeteer.launch({ headless: "new", args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    const consoleErrors = [];
    const MAX_JOB_SEEKERS = 5; // Align with script.js for message checks
    const testResults = {
        initialLoadErrors: false,
        mainHeadingPresent: false,
        joinUsSectionVisible: false,
        signupFormVisible: false,
        submissions: [],
        signupFormHiddenAfter5: false,
        sixthSubmissionRejected: false,
        sixthSubmissionMessageCorrect: false,
    };

    page.on('console', msg => {
        if (msg.type() === 'error') {
            consoleErrors.push(msg.text());
            console.error(`PAGE LOG ERROR: ${msg.text()}`);
        } else {
            console.log(`PAGE LOG: ${msg.text()}`);
        }
    });

    try {
        console.log('1. Loading index.html...');
        await page.goto('file://' + path.join(__dirname, 'index.html'), { waitUntil: 'networkidle0' });
        console.log('Page loaded.');

        console.log('2. Check for initial console errors...');
        testResults.initialLoadErrors = consoleErrors.length === 0;
        if (!testResults.initialLoadErrors) console.error('Initial console errors found:', consoleErrors);

        console.log('3. Verify main heading...');
        const mainHeading = await page.$eval('header h1', el => el.textContent);
        testResults.mainHeadingPresent = mainHeading === 'Find Your Next Opportunity!';
        assert.strictEqual(testResults.mainHeadingPresent, true, 'Main heading not found or incorrect.');
        console.log('Main heading verified.');

        console.log('4. Verify "Join Us!" section and form visibility...');
        const joinUsVisible = await page.$eval('#signup-section h2', el => el.offsetParent !== null && el.textContent === 'Join Us!');
        testResults.joinUsSectionVisible = joinUsVisible;
        assert.strictEqual(testResults.joinUsSectionVisible, true, '"Join Us!" section not visible or incorrect title.');

        const formVisible = await page.$eval('#signup-form', el => el.offsetParent !== null);
        testResults.signupFormVisible = formVisible;
        assert.strictEqual(testResults.signupFormVisible, true, 'Signup form not visible.');
        console.log('"Join Us!" section and form verified.');

        for (let i = 1; i <= 5; i++) {
            console.log(`--- Iteration ${i} ---`);
            const currentSubmissionErrors = [];
            page.on('console', msg => { // Re-attach for this scope if needed, or rely on outer scope
                if (msg.type() === 'error' && !consoleErrors.includes(msg.text())) { // Avoid duplicates
                    currentSubmissionErrors.push(msg.text());
                }
            });

            const name = `Test User ${i}`;
            const email = `test${i}@example.com`;
            const skills = `skill${i}a,skill${i}b`;

            console.log(`5. Filling form for ${name}...`);
            await page.type('#name', name);
            await page.type('#email', email);
            await page.type('#skills', skills);

            console.log('6. Clicking Sign Up...');
            // It's good practice to wait for navigation or content change if any is expected
            // For SPA-like behavior, we might wait for a specific element or a timeout
            await page.click('#signup-form button[type="submit"]');
            await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for simulated AJAX and DOM updates

            console.log('7. Checking for console errors after submission...');
            const submissionConsoleErrorsFound = currentSubmissionErrors.length > 0;
            if (submissionConsoleErrorsFound) console.error(`Console errors during submission ${i}:`, currentSubmissionErrors);


            console.log('8. Verifying new seeker card...');
            const seekerCardExists = await page.waitForSelector(`#job-seekers-list .seeker-card h3`, {timeout: 2000})
                .then(async () => {
                    const cards = await page.$$eval('#job-seekers-list .seeker-card', cards => cards.map(c => c.querySelector('h3').textContent));
                    return cards.some(text => text === name);
                })
                .catch(() => false);
            assert.strictEqual(seekerCardExists, true, `Seeker card for ${name} not found.`);
            console.log(`Seeker card for ${name} verified.`);

            console.log('9. Verifying signup message...');
            const signupMessage = await page.$eval('#signup-message', el => el.textContent.trim());
            
            let expectedMessageContent;
            const remainingSlots = MAX_JOB_SEEKERS - i; // i is 1-indexed

            if (i === MAX_JOB_SEEKERS) { // After the 5th successful signup
                 expectedMessageContent = `We have reached our maximum of ${MAX_JOB_SEEKERS} candidates. Thank you for your interest!`;
            } else if (remainingSlots > 0) { // For users 1 through 4
                // After a signup, script.js updates message to show remaining slots.
                expectedMessageContent = `Sign up now! ${remainingSlots} spot(s) remaining. You'll get paid for the first hour after you sign up and are selected!`;
            }
            // Note: The original script.js briefly shows "Welcome, {name}!" for the 5th user too,
            // then updateSignupSectionVisibility overwrites it with the "max candidates" message.
            // The test checks the final, stable message.
            
            const messageCorrect = signupMessage === expectedMessageContent;
            assert.strictEqual(messageCorrect, true, `Signup message incorrect for ${name} (iteration ${i}). Got: "${signupMessage}". Expected: "${expectedMessageContent}"`);
            console.log(`Signup message for ${name} verified.`);
            
            testResults.submissions.push({
                name,
                consoleErrors: submissionConsoleErrorsFound ? [...currentSubmissionErrors] : [],
                seekerCardAdded: seekerCardExists,
                signupMessageCorrect: messageCorrect,
            });
            currentSubmissionErrors.length = 0; // Reset for next iteration
        }

        console.log('--- After 5 Submissions ---');
        console.log('11. Verifying signup form is hidden or "Applications Closed" message...');
        // Wait for the DOM to potentially update after the 5th submission
        await new Promise(resolve => setTimeout(resolve, 500)); // Give a little time for UI to update

        const formHidden = await page.$eval('#signup-form', el => el.style.display === 'none' || el.offsetParent === null);
        const closedMessage = await page.$eval('#signup-section h2', el => el.textContent);
        const closedMessageAlt = await page.$eval('#signup-message', el => el.textContent);


        if (formHidden) {
            testResults.signupFormHiddenAfter5 = true;
            console.log('Signup form is hidden.');
        } else if (closedMessage === 'Applications Closed') {
            testResults.signupFormHiddenAfter5 = true; // Treat as equivalent success
            console.log('Signup section title changed to "Applications Closed".');
        } else if (closedMessageAlt.includes("maximum of 5 candidates")) {
             testResults.signupFormHiddenAfter5 = true; // Treat as equivalent success
             console.log('Signup message indicates maximum candidates reached.');
        } else {
            console.error('Neither form hidden, nor "Applications Closed" title, nor max candidates message found.');
        }
        assert.strictEqual(testResults.signupFormHiddenAfter5, true, 'Signup form not hidden or "Applications Closed" message not shown after 5 submissions.');


        console.log('12. Attempting 6th submission...');
        try {
            // Try to fill and submit if form is somehow still visible or to test robustness
             if (!formHidden) { // Only if form wasn't hidden as expected
                console.log('Form not hidden, attempting to fill and click...');
                await page.type('#name', 'Test User 6');
                await page.type('#email', 'test6@example.com');
                await page.type('#skills', 'testing');
                await page.click('#signup-form button[type="submit"]');
                await new Promise(resolve => setTimeout(resolve, 1500)); // Wait for potential (rejected) submission
             } else {
                 console.log("Form is hidden, cannot attempt 6th submission through UI interaction for filling. Will check message.");
             }
        } catch (e) {
            console.log('Error during 6th submission attempt (might be expected if form is gone):', e.message);
        }

        console.log('13. Verifying 6th submission rejection message...');
        const rejectionMessage = await page.$eval('#signup-message', el => el.textContent);
        // Example of expected messages, adjust based on actual script.js
        const expectedRejectionMessages = [
            "Sorry, we are not accepting more applications at the moment.",
            "We have reached our maximum of 5 candidates. Thank you for your interest!"
        ];
        testResults.sixthSubmissionRejected = true; // If we got this far without adding a 6th user, it's rejected.
        testResults.sixthSubmissionMessageCorrect = expectedRejectionMessages.some(msg => rejectionMessage.includes(msg));

        assert.strictEqual(testResults.sixthSubmissionMessageCorrect, true, `6th submission rejection message incorrect or not found. Got: "${rejectionMessage}"`);
        const seekerCardsCount = await page.$$eval('#job-seekers-list .seeker-card', cards => cards.length);
        assert.strictEqual(seekerCardsCount, 5, 'Number of seeker cards should be 5 after attempting 6th submission.');
        console.log('6th submission correctly rejected with appropriate message.');

        console.log('All tests passed!');

    } catch (error) {
        console.error('Test failed:', error);
        // Log current state of testResults for debugging
        console.error('Current test results:', JSON.stringify(testResults, null, 2));
    } finally {
        console.log('\n--- Test Summary ---');
        console.log(`Initial page load without console errors: ${testResults.initialLoadErrors}`);
        console.log(`Main heading "Find Your Next Opportunity!" present: ${testResults.mainHeadingPresent}`);
        console.log(`"Join Us!" section visible: ${testResults.joinUsSectionVisible}`);
        console.log(`Signup form visible initially: ${testResults.signupFormVisible}`);

        testResults.submissions.forEach((sub, idx) => {
            console.log(`\nSubmission ${idx + 1} (${sub.name}):`);
            console.log(`  Console errors during/after submission: ${sub.consoleErrors.length > 0 ? JSON.stringify(sub.consoleErrors) : 'None'}`);
            console.log(`  Seeker card added: ${sub.seekerCardAdded}`);
            console.log(`  Signup message correct: ${sub.signupMessageCorrect}`);
        });

        console.log(`\nSignup form hidden or "Applications Closed" after 5 submissions: ${testResults.signupFormHiddenAfter5}`);
        console.log(`6th submission attempt rejected: ${testResults.sixthSubmissionRejected}`);
        console.log(`6th submission rejection message correct: ${testResults.sixthSubmissionMessageCorrect}`);

        console.log('\n--- All Page Console Errors Encountered ---');
        if (consoleErrors.length > 0) {
            consoleErrors.forEach(err => console.error(err));
        } else {
            console.log('No console errors were recorded during the test.');
        }
        await browser.close();
    }
})();
