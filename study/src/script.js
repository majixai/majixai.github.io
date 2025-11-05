document.addEventListener('DOMContentLoaded', () => {
    let currentLessons = [];
    let currentLessonIndex = 0;
    let selectedTopic = null;
    let lessonStartTime = null;
    let lessonTimerInterval = null;
    const lessonTimerDuration = 60000; // 60 seconds

    const lessonTitle = document.getElementById('lesson-title');
    const lessonContent = document.getElementById('lesson-content');
    const progressBarContainer = document.querySelector('.progress-bar-container');
    const progressBar = document.getElementById('progress-bar');
    const topicButtons = document.querySelectorAll('.topic-btn');
    const optionsDisclaimer = document.getElementById('options-disclaimer');
    const lessonListContainer = document.getElementById('lesson-list-container');

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
                    store.createIndex("topic", "topic", { unique: false });
                }
            };

            request.onsuccess = function(event) {
                db = event.target.result;
                resolve(db);
            };

            request.onerror = function(event) {
                console.error("IndexedDB error:", event.target.errorCode);
                reject(event.target.errorCode);
            };
        });
    }

    async function addStudySession(sessionData) {
        if (!db) return;
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readwrite");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.add(sessionData);
            request.onsuccess = () => resolve();
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async function getStudySessionsForDate(dateString) {
        if (!db) return [];
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const index = store.index("date");
            const request = index.getAll(dateString);
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    async function getAllStudySessions() {
        if (!db) return [];
        return new Promise((resolve, reject) => {
            const transaction = db.transaction([STORE_NAME], "readonly");
            const store = transaction.objectStore(STORE_NAME);
            const request = store.getAll();
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event) => reject(event.target.error);
        });
    }

    function displayLesson(index) {
        lessonListContainer.querySelectorAll('li.lesson-link').forEach(link => link.classList.remove('active-lesson-link'));

        if (index >= 0 && index < currentLessons.length) {
            const lesson = currentLessons[index];
            lessonTitle.textContent = lesson.title;
            lessonTitle.classList.remove('clickable', 'active-lesson');
            lessonContent.innerHTML = lesson.content;
            currentLessonIndex = index;
            startLessonTimer();

            const activeLink = lessonListContainer.querySelector(`li[data-lesson-index="${index}"]`);
            if (activeLink) {
                activeLink.classList.add('active-lesson-link');
            }
        } else if (currentLessons.length > 0 && index >= currentLessons.length) {
            lessonTitle.textContent = `${selectedTopic.replace(/_/g, ' ')} Topic Complete!`;
            lessonTitle.classList.remove('active-lesson');
            lessonContent.innerHTML = "<p class='instructions'>You have finished all lessons. Select another topic or review this one.</p>";

            if (lessonTimerInterval && lessonStartTime && currentLessons.length > 0) {
                clearInterval(lessonTimerInterval);
                const lastLesson = currentLessons[currentLessons.length - 1];
                const duration = Math.round((Date.now() - lessonStartTime) / 1000);
                addStudySession({
                    date: new Date().toISOString().split('T')[0],
                    duration: duration,
                    lessonTitle: lastLesson.title,
                    topic: selectedTopic,
                    timestamp: Date.now()
                }).then(() => renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear()));
                lessonStartTime = null;
                lessonTimerInterval = null;
            }
            lessonTitle.classList.add('clickable');
            lessonTitle.textContent = `Click to start a new topic or re-study ${selectedTopic.replace(/_/g, ' ')}`;
            optionsDisclaimer.classList.remove('w3-show');
        } else {
            lessonTitle.textContent = "Please Select a Topic Above";
            lessonTitle.classList.remove('clickable', 'active-lesson');
            lessonContent.innerHTML = "<p class='instructions'>Welcome! Choose a subject to load lessons.</p>";
            progressBar.style.width = '0%';
            if (lessonTimerInterval) clearInterval(lessonTimerInterval);
            currentLessons = [];
            currentLessonIndex = 0;
            selectedTopic = null;
            displayLessonTitles([]);
        }
    }

    function displayLessonTitles(lessons) {
        lessonListContainer.innerHTML = '';
        if (!lessons || lessons.length === 0) {
            lessonListContainer.innerHTML = '<p class="instructions">No lessons available.</p>';
            return;
        }

        const ul = document.createElement('ul');
        lessons.forEach((lesson, index) => {
            const li = document.createElement('li');
            li.textContent = lesson.title;
            li.dataset.lessonIndex = index;
            li.classList.add('lesson-link');
            ul.appendChild(li);
        });
        lessonListContainer.appendChild(ul);
    }

    function startLessonTimer() {
        if (lessonTimerInterval) clearInterval(lessonTimerInterval);
        progressBar.style.width = '0%';
        lessonStartTime = Date.now();
        lessonTitle.classList.remove('clickable');

        lessonTimerInterval = setInterval(() => {
            const elapsedTime = Date.now() - lessonStartTime;
            const progress = Math.min((elapsedTime / lessonTimerDuration) * 100, 100);
            progressBar.style.width = `${progress}%`;

            if (elapsedTime >= lessonTimerDuration) {
                lessonTimerEnded();
            }
        }, 100);
    }

    async function lessonTimerEnded() {
        if (lessonTimerInterval) {
            clearInterval(lessonTimerInterval);
            lessonTimerInterval = null;
        }
        lessonTitle.classList.add('clickable');
        lessonTitle.textContent = "Time's up! Click for next lesson.";
        progressBar.style.width = '100%';

        if (selectedTopic && currentLessons.length > 0 && currentLessonIndex < currentLessons.length) {
            const lesson = currentLessons[currentLessonIndex];
            await addStudySession({
                date: new Date().toISOString().split('T')[0],
                duration: lessonTimerDuration / 1000,
                lessonTitle: lesson.title,
                topic: selectedTopic,
                timestamp: Date.now()
            });
            await renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
        }
        lessonStartTime = null;
    }

    topicButtons.forEach(button => {
        button.addEventListener('click', async function() {
            if (lessonTimerInterval) {
                clearInterval(lessonTimerInterval);
                lessonTimerInterval = null;
                if (lessonStartTime && selectedTopic && currentLessons.length > 0 && currentLessonIndex < currentLessons.length) {
                    const lesson = currentLessons[currentLessonIndex];
                    const duration = Math.round((Date.now() - lessonStartTime) / 1000);
                    await addStudySession({
                        date: new Date().toISOString().split('T')[0],
                        duration: duration,
                        lessonTitle: lesson.title,
                        topic: selectedTopic,
                        timestamp: Date.now()
                    });
                    await renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
                }
            }
            lessonStartTime = null;

            selectedTopic = this.dataset.topic;
            const jsonFile = `topics_data/${selectedTopic}.json`;
            topicButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');

            if (['options_trading', 'advanced_quant_finance', 'finance_modeling'].includes(selectedTopic)) {
                optionsDisclaimer.classList.add('w3-show');
            } else {
                optionsDisclaimer.classList.remove('w3-show');
            }

            lessonTitle.textContent = `Loading ${selectedTopic.replace(/_/g, ' ')}...`;
            lessonContent.innerHTML = '<p class="instructions">Loading lessons...</p>';
            progressBar.style.width = '0%';

            try {
                const response = await fetch(jsonFile);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const data = await response.json();

                if (data && data.length > 0) {
                    currentLessons = data;
                    displayLessonTitles(currentLessons);
                    displayLesson(0);
                } else {
                    throw new Error("No lessons found or file is empty.");
                }
            } catch (error) {
                lessonTitle.textContent = "Error Loading Topic";
                lessonContent.innerHTML = `<p class="instructions">Could not load lessons for '${selectedTopic.replace(/_/g, ' ')}'. ${error.message}</p>`;
                progressBar.style.width = '0%';
                lessonTitle.classList.remove('clickable', 'active-lesson');
                currentLessons = [];
                currentLessonIndex = 0;
                selectedTopic = null;
                optionsDisclaimer.classList.remove('w3-show');
                displayLessonTitles([]);
            }
        });
    });

    lessonListContainer.addEventListener('click', function(event) {
        if (event.target && event.target.matches('li.lesson-link')) {
            const targetIndex = parseInt(event.target.dataset.lessonIndex, 10);
            if (!isNaN(targetIndex) && currentLessons && targetIndex >= 0 && targetIndex < currentLessons.length) {
                if (lessonStartTime && selectedTopic && currentLessonIndex !== targetIndex) {
                    if (lessonTimerInterval) {
                        clearInterval(lessonTimerInterval);
                        lessonTimerInterval = null;
                    }
                    const lesson = currentLessons[currentLessonIndex];
                    const duration = Math.round((Date.now() - lessonStartTime) / 1000);
                    if (duration > 0) {
                        addStudySession({
                            date: new Date().toISOString().split('T')[0],
                            duration: duration,
                            lessonTitle: lesson.title,
                            topic: selectedTopic,
                            timestamp: Date.now()
                        }).then(() => renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear()));
                    }
                }
                displayLesson(targetIndex);
            }
        }
    });

    lessonTitle.addEventListener('click', () => {
        if (lessonTitle.classList.contains('clickable')) {
            if (lessonStartTime && currentLessons.length > 0 && currentLessonIndex < currentLessons.length) {
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
            displayLesson(currentLessonIndex + 1);
        }
    });

    progressBarContainer.addEventListener('click', (event) => {
        if (currentLessons.length > 0) {
            const containerWidth = progressBarContainer.offsetWidth;
            const clickX = event.offsetX;
            let targetIndex = Math.floor((clickX / containerWidth) * currentLessons.length);
            targetIndex = Math.max(0, Math.min(targetIndex, currentLessons.length - 1));

            if (lessonStartTime && currentLessons.length > 0) {
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
            displayLesson(targetIndex);
        }
    });

    // Calendar, Modal, and GenAI logic remains largely the same as it had minimal jQuery.
    // Small adjustments for consistency might be needed.
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonthYearSpan = document.getElementById('current-month-year');
    let currentCalendarDate = new Date();

    async function renderCalendar(month, year) {
        // Clear previous grid but keep headers
        const headers = calendarGrid.querySelectorAll('.calendar-day-header');
        calendarGrid.innerHTML = '';
        headers.forEach(header => calendarGrid.appendChild(header.cloneNode(true)));


        currentMonthYearSpan.textContent = `${new Date(year, month).toLocaleString('default', { month: 'long' })} ${year}`;

        const firstDayOfMonth = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        if (!db) await initDB();
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

    const statsModal = document.getElementById('stats-modal');
    async function openStatsModal(dateString) {
        document.getElementById('modal-date').textContent = dateString;
        const sessionsForDay = await getStudySessionsForDate(dateString);

        let totalTimeToday = sessionsForDay.reduce((acc, s) => acc + s.duration, 0);
        let lessonsTodayDetails = sessionsForDay.map(s => `<li>${s.lessonTitle} (${Math.round(s.duration/60)} min)</li>`).join('');

        document.getElementById('modal-time-studied').textContent = `${Math.round(totalTimeToday / 60)} minutes`;
        document.getElementById('modal-topics-covered').innerHTML = lessonsTodayDetails ? `<ul>${lessonsTodayDetails}</ul>` : 'None';

        const allSessions = await getAllStudySessions();
        let totalStudyTimeAll = allSessions.reduce((acc, s) => acc + s.duration, 0);
        let studyDays = new Set(allSessions.map(s => s.date));

        document.getElementById('modal-total-lessons').textContent = allSessions.length;
        document.getElementById('modal-overall-average').textContent = `${studyDays.size > 0 ? Math.round((totalStudyTimeAll / studyDays.size) / 60) : 0} minutes/day`;

        // Streak calculation can be complex, keeping original logic
        let streak = 0;
        if (studyDays.size > 0) {
            const sortedDates = Array.from(studyDays).sort((a, b) => new Date(b) - new Date(a));
            let checkDate = new Date(new Date().toISOString().split('T')[0]);
            if (sortedDates[0] === checkDate.toISOString().split('T')[0]) {
                streak = 1;
                checkDate.setDate(checkDate.getDate() - 1);
                for (let i = 1; i < sortedDates.length; i++) {
                    if (sortedDates[i] === checkDate.toISOString().split('T')[0]) {
                        streak++;
                        checkDate.setDate(checkDate.getDate() - 1);
                    } else if (new Date(sortedDates[i]) < new Date(checkDate.toISOString().split('T')[0])) break;
                }
            }
        }
        document.getElementById('modal-overall-streak').textContent = `${streak} days`;

        statsModal.style.display = 'block';
    }

    statsModal.querySelector('.w3-display-topright').addEventListener('click', () => {
        statsModal.style.display = 'none';
    });
    statsModal.querySelector('footer button').addEventListener('click', () => {
        statsModal.style.display = 'none';
    });


    async function callGeminiAPI(inputText) {
        const apiKey = "JINXAI00aleamnelaweirasld0234fm345o8fydvhv9sdfvn8mcsl5v50497";
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:streamGenerateContent?key=${apiKey}`;
        const payload = { "contents": [{ "role": "user", "parts": [{ "text": inputText }] }], "generationConfig": { "responseMimeType": "text/plain" } };

        try {
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
            const responseText = await response.text();
            // Basic text extraction, might need refinement based on actual streaming format
            return responseText.split('"text": "')[1].split('"')[0].replace(/\\n/g, '\n') || responseText;
        } catch (error) {
            console.error('Error calling Gemini API:', error);
            return `Error: ${error.message}`;
        }
    }

    document.getElementById('submit-genai-query').addEventListener('click', async () => {
        const inputField = document.getElementById('genai-query-input');
        const queryText = inputField.value.trim();
        const responseArea = document.getElementById('genai-response-area');
        if (queryText) {
            responseArea.innerHTML = '<p><i>Thinking...</i></p>';
            const result = await callGeminiAPI(queryText);
            responseArea.textContent = result;
            inputField.value = '';
        } else {
            responseArea.innerHTML = '<p>Please type a query.</p>';
        }
    });

    document.getElementById('elaborate-lesson-btn').addEventListener('click', async () => {
        const lessonText = lessonContent.textContent.trim();
        const responseArea = document.getElementById('genai-response-area');
        if (selectedTopic && lessonText) {
            const prompt = `Elaborate on this lesson titled "${currentLessons[currentLessonIndex].title}":\n\n${lessonText}`;
            responseArea.innerHTML = '<p><i>Elaborating...</i></p>';
            const result = await callGeminiAPI(prompt);
            responseArea.textContent = result;
        } else {
            responseArea.innerHTML = '<p>Please load a lesson first.</p>';
        }
    });

    initDB().then(() => {
        renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
        displayLesson(-1);
    }).catch(err => {
        console.error("DB initialization failed:", err);
        renderCalendar(currentCalendarDate.getMonth(), currentCalendarDate.getFullYear());
        displayLesson(-1);
    });
});
