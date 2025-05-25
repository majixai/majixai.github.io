const CACHE_NAME = 'room-viewer-v1';
const urlsToCache = [
    '/', // Alias for index.html
    'index.html',
    'style.css',
    'config.js',
    'api.js',
    'storage.js',
    'ui.js',
    'script.js',
    // Note: Add paths to any critical images or icons if they exist and are static
    // e.g., 'images/logo.png'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Opened cache:', CACHE_NAME);
                // Handle cases where some assets might fail to cache, e.g. if '/' and 'index.html' are the same
                // For addAll, if one request fails, the entire operation fails.
                // A more robust approach might cache them individually or filter duplicates.
                const uniqueUrlsToCache = [...new Set(urlsToCache.map(url => (url === '/' ? 'index.html' : url)))];
                // Let's try to cache '/' separately as it can sometimes cause issues with addAll if index.html is also listed.
                // However, the current logic in fetch handler normalizes '/' to 'index.html' for matching.
                // So, ensuring 'index.html' is cached is key. For simplicity, we'll assume `addAll` handles this fine
                // or that the server correctly serves `index.html` for `/`.
                return cache.addAll(urlsToCache.map(url => {
                    // Ensure relative URLs for local assets
                    if (url.startsWith('/') && !url.startsWith('//')) { // relative path
                        return new URL(url, self.location.origin).pathname;
                    }
                    return url; // full URL or already correctly formatted
                })).catch(error => {
                    console.error('Failed to cache all urls:', error);
                    // Optionally, try to cache essential files one by one if addAll fails
                    // For now, we'll let it fail to indicate a problem during installation.
                    throw error;
                });
            })
            .then(() => self.skipWaiting()) // Activate new SW immediately
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => clients.claim()) // Take control of open clients
    );
});

self.addEventListener('fetch', event => {
    if (event.request.method !== 'GET') {
        return;
    }

    const requestUrl = new URL(event.request.url);

    // Normalize pathname for matching (remove leading slash for local assets, ensure 'index.html' for root)
    let pathForCacheCheck = requestUrl.pathname;
    if (requestUrl.origin === self.location.origin) { // Local asset
        pathForCacheCheck = requestUrl.pathname.substring(1); // remove leading '/'
        if (pathForCacheCheck === '' || requestUrl.pathname === '/') {
            pathForCacheCheck = 'index.html';
        }
    }
    
    const isAssetToCache = urlsToCache.includes(pathForCacheCheck) || urlsToCache.includes(requestUrl.pathname);


    if (isAssetToCache) {
        event.respondWith(
            caches.match(event.request)
                .then(response => {
                    if (response) {
                        // console.log('Serving from cache:', event.request.url);
                        return response;
                    }
                    // console.log('Fetching from network and caching:', event.request.url);
                    return fetch(event.request).then(
                        networkResponse => {
                            // Check for valid response to cache for static assets
                            if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                                if (networkResponse && networkResponse.status !== 0 && !networkResponse.ok) { // status 0 for opaque responses
                                     console.warn(`Not caching non-OK response for ${event.request.url}: ${networkResponse.status}`);
                                }
                                return networkResponse;
                            }
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then(cache => {
                                    cache.put(event.request, responseToCache);
                                });
                            return networkResponse;
                        }
                    ).catch(error => {
                        console.error('Fetch failed for cached asset, no cache fallback used here, error:', error, event.request.url);
                        // Optionally, return a fallback page for assets if truly offline and not cached
                        // For now, let the browser handle the fetch error if not in cache and network fails.
                        throw error;
                    });
                })
        );
    } else if (requestUrl.href.startsWith('https://chaturbate.com/api/public/affiliates/onlinerooms/')) {
        // Strategy for API calls: Network first, then cache (Stale-While-Revalidate like behavior)
        event.respondWith(
            caches.open(CACHE_NAME).then(cache => {
                return fetch(event.request)
                    .then(networkResponse => {
                        if (networkResponse.ok) { // Only cache successful responses (status 200-299)
                            // console.log('API call successful, caching response for:', event.request.url);
                            cache.put(event.request, networkResponse.clone());
                        } else {
                            // console.warn(`API call not OK, not caching response for ${event.request.url}: ${networkResponse.status}`);
                        }
                        return networkResponse;
                    })
                    .catch(async (error) => {
                        console.warn('Network request for API failed, attempting to serve from cache:', event.request.url, error.message);
                        const cachedResponse = await cache.match(event.request);
                        if (cachedResponse) {
                            // console.log('Serving API response from cache:', event.request.url);
                            return cachedResponse;
                        }
                        // If not in cache and network fails, the error will propagate
                        console.error('API request failed and not found in cache:', event.request.url);
                        throw error; // Re-throw the original fetch error
                    });
            })
        );
    } else {
        // For all other requests, just fetch from network (default behavior)
        // console.log('Service Worker: Passing through request (not cached, not API):', event.request.url);
        return; // Let the browser handle it
    }
});


// Existing fetchData and message listener for offloading API calls from client
// This part is kept as is, as it's a different mechanism than the fetch event interception.
// The fetch calls made by this fetchData will also be intercepted by the 'fetch' event handler above.
async function fetchData() {
    const limit = 500; // These should ideally come from config.js or be passed
    let offset = 0;
    let continueFetching = true;
    let allOnlineUsersData = [];
    // This apiUrlBase is hardcoded here, ideally it should be dynamic or from a shared config.
    const apiUrlBase = 'https://chaturbate.com/api/public/affiliates/onlinerooms/?wm=9cg6A&client_ip=request_ip&gender=f';


    while (continueFetching) {
        const apiUrl = `${apiUrlBase}&limit=${limit}&offset=${offset}`;
        try {
            const response = await fetch(apiUrl); // This fetch will be caught by the 'fetch' listener
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            if (data.results && data.results.length > 0) {
                allOnlineUsersData = allOnlineUsersData.concat(data.results);
                if (data.results.length < limit) {
                    continueFetching = false;
                } else {
                    offset += limit;
                }
            } else {
                continueFetching = false;
            }
        } catch (error) {
            console.error("Service Worker fetchData internal error:", error);
            return { error: error.message }; // Propagate error to the client
        }
    }
    return { data: allOnlineUsersData };
}

self.addEventListener('message', async event => {
    if (event.data && event.data.type === 'FETCH_USERS') {
        const result = await fetchData();
        if (event.ports && event.ports[0]) {
            event.ports[0].postMessage(result);
        } else {
            console.error("Service Worker: No port available to post message back to client.");
            // Optionally, broadcast to all clients if no specific port
            // self.clients.matchAll().then(clients => {
            //   clients.forEach(client => client.postMessage({ type: 'FETCH_USERS_RESULT', result }));
            // });
        }
    }
});
