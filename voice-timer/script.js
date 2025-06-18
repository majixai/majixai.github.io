// This is the script file for the voice-activated timer.
document.addEventListener('DOMContentLoaded', () => {
    const activateButton = document.getElementById('activate-button');
    const mainTimerDisplay = document.getElementById('timer-display'); // Main container for individual timers
    const endTimesClosenessDisplay = document.getElementById('end-times-closeness');

    let activeTimers = []; // Stores { id, intervalId, remainingSeconds, endTime, displayElement, active }
    let timerCounter = 0; // To create unique IDs and labels

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
        const errorMsg = "Sorry, your browser doesn't support the Web Speech API. Try Chrome or Edge.";
        const p = document.createElement('p');
        p.textContent = errorMsg;
        mainTimerDisplay.appendChild(p);
        activateButton.disabled = true;
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    function wordToNumber(word) {
        const words = {
            "zero": 0, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
            "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
            "eleven": 11, "twelve": 12, "thirteen": 13, "fourteen": 14, "fifteen": 15,
            "sixteen": 16, "seventeen": 17, "eighteen": 18, "nineteen": 19, "twenty": 20,
            "thirty": 30, "forty": 40, "fifty": 50, "sixty": 60
        };
        return words[word.toLowerCase()];
    }

    function formatTimeDifference(ms) {
        if (ms < 0) ms = -ms;
        let seconds = Math.floor(ms / 1000);
        let minutes = Math.floor(seconds / 60);
        seconds = seconds % 60;
        let hours = Math.floor(minutes / 60);
        minutes = minutes % 60;

        let str = "";
        if (hours > 0) str += `${hours} hour${hours > 1 ? 's' : ''} `;
        if (minutes > 0) str += `${minutes} minute${minutes > 1 ? 's' : ''} `;
        if (seconds > 0 || str === "") str += `${seconds} second${seconds !== 1 ? 's' : ''}`;
        return str.trim();
    }

    function updateClosenessDisplay() {
        endTimesClosenessDisplay.innerHTML = ''; // Clear previous content
        const timersWithEndTime = activeTimers.filter(t => t.endTime !== null);

        if (timersWithEndTime.length < 2) {
            endTimesClosenessDisplay.textContent = "Need at least two timers to compare end times.";
            return;
        }

        for (let i = 0; i < timersWithEndTime.length; i++) {
            for (let j = i + 1; j < timersWithEndTime.length; j++) {
                const timerA = timersWithEndTime[i];
                const timerB = timersWithEndTime[j];
                const differenceMs = timerA.endTime - timerB.endTime;

                const p = document.createElement('p');
                p.textContent = `Timer ${timerA.label} & Timer ${timerB.label}: ${formatTimeDifference(differenceMs)} apart.`;
                endTimesClosenessDisplay.appendChild(p);
            }
        }
    }

    function updateTimerDisplay(timerId) {
        const timer = activeTimers.find(t => t.id === timerId);
        if (!timer || !timer.active) return;

        if (timer.remainingSeconds <= 0) {
            clearInterval(timer.intervalId);
            timer.intervalId = null;
            timer.active = false;
            timer.displayElement.textContent = `Timer ${timer.label}: Time's up!`;
            timer.displayElement.classList.add('timer-finished');
            updateClosenessDisplay(); // Update closeness when a timer finishes
            // Check if all timers are finished to potentially re-enable activate button if a limit was set
            return;
        }

        const minutes = Math.floor(timer.remainingSeconds / 60);
        const seconds = timer.remainingSeconds % 60;
        const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        timer.displayElement.textContent = `Timer ${timer.label}: ${formattedTime}`;
        timer.remainingSeconds--;
    }

    function startTimer(timerId) {
        const timer = activeTimers.find(t => t.id === timerId);
        if (!timer) return;

        if (timer.intervalId) { // Should not happen if logic is correct elsewhere
            clearInterval(timer.intervalId);
        }

        timer.active = true;
        updateTimerDisplay(timerId); // Call immediately
        timer.intervalId = setInterval(() => updateTimerDisplay(timerId), 1000);
        // activateButton remains enabled to add more timers
    }

    activateButton.addEventListener('click', () => {
        try {
            recognition.start();
            // No general "Listening..." message in main display, could be a small indicator near button
            console.log("Listening for timer command...");
            activateButton.disabled = true; // Disable while listening
        } catch (error) {
            console.error("Speech recognition start error:", error);
            // Display error temporarily or in a dedicated error area
            const tempErrorMsg = document.createElement('p');
            tempErrorMsg.textContent = `Error starting speech recognition: ${error.message}`;
            tempErrorMsg.style.color = 'red';
            mainTimerDisplay.insertBefore(tempErrorMsg, mainTimerDisplay.firstChild);
            setTimeout(() => tempErrorMsg.remove(), 3000);
            activateButton.disabled = false;
        }
    });

    recognition.addEventListener('result', (event) => {
        const transcript = event.results[0][0].transcript;
        console.log('Transcript:', transcript);
        activateButton.disabled = false; // Re-enable after transcript received

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
                console.log("Extracted minutes:", minutesParsed);
                timerCounter++;
                const newTimerId = `timer_${Date.now()}_${timerCounter}`;
                const newTimerLabel = timerCounter;

                const timerDiv = document.createElement('div');
                timerDiv.classList.add('individual-timer-display');
                timerDiv.id = newTimerId + "_display"; // For potential direct manipulation
                mainTimerDisplay.appendChild(timerDiv);

                const newTimer = {
                    id: newTimerId,
                    label: newTimerLabel,
                    intervalId: null,
                    remainingSeconds: minutesParsed * 60,
                    endTime: Date.now() + (minutesParsed * 60 * 1000),
                    displayElement: timerDiv,
                    active: true
                };
                activeTimers.push(newTimer);
                startTimer(newTimerId);
                updateClosenessDisplay(); // Update closeness when a new timer is added
            } else {
                console.log("Invalid or zero minutes parsed:", numberStr);
                // Display temp error, similar to speech start error
                const tempErrorMsg = document.createElement('p');
                tempErrorMsg.textContent = "Could not understand a valid number of minutes. (e.g., 'Set timer for 5 minutes').";
                tempErrorMsg.style.color = 'orange';
                mainTimerDisplay.insertBefore(tempErrorMsg, mainTimerDisplay.firstChild);
                setTimeout(() => tempErrorMsg.remove(), 3000);
            }
        } else {
            console.log("No minute pattern found in transcript:", transcript);
            const tempErrorMsg = document.createElement('p');
            tempErrorMsg.textContent = "Could not understand the timer command. (e.g., 'Set timer for 5 minutes').";
            tempErrorMsg.style.color = 'orange';
            mainTimerDisplay.insertBefore(tempErrorMsg, mainTimerDisplay.firstChild);
            setTimeout(() => tempErrorMsg.remove(), 3000);
        }
    });

    recognition.addEventListener('error', (event) => {
        console.error('Speech recognition error:', event.error);
        const tempErrorMsg = document.createElement('p');
        tempErrorMsg.textContent = `Error recognizing speech: ${event.error}`;
        tempErrorMsg.style.color = 'red';
        mainTimerDisplay.insertBefore(tempErrorMsg, mainTimerDisplay.firstChild);
        setTimeout(() => tempErrorMsg.remove(), 3000);
        activateButton.disabled = false;
    });

    recognition.addEventListener('nomatch', () => {
        console.log('No speech recognized');
        const tempErrorMsg = document.createElement('p');
        tempErrorMsg.textContent = "No speech recognized, please try again.";
        tempErrorMsg.style.color = 'orange';
        mainTimerDisplay.insertBefore(tempErrorMsg, mainTimerDisplay.firstChild);
        setTimeout(() => tempErrorMsg.remove(), 3000);
        activateButton.disabled = false;
    });

    recognition.addEventListener('speechend', () => {
        console.log('Speech ended.');
        // Button is re-enabled in 'result', 'error', 'nomatch' or 'end'
        // This event is just for logging or specific UI cues if needed.
    });

    recognition.addEventListener('end', () => {
        console.log('Recognition service ended.');
        // Ensure button is enabled if it was disabled for listening and no result/error/nomatch happened.
        if (activateButton.disabled) {
            activateButton.disabled = false;
        }
    });
});
