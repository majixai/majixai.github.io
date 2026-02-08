// Service Worker for MajixAI Project Directory PWA
const CACHE_NAME = 'majixai-cache-v1';
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './style.css',
    './script.js',
    './redirect.js',
    './analytics.js',
    // External CDN assets
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
    'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js',
    'https://www.w3schools.com/w3css/4/w3.css',
    'https://code.jquery.com/jquery-3.7.1.min.js'
];

// Install event - cache assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('ServiceWorker: Caching app shell and assets');
                // Use Promise.all with individual catches for more resilient caching
                return Promise.all(ASSETS_TO_CACHE.map(url => {
                    return cache.add(url).catch(err => {
                        console.warn(`ServiceWorker: Failed to cache ${url}`, err);
                    });
                }));
            })
            .then(() => self.skipWaiting())
            .catch(error => {
                console.error('ServiceWorker: Failed to open cache', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('ServiceWorker: Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('ServiceWorker: Activated and old caches cleared.');
            return self.clients.claim();
        })
    );
});

// Fetch event - network first for navigation, cache first for assets
self.addEventListener('fetch', (event) => {
    const { request } = event;

    // Skip non-GET requests and analytics/tracking requests
    if (request.method !== 'GET') {
        return;
    }

    // Skip Google Analytics and tracking requests by checking the URL hostname
    try {
        const url = new URL(request.url);
        const hostname = url.hostname;
        const pathname = url.pathname;
        
        // Check if this is an analytics/tracking request
        if (hostname === 'www.google-analytics.com' ||
            hostname === 'google-analytics.com' ||
            hostname === 'www.googletagmanager.com' ||
            hostname === 'googletagmanager.com' ||
            hostname === 'script.google.com' ||
            pathname === '/collect' ||
            pathname === '/g/collect' ||
            pathname.startsWith('/mp/collect')) {
            return;
        }
    } catch (e) {
        // If URL parsing fails, proceed with caching logic
        console.warn('ServiceWorker: Could not parse URL', request.url);
    }

    // For navigation requests (HTML), use network first strategy
    if (request.mode === 'navigate') {
        event.respondWith(
            fetch(request)
                .then(response => {
                    if (response && response.status === 200) {
                        const responseToCache = response.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return response;
                })
                .catch(() => {
                    return caches.match(request).then(cachedResponse => {
                        return cachedResponse || caches.match('./index.html');
                    });
                })
        );
        return;
    }

    // For other requests (CSS, JS, fonts, images), use cache first strategy
    event.respondWith(
        caches.match(request)
            .then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(request).then((networkResponse) => {
                    // Cache successful same-origin responses
                    if (networkResponse && networkResponse.ok) {
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME).then(cache => {
                            cache.put(request, responseToCache);
                        });
                    }
                    return networkResponse;
                }).catch(error => {
                    console.warn(`ServiceWorker: Fetch failed for ${request.url}`, error);
                });
            })
    );
});
