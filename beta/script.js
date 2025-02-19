document.addEventListener('DOMContentLoaded', function() {
    const rssFeedUrl = 'https://www.pornhub.com/video/webmasterss';

    fetch(rssFeedUrl)
        .then(response => response.text())
        .then(xmlText => {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, "text/xml");
            const items = xmlDoc.querySelectorAll('item'); // Adjust selector if needed

            const rssContainer = document.getElementById('rss-feed-container');
            let output = '';

            items.forEach(item => {
                const title = item.querySelector('title').textContent;
                const link = item.querySelector('link').textContent;
                const description = item.querySelector('description').textContent;

                output += `
                    <div class="w3-card-4 w3-margin w3-white">
                        <div class="w3-container">
                            <h3><b><a href="${link}" target="_blank" rel="noopener">${title}</a></b></h3>
                        </div>
                        <div class="w3-container">
                            <p>${description}</p>
                            <div class="w3-row">
                                <div class="w3-col m8 s12">
                                    <p><button class="w3-button w3-padding-large w3-white w3-border"><a href="${link}" target="_blank" rel="noopener"><b>READ MORE »</b></a></button></p>
                                </div>
                                <div class="w3-col m4 w3-hide-small">
                                    <p><span class="w3-padding-large w3-right"><b>Comments</b> <span class="w3-badge">0</span></span></p>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            });

            rssContainer.innerHTML = output;

        })
        .catch(error => {
            console.error('Error fetching RSS feed:', error);
            document.getElementById('rss-feed-container').innerHTML = `<p class="w3-panel w3-red">Error loading RSS feed: ${error.message}</p>`;
        });
});
