let videoData = []; // Initialize as empty array to be populated by fetch
let currentVideoData = []; // Data currently displayed
let selectedIframeId = 'iframe1'; // Default iframe to update

function selectIframe(iframeId) {
    selectedIframeId = iframeId;
    document.getElementById('select-iframe1').classList.remove('selected');
    document.getElementById('select-iframe2').classList.remove('selected');
    document.getElementById('select-' + iframeId).classList.add('selected');
}

function displayVideoResults(videos) {
    const resultsDiv = document.getElementById('video-results');
    resultsDiv.innerHTML = ''; // Clear previous results
    if (!videos || videos.length === 0) {
        resultsDiv.innerHTML = "<p>No videos found.</p>";
        return;
    }
    videos.forEach(video => {
        const videoItem = document.createElement('a');
        videoItem.href = "#"; // Placeholder, actual link is handled by JS
        videoItem.classList.add('video-item');
        videoItem.onclick = function(event) {
            event.preventDefault(); // Prevent default link behavior
            loadVideoInIframe(video.url);
        };

        const img = document.createElement('img');
        img.src = video.thumbnail || 'placeholder.jpg'; // Use placeholder if no thumbnail
        img.alt = video.title;
        img.onerror = function() { // Fallback in case thumbnail fails to load
            img.src = 'placeholder.jpg';
        };

        const titleOverlay = document.createElement('div');
        titleOverlay.classList.add('video-title-overlay');
        titleOverlay.textContent = video.title;

        videoItem.appendChild(img);
        videoItem.appendChild(titleOverlay);
        resultsDiv.appendChild(videoItem);
    });
}

function loadVideoInIframe(videoUrl) {
    const iframe = document.getElementById(selectedIframeId);
    iframe.src = videoUrl;
}

function fetchData() {
    return fetch('https://www.pornhub.com/video/webmasterss')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.text(); // Get response as text (XML)
        })
        .then(xmlText => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "application/xml");
            const items = xmlDoc.querySelectorAll('item');
            const fetchedVideoData = [];

            items.forEach(item => {
                const title = item.querySelector('title').textContent;
                const videoUrl = item.querySelector('link').textContent;
                // Extract thumbnail from description - this might need adjustment based on actual RSS content
                let description = item.querySelector('description').textContent;
                let thumbnailUrl = '';

                // Basic attempt to extract thumbnail URL from description, assuming it's in an <img> tag
                const tempElement = document.createElement('div');
                tempElement.innerHTML = description;
                const imgTag = tempElement.querySelector('img');
                if (imgTag && imgTag.src) {
                    thumbnailUrl = imgTag.src;
                } else {
                    // Fallback if no <img> tag or src attribute found in description
                    thumbnailUrl = 'placeholder.jpg'; // Or handle differently
                    console.warn("Thumbnail URL not found in description for:", title);
                }


                fetchedVideoData.push({
                    title: title,
                    url: videoUrl,
                    thumbnail: thumbnailUrl
                });
            });
            return fetchedVideoData;
        })
        .catch(error => {
            console.error("Fetch error:", error);
            return []; // Return empty array in case of error
        });
}


function initializePage() {
    // Load data from localStorage or fetch new data
    const storedData = localStorage.getItem('videoData');
    if (storedData) {
        currentVideoData = JSON.parse(storedData);
        displayVideoResults(currentVideoData);
        if (currentVideoData.length > 0) {
            loadVideoInIframe(currentVideoData[0].url); // Load first video in iframe
        }
    }

    fetchData().then(fetchedData => {
        if (fetchedData && fetchedData.length > 0) {
            // Append new fetched data to existing data (if any)
            const newData = storedData ? [...currentVideoData, ...fetchedData] : fetchedData;
            // Remove duplicates based on video URL
            const uniqueData = Array.from(new Map(newData.map(item => [item.url, item])).values());
            currentVideoData = uniqueData;

            displayVideoResults(currentVideoData);
            saveToLocalStorage(); // Save the updated list
            if (!storedData && currentVideoData.length > 0) { // Load first video only if no stored data initially
                loadVideoInIframe(currentVideoData[0].url);
            }
        } else if (!storedData) {
            displayVideoResults([]); // Display "No videos found" if no data and fetch fails initially
        }
    });
}


function saveToLocalStorage() {
    localStorage.setItem('videoData', JSON.stringify(currentVideoData));
}

function autocompleteSearch() {
    const input = document.getElementById('search-input');
    const filter = input.value.toUpperCase();
    const autocompleteList = document.getElementById('autocomplete-list');
    autocompleteList.innerHTML = "";
    autocompleteList.classList.add('w3-hide');

    if (!filter) {
        return; // Don't show list if input is empty
    }

    const filteredVideos = currentVideoData.filter(video => video.title.toUpperCase().includes(filter));

    if (filteredVideos.length > 0) {
        autocompleteList.classList.remove('w3-hide');
        filteredVideos.forEach(video => {
            const itemDiv = document.createElement('div');
            itemDiv.classList.add('autocomplete-item');
            itemDiv.textContent = video.title;
            itemDiv.onclick = function() {
                input.value = video.title;
                autocompleteList.classList.add('w3-hide');
                displayVideoResults([video]); // Display only the selected video
                loadVideoInIframe(video.url);
            };
            autocompleteList.appendChild(itemDiv);
        });
    }
}


// Initialize when the page loads
window.onload = initializePage;
window.onbeforeunload = saveToLocalStorage; // Save to local storage when leaving page
