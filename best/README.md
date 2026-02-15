# Room Viewer Application

This is a web application designed to fetch, display, and manage online rooms from the Chaturbate public API. It provides filtering capabilities, viewing history, message storage, dynamic viewer layouts, and basic client-side image recognition.

**NOTE:** This application is a client-side implementation. Features like report sending are handled directly from the browser, which is **not secure** for sensitive data or in production environments. A robust backend is highly recommended for such features.

## Features

*   **API Fetching:** Periodically fetches a list of currently online public rooms from the Chaturbate public API.
*   **User List Display:** Shows online users with their image (or optional live iframe preview), age, tags, and viewer count.
*   **Filtering:** Filter the online user list by tags and age. Quick filter buttons are provided for common criteria (e.g., Age 18, specific tags).
*   **User Search:** Filter the online list by username using an autocomplete search input.
*   **Viewing History:** Maintains a history of clicked users using browser storage (Local Storage, Session Storage, or IndexedDB). Displays users from history who are currently online. Allows clearing the history.
*   **Message Storage:** Save custom text messages to IndexedDB for later use.
*   **Message Management:** View a scrollable list of saved messages. Search messages by text using autocomplete. Click a message to copy its text to the clipboard.
*   **Dynamic Main Viewer:** Load a user's stream into one of two or four available viewer iframes. Toggle the number of active viewports (2 or 4).
*   **Viewer Sizing:** Increase or decrease the size of the main viewer column to adjust the prominence of the streams.
*   **List Display Mode:** Toggle the online users list display between static thumbnail images and small live iframe previews.
*   **Auto-Scrolling:** Start/stop slow automatic scrolling of the online user list. Stops automatically on user interaction or list update.
*   **Detailed Age Display:** For users reported as age 18 by the API, attempts to calculate and display the number of days since their 18th birthday (requires accurate birthday data from API).
*   **Image Recognition:** Uses TensorFlow.js and MobileNet to perform basic image classification on the thumbnail images of online users (when in image mode) and displays common recognition results (e.g., "person", "dog", "chair"). Results are displayed below the user's details.
*   **Client-Side Reporting:** Sends a JSON report of the currently filtered online users via a client-side method (configurable as a placeholder service or `mailto:` link). **INSECURE - FOR DEMONSTRATION ONLY.**
*   **Togglable Sections:** Control panels (Filters, Display, Viewer, Messaging, Reporting) can be expanded/collapsed for a cleaner UI.
*   **Dependencies via CDN:** Utilizes W3.CSS, jQuery, jQuery UI, TensorFlow.js, and MobileNet via Content Delivery Networks.
*   **Responsive Design:** Layout adapts to different screen sizes using W3.CSS grid and custom CSS.

## Technologies Used

*   HTML5
*   CSS3 (with W3.CSS framework)
*   JavaScript (ES6+)
*   [jQuery](https://jquery.com/) (via CDN)
*   [jQuery UI](https://jqueryui.com/) (for Autocomplete, via CDN)
*   [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) (for history and message storage)
*   [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) (for API data fetching)
*   [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API) (Local and Session Storage options)
*   [TensorFlow.js](https://www.tensorflow.org/js) (via CDN)
*   [MobileNet](https://www.tensorflow.org/js/models#mobilenet) (pre-trained model for TF.js, via CDN)
*   [W3.CSS](https://www.w3schools.com/w3css/) (via CDN)
*   (Potentially client-side email service SDK like [EmailJS](https://www.emailjs.com/) if configured for reporting)

## Setup

1.  Clone or download the repository files (`index.html`, `style.css`, `script.js`).
2.  Place all three files in the same directory.
3.  Since the application fetches data from an external API and relies on browser storage APIs which can have limitations or security restrictions when opening local files directly (`file://` protocol), you **must** run this application using a local web server.
    *   **Recommended:** Use the "Live Server" extension for VS Code.
    *   **Alternatively (Python):** Open your terminal in the directory containing the files and run `python -m http.server` (Python 3) or `python -m SimpleHTTPServer` (Python 2). Then navigate to `http://localhost:8000` in your browser.
    *   **Alternatively (Node.js):** Install the `serve` package (`npm install -g serve`) and run `serve` in the directory.

4.  Open `index.html` in your web browser via the local web server address (e.g., `http://localhost:8000`).

## Configuration

You may need to adjust the configuration variables at the top of the `script.js` file:

*   `REPORT_SEND_METHOD`: Set this to `'placeholder-client-service'` (requires integration with a service like EmailJS) or `'mailto'` (basic email link). **Modify with caution and awareness of security implications.**
*   If using `'mailto'`, update the email address in the `sendReport` function: `mailto:your.email@example.com`.
*   If using a client-side service like EmailJS, you'll need to uncomment and replace placeholders for `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, and `EMAILJS_PUBLIC_KEY` in `script.js` and potentially the `index.html` script tag if initializing there.
*   `apiUrlBase`: The base URL for fetching online user data. Verify this is correct.
*   `apiLimit`, `fetchIntervalDuration`, `maxApiFetchLimit`, `apiFetchTimeout`: Adjust API fetching behavior.
*   `maxHistorySize`: Limit the number of users stored in history.
*   `AUTO_SCROLL_SPEED`, `AUTO_SCROLL_DELAY_AT_END`: Tune the automatic scrolling animation.
*   `LIST_IFRAME_PARAMS`, `MAIN_IFRAME_PARAMS`: Modify parameters passed to the Chaturbate embed/fullvideo URLs.
*   `IFRAME_SIZE_CLASSES`: Customize the CSS classes used for main viewer column sizing.
*   `AUTOCOMPLETE_MIN_LENGTH`, `AUTOCOMPLETE_DELAY`, `AUTOCOMPLETE_MAX_SUGGESTIONS`: Adjust autocomplete behavior.
*   `IMAGE_RECOGNITION_CONFIDENCE_THRESHOLD`, `IMAGE_RECOGNITION_MAX_RESULTS`, `ANALYSIS_DELAY`: Control the image recognition process and output.
*   IndexedDB Database Name/Version: Modify `IndexedDB.open('UserDatabase', 2)` if you plan to change the database structure (requires understanding IndexedDB migrations).

## Usage

1.  Once the application is running via a web server, it will automatically start fetching online users and loading your history.
2.  The "Online Users" list on the left will populate.
3.  Use the filters (tags, age, quick filters) and the "Search usernames" input to narrow down the list.
4.  Click on a user in the "Online Users" or "History" lists to load their stream into the main viewer area.
5.  Use the radio buttons under "Viewer Options" to choose which of the active viewports a clicked user loads into.
6.  Use the "Toggle 2/4 Viewports" button to switch between showing two or four main viewer iframes.
7.  Use the "Bigger" and "Smaller" buttons under "Viewer Options" to change the size of the main viewer column relative to the user lists.
8.  Click "Start Auto-Scroll Online" to begin slowly scrolling through the online users list. Manual scrolling or list updates will stop the auto-scroll.
9.  In the "Messaging" section, type text into the input box and click "Save Message" to store it in your browser's IndexedDB.
10. The "Saved Messages" list will display your messages. Use the search input to filter this list.
11. Click any message in the "Saved Messages" list to copy its content to your clipboard.
12. Use the collapsible headers (click on "Filters & History", "Display & Tools", etc.) to show or hide the control panels.
13. The "History (Online Now)" list on the right shows users you've clicked who are currently online and in public shows.
14. Click "Clear History" in the Filters section to remove all users from your viewing history (from the currently selected storage type).
15. Click "Send Report of Online Users" in the Reporting section to generate a report based on the *currently filtered* online users and send it using the configured method (mailto or placeholder). **Be aware of the security note.**

## Important Notes & Caveats

*   **Security Warning:** The client-side report sending mechanism is insecure and should **never** be used for sensitive information or in a production environment. Anyone with access to the client-side code can potentially see API keys (if used directly) or modify the data being sent. A secure backend endpoint is the standard practice for sending data like reports.
*   **Browser Storage:** IndexedDB, Local Storage, and Session Storage are browser-specific and have storage quotas. Data is tied to the specific browser and profile. Clearing browser data will remove stored history and messages.
*   **API Dependence:** The application's functionality relies entirely on the availability and structure of the Chaturbate public API. Changes to the API may break the application.
*   **Image Recognition:**
    *   This uses client-side Machine Learning (TensorFlow.js/MobileNet) which can be resource-intensive and may impact performance, especially on older devices or with many users visible.
    *   Analysis only runs when the online list is initially displayed or re-rendered.
    *   Results are probabilistic and may not always be accurate or relevant. The threshold and number of results displayed can be configured.
    *   Analysis results are stored in the `allOnlineUsersData` state for the current session but are not persistently saved.
    *   The model is loaded asynchronously on app start. Recognition results will appear shortly after the list is displayed, as images are analyzed in a queue.
*   **Mailto Limitations:** The `mailto:` method for reporting has strict limits on the amount of data that can be sent via the URL. Large reports will fail. It also requires the user's email client to be configured and opened manually.
*   **Age Calculation:** The detailed "X days" calculation for age 18 relies on the API providing both the `age` as exactly 18 AND a valid `birthday` string. Inconsistent or missing data will prevent this calculation. The calculation method makes assumptions based on standard age calculation and the provided API age.
*   **Iframe Restrictions:** Iframes may have various browser or website-imposed restrictions (e.g., sandbox attributes, `X-Frame-Options` headers) that could potentially affect functionality or embedding behavior.

## Future Improvements

*   Implement a secure backend for handling reports and potentially other data.
*   Add message editing and deletion features.
*   Implement persistent storage for image recognition results.
*   Allow configuring/disabling image recognition.
*   Add more advanced filtering options (e.g., by language, online status details).
*   Implement infinite scrolling or pagination for the online user list for better performance with very large results.
*   Add user authentication or profiles if building a multi-user application.
*   Improve UI feedback for loading states, errors, and actions (e.g., message copied).
*   More sophisticated error handling for API calls, storage issues, etc.
*   Option to save/load filter presets or viewer layouts.

---

## Compressed Image DB Pipeline (best/index.html)

This directory now includes an automated compressed image datastore pipeline:

- Script: `best/compressed_image_db_pipeline.py`
- Compressed DB output: `best/dbs/performer_images.db.gz`
- Viewer manifest output: `best/dbs/performer_images_manifest.dat`
- Viewer page: `best/index.html`

### Scheduling and concurrency

- Workflow: `.github/workflows/best_performer_minute.yml`
- Schedule: `*/1 * * * *`
- Per-run maximum runtime: `180` seconds
- Race-condition protections:
    - GitHub Actions `concurrency` group prevents workflow overlap.
    - Script-level file lock (`best/dbs/.performer_images.lock`) prevents local overlap.
    - Atomic compressed DB replacement avoids partial writes.

### What gets stored

- Every newly seen performer `image_url` is downloaded once and stored in compressed SQLite.
- Existing images are not re-downloaded unless the URL is unseen.
- Per-performer mapping is updated with last-seen metadata for viewer rendering.

### Viewer behavior

- `best/index.html` reads `best/dbs/performer_images_manifest.dat`.
- Manifest is zlib-compressed JSON and rendered client-side using `pako`.
- The UI supports quick filtering and shows cache metadata from the compressed datastore.

