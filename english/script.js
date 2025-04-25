// Define a class to manage the entire application logic
class LessonApp {
    constructor() {
        // Get DOM elements and store them as instance properties
        this.lessonTitle = document.getElementById('lesson-title');
        this.lessonContent = document.getElementById('lesson-content');
        this.progressBar = document.getElementById('progress-bar');
        this.topicSelector = document.getElementById('topic-selector');
        this.topicButtons = document.querySelectorAll('.topic-btn');
        this.optionsDisclaimer = document.getElementById('options-disclaimer'); // Get the disclaimer element

        // Application State
        this.lessons = []; // Lessons for the currently selected topic
        this.currentTopic = null; // Name of the currently selected topic
        this.timerInterval = null; // Holds the interval ID for the timer
        this.timerDuration = 60000; // 60 seconds in milliseconds
        this.lastLessonIndex = -1; // Index of the previously shown lesson for the current topic
        this.currentLessonActive = false; // Flag to indicate if a lesson timer is running

        // localStorage key
        this.localStorageTopicKey = 'lastLessonTopic';
    }

    // --- Initialization Method ---
    init() {
        console.log("LessonApp initialized.");
        this.setupEventListeners();
        this.loadSavedTopic(); // Attempt to load the last topic on startup
    }

    // --- Setup Event Listeners ---
    setupEventListeners() {
        // Listener for the main lesson title (to get a new lesson)
        this.lessonTitle.addEventListener('click', () => {
            // Only display a new lesson if the title is marked as clickable
            if (this.lessonTitle.classList.contains('clickable')) {
                this.displayRandomLesson();
            }
        });

        // Listeners for each topic selection button
        this.topicButtons.forEach(button => {
            button.addEventListener('click', () => {
                const topic = button.getAttribute('data-topic');
                if (topic && topic !== this.currentTopic) { // Only load if it's a different topic
                    this.selectTopic(topic, button);
                }
            });
        });

        // Listen for changes in localStorage in other tabs/windows (optional but good practice)
        window.addEventListener('storage', (event) => {
            if (event.key === this.localStorageTopicKey && event.newValue !== this.currentTopic) {
                 console.log("Storage change detected for topic, reloading...");
                 this.loadSavedTopic(); // Reload topic if it changed elsewhere
            }
        });
    }

    // --- Handle Topic Selection ---
    async selectTopic(topic, clickedButton) {
        console.log(`Topic selected: ${topic}`);

        // Update button active states
        this.topicButtons.forEach(btn => btn.classList.remove('active'));
        clickedButton.classList.add('active');

        // Save the selected topic to localStorage
        this.saveSelectedTopic(topic);

        // Reset UI and state before loading
        this.resetLessonState(); // Stop timer, reset progress, clear content
        this.currentTopic = topic;
        this.lessonTitle.textContent = `Loading ${this.formatTopicName(topic)} lessons...`;
        this.lessonTitle.classList.remove('clickable', 'active');
        this.lessonContent.innerHTML = '<p class="instructions">Loading...</p>';
        this.toggleDisclaimer(false); // Hide disclaimer while loading

        // Load the lessons
        await this.loadLessons(topic); // Use await here

        // Update UI based on load result handled within loadLessons
    }

    // --- Fetch Lessons using Async/Await ---
    async loadLessons(topic) {
        const filename = `${topic}.json`;
        console.log(`Fetching: ${filename}`);

        try {
            const response = await fetch(filename); // Use await with fetch

            if (!response.ok) {
                 // Throw error with more details if available
                 const text = await response.text(); // Await text reading
                 throw new Error(`HTTP error! Status: ${response.status} loading ${filename}. Message: ${text || 'No additional message'}`);
            }

            this.lessons = await response.json(); // Use await with .json()
            console.log(`${topic} lessons loaded successfully:`, this.lessons.length);

            // Update UI after successful load
            if (this.lessons.length > 0) {
                this.lessonTitle.textContent = `Click Here for a ${this.formatTopicName(topic)} Lesson!`;
                this.lessonTitle.classList.add('clickable'); // Make title clickable
                this.lessonContent.innerHTML = `<p class="instructions">Click the title above to start a random ${this.formatTopicName(topic)} lesson.</p>`;
                this.toggleDisclaimer(topic === 'options_trading' || topic === 'finance_modeling' || topic === 'advanced_quant_finance'); // Show disclaimer if relevant topic
            } else {
                this.lessonTitle.textContent = `No lessons found for ${this.formatTopicName(topic)}.`;
                this.lessonContent.innerHTML = `<p class="instructions">Could not find any lessons in ${filename}.</p>`;
                this.lessonTitle.classList.remove('clickable'); // Not clickable if no lessons
            }

        } catch (error) {
            console.error(`Error loading ${topic} lessons:`, error);
            let errorMessage = `Error loading ${this.formatTopicName(topic)} lessons. Please check the console or try again later.<br>Details: ${error.message}`;
             if (error.message.includes('JSON at position') || error.message.includes('SyntaxError')) {
                 errorMessage += `<br>This might indicate an error in the structure of the '${filename}' file.`
             } else if (error.message.includes('404')) {
                  errorMessage += `<br>Could not find the '${filename}' file. Make sure it's in the same directory.`
             }
            this.lessonContent.innerHTML = `<p class="instructions" style="color: red; text-align: left; padding: 10px;">${errorMessage}</p>`;
            this.lessonTitle.textContent = `Error Loading ${this.formatTopicName(topic)} Lessons`;
            this.lessonTitle.classList.remove('clickable', 'active'); // Not clickable on error
            this.toggleDisclaimer(false); // Hide disclaimer on error
        }
    }

    // --- Display a Random Lesson ---
    displayRandomLesson() {
        if (this.currentLessonActive || this.lessons.length === 0) {
             // Already running, or no lessons loaded
             console.log("Attempted to display lesson but conditions not met.");
            return;
        }

        this.currentLessonActive = true; // Set flag
        this.resetLessonState(); // Ensure reset (mostly timer/progress)

        let randomIndex;
        if (this.lessons.length > 1) {
            // Select a random lesson, trying not to repeat immediately
            do {
                randomIndex = Math.floor(Math.random() * this.lessons.length);
            } while (randomIndex === this.lastLessonIndex);
        } else {
            randomIndex = 0; // Only one lesson available
        }
        this.lastLessonIndex = randomIndex;

        const selectedLesson = this.lessons[randomIndex];

        // Update UI with lesson content
        this.lessonTitle.textContent = selectedLesson.title;
        this.lessonTitle.classList.remove('clickable');
        this.lessonTitle.classList.add('active');
        this.lessonContent.innerHTML = selectedLesson.content;
        this.lessonContent.scrollTop = 0; // Scroll to top for potentially long content

         // Show disclaimer again if it's a relevant topic
         this.toggleDisclaimer(this.currentTopic === 'options_trading' || this.currentTopic === 'finance_modeling' || this.currentTopic === 'advanced_quant_finance');


        // Start the timer
        this.startLessonTimer();
    }

    // --- Start the 60-second Timer ---
    startLessonTimer() {
        let startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsedTime = Date.now() - startTime;
            const progress = Math.min((elapsedTime / this.timerDuration) * 100, 100); // Cap at 100%
            this.progressBar.style.width = progress + '%';

            if (elapsedTime >= this.timerDuration) {
                this.timerEnded();
            }
        }, 100); // Update progress bar every 100ms
    }

    // --- Handle Timer Ending ---
    timerEnded() {
        clearInterval(this.timerInterval);
        this.timerInterval = null; // Clear the interval ID
        this.lessonTitle.textContent = "Time's up! Click for another lesson.";
        this.lessonTitle.classList.add('clickable');
        this.lessonTitle.classList.remove('active');
        this.currentLessonActive = false; // Reset active flag
         // Keep disclaimer visible after time's up if it's relevant
         this.toggleDisclaimer(this.currentTopic === 'options_trading' || this.currentTopic === 'finance_modeling' || this.currentTopic === 'advanced_quant_finance');

        // Optional: Clear lesson content after timer ends, or leave it visible
        // this.lessonContent.innerHTML = `<p class="instructions">Time's up for the last lesson. Click the title above for a new ${this.formatTopicName(this.currentTopic)} lesson.</p>`;
    }

    // --- Reset State (called on new topic or timer end) ---
    resetLessonState() {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
        this.progressBar.style.width = '0%';
        this.currentLessonActive = false;
        // Don't reset lessons array or currentTopic here, as this is for state within a topic or after timer.
        // Lessons array and currentTopic are reset in selectTopic().
    }

    // --- Local Storage ---
    saveSelectedTopic(topic) {
        try {
            localStorage.setItem(this.localStorageTopicKey, topic);
            console.log(`Saved topic '${topic}' to localStorage.`);
        } catch (e) {
            console.error("Error saving to localStorage:", e);
             // Handle potential storage full errors etc.
        }
    }

    loadSavedTopic() {
        try {
            const savedTopic = localStorage.getItem(this.localStorageTopicKey);
            if (savedTopic) {
                console.log(`Loaded topic '${savedTopic}' from localStorage.`);
                // Find and visually activate the corresponding button
                const savedTopicButton = document.querySelector(`.topic-btn[data-topic="${savedTopic}"]`);
                if (savedTopicButton) {
                    // Programmatically click the button to trigger loading
                    savedTopicButton.click();
                } else {
                     console.warn(`Saved topic button not found for topic: ${savedTopic}.`);
                     this.showInitialState(); // Show initial message if saved topic button doesn't exist
                }
            } else {
                 console.log("No topic found in localStorage.");
                 this.showInitialState(); // Show initial message if no saved topic
            }
        } catch (e) {
            console.error("Error loading from localStorage:", e);
            this.showInitialState(); // Show initial message if localStorage read fails
        }
    }

    // --- Helper Functions ---
    formatTopicName(topic) {
        // Simple formatting: replace underscores with spaces, capitalize words
        if (!topic) return "a topic";
        return topic.replace(/_/g, ' ').split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    }

     toggleDisclaimer(show) {
         if (this.optionsDisclaimer) { // Check if the element exists
              if (show) {
                  // Add W3.CSS class if needed, or just change style
                  this.optionsDisclaimer.style.display = 'block';
                  // Optional: add w3-show if using that class for hiding
                  // this.optionsDisclaimer.classList.add('w3-show');
              } else {
                  this.optionsDisclaimer.style.display = 'none';
                   // Optional: remove w3-show if using that class for hiding
                  // this.optionsDisclaimer.classList.remove('w3-show');
              }
         }
     }

     showInitialState() {
         this.lessonTitle.textContent = 'Please Select a Topic Above';
         this.lessonTitle.classList.remove('clickable', 'active'); // Ensure it's not clickable
         this.lessonContent.innerHTML = '<p class="instructions">Welcome! Choose a subject from the buttons above to load lessons on that topic.</p>';
         this.toggleDisclaimer(false); // Hide disclaimer initially
         this.progressBar.style.width = '0%'; // Ensure progress is reset
         this.topicButtons.forEach(btn => btn.classList.remove('active')); // Ensure no button is active visually
     }
}

// --- Instantiate and Initialize the App when the DOM is ready ---
document.addEventListener('DOMContentLoaded', () => {
    const app = new LessonApp();
    app.init();
});
