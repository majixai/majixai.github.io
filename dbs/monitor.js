document.addEventListener('DOMContentLoaded', async () => {
    const fileListElement = document.getElementById('file-list');

    try {
        // Use a cache-busting query parameter to ensure we get the latest file list
        const response = await fetch(`files.json?t=${new Date().getTime()}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const files = await response.json();
        const datFiles = files.filter(file => file.endsWith('.dat'));

        if (datFiles.length === 0) {
            const li = document.createElement('li');
            li.textContent = 'No .dat files found in the manifest.';
            fileListElement.appendChild(li);
            return;
        }

        datFiles.forEach(file => {
            const li = document.createElement('li');
            li.textContent = file;
            fileListElement.appendChild(li);
        });
    } catch (error) {
        console.error('Error fetching or processing file list:', error);
        const li = document.createElement('li');
        li.textContent = 'Error loading file list. See console for details.';
        li.style.color = 'red';
        fileListElement.appendChild(li);
    }
});
