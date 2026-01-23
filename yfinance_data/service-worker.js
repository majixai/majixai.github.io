/**
 * Service Worker for YFinance Data Analytics PWA
 * Provides offline functionality and caching strategies
 */

const CACHE_VERSION = 'v1.0.0';
const CACHE_NAME = `yfinance-data-${CACHE_VERSION}`;
const DATA_CACHE_NAME = `yfinance-data-runtime-${CACHE_VERSION}`;

// Assets to cache on install
const STATIC_ASSETS = [
    '/yfinance_data/',
    '/yfinance_data/index.html',
    '/yfinance_data/ticker_detail.html',
    '/yfinance_data/style.css',
    '/yfinance_data/detail_style.css',
    '/yfinance_data/script.js',
    '/yfinance_data/detail_script.js',
    '/yfinance_data/actions.js',
    '/yfinance_data/worker.js',
    '/yfinance_data/manifest.json',
    'https://cdn.plot.ly/plotly-2.27.0.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/mathjs/12.2.0/math.min.js',
    'https://cdnjs.cloudflare.com/ajax/libs/pako/2.1.0/pako.min.js',
    'https://cdn.jsdelivr.net/npm/sql.js@1.8.0/dist/sql-wasm.js'
];

// API endpoints to cache with network-first strategy
const API_ENDPOINTS = [
    /yfinance\.dat$/,
    /yfinance_intraday\.dat$/
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
    console.log('[Service Worker] Installing...');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Caching static assets');
                return cache.addAll(STATIC_ASSETS.map(url => new Request(url, { cache: 'reload' })));
            })
            .then(() => {
                console.log('[Service Worker] Installation complete');
                return self.skipWaiting(); // Activate immediately
            })
            .catch((error) => {
                console.error('[Service Worker] Installation failed:', error);
            })
    );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activating...');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((cacheName) => {
                            // Delete old cache versions
                            return cacheName.startsWith('yfinance-data-') && cacheName !== CACHE_NAME && cacheName !== DATA_CACHE_NAME;
                        })
                        .map((cacheName) => {
                            console.log('[Service Worker] Deleting old cache:', cacheName);
                            return caches.delete(cacheName);
                        })
                );
            })
            .then(() => {
                console.log('[Service Worker] Activation complete');
                return self.clients.claim(); // Take control immediately
            })
    );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip cross-origin requests (except CDN assets)
    if (url.origin !== location.origin && !isCDNAsset(url.href)) {
        return;
    }

    // Handle API data requests (database files)
    if (isDataRequest(url.pathname)) {
        event.respondWith(networkFirstStrategy(request));
        return;
    }

    // Handle static assets
    if (isStaticAsset(url.pathname)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // Handle CDN assets
    if (isCDNAsset(url.href)) {
        event.respondWith(cacheFirstStrategy(request));
        return;
    }

    // Default: cache first with network fallback
    event.respondWith(cacheFirstStrategy(request));
});

// ============================================
// CACHING STRATEGIES
// ============================================

/**
 * Cache First Strategy
 * Serve from cache if available, otherwise fetch from network and cache
 */
async function cacheFirstStrategy(request) {
    try {
        // Try to get from cache first
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            console.log('[Service Worker] Serving from cache:', request.url);
            return cachedResponse;
        }

        // Not in cache, fetch from network
        console.log('[Service Worker] Fetching from network:', request.url);
        const networkResponse = await fetch(request);

        // Cache the new response (only if successful)
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.error('[Service Worker] Fetch failed:', error);
        
        // Try to serve offline fallback page
        if (request.destination === 'document') {
            const cache = await caches.open(CACHE_NAME);
            return cache.match('/yfinance_data/index.html');
        }

        // Return offline response
        return new Response('Offline - Content not available', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

/**
 * Network First Strategy
 * Try network first, fallback to cache if offline
 */
async function networkFirstStrategy(request) {
    try {
        console.log('[Service Worker] Network first:', request.url);
        
        // Try network first
        const networkResponse = await fetch(request);

        // Cache the response
        if (networkResponse && networkResponse.status === 200) {
            const cache = await caches.open(DATA_CACHE_NAME);
            cache.put(request, networkResponse.clone());
        }

        return networkResponse;

    } catch (error) {
        console.log('[Service Worker] Network failed, trying cache:', request.url);
        
        // Network failed, try cache
        const cachedResponse = await caches.match(request);
        
        if (cachedResponse) {
            return cachedResponse;
        }

        // No cache available
        return new Response('Data not available offline', {
            status: 503,
            statusText: 'Service Unavailable',
            headers: new Headers({
                'Content-Type': 'text/plain'
            })
        });
    }
}

/**
 * Stale While Revalidate Strategy
 * Serve from cache immediately, update cache in background
 */
async function staleWhileRevalidateStrategy(request) {
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(request);

    // Fetch from network in background
    const fetchPromise = fetch(request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
            cache.put(request, networkResponse.clone());
        }
        return networkResponse;
    });

    // Return cached response immediately, or wait for network
    return cachedResponse || fetchPromise;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

function isStaticAsset(pathname) {
    return pathname.match(/\.(html|css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|ico)$/);
}

function isDataRequest(pathname) {
    return API_ENDPOINTS.some(pattern => pattern.test(pathname));
}

function isCDNAsset(url) {
    return url.includes('cdn.plot.ly') || 
           url.includes('cdnjs.cloudflare.com') || 
           url.includes('cdn.jsdelivr.net');
}

// ============================================
// MESSAGE HANDLING
// ============================================

// Listen for messages from clients
self.addEventListener('message', (event) => {
    console.log('[Service Worker] Message received:', event.data);

    if (event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }

    if (event.data.type === 'CLEAR_CACHE') {
        event.waitUntil(
            caches.keys().then((cacheNames) => {
                return Promise.all(
                    cacheNames.map((cacheName) => caches.delete(cacheName))
                );
            }).then(() => {
                event.ports[0].postMessage({ success: true });
            })
        );
    }

    if (event.data.type === 'CACHE_SIZE') {
        event.waitUntil(
            getCacheSize().then((size) => {
                event.ports[0].postMessage({ size });
            })
        );
    }
});

// Get total cache size
async function getCacheSize() {
    const cacheNames = await caches.keys();
    let totalSize = 0;

    for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const requests = await cache.keys();
        
        for (const request of requests) {
            const response = await cache.match(request);
            if (response) {
                const blob = await response.blob();
                totalSize += blob.size;
            }
        }
    }

    return totalSize;
}

// ============================================
// BACKGROUND SYNC
// ============================================

self.addEventListener('sync', (event) => {
    console.log('[Service Worker] Background sync:', event.tag);
    
    if (event.tag === 'sync-data') {
        event.waitUntil(syncData());
    }
});

async function syncData() {
    console.log('[Service Worker] Syncing data...');
    // Implement data synchronization logic
    // This could sync local changes to server when online
}

// ============================================
// PUSH NOTIFICATIONS (Optional)
// ============================================

self.addEventListener('push', (event) => {
    console.log('[Service Worker] Push notification received');
    
    const options = {
        body: event.data ? event.data.text() : 'New market data available',
        icon: '/yfinance_data/icons/icon-192x192.png',
        badge: '/yfinance_data/icons/icon-72x72.png',
        vibrate: [200, 100, 200],
        data: {
            dateOfArrival: Date.now(),
            primaryKey: 1
        },
        actions: [
            {
                action: 'view',
                title: 'View Details',
                icon: '/yfinance_data/icons/icon-72x72.png'
            },
            {
                action: 'close',
                title: 'Close',
                icon: '/yfinance_data/icons/icon-72x72.png'
            }
        ]
    };

    event.waitUntil(
        self.registration.showNotification('YFinance Data Update', options)
    );
});

self.addEventListener('notificationclick', (event) => {
    console.log('[Service Worker] Notification clicked:', event.action);
    
    event.notification.close();

    if (event.action === 'view') {
        event.waitUntil(
            clients.openWindow('/yfinance_data/index.html')
        );
    }
});

// ============================================
// PERIODIC BACKGROUND SYNC (Experimental)
// ============================================

self.addEventListener('periodicsync', (event) => {
    console.log('[Service Worker] Periodic sync:', event.tag);
    
    if (event.tag === 'update-data') {
        event.waitUntil(updateData());
    }
});

async function updateData() {
    console.log('[Service Worker] Updating data in background...');
    // Implement periodic data update logic
}

console.log('[Service Worker] Loaded');
