document.addEventListener('DOMContentLoaded', async function() {

    console.log("DOM fully loaded. Initializing video viewer...");

    // --- Configuration ---
    // !! IMPORTANT !! Replace this with the URL of YOUR server-side endpoint
    // This endpoint should fetch the RSS feed, parse it, and return JSON.
    const VIDEO_PROXY_ENDPOINT = '/api/pornhub-rss'; // Example: '/api/pornhub-rss' or 'https://your-server.com/ph-videos'

    // --- DOM References ---
    const videoListDiv = document.getElementById("video-list");
    const loadingIndicator = document.getElementById("loading");
    const errorDisplay = document.getElementById("error");
    const videoPlayerContainer = document.getElementById("video-player-container");
    const videoPlayerIframe = document.getElementById("video-player");


    // --- Helper Functions ---

    /**
     * Formats duration in seconds into MM:SS.
     * @param {number} totalSeconds - Duration in seconds.
     * @returns {string} - Formatted string like "05:30".
     */
    function formatDuration(totalSeconds) {
        if (typeof totalSeconds !== 'number' || isNaN(totalSeconds) || totalSeconds < 0) {
            return 'N/A';
        }
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = Math.floor(totalSeconds % 60);
        const paddedMinutes = String(minutes).padStart(2, '0');
        const paddedSeconds = String(seconds).padStart(2, '0');
        return `${paddedMinutes}:${paddedSeconds}`;
    }

    /**
     * Basic function to format view counts for readability.
     * @param {number | string} views - View count.
     * @returns {string} - Formatted string like "1.2M" or "15,000".
     */
    function formatViews(views) {
        const numViews = typeof views === 'string' ? parseInt(views.replace(/,/g, ''), 10) : views;
         if (typeof numViews !== 'number' || isNaN(numViews) || numViews < 0) {
            return 'N/A';
        }
        if (numViews >= 1000000) {
            return (numViews / 1000000).toFixed(1) + 'M';
        }
        if (numViews >= 1000) {
            return (numViews / 1000).toFixed(1) + 'K';
        }
        return numViews.toLocaleString(); // Use locale for comma separation
    }


    // --- Core Application Logic Functions ---

    /**
     * Fetches video data from the server-side proxy endpoint.
     */
    async function fetchVideos() {
        console.log(`Fetching videos from proxy: ${VIDEO_PROXY_ENDPOINT}`);
        showLoading();
        hideError(); // Clear previous errors

        try {
            // Add a timeout to the fetch request (requires AbortController)
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 seconds timeout

            const response = await fetch(VIDEO_PROXY_ENDPOINT, { signal: controller.signal });
            clearTimeout(timeoutId); // Clear timeout if fetch completes/fails quickly

            if (!response.ok) {
                 const errorBody = await response.text().catch(() => response.statusText);
                 throw new Error(`HTTP error! status: ${response.status}, details: ${errorBody}`);
            }

            const videos = await response.json(); // Expecting JSON array from the proxy

            if (!Array.isArray(videos)) {
                throw new Error("Proxy did not return a valid array of videos.");
            }

            console.log(`Successfully fetched ${videos.length} videos.`);
            displayVideos(videos); // Display the fetched videos

        } catch (error) {
            console.error("Error fetching or processing videos:", error);
             if (error.name === 'AbortError') {
                showError(`Fetch timed out while loading videos.`);
                console.error("Video fetch timed out.");
            } else {
                showError(`Failed to load videos: ${error.message}`);
            }
            if(videoListDiv) videoListDiv.innerHTML = '<p class="w3-center w3-text-red">Could not load videos.</p>'; // Show error in list area
        } finally {
             hideLoading(); // Always hide loading indicator
             console.log("fetchVideos execution finished.");
        }
    }

    /**
     * Displays the list of videos by creating and appending HTML elements.
     * @param {Array<Object>} videos - An array of video objects from the proxy.
     */
    function displayVideos(videos) {
         if (!videoListDiv) {
              console.warn("Video list div not found. Cannot display videos.");
              return;
         }
        console.log(`Displaying ${videos.length} videos.`);
        videoListDiv.innerHTML = ""; // Clear current list

        if (videos.length === 0) {
            videoListDiv.innerHTML = '<p class="w3-center w3-text-grey">No videos found.</p>';
            return;
        }

        // Create a document fragment for better performance when adding many elements
        const fragment = document.createDocumentFragment();

        videos.forEach(video => {
            // Basic data validation from expected JSON structure
            if (!video || !video.title || !video.thumbnail_url_1 || !video.embed_url) {
                 console.warn("Skipping video with incomplete data:", video);
                 return;
             }

            // Create the W3.CSS grid column div
            const colDiv = document.createElement("div");
            colDiv.className = "w3-col l3 m6 s12"; // l3=25% (4 per row), m6=50% (2 per row), s12=100% (1 per row)

            // Create the W3.CSS card div
            const cardDiv = document.createElement("div");
            cardDiv.className = "w3-card w3-white video-card";
            // Store the embed URL in a data attribute for easy access on click
            cardDiv.dataset.embedUrl = video.embed_url;

            // Create the image element
            const img = document.createElement("img");
            img.src = video.thumbnail_url_1; // Use the first thumbnail URL
            img.alt = video.title; // Use title as alt text
            img.className = "thumbnail"; // Add class for potential fixed height styling
            img.loading = "lazy"; // Improve performance for many images

            // Create the details container
            const detailsDiv = document.createElement("div");
            detailsDiv.className = "w3-container video-details";

            // Populate details using helper functions and checks
            detailsDiv.innerHTML = `
                <h4><b>${video.title || 'Untitled Video'}</b></h4>
                <p>${video.duration_seconds ? `Duration: ${formatDuration(video.duration_seconds)}` : ''}</p>
                 <!-- Assuming views and rating might be available from a more complete API -->
                <p>${video.views ? `Views: ${formatViews(video.views)}` : ''}</p>
                <p>${video.rating ? `Rating: ${'★'.repeat(Math.round(video.rating || 0))} (${(video.rating || 0).toFixed(1)})` : ''}</p>
                <!-- Add other details like tags if available -->
            `;

            // Append image and details to the card
            cardDiv.appendChild(img);
            cardDiv.appendChild(detailsDiv);

            // Add click event listener to the card
            cardDiv.addEventListener("click", function() {
                const embedUrl = this.dataset.embedUrl; // Get the embed URL from data attribute
                console.log("Video card clicked, loading embed:", embedUrl);
                loadVideoInPlayer(embedUrl); // Load the video in the player
            });

            // Append the column div containing the card to the fragment
            const gridCol = document.createElement("div"); // Create wrapper for grid
            gridCol.className = "w3-col l3 m6 s12";
            gridCol.appendChild(cardDiv);
            fragment.appendChild(gridCol);
        });

        // Append the fragment to the video list div (more efficient)
        videoListDiv.appendChild(fragment);
        console.log("Finished displaying videos.");
    }

    /**
     * Loads a video embed URL into the iframe player.
     * Shows the player container.
     * @param {string} embedUrl - The URL of the video embed.
     */
    function loadVideoInPlayer(embedUrl) {
         if (!videoPlayerContainer || !videoPlayerIframe) {
             console.warn("Video player elements not found. Cannot load video.");
             return;
         }
         if (!embedUrl) {
              console.warn("No embed URL provided to load video.");
              return;
         }
         console.log("Loading video into player:", embedUrl);
         videoPlayerIframe.src = embedUrl;
         videoPlayerContainer.classList.add('visible'); // Use class to control display via CSS
         videoPlayerContainer.style.display = 'block'; // Ensure display block if using inline style toggle
         // Optional: Scroll to the player
         // videoPlayerContainer.scrollIntoView({ behavior: 'smooth' });
    }


    // --- Loading and Error Display Functions ---
    function showLoading() {
        if (loadingIndicator) loadingIndicator.style.display = 'block';
    }

    function hideLoading() {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }

    function showError(message) {
        if (errorDisplay) {
            errorDisplay.textContent = message;
            errorDisplay.style.display = 'block';
        }
    }

    function hideError() {
        if (errorDisplay) errorDisplay.style.display = 'none';
        if (errorDisplay) errorDisplay.textContent = ''; // Clear text
    }

     // --- Initialization ---

    // Start fetching videos when the DOM is ready
    fetchVideos(); // Initial load

    // Add any interval fetching if desired (like the Chaturbate example)
    // setInterval(fetchVideos, 300000); // Example: Refresh every 5 minutes


    console.log("Application initialization complete.");

});
