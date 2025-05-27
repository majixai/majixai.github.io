# Study Application

## Description

A web application designed for timed micro-learning sessions on various topics. It features study session tracking, a calendar view to visualize progress, detailed statistics, and placeholder integration for GenAI-powered elaborations and queries.

## Features

*   **Topic Selection:** Choose lessons from a variety of subjects (e.g., English Structure, Computer Science, Finance Modeling, Advanced Quant Finance).
*   **Timed Lessons:** Each lesson is accompanied by a 60-second visual countdown timer and progress bar to encourage focused study.
*   **Study Session Tracking:** Automatically logs completed lessons, including the topic, lesson title, duration, and date, using the browser's IndexedDB.
*   **Calendar View:**
    *   Provides a monthly calendar.
    *   Visually highlights days with recorded study activity.
    *   Clicking on a day opens a modal with detailed statistics for that date.
*   **Statistics Modal:**
    *   Displays total time studied and a list of lessons/topics covered for the selected day.
    *   Shows overall progress metrics:
        *   Current study streak (consecutive days with activity).
        *   Average daily study time.
        *   Total number of lessons completed.
    *   Includes a Plotly bar chart visualizing study duration for each day of the currently viewed month in the calendar.
*   **GenAI Interaction (Placeholder & Requires User Configuration):**
    *   **Elaborate on Current Lesson:** A button to send the content of the currently displayed lesson to a GenAI model for further explanation.
    *   **Custom Query Box:** An input field to send custom text queries to the GenAI model.
    *   **Note:** These features require a valid Gemini API key to be configured by the user in `study/script.js`. The application currently uses a non-functional placeholder key.

## Setup and Usage

1.  **Clone the Repository:**
    ```bash
    git clone <repository_url>
    ```
    (Replace `<repository_url>` with the actual URL of the repository).
2.  **Navigate to the Project Directory:**
    ```bash
    cd <repository_name>
    ```
3.  **Open the Application:**
    *   Open the `study/index.html` file in a modern web browser that supports IndexedDB and modern JavaScript (e.g., Chrome, Firefox, Edge, Safari).

**Using the Application:**

*   **Select a Topic:** Click on one of the topic buttons at the top of the page (e.g., "Computer Science").
*   **Start a Lesson:** The first lesson of the selected topic will load automatically. The 60-second timer and progress bar will start.
*   **Navigate Lessons:**
    *   When the 60-second timer for a lesson ends, the lesson title will become clickable, allowing you to advance to the next lesson. The completed lesson (60s duration) is logged.
    *   You can click the lesson title *before* the timer ends to advance to the next lesson. The actual time spent on the lesson will be logged.
    *   Clicking on the progress bar container also allows you to jump to any lesson within the current topic; actual time spent on the interrupted lesson will be logged.
*   **View Calendar & Statistics:**
    *   The calendar below the lesson area shows your study activity.
    *   Navigate months using the "Prev" and "Next" buttons.
    *   Click on any day in the calendar to open the Statistics Modal, which shows detailed stats for that day and overall progress, including a chart.
*   **Use GenAI Features (Requires API Key Setup):**
    *   To use the "Elaborate on Current Lesson" or "Ask GenAI" features, you must first replace the placeholder API key in `study/script.js` with your own valid Gemini API key.
    *   Click "Elaborate on Current Lesson" while a lesson is displayed to get more information about it.
    *   Type a query into the "Ask GenAI" input box and click "Submit Query" for custom questions. Responses will appear in the designated area.

## File Structure Overview

*   `README.md`: This file.
*   `study/`: Main directory for the application.
    *   `index.html`: The single-page application's HTML structure.
    *   `script.js`: Contains all client-side JavaScript logic, including:
        *   Lesson loading and display.
        *   60-second lesson timer.
        *   Calendar rendering and interaction.
        *   IndexedDB operations for study session storage.
        *   Statistics calculation and Plotly chart generation.
        *   GenAI API call function and related UI handlers.
    *   `style.css`: Custom CSS styles for the application, supplementing W3.CSS.
    *   `topics_data/`: A directory containing JSON files for different lesson topics. Each file (e.g., `computer_science.json`) holds an array of lesson objects for that topic.

## Known Issues / Limitations

*   **GenAI Functionality Requires User Setup:** The GenAI interaction features depend on a valid Gemini API key. The application currently includes a placeholder key (`JINXAI00aleamnelaweirasld0234fm345o8fydvhv9sdfvn8mcsl5v50497`) in `study/script.js`. Users must replace this with their own active API key. Furthermore, making API calls directly from the client-side with an embedded API key is generally insecure for production applications and is done here for simplicity in this example project.
*   **Local Storage Only:** All study data (session history, streaks, etc.) is stored locally in the browser's IndexedDB. There is no backend server or cloud synchronization. Clearing browser data for this site will result in the loss of all study history.
*   **Topic Sequence Progress Indicator:** The main visual progress bar is dedicated to the 60-second timer for the current lesson. It no longer indicates the user's progress through the sequence of lessons within a topic (e.g., "Lesson 3 of 10").

---
This README aims to provide a good overview for users and potential developers of the Study Application.
