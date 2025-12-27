document.addEventListener('DOMContentLoaded', () => {
    const fileListElement = document.getElementById('file-list');

    // Use a cache-busting query parameter to ensure we get the latest file list
    fetch(`files.json?t=${new Date().getTime()}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(files => {
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
        })
        .catch(error => {
            console.error('Error fetching or processing file list:', error);
            const li = document.createElement('li');
            li.textContent = 'Error loading file list. See console for details.';
            li.style.color = 'red';
            fileListElement.appendChild(li);
        });
});
