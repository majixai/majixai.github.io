// --- Mock DOM and APIs ---

// Mock document.getElementById
const mockElements = {};
global.document = {
    getElementById: (id) => {
        if (!mockElements[id]) {
            mockElements[id] = {
                textContent: '',
                innerHTML: '',
                classList: {
                    add: (className) => mockElements[id].className = (mockElements[id].className || '') + ' ' + className,
                    remove: (className) => {}
                },
                appendChild: (child) => {
                    // Simple appendChild mock for text content or basic structure
                    if (child.textContent) {
                        mockElements[id].innerHTML += child.textContent + '\n';
                    }
                },
                insertBefore: (newNode, referenceNode) => {
                     // Simplified: just add to innerHTML for testing output
                    if (newNode.textContent) {
                        mockElements[id].innerHTML = newNode.textContent + '\n' + mockElements[id].innerHTML;
                    }
                },
                style: {} // For things like tempErrorMsg.style.color
            };
        }
        return mockElements[id];
    },
    createElement: (tagName) => {
        // Basic element creation, primarily for textContent and appendChild
        const newElem = {
            tagName,
            textContent: '',
            innerHTML: '',
            classList: { add: (cn) => newElem.className = (newElem.className || '') + ' ' + cn },
            appendChild: (child) => {
                if (child.textContent) newElem.innerHTML += child.textContent;
            },
            style: {}
        };
        return newElem;

    }
};

// Mock Web Speech API
global.window = {
    SpeechRecognition: function() {
        this.lang = '';
        this.interimResults = false;
        this.maxAlternatives = 1;
        this.onresult = null;
        this.onerror = null;
        this.onnomatch = null;
        this.onspeechend = null;
        this.onend = null;

        this.start = () => { console.log("Mock SpeechRecognition: start()"); this.onstart && this.onstart(); };
        this.stop = () => { console.log("Mock SpeechRecognition: stop()"); this.onend && this.onend(); }; // Often onend is called after stop

        // Methods to simulate events
        this.simulateResult = (transcript) => {
            if (this.onresult) {
                this.onresult({ results: [[{ transcript: transcript, confidence: 1 }]] });
            }
        };
        this.simulateError = (error) => {
            if (this.onerror) {
                this.onerror({ error: error });
            }
        };
        this.simulateNoMatch = () => {
            if (this.onnomatch) {
                this.onnomatch();
            }
        };
        this.simulateSpeechEnd = () => {
            if (this.onspeechend) {
                this.onspeechend();
            }
        };
         this.simulateEnd = () => { // For the general 'end' event
            if (this.onend) {
                this.onend();
            }
        };
    },
    webkitSpeechRecognition: global.window.SpeechRecognition // For compatibility
};

// Mock setTimeout and clearInterval for timer testing (very basic)
global.setTimeout = (fn, ms) => { fn(); return 1; /* return a dummy id */ }; // Execute immediately for tests
global.setInterval = (fn, ms) => { fn(); return Date.now(); /* dummy interval id */ };
global.clearInterval = (id) => { console.log(`Mock clearInterval called for id: ${id}`); };


// --- Test Helper ---
function assertEquals(actual, expected, message) {
  // Using JSON.stringify for objects/arrays comparison, otherwise direct compare
  const actualString = typeof actual === 'object' ? JSON.stringify(actual) : actual;
  const expectedString = typeof expected === 'object' ? JSON.stringify(expected) : expected;

  if (actualString !== expectedString) {
    console.error(`Assertion Failed: ${message}. Expected "${expectedString}", got "${actualString}"`);
    return false;
  } else {
    console.log(`Assertion Passed: ${message}`);
    return true;
  }
}

function assertContains(haystack, needle, message) {
    if (!haystack.includes(needle)) {
        console.error(`Assertion Failed: ${message}. Expected "${haystack}" to contain "${needle}"`);
        return false;
    } else {
        console.log(`Assertion Passed: ${message}`);
        return true;
    }
}

function assert(condition, message) {
    if (!condition) {
        console.error(`Assertion Failed: ${message}`);
        return false;
    } else {
        console.log(`Assertion Passed: ${message}`);
        return true;
    }
}


// --- Test Suites ---

// These functions are from script.js and need to be accessible here.
// In a real module system, we would import them. For this setup, we'll redefine them
// or assume script.js has been loaded globally IF running in a browser.
// For a self-contained test.js, we need to copy/paste or re-implement parts.
// Given the constraints, I will assume `script.js` content is conceptually available.
// The actual `wordToNumber` etc. from script.js will be used when index.html loads both.

// For Node.js execution or pure self-contained test, we'd need to extract functions from script.js
// or use a proper module system. Let's proceed as if functions are globally available for now.
// This means these tests are best run in a browser after script.js is loaded.

// --- Mocks for script.js dependencies ---
let activeTimers = []; // From script.js
let timerCounter = 0; // From script.js

// Re-define functions from script.js that are not event handlers for easier testing
// Or, ensure script.js is loaded before test.js in the HTML.
// For this exercise, I'll assume they are available globally.

function testWordToNumber() {
    console.log("\n--- Testing wordToNumber ---");
    assertEquals(wordToNumber("one"), 1, "Test 'one'");
    assertEquals(wordToNumber("five"), 5, "Test 'five'");
    assertEquals(wordToNumber("ten"), 10, "Test 'ten'");
    assertEquals(wordToNumber("twenty"), 20, "Test 'twenty'");
    assertEquals(wordToNumber("sixty"), 60, "Test 'sixty'");
    assertEquals(wordToNumber("eleven"), 11, "Test 'eleven'");
    assertEquals(wordToNumber("thirty"), 30, "Test 'thirty'");
    assertEquals(wordToNumber("apple"), undefined, "Test invalid 'apple'"); // wordToNumber returns undefined for no match
    assertEquals(wordToNumber("NINe"), 9, "Test 'NINe' (case-insensitivity)");
}

function testFormatTimeDifference() {
    console.log("\n--- Testing formatTimeDifference ---");
    assertEquals(formatTimeDifference(60000), "1 minute 0 seconds", "Test 1 min 0 sec");
    assertEquals(formatTimeDifference(90000), "1 minute 30 seconds", "Test 1 min 30 sec");
    assertEquals(formatTimeDifference(3600000), "60 minutes 0 seconds", "Test 60 min 0 sec (1 hour)"); // As per current function
    assertEquals(formatTimeDifference(3661000), "61 minutes 1 second", "Test 61 min 1 sec");
    assertEquals(formatTimeDifference(0), "0 seconds", "Test 0 sec");
    assertEquals(formatTimeDifference(5000), "5 seconds", "Test 5 sec");
    assertEquals(formatTimeDifference(125000), "2 minutes 5 seconds", "Test 2 min 5 sec");
     // Test with hours if function is updated for it
    assertEquals(formatTimeDifference(3600000 * 2 + 180000 + 5000), "123 minutes 5 seconds", "Test >1 hour complex");
}


function testSpeechParsingAndTimerCreation() {
    console.log("\n--- Testing Speech Parsing and Timer Creation ---");
    // Reset global state for this test suite
    activeTimers = [];
    timerCounter = 0;
    mockElements['timer-display'] = { textContent: '', innerHTML: '', appendChild: function(el) { this.innerHTML += el.textContent + '<br>';} }; // Reset display

    // Get a new recognition instance for each sub-test or ensure state is clean
    const recognitionInstance = new window.SpeechRecognition();

    // Attach the result handler from script.js to this instance
    // This assumes the event listener setup in script.js is conceptually what we test
    // For a truly isolated unit test, we'd call the handler function directly.
    // Let's simulate the event listener attachment that would happen in DOMContentLoaded

    // Simplified: Directly call the logic that would be in onresult
    // This requires extracting the core logic of onresult from script.js
    // For now, let's assume `handleSpeechResult` is that extracted logic.
    // We'll need to define it or copy it here for isolated testing.

    // --- Replicating core onresult logic from script.js for testing ---
    const _handleSpeechResult = (transcript) => {
        let minutesParsed = null;
        const regex = /(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty)\s+(minute|minutes)/i;
        const match = transcript.match(regex);

        if (match && match[1]) {
            const numberStr = match[1];
            if (isNaN(numberStr)) {
                minutesParsed = wordToNumber(numberStr);
            } else {
                minutesParsed = parseInt(numberStr, 10);
            }

            if (minutesParsed !== null && !isNaN(minutesParsed) && minutesParsed > 0) {
                timerCounter++; // Uses global timerCounter
                const newTimerId = `test_timer_${Date.now()}_${timerCounter}`;
                const newTimerLabel = timerCounter;

                const timerDiv = document.createElement('div'); // Mocked
                timerDiv.classList.add('individual-timer-display');
                document.getElementById('timer-display').appendChild(timerDiv); // Mocked

                const newTimer = {
                    id: newTimerId,
                    label: newTimerLabel,
                    intervalId: null, // Will be set by mock setInterval
                    remainingSeconds: minutesParsed * 60,
                    endTime: Date.now() + (minutesParsed * 60 * 1000), // Approximate for test
                    displayElement: timerDiv, // Mocked div
                    active: true
                };
                activeTimers.push(newTimer); // Uses global activeTimers
                // In real script: startTimer(newTimerId);
                // In test: We can check activeTimers and the display element's content.
                // Mock `startTimer` behavior for test (immediate update)
                timerDiv.textContent = `Timer ${newTimerLabel}: ${String(minutesParsed).padStart(2, '0')}:00`;
                return minutesParsed;
            } else {
                document.getElementById('timer-display').textContent = "Could not understand a valid number of minutes.";
                return null;
            }
        } else {
            document.getElementById('timer-display').textContent = "Could not understand the timer command.";
            return null;
        }
    };
    // --- End of replicated logic ---

    let parsedMinutes;

    parsedMinutes = _handleSpeechResult("set timer for 5 minutes");
    assertEquals(parsedMinutes, 5, "Parse 'set timer for 5 minutes'");
    assertEquals(activeTimers.length, 1, "Active timers count after 1st timer");
    assert(activeTimers[0].endTime > Date.now(), "1st timer endTime is in future");
    assertEquals(activeTimers[0].remainingSeconds, 5 * 60, "1st timer remaining seconds");
    assertContains(mockElements['timer-display'].innerHTML, "Timer 1: 05:00", "1st timer display");


    parsedMinutes = _handleSpeechResult("timer for ten minutes");
    assertEquals(parsedMinutes, 10, "Parse 'timer for ten minutes'");
    assertEquals(activeTimers.length, 2, "Active timers count after 2nd timer");
    assertContains(mockElements['timer-display'].innerHTML, "Timer 2: 10:00", "2nd timer display");

    parsedMinutes = _handleSpeechResult("1 minute");
    assertEquals(parsedMinutes, 1, "Parse '1 minute'");
    assertEquals(activeTimers.length, 3, "Active timers count after 3rd timer");
    assertContains(mockElements['timer-display'].innerHTML, "Timer 3: 01:00", "3rd timer display");

    // For "forty five", wordToNumber needs to handle multi-word numbers, or regex needs to be smarter.
    // Current wordToNumber is single word. Let's test with a number it can handle.
    parsedMinutes = _handleSpeechResult("timer for twenty minutes please");
    assertEquals(parsedMinutes, 20, "Parse 'timer for twenty minutes please'");
    assertEquals(activeTimers.length, 4, "Active timers count after 4th timer");

    parsedMinutes = _handleSpeechResult("invalid input");
    assertEquals(parsedMinutes, null, "Parse 'invalid input'");
    assertEquals(activeTimers.length, 4, "Active timers count remains 4 after invalid input");
    assertContains(mockElements['timer-display'].textContent, "Could not understand the timer command.", "Invalid input message");

    parsedMinutes = _handleSpeechResult("timer for zero minutes");
    assertEquals(parsedMinutes, null, "Parse 'timer for zero minutes'");
    assertEquals(activeTimers.length, 4, "Active timers count remains 4 after zero minutes");
    assertContains(mockElements['timer-display'].textContent, "Could not understand a valid number of minutes.", "Zero minutes message");

    // Test endTime (approximate, due to Date.now())
    const now = Date.now();
    const timer1ExpectedEndTime = now + 5 * 60 * 1000;
    // Allow a small delta for execution time
    assert(Math.abs(activeTimers[0].endTime - timer1ExpectedEndTime) < 2000, "Timer 1 endTime calculation approx.");
}

function testUpdateClosenessDisplay() {
    console.log("\n--- Testing updateClosenessDisplay ---");
    // Reset and mock
    activeTimers = [];
    mockElements['end-times-closeness'] = { textContent: '', innerHTML: '' };

    // --- Replicating updateClosenessDisplay logic from script.js ---
    const _updateClosenessDisplay = () => {
        const displayDiv = document.getElementById('end-times-closeness'); // Mocked
        displayDiv.innerHTML = '';
        const timersWithEndTime = activeTimers.filter(t => t.endTime !== null);

        if (timersWithEndTime.length < 2) {
            displayDiv.textContent = "Need at least two timers to compare end times.";
            return;
        }

        for (let i = 0; i < timersWithEndTime.length; i++) {
            for (let j = i + 1; j < timersWithEndTime.length; j++) {
                const timerA = timersWithEndTime[i];
                const timerB = timersWithEndTime[j];
                const differenceMs = timerA.endTime - timerB.endTime;

                const p = document.createElement('p'); // Mocked
                p.textContent = `Timer ${timerA.label} & Timer ${timerB.label}: ${formatTimeDifference(differenceMs)} apart.`;
                displayDiv.appendChild(p); // Mocked (adds to innerHTML)
            }
        }
    };
    // --- End of replicated logic ---

    _updateClosenessDisplay();
    assertContains(mockElements['end-times-closeness'].textContent, "Need at least two timers", "Closeness with 0 timers");

    activeTimers = [
        { id: 't1', label: '1', endTime: Date.now() + 60000, active: true }, // Ends in 1 min
    ];
    _updateClosenessDisplay();
    assertContains(mockElements['end-times-closeness'].textContent, "Need at least two timers", "Closeness with 1 timer");

    activeTimers = [
        { id: 't1', label: '1', endTime: Date.now() + 60000, active: true },  // Ends in 1 min
        { id: 't2', label: '2', endTime: Date.now() + 120000, active: true } // Ends in 2 mins
    ];
    _updateClosenessDisplay();
    assertContains(mockElements['end-times-closeness'].innerHTML, "Timer 1 & Timer 2: 1 minute 0 seconds apart", "Closeness with 2 timers (T2 later)");

    activeTimers = [
        { id: 't1', label: 'A', endTime: Date.now() + 180000, active: true }, // Ends in 3 mins
        { id: 't2', label: 'B', endTime: Date.now() + 30000, active: true },  // Ends in 0.5 mins
        { id: 't3', label: 'C', endTime: Date.now() + 90000, active: true }   // Ends in 1.5 mins
    ];
    _updateClosenessDisplay();
    // Check for specific pairs. Order of pairs might vary.
    // T_A and T_B: 2min 30sec apart
    // T_A and T_C: 1min 30sec apart
    // T_B and T_C: 1min 0sec apart
    const closenessContent = mockElements['end-times-closeness'].innerHTML;
    assertContains(closenessContent, "Timer A & Timer B: 2 minutes 30 seconds apart.", "Closeness A & B");
    assertContains(closenessContent, "Timer A & Timer C: 1 minute 30 seconds apart.", "Closeness A & C");
    assertContains(closenessContent, "Timer B & Timer C: 1 minute 0 seconds apart.", "Closeness B & C");

    // Test with one timer finished (active: false, but has endTime)
     activeTimers = [
        { id: 't1', label: '1', endTime: Date.now() - 10000, active: false }, // Finished 10s ago
        { id: 't2', label: '2', endTime: Date.now() + 50000, active: true }  // Ends in 50s
    ];
    _updateClosenessDisplay();
    assertContains(mockElements['end-times-closeness'].innerHTML, "Timer 1 & Timer 2: 1 minute 0 seconds apart", "Closeness with one finished timer");

}


// --- Run Tests ---
// These functions need to be defined (copied from script.js or script.js loaded first)
// For this environment, we'll assume they are available.
// If running this file standalone (e.g. with Node.js after adding module.exports to script.js),
// you'd import them.

// Functions from script.js that test.js depends on:
// - wordToNumber
// - formatTimeDifference
// (The core logic of event handlers like onresult is replicated or called)

// Simulating that script.js has loaded and defined these globally for the browser context:
const wordToNumber = global.window.wordToNumber || function(word) {
    const words = {
        "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
        "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
        "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
        "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
        "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60
    };
    return words[word.toLowerCase()];
};

const formatTimeDifference = global.window.formatTimeDifference || function(ms) {
    if (ms < 0) ms = -ms;
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    seconds = seconds % 60;
    let hours = Math.floor(minutes / 60);
    minutes = minutes % 60;

    let str = "";
    // Original script.js doesn't use hours, but test case implies it might be desired
    if (hours > 0) str += `${hours} hour${hours > 1 ? 's' : ''} `;
    if (minutes > 0) str += `${minutes} minute${minutes > 1 ? 's' : ''} `;
    // Ensure "0 seconds" is displayed if ms is 0 and no larger units
    if (seconds >= 0 && str === "" || seconds > 0) str += `${seconds} second${seconds !== 1 ? 's' : ''}`;
    return str.trim() === "" ? "0 seconds" : str.trim(); // Handle case where all are zero
};


console.log("Starting Voice Timer Tests...");

testWordToNumber();
testFormatTimeDifference();
testSpeechParsingAndTimerCreation();
testUpdateClosenessDisplay();

console.log("\nVoice Timer Tests Finished.");
// End of test.js
