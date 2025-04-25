const lessonTitle = document.getElementById('lesson-title');
const lessonContent = document.getElementById('lesson-content');
const progressBar = document.getElementById('progress-bar');

let lessons = []; // Array to hold lessons loaded from JSON
let timerInterval = null;
const timerDuration = 60000; // 60 seconds in milliseconds
let lastLessonIndex = -1; // Keep track of the last lesson shown
let currentLessonActive = false; // Flag to prevent starting multiple lessons

// Function to display a random lesson
function displayRandomLesson() {
    // Prevent starting a new lesson if one is already running
    if (currentLessonActive) {
        console.log("Lesson already in progress.");
        return;
    }

    // Check if lessons are loaded
    if (lessons.length === 0) {
        lessonContent.innerHTML = '<p class="instructions">Error: Lessons not loaded. Please try refreshing.</p>';
        console.error("Attempted to display lesson, but lessons array is empty.");
        return;
    }

    currentLessonActive = true; // Set flag

    // Clear any previous timer
    clearInterval(timerInterval);
    progressBar.style.width = '0%'; // Reset progress bar visually

    // Select a random lesson different from the last one (if possible)
    let randomIndex;
    if (lessons.length > 1) {
        do {
            randomIndex = Math.floor(Math.random() * lessons.length);
        } while (randomIndex === lastLessonIndex);
    } else if (lessons.length === 1) {
        randomIndex = 0;
    } else {
        // Should not happen if check above works, but safe fallback
        lessonContent.innerHTML = '<p class="instructions">No lessons available.</p>';
        currentLessonActive = false;
        return;
    }
    lastLessonIndex = randomIndex;

    const selectedLesson = lessons[randomIndex];

    // Update title and content
    lessonTitle.textContent = selectedLesson.title;
    lessonTitle.classList.remove('clickable');
    lessonTitle.classList.add('active');
    lessonContent.innerHTML = selectedLesson.content; // Use innerHTML to render HTML tags from JSON

    // Start the timer and progress bar
    let startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min((elapsedTime / timerDuration) * 100, 100); // Cap at 100%
        progressBar.style.width = progress + '%';

        if (elapsedTime >= timerDuration) {
            clearInterval(timerInterval);
            lessonTitle.textContent = "Time's up! Click for another lesson.";
            lessonTitle.classList.add('clickable');
            lessonTitle.classList.remove('active');
            currentLessonActive = false; // Reset flag
            // Optional: Clear content after timer ends
            // lessonContent.innerHTML = '<p class="instructions">Click the title above for a new lesson.</p>';
        }
    }, 100); // Update progress bar every 100ms
}

// --- Fetch lessons from JSON file ---
function loadLessons() {
    fetch('lessons.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            lessons = data; // Store fetched lessons in the global array
            console.log("Lessons loaded successfully:", lessons.length);
            // Update initial state message now that lessons are loaded
            lessonContent.innerHTML = '<p class="instructions">Click the title above to start. A new random lesson will appear, and the timer will begin.</p>';
            // Add event listener ONLY after lessons are loaded
            lessonTitle.addEventListener('click', displayRandomLesson);
            lessonTitle.classList.add('clickable'); // Ensure title is clickable
        })
        .catch(error => {
            console.error('Error loading lessons:', error);
            lessonContent.innerHTML = `<p class="instructions" style="color: red;">Error loading lessons. Please check the console or try again later.<br>(${error.message})</p>`;
            lessonTitle.textContent = "Error Loading Lessons";
            lessonTitle.classList.remove('clickable'); // Not clickable if loading failed
        });
}

// --- Initialisation ---
// Set initial loading message
lessonContent.innerHTML = '<p class="instructions">Loading lessons...</p>';
// Start loading lessons when the script runs
loadLessons();
