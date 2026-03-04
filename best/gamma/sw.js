'use strict';

const CACHE_NAME = 'my-site-cache-v1';
const OFFLINE_URL = 'offline.html';
const ASSETS_TO_CACHE = [
    '/index.html',
    '/styles.css',
    '/script.js',
    OFFLINE_URL
];

// Install event: caching assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => {
                console.log('Caching assets');
                return cache.addAll(ASSETS_TO_CACHE);
            })
    );
});

// Fetch event: serving cached assets
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request)
                    .catch(() => caches.match(OFFLINE_URL));
            })
    );
});

// Activate event: deleting old caches
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
        })
    );
});

// Background sync
self.addEventListener('sync', event => {
    if (event.tag === 'sync-updates') {
        event.waitUntil(
            // Perform background sync here
            console.log('Background Sync Triggered')
        );
    }
});
