document.addEventListener('DOMContentLoaded', () => {
    const urlInput = document.getElementById('urlInput');
    const titleInput = document.getElementById('titleInput');
    const addLinkForm = document.querySelector('form');
    const linkList = document.getElementById('linkList');

    let db;
    const dbName = 'LinkIndexerDB';
    const storeName = 'links';

    // 1. Initialize IndexedDB
    const request = indexedDB.open(dbName, 1);

    request.onerror = (event) => {
        console.error('Database error:', event.target.errorCode);
    };

    request.onupgradeneeded = (event) => {
        db = event.target.result;
        if (!db.objectStoreNames.contains(storeName)) {
            const store = db.createObjectStore(storeName, { keyPath: 'id', autoIncrement: true });
            store.createIndex('url', 'url', { unique: false }); // Allow duplicate URLs if titles are different, or change to true if URLs must be unique
            console.log('Object store created:', storeName);
        }
    };

    request.onsuccess = (event) => {
        db = event.target.result;
        console.log('Database opened successfully:', dbName);
        displayLinks();
    };

    // 2. Handle form submission
    addLinkForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const url = urlInput.value.trim();
        const title = titleInput.value.trim();

        if (url && title) {
            addLink(url, title);
            urlInput.value = '';
            titleInput.value = '';
        } else {
            alert('Please enter both URL and Title.');
        }
    });

    function addLink(url, title) {
        if (!db) {
            console.error('Database not initialized.');
            return;
        }
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const link = { url, title, added: new Date() };

        const request = store.add(link);

        request.onsuccess = () => {
            console.log('Link added successfully:', link);
            displayLinks(); // Refresh the list
        };

        request.onerror = (event) => {
            console.error('Error adding link:', event.target.error);
            if (event.target.error.name === 'ConstraintError') {
                alert('A link with this URL already exists.'); // Only if 'url' index is unique
            }
        };
    }

    // 3. Display links
    function displayLinks() {
        if (!db) {
            console.error('Database not initialized for displaying links.');
            return;
        }
        linkList.innerHTML = ''; // Clear existing list

        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (event) => {
            const links = event.target.result;
            if (links && links.length > 0) {
                links.forEach(link => {
                    const listItem = document.createElement('li');

                    const a = document.createElement('a');
                    a.href = link.url;
                    a.textContent = link.title;
                    a.target = '_blank'; // Open in new tab

                    const deleteButton = document.createElement('button');
                    deleteButton.textContent = 'Delete';
                    deleteButton.classList.add('delete-btn');
                    deleteButton.dataset.id = link.id;
                    deleteButton.addEventListener('click', deleteLink);

                    listItem.appendChild(a);
                    listItem.appendChild(deleteButton);
                    linkList.appendChild(listItem);
                });
            } else {
                linkList.innerHTML = '<li>No links stored yet.</li>';
            }
        };

        request.onerror = (event) => {
            console.error('Error retrieving links:', event.target.error);
            linkList.innerHTML = '<li>Error loading links.</li>';
        };
    }

    // 4. Handle link deletion
    function deleteLink(event) {
        const linkId = parseInt(event.target.dataset.id, 10);
        if (isNaN(linkId)) {
            console.error('Invalid link ID for deletion.');
            return;
        }

        if (!db) {
            console.error('Database not initialized for deleting link.');
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(linkId);

        request.onsuccess = () => {
            console.log('Link deleted successfully:', linkId);
            displayLinks(); // Refresh the list
        };

        request.onerror = (event) => {
            console.error('Error deleting link:', event.target.error);
        };
    }
});
