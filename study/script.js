// Original jQuery-based lesson display logic (previously embedded in index.html)
$(document).ready(function() {
    let currentLessons = [];
    let currentLessonIndex = 0;
    let selectedTopic = null;
    let lessonStartTime = null; // To track when a lesson starts for duration calculation
    let lessonTimerInterval = null; // Holds the setInterval ID for the lesson timer
    const lessonTimerDuration = 60000; // 60 seconds in milliseconds

    const $lessonTitle = $('#lesson-title');
    const $lessonContent = $('#lesson-content');
    const $progressBarContainer = $('.progress-bar-container');
    const $progressBar = $('#progress-bar');
    const $topicButtons = $('.topic-btn');
    const $optionsDisclaimer = $('#options-disclaimer');
    const $lessonListContainer = $('#lesson-list-container'); // Cache the new element

    // --- IndexedDB ---
    let db;
    const DB_NAME = "StudyTrackerDB";
    const STORE_NAME = "studySessions";

    function initDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, 1);

            request.onupgradeneeded = function(event) {
                db = event.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                    store.createIndex("date", "date", { unique: false });
                    store.createIndex("topic", "topic", { unique: false }); // For topic-based stats
                    console.log("IndexedDB: Object store created.");
                }
            };

            request.onsuccess = function(event) {
                db = event.target.result;
                console.log("IndexedDB initialized successfully.");
                resolve(db);
            };

            request.onerror = function(event) {
                console.error("IndexedDB error:", event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    async function addStudySession(sessionData) {
        if (!db) {
            console.error("DB not initialized. Cannot add session.");
            return;
        }
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(sessionData);

            request.onsuccess = function() {
                console.log("Study session added to DB:", sessionData);
                resolve();
            };
            request.onerror = function(event) {
                console.error("Error adding study session:", event.target.error);
                reject(event.target.error);
            };
        });
    }

    async function getStudySessionsForDate(dateString) { // dateString in YYYY-MM-DD
        if (!db) return [];
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index("date");
            const request = index.getAll(dateString);

            request.onsuccess = function() {
                resolve(request.result || []);
            };
            request.onerror = function(event) {
                console.error("Error fetching sessions for date:", event.target.error);
                reject(event.target.error);
            };
        });
    }
    
    async function getAllStudySessions() {
        if (!db) return [];
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();

            request.onsuccess = function() {
                resolve(request.result || []);
            };
            request.onerror = function(event) {
                console.error("Error fetching all sessions:", event.target.error);
                reject(event.target.error);
            };
        });
    }


    function displayLesson(index) {
        // Remove active class from any previously active lesson link in the side panel
        $lessonListContainer.find('li.lesson-link').removeClass('active-lesson-link');

        if (index >= 0 && index < currentLessons.length) {
            const lesson = currentLessons[index];
            $lessonTitle.text(lesson.title).removeClass('clickable active-lesson'); // Title not clickable during lesson
            $lessonContent.html(lesson.content);
            currentLessonIndex = index;
            startLessonTimer(); // Start the 60-second timer

            // Add active class to the current lesson link in the side panel
            $lessonListContainer.find('li[data-lesson-index="' + index + '"]').addClass('active-lesson-link');

        } else if (currentLessons.length > 0 && index >= currentLessons.length) { // Topic completed
            $lessonTitle.text(selectedTopic.replace(/_/g, ' ') + " Topic Complete!").removeClass('clickable active-lesson');
            $lessonContent.html("<p class='instructions'>You have finished all lessons for this topic. Please select another topic from the buttons above, or choose this topic again to review.</p>");
            // $progressBar.css('width', '100%'); // No longer used for topic progress
            
            // Log the final lesson if active timer was running and not logged by timerEnded
            if (lessonTimerInterval && lessonStartTime && currentLessons.length > 0) {
                 clearInterval(lessonTimerInterval); // Stop timer
                 const lastLesson = currentLessons[currentLessons.length -1];
                 const duration = Math.round((Date.now() - lessonStartTime) / 1000); // Actual time spent
                 addStudySession({
                     date: new Date().toISOString().split('T')[0],
                     duration: duration,
                     lessonTitle: lastLesson.title,
                     topic: selectedTopic,
                     timestamp: Date.now()
                 }).then(() => {
                    renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
                 });
                 lessonStartTime = null;
                 lessonTimerInterval = null;
            }
            // Make title clickable to select a new topic or restart current
            $lessonTitle.addClass('clickable').text(`Click to start a new topic or re-study ${selectedTopic.replace(/_/g, ' ')}`);


            // Keep lessons available for review if user re-selects topic or for other UI purposes
            $optionsDisclaimer.removeClass('w3-show');
        } else { // Initial state or no lessons loaded
            $lessonTitle.text("Please Select a Topic Above").removeClass('clickable active-lesson');
            $lessonContent.html("<p class='instructions'>Welcome! Choose a subject from the buttons above to load lessons on that topic.</p>");
            $progressBar.css('width', '0%'); // Reset progress bar
            if(lessonTimerInterval) clearInterval(lessonTimerInterval); // Clear timer if any
            currentLessons = [];
            currentLessonIndex = 0;
            selectedTopic = null;
            displayLessonTitles([]); // Reset lesson titles panel
        }
    }

    // Function to display lesson titles in the side panel
    function displayLessonTitles(lessons) {
        $lessonListContainer.empty(); // Clear previous titles

        if (!lessons || lessons.length === 0) {
            $lessonListContainer.html('<p class="instructions">No lessons available for this topic, or please select a topic.</p>');
            return;
        }

        const $ul = $('<ul></ul>');
        lessons.forEach((lesson, index) => {
            const $li = $('<li></li>')
                .text(lesson.title)
                .attr('data-lesson-index', index)
                .addClass('lesson-link'); // Add a class for styling and event handling
            $ul.append($li);
        });
        $lessonListContainer.append($ul);
    }

    function startLessonTimer() {
        if (lessonTimerInterval) {
            clearInterval(lessonTimerInterval);
        }
        $progressBar.css('width', '0%');
        lessonStartTime = Date.now(); // Set/reset lesson start time
        let BORDER_LESSON_TITLE = $lessonTitle.text();
        $lessonTitle.removeClass('clickable');


        lessonTimerInterval = setInterval(() => {
            const elapsedTime = Date.now() - lessonStartTime;
            const progress = Math.min((elapsedTime / lessonTimerDuration) * 100, 100);
            $progressBar.css('width', progress + '%');

            if (elapsedTime >= lessonTimerDuration) {
                lessonTimerEnded();
            }
        }, 100); // Update every 100ms for smooth animation
    }

    async function lessonTimerEnded() {
        if (lessonTimerInterval) {
            clearInterval(lessonTimerInterval);
            lessonTimerInterval = null;
        }
        
        $lessonTitle.addClass('clickable').text("Time's up! Click for next lesson or select a new topic.");
        $progressBar.css('width', '100%'); // Ensure it shows full

        if (selectedTopic && currentLessons.length > 0 && currentLessonIndex < currentLessons.length) {
            const lesson = currentLessons[currentLessonIndex];
            const today = new Date().toISOString().split('T')[0];
            await addStudySession({ // Log with full 60-second duration
                date: today,
                duration: lessonTimerDuration / 1000, // Store in seconds
                lessonTitle: lesson.title,
                topic: selectedTopic,
                timestamp: Date.now()
            });
            console.log(`Lesson "${lesson.title}" ended (60s timer).`);
            await renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
        }
        lessonStartTime = null; // Reset start time
    }


    $topicButtons.on('click', function() {
        if (lessonTimerInterval) { // If a lesson timer is running, clear it and log partial
            clearInterval(lessonTimerInterval);
            lessonTimerInterval = null;
            if (lessonStartTime && selectedTopic && currentLessons.length > 0 && currentLessonIndex < currentLessons.length) {
                const lesson = currentLessons[currentLessonIndex];
                const duration = Math.round((Date.now() - lessonStartTime) / 1000);
                 addStudySession({
                    date: new Date().toISOString().split('T')[0],
                    duration: duration,
                    lessonTitle: lesson.title,
                    topic: selectedTopic,
                    timestamp: Date.now()
                }).then(() => renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear()));
            }
        }
        lessonStartTime = null;

        selectedTopic = $(this).data('topic');
        const jsonFile = 'topics_data/' + selectedTopic + '.json';
        $topicButtons.removeClass('active');
        $(this).addClass('active');

        if (selectedTopic === 'options_trading' || selectedTopic === 'advanced_quant_finance' || selectedTopic === 'finance_modeling') {
            $optionsDisclaimer.addClass('w3-show');
        } else {
            $optionsDisclaimer.removeClass('w3-show');
        }
        
        $lessonTitle.text(`Loading ${selectedTopic.replace(/_/g, ' ')}...`); // Loading message
        $lessonContent.html('<p class="instructions">Loading lessons...</p>');
        $progressBar.css('width', '0%');


        $.getJSON(jsonFile)
            .done(function(data) {
                if (data && data.length > 0) {
                    currentLessons = data;
                    displayLessonTitles(currentLessons); // Populate side panel
                    displayLesson(0); // This will start the timer for the first lesson
                } else {
                    $lessonTitle.text("No Lessons Found");
                    $lessonContent.html("<p class='instructions'>The selected topic '" + selectedTopic.replace(/_/g, ' ') + "' has no lessons or the file is empty/invalid.</p>");
                    $progressBar.css('width', '0%');
                    $lessonTitle.removeClass('clickable active-lesson');
                    currentLessons = []; currentLessonIndex = 0; 
                    $optionsDisclaimer.removeClass('w3-show');
                    displayLessonTitles([]); // Clear side panel
                }
            })
            .fail(function(jqXHR, textStatus, errorThrown) {
                $lessonTitle.text("Error Loading Topic");
                let errorMessage = "Could not load lessons for '" + (selectedTopic ? selectedTopic.replace(/_/g, ' ') : 'topic') + "'. File: " + jsonFile + ".<br>";
                errorMessage += "Status: " + textStatus + (errorThrown ? " - " + errorThrown : "");
                $lessonContent.html("<p class='instructions'>" + errorMessage + "</p>");
                $progressBar.css('width', '0%');
                $lessonTitle.removeClass('clickable active-lesson');
                currentLessons = []; currentLessonIndex = 0; selectedTopic = null; // Clear selectedTopic on load error
                $optionsDisclaimer.removeClass('w3-show');
                displayLessonTitles([]); // Clear side panel on failure
            });
    });

    // Event listener for lesson links in the side panel
    $lessonListContainer.on('click', '.lesson-link', function() {
        const $clickedLi = $(this);
        const targetIndex = parseInt($clickedLi.data('lesson-index'), 10);

        if (!isNaN(targetIndex) && currentLessons && targetIndex >= 0 && targetIndex < currentLessons.length) {
            // If a lesson was actively being timed (lessonStartTime is set)
            // AND this click is for a DIFFERENT lesson than the one being timed
            if (lessonStartTime && selectedTopic && currentLessons.length > 0 && currentLessonIndex < currentLessons.length && currentLessonIndex !== targetIndex) {
                // Clear current timer and log partial duration
                if (lessonTimerInterval) {
                    clearInterval(lessonTimerInterval);
                    lessonTimerInterval = null;
                }
                const lesson = currentLessons[currentLessonIndex];
                const duration = Math.round((Date.now() - lessonStartTime) / 1000); // Actual time spent

                if (duration > 0) {
                    addStudySession({
                        date: new Date().toISOString().split('T')[0],
                        duration: duration,
                        lessonTitle: lesson.title,
                        topic: selectedTopic,
                        timestamp: Date.now()
                    }).then(() => {
                        renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
                    });
                }
                lessonStartTime = null; // Reset, new lesson will set its own start time via startLessonTimer()
            }
            displayLesson(targetIndex);
        }
    });

    $lessonTitle.on('click', function() {
        if ($(this).hasClass('clickable')) {
            // Before advancing, log the completed lesson
            if (lessonStartTime && currentLessons.length > 0 && currentLessonIndex < currentLessons.length) {
                const lesson = currentLessons[currentLessonIndex];
                const duration = Math.round((Date.now() - lessonStartTime) / 1000); // seconds
                const today = new Date().toISOString().split('T')[0];
                addStudySession({
                    date: today,
                    duration: duration,
                    lessonTitle: lesson.title,
                    topic: selectedTopic,
                    timestamp: Date.now()
                }).then(() => {
                     renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear()); // Re-render calendar
                });
            }
            displayLesson(currentLessonIndex + 1);
        }
    });

    $progressBarContainer.on('click', function(event) {
        if (currentLessons.length > 0) {
            const $container = $(this);
            const containerWidth = $container.width();
            const clickX = event.offsetX;
            let targetIndex = Math.floor((clickX / containerWidth) * currentLessons.length);
            targetIndex = Math.max(0, Math.min(targetIndex, currentLessons.length - 1));
            
            // Log current lesson before jumping
            if (lessonStartTime && currentLessons.length > 0 && currentLessonIndex < currentLessons.length) {
                 const lesson = currentLessons[currentLessonIndex];
                 const duration = Math.round((Date.now() - lessonStartTime) / 1000);
                 const today = new Date().toISOString().split('T')[0];
                 addStudySession({
                     date: today,
                     duration: duration,
                     lessonTitle: lesson.title,
                     topic: selectedTopic,
                     timestamp: Date.now()
                 }).then(() => {
                    renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
                 });
            }
            displayLesson(targetIndex);
        }
    });

    // --- Calendar Logic ---
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYearSpan = document.getElementById('current-month-year');
    let currentCalendarDate = new Date();

    async function renderCalendar(month, year) {
        calendarGrid.innerHTML = ''; // Clear previous grid cells, keep headers if they are outside this element
        
        // Re-add day headers because the prompt's example clears everything.
        const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        daysOfWeek.forEach(day => {
            const dayHeader = document.createElement('div');
            // Using classes from HTML for consistency
            dayHeader.className = 'w3-center w3-padding-small w3-dark-grey calendar-day-header'; 
            dayHeader.textContent = day;
            calendarGrid.appendChild(dayHeader);
        });


        currentMonthYearSpan.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;
        
        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        
        // Ensure DB is initialized before fetching sessions
        if (!db) {
            console.log("DB not ready for calendar rendering, trying to init again.");
            await initDB(); // Make sure DB is ready
        }
        const allSessions = await getAllStudySessions(); 

        for (let i = 0; i < firstDayOfMonth; i++) {
            const emptyCell = document.createElement('div');
            emptyCell.classList.add('calendar-day', 'empty');
            calendarGrid.appendChild(emptyCell);
        }

        for (let day = 1; day <= daysInMonth; day++) {
            const dayCell = document.createElement('div');
            dayCell.classList.add('calendar-day');
            const dayNumberSpan = document.createElement('span');
            dayNumberSpan.classList.add('day-number');
            dayNumberSpan.textContent = day;
            dayCell.appendChild(dayNumberSpan);
            
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
            dayCell.dataset.date = dateStr;

            const today = new Date();
            if (day === today.getDate() && year === today.getFullYear() && month === today.getMonth()) {
                dayCell.classList.add('today');
            }

            const sessionsForDay = allSessions.filter(s => s.date === dateStr);
            if (sessionsForDay.length > 0) {
                dayCell.classList.add('has-data');
                const lessonsCompletedSpan = document.createElement('span');
                lessonsCompletedSpan.classList.add('lessons-completed');
                lessonsCompletedSpan.textContent = `${sessionsForDay.length} session(s)`;
                dayCell.appendChild(lessonsCompletedSpan);
            }
            
            dayCell.addEventListener('click', () => openStatsModal(dayCell.dataset.date));
            calendarGrid.appendChild(dayCell);
        }
    }

    document.getElementById('prev-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
        renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
    });

    document.getElementById('next-month').addEventListener('click', () => {
        currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
        renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
    });

    // --- Statistics Modal & Plotly ---
    const statsModal = document.getElementById('stats-modal');
    const modalDateSpan = document.getElementById('modal-date');
    const modalTimeStudiedSpan = document.getElementById('modal-time-studied');
    const modalTopicsCoveredSpan = document.getElementById('modal-topics-covered');
    const modalOverallStreakSpan = document.getElementById('modal-overall-streak');
    const modalOverallAverageSpan = document.getElementById('modal-overall-average');
    const modalTotalLessonsSpan = document.getElementById('modal-total-lessons');
    // Close buttons are handled by inline onclick in HTML for simplicity

    async function openStatsModal(dateString) {
        modalDateSpan.textContent = dateString;
        const sessionsForDay = await getStudySessionsForDate(dateString);
        
        let totalTimeToday = 0;
        let topicsToday = new Set();
        let lessonsTodayDetails = ""; // For listing lessons

        sessionsForDay.forEach(s => {
            totalTimeToday += s.duration;
            topicsToday.add(s.topic || 'General');
            lessonsTodayDetails += `<li>${s.lessonTitle} (${Math.round(s.duration/60)} min)</li>`;
        });
        modalTimeStudiedSpan.textContent = `${Math.round(totalTimeToday / 60)} minutes`;
        modalTopicsCoveredSpan.innerHTML = topicsToday.size > 0 ? `<ul>${lessonsTodayDetails}</ul>` : 'None';


        // Overall Stats
        const allSessions = await getAllStudySessions();
        let totalStudyTimeAll = 0;
        let lessonsCompletedAllCount = allSessions.length; // Each session is one lesson completion for this logic
        let studyDays = new Set();
        allSessions.forEach(s => {
            totalStudyTimeAll += s.duration;
            studyDays.add(s.date);
        });
        
        modalTotalLessonsSpan.textContent = lessonsCompletedAllCount; // Corrected variable name
        const avgStudyTime = studyDays.size > 0 ? Math.round((totalStudyTimeAll / studyDays.size) / 60) : 0;
        modalOverallAverageSpan.textContent = `${avgStudyTime} minutes/day`;
        
        // Calculate Streak
        let streak = 0;
        if (studyDays.size > 0) {
            const sortedDates = Array.from(studyDays).sort((a,b) => new Date(b) - new Date(a)); // Descending
            let checkDate = new Date(new Date().toISOString().split('T')[0]); // Today
            
            if (sortedDates[0] === checkDate.toISOString().split('T')[0]) { // Studied today
                streak = 1;
                checkDate.setDate(checkDate.getDate() - 1); // Move to yesterday
                for (let i = 1; i < sortedDates.length; i++) {
                    if (sortedDates[i] === checkDate.toISOString().split('T')[0]) {
                        streak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    } else if (new Date(sortedDates[i]) < new Date(checkDate.toISOString().split('T')[0])) {
                        break; // Gap in dates
                    }
                }
            } else { // Did not study today, check if yesterday was the last study day
                 checkDate.setDate(checkDate.getDate() - 1); // Yesterday
                 if (sortedDates[0] === checkDate.toISOString().split('T')[0]){
                    streak = 1; 
                    checkDate.setDate(checkDate.getDate() - 1); 
                    for (let i = 1; i < sortedDates.length; i++) {
                         if (sortedDates[i] === checkDate.toISOString().split('T')[0]) {
                             streak++;
                             checkDate.setDate(checkDate.getDate() - 1);
                         } else if (new Date(sortedDates[i]) < new Date(checkDate.toISOString().split('T')[0])) {
                             break; 
                         }
                     }
                 }
            }
        }
        modalOverallStreakSpan.textContent = `${streak} days`;

        // Plotly Chart 1: Study duration per day for the current calendar month
        const { month, year } = { month: currentCalendarDate.getMonth(), year: currentCalendarDate.getFullYear() };
        const daysInCurrentMonth = new Date(year, month + 1, 0).getDate();
        let monthlyDurations = Array(daysInCurrentMonth).fill(0);
        let daysOfMonthLabels = Array.from({length: daysInCurrentMonth}, (_, i) => String(i + 1));

        allSessions.forEach(s => {
            const sessionDate = new Date(s.date + "T00:00:00"); // Ensure local timezone interpretation
            if (sessionDate.getFullYear() === year && sessionDate.getMonth() === month) {
                monthlyDurations[sessionDate.getDate() - 1] += (s.duration / 60); // minutes
            }
        });
        
        const trace1 = {
            x: daysOfMonthLabels,
            y: monthlyDurations,
            type: 'bar',
            marker: { color: '#3498db' }
        };
        const layout1 = {
            title: `Daily Study Time - ${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`,
            xaxis: { title: 'Day of Month' },
            yaxis: { title: 'Minutes Studied' },
            margin: { t: 50, b: 40, l: 50, r: 20 },
            paper_bgcolor: '#f9f9f9',
            plot_bgcolor: '#f9f9f9'
        };
        
        let chartContainer = document.getElementById('chart1-container');
        if (!chartContainer) {
            chartContainer = document.createElement('div');
            chartContainer.id = 'chart1-container';
            const modalContent = statsModal.querySelector('.w3-container.w3-padding'); // The main content area of modal
            const hrElement = modalContent.querySelector('hr');
            if (hrElement) { // Insert before the HR separating daily and overall stats
                modalContent.insertBefore(chartContainer, hrElement);
            } else { // Fallback if HR is not there
                modalContent.appendChild(chartContainer);
            }
        }
        Plotly.newPlot('chart1-container', [trace1], layout1, {responsive: true});
        
        statsModal.style.display = 'block';
    }


    // --- Gemini API Call Template ---
    // Defined as per instructions, not called by any UI event by default.
    async function callGeminiAPI(inputText) {
        const apiKey = "JINXAI00aleamnelaweirasld0234fm345o8fydvhv9sdfvn8mcsl5v50497"; 
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${apiKey}`;

        const payload = {
            "contents": [
                {
                    "role": "user",
                    "parts": [ { "text": inputText } ]
                }
            ],
            "generationConfig": {
                "responseMimeType": "text/plain"
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorBody = await response.text();
                console.error(`Gemini API Error: ${response.status} ${response.statusText}`, errorBody);
                throw new Error(`API request failed with status ${response.status}: ${errorBody}`);
            }
            
            const responseText = await response.text();
            // console.log("Raw Gemini API Response Text:", responseText); 
            
            // Attempt to parse assuming it might be line-delimited JSON chunks,
            // common for streaming text/plain from Gemini.
            try {
                const lines = responseText.trim().split('\n');
                let extractedText = "";
                let inTextPart = false;
                lines.forEach(line => {
                    if (line.includes('"text": "')) {
                        try {
                            // This is a very basic way to grab text if it's in JSON-like lines
                            const textMatch = line.match(/"text":\s*"(.*?)"/);
                            if (textMatch && textMatch[1]) {
                                extractedText += textMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
                            }
                        } catch(e) { /* ignore lines not matching */ }
                    } else if (!line.startsWith('[') && !line.startsWith(']') && !line.startsWith('{') && !line.startsWith('}')) {
                        // If the line is not typical JSON structure, append it directly if it seems like plain text.
                        // This is a heuristic. A more robust parser for the specific stream format might be needed.
                        // extractedText += line + '\n'; 
                    }
                });
                 return extractedText.trim() || responseText; 
            } catch (e) {
                return responseText; // Fallback to raw text
            }

        } catch (error) {
            console.error('Error calling Gemini API:', error);
            return `Error: ${error.message}`;
        }
    }
    // Example of how callGeminiAPI might be used (NOT CALLED BY DEFAULT):
    // const someButton = document.getElementById('someButtonForGemini');
    // if (someButton) {
    //   someButton.addEventListener('click', async () => {
    //     const promptInput = document.getElementById('geminiPromptInput');
    //     if (promptInput && promptInput.value) {
    //       const result = await callGeminiAPI(promptInput.value);
    //       const resultArea = document.getElementById('geminiResultArea');
    //       if (resultArea) resultArea.textContent = result;
    //     } else {
    //       console.log("No prompt provided for Gemini API.");
    //     }
    //   });
    // }

    // --- GenAI Interaction Event Listeners ---
    $('#submit-genai-query').on('click', async function() {
        const $inputField = $('#genai-query-input');
        const queryText = $inputField.val().trim();
        const $responseArea = $('#genai-response-area');

        if (queryText) {
            $responseArea.html('<p class="w3-text-grey"><i>Thinking...</i></p>'); // Show thinking message
            try {
                const result = await callGeminiAPI(queryText);
                // Ensure the result is treated as plain text and line breaks are preserved
                $responseArea.text(result); 
            } catch (error) {
                console.error("Error from callGeminiAPI (Submit Query):", error);
                $responseArea.html(`<p class="w3-text-red">Error: ${error.message || 'Failed to get response from GenAI.'}</p>`);
            }
            $inputField.val(''); // Clear input field
        } else {
            $responseArea.html('<p class="w3-text-orange">Please type a query first.</p>');
        }
    });

    $('#elaborate-lesson-btn').on('click', async function() {
        // Get text content from #lesson-content. jQuery's .text() will get text from all child elements too.
        const lessonText = $lessonContent.text().trim(); 
        const $responseArea = $('#genai-response-area');

        if (selectedTopic && currentLessons.length > 0 && lessonText) {
            const currentLessonTitle = currentLessons[currentLessonIndex].title;
            const prompt = `Please elaborate on the following lesson content titled "${currentLessonTitle}":\n\n${lessonText}`;
            
            $responseArea.html('<p class="w3-text-grey"><i>Thinking... (Elaborating on current lesson)</i></p>');
            try {
                const result = await callGeminiAPI(prompt);
                $responseArea.text(result);
            } catch (error) {
                console.error("Error from callGeminiAPI (Elaborate Lesson):", error);
                $responseArea.html(`<p class="w3-text-red">Error: ${error.message || 'Failed to get elaboration from GenAI.'}</p>`);
            }
        } else if (!selectedTopic || currentLessons.length === 0) {
            $responseArea.html('<p class="w3-text-orange">Please load a lesson first before asking for elaboration.</p>');
        } else {
            $responseArea.html('<p class="w3-text-orange">Current lesson content is empty or could not be retrieved.</p>');
        }
    });


    // --- Initializations ---
    initDB().then(() => {
        console.log("DB initialized, rendering calendar.");
        renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
        displayLesson(-1); // Initial display for lessons
    }).catch(err => {
        console.error("Failed to initialize DB, calendar might not reflect stored data accurately.", err);
        // Still attempt to render calendar and lessons for basic functionality
        renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
        displayLesson(-1);
    });
});
