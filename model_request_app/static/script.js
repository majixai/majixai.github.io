// IIFE to avoid polluting the global namespace
(function() {
    'use strict';

    document.addEventListener('DOMContentLoaded', function() {
        // Simple animation on the header
        const header = document.querySelector('.main-header');
        let animationInterval;

        function startAnimation() {
            if (animationInterval) return; // Prevent multiple intervals
            let color = '#00539B';
            animationInterval = setInterval(() => {
                header.style.color = color;
                color = color === '#00539B' ? '#004080' : '#00539B';
            }, 1000);
        }

        function stopAnimation() {
            clearInterval(animationInterval);
            animationInterval = null;
            header.style.color = '#00539B'; // Reset to original color
        }

        // Add start/stop buttons for the animation
        const animationControls = document.createElement('div');
        animationControls.className = 'text-center my-3';
        animationControls.innerHTML = `
            <button id="start-animation" class="btn btn-secondary">Start Animation</button>
            <button id="stop-animation" class="btn btn-secondary">Stop Animation</button>
        `;
        header.parentNode.insertBefore(animationControls, header.nextSibling);

        document.getElementById('start-animation').addEventListener('click', startAnimation);
        document.getElementById('stop-animation').addEventListener('click', stopAnimation);

        startAnimation(); // Start animation by default

        // IndexedDB for client-side caching
        const dbName = 'ModelRequestCache';
        let db;

        function openDb() {
            const request = indexedDB.open(dbName, 1);

            request.onerror = function(event) {
                console.error("Database error: " + event.target.errorCode);
            };

            request.onupgradeneeded = function(event) {
                db = event.target.result;
                db.createObjectStore('requests', { keyPath: 'id', autoIncrement:true });
            };

            request.onsuccess = function(event) {
                db = event.target.result;
                console.log("Database opened successfully");
                loadHistory();
            };
        }

        function addUploadToHistory(requestData) {
            const transaction = db.transaction(['requests'], 'readwrite');
            const store = transaction.objectStore('requests');
            const request = { ...requestData, timestamp: new Date() };
            store.add(request);
            appendHistoryItem(request);
        }

        function loadHistory() {
            const historyList = document.getElementById('upload-history');
            historyList.innerHTML = ''; // Clear the list before loading
            const transaction = db.transaction(['requests'], 'readonly');
            const store = transaction.objectStore('requests');
            const cursorRequest = store.openCursor(null, 'prev');

            cursorRequest.onsuccess = function(event) {
                const cursor = event.target.result;
                if (cursor) {
                    appendHistoryItem(cursor.value);
                    cursor.continue();
                }
            };
        }

        function appendHistoryItem(item) {
            const historyList = document.getElementById('upload-history');
            const listItem = document.createElement('li');
            listItem.className = 'list-group-item';
            listItem.textContent = `${item.name} - ${item.filename} - ${new Date(item.timestamp).toLocaleString()}`;
            historyList.appendChild(listItem);
        }

        function flashMessage(message, category = 'info') {
            const flashContainer = document.getElementById('flash-messages');
            const alert = document.createElement('div');
            alert.className = `alert alert-${category} alert-dismissible fade show`;
            alert.setAttribute('role', 'alert');
            alert.innerHTML = `
                ${message}
                <button type="button" class="close" data-dismiss="alert" aria-label="Close">
                    <span aria-hidden="true">&times;</span>
                </button>
            `;
            flashContainer.appendChild(alert);
        }

        const form = document.getElementById('upload-form');
        form.addEventListener('submit', function(event) {
            event.preventDefault();

            const formData = new FormData(form);

            fetch('/', {
                method: 'POST',
                body: formData
            })
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    flashMessage(data.message, 'success');
                    addUploadToHistory({
                        name: formData.get('name'),
                        filename: formData.get('file').name
                    });
                    form.reset();
                } else {
                    flashMessage(data.message, 'danger');
                }
            })
            .catch(error => {
                console.error('Error:', error);
                flashMessage('An unexpected error occurred.', 'danger');
            });
        });

        openDb();
    });
})();