const lessonTitle = document.getElementById('lesson-title');
const lessonContent = document.getElementById('lesson-content');
const progressBar = document.getElementById('progress-bar');
const topicSelector = document.getElementById('topic-selector');
const topicButtons = document.querySelectorAll('.topic-btn');
const optionsDisclaimer = document.getElementById('options-disclaimer');

let lessons = []; // Array to hold lessons for the CURRENTLY selected topic
let currentTopic = null;
let timerInterval = null;
const timerDuration = 60000; // 60 seconds in milliseconds
let lastLessonIndex = -1;
let currentLessonActive = false;

// --- Core Lesson Display Logic (Mostly Unchanged) ---
function displayRandomLesson() {
    if (currentLessonActive || lessons.length === 0) {
        console.log("Lesson already active or no lessons loaded for this topic.");
        return;
    }
    currentLessonActive = true;
    clearInterval(timerInterval);
    progressBar.style.width = '0%';

    let randomIndex;
    if (lessons.length > 1) {
        do {
            randomIndex = Math.floor(Math.random() * lessons.length);
        } while (randomIndex === lastLessonIndex);
    } else if (lessons.length === 1) {
        randomIndex = 0;
    } else {
        lessonContent.innerHTML = '<p class="instructions">No lessons available for this topic.</p>';
        currentLessonActive = false;
        return;
    }
    lastLessonIndex = randomIndex;

    const selectedLesson = lessons[randomIndex];

    lessonTitle.textContent = selectedLesson.title;
    lessonTitle.classList.remove('clickable');
    lessonTitle.classList.add('active');
    lessonContent.innerHTML = selectedLesson.content; // Display lesson content

    // Show disclaimer ONLY if options trading topic is active AND lesson content loaded
    optionsDisclaimer.style.display = (currentTopic === 'options_trading') ? 'block' : 'none';


    lessonContent.scrollTop = 0;

    let startTime = Date.now();
    timerInterval = setInterval(() => {
        const elapsedTime = Date.now() - startTime;
        const progress = Math.min((elapsedTime / timerDuration) * 100, 100);
        progressBar.style.width = progress + '%';

        if (elapsedTime >= timerDuration) {
            clearInterval(timerInterval);
            lessonTitle.textContent = "Time's up! Click for another lesson.";
            lessonTitle.classList.add('clickable');
            lessonTitle.classList.remove('active');
            currentLessonActive = false;
             // Keep disclaimer visible after time's up if it's options
            optionsDisclaimer.style.display = (currentTopic === 'options_trading') ? 'block' : 'none';

        }
    }, 100);
}

// --- Fetch lessons based on selected topic ---
function loadLessons(topic) {
    // Reset state before loading new topic
    currentTopic = topic;
    lessons = []; // Clear previous lessons
    clearInterval(timerInterval); // Stop any running timer
    currentLessonActive = false;
    progressBar.style.width = '0%';
    lessonTitle.textContent = `Loading ${topic.replace('_', ' ')} lessons...`;
    lessonTitle.classList.remove('clickable', 'active');
    lessonContent.innerHTML = '<p class="instructions">Loading...</p>';
    optionsDisclaimer.style.display = 'none'; // Hide disclaimer initially
    lastLessonIndex = -1; // Reset last lesson index


    const filename = `${topic}.json`;
    console.log(`Fetching: ${filename}`);

    fetch(filename)
        .then(response => {
            if (!response.ok) {
                 return response.text().then(text => {
                    throw new Error(`HTTP error! Status: ${response.status} loading ${filename}. Message: ${text || 'No additional message'}`);
                 });
            }
            return response.json();
        })
        .then(data => {
            lessons = data;
            console.log(`${topic} lessons loaded successfully:`, lessons.length);

            if (lessons.length > 0) {
                lessonTitle.textContent = `Click Here for a ${topic.replace('_', ' ')} Lesson!`;
                lessonTitle.classList.add('clickable'); // Make title clickable now
                lessonContent.innerHTML = `<p class="instructions">Click the title above to start a random ${topic.replace('_', ' ')} lesson.</p>`;
                 // Show disclaimer if options trading topic loaded successfully
                optionsDisclaimer.style.display = (topic === 'options_trading') ? 'block' : 'none';
            } else {
                 lessonTitle.textContent = `No lessons found for ${topic.replace('_', ' ')}.`;
                 lessonContent.innerHTML = `<p class="instructions">Could not find any lessons in ${filename}.</p>`;
            }

        })
        .catch(error => {
            console.error(`Error loading ${topic} lessons:`, error);
            let errorMessage = `Error loading ${topic.replace('_', ' ')} lessons. Please check the console or try again later.<br>Details: ${error.message}`;
             if (error.message.includes('JSON at position')) {
                 errorMessage += `<br>This might indicate an error in the structure of the '${filename}' file.`
             } else if (error.message.includes('404')) {
                  errorMessage += `<br>Could not find the '${filename}' file. Make sure it's in the same directory.`
             }
            lessonContent.innerHTML = `<p class="instructions" style="color: red; text-align: left; padding: 10px;">${errorMessage}</p>`;
            lessonTitle.textContent = `Error Loading ${topic.replace('_', ' ')} Lessons`;
            lessonTitle.classList.remove('clickable', 'active');
        });
}

// --- Event Listeners ---

// Add click listener to the lesson title (but only works when clickable)
lessonTitle.addEventListener('click', () => {
    if (lessonTitle.classList.contains('clickable')) {
        displayRandomLesson();
    }
});

// Add click listeners to topic buttons
topicButtons.forEach(button => {
    button.addEventListener('click', () => {
        // Remove active class from all buttons
        topicButtons.forEach(btn => btn.classList.remove('active'));
        // Add active class to the clicked button
        button.classList.add('active');
        // Load lessons for the selected topic
        const topic = button.getAttribute('data-topic');
        loadLessons(topic);
    });
});

// --- Initialisation ---
// Set initial state message (user needs to select topic)
lessonContent.innerHTML = '<p class="instructions">Please select a topic above to begin.</p>';
