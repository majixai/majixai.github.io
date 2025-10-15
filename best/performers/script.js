document.addEventListener('DOMContentLoaded', () => {
    const performersContainer = document.querySelector('.performers-list-container');
    const mainIframe = document.getElementById('mainIframe');

    const DAT_FILES = [
        'all_performers_v3.dat',
        'favorite_performers.dat',
        'history_performers.dat',
        'performers_cache.dat',
        'performers_cache_v2.dat',
        'selected_performers_usernames.dat'
    ];
    const DB_PATH = '../';

    async function fetchAndDecompressDatFile(file) {
        try {
            const response = await fetch(DB_PATH + file);
            if (!response.ok) {
                return null;
            }
            const compressedData = await response.arrayBuffer();
            const decompressedData = pako.inflate(new Uint8Array(compressedData), { to: 'string' });
            return JSON.parse(decompressedData);
        } catch (error) {
            // It's possible some .dat files are not compressed or not valid JSON
            // We'll silently ignore these errors for now.
            return null;
        }
    }

    function createPerformerCard(performer) {
        // Assuming the performer object has a 'username' and 'display_name'
        // and other potential fields. We will use what is available.
        const name = performer.display_name || performer.username || 'Unknown';

        const card = document.createElement('div');
        card.className = 'performer-card';

        const imageUrl = performer.image_url || performer.profile_pic_url;
        if (imageUrl) {
            card.innerHTML += `<img src="${imageUrl}" alt="${name}" style="width:100%">`;
        }

        card.innerHTML += `<h3>${name}</h3>`;

        // Add more details if they exist
        if(performer.age) card.innerHTML += `<p>Age: ${performer.age}</p>`;
        if(performer.gender) card.innerHTML += `<p>Gender: ${performer.gender}</p>`;


        card.addEventListener('click', () => {
            const iframeUrl = performer.iframe_embed;
            if (iframeUrl) {
                mainIframe.src = iframeUrl;
            }
        });
        return card;
    }

    async function loadPerformers() {
        const performerPromises = DAT_FILES.map(fetchAndDecompressDatFile);
        const performerDataArrays = (await Promise.all(performerPromises)).filter(d => d);

        let allPerformers = [];
        performerDataArrays.forEach(data => {
            if (Array.isArray(data)) {
                allPerformers = allPerformers.concat(data);
            } else if (typeof data === 'object' && data !== null) {
                // Handle cases where the .dat file contains a single object or a dictionary of objects
                allPerformers = allPerformers.concat(Object.values(data));
            }
        });

        // Remove duplicates based on username
        const uniquePerformers = allPerformers.filter((p, index, self) =>
            p && p.username && self.findIndex(t => t.username === p.username) === index
        );


        if (uniquePerformers.length === 0) {
            performersContainer.innerHTML = '<p>No performers found.</p>';
            return;
        }

        uniquePerformers.forEach(performer => {
            const card = createPerformerCard(performer);
            if (card) {
                performersContainer.appendChild(card);
            }
        });
    }

    loadPerformers();
});