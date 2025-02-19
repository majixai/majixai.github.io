// service-worker.js

const FETCH_INTERVAL_HOURS = 1; // Set the interval to 1 hour (adjust as needed)

async function appendTextFromUrlAndStore(url) {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const newText = await response.text();
    const storageKey = `urlText_${encodeURIComponent(url)}`;
    const existingText = localStorage.getItem(storageKey);

    let combinedText = newText;
    if (existingText) {
      combinedText = existingText + "\n\n" + newText;
    }

    localStorage.setItem(storageKey, combinedText);
    console.log(`Service Worker: Text from URL '${url}' appended to localStorage with key '${storageKey}'.`); // Logging in Service Worker context
    return { success: true, key: storageKey };

  } catch (error) {
    console.error("Service Worker: Error fetching or appending text:", error); // Error logging in Service Worker
    return { success: false, error: error.message };
  }
}

function runTask() {
  const urlToFetch = 'https://www.example.com'; // Replace with your URL
  appendTextFromUrlAndStore(urlToFetch)
    .then(result => {
      if (result.success) {
        console.log("Service Worker: Hourly text append task completed successfully.");
      } else {
        console.error("Service Worker: Hourly text append task failed:", result.error);
      }
    });
}

// Set up the interval to run the task every hour
setInterval(runTask, FETCH_INTERVAL_HOURS * 60 * 60 * 1000); // Convert hours to milliseconds

// Run the task immediately when the service worker starts up (optional)
console.log("Service Worker: Starting hourly text append task.");
runTask();
