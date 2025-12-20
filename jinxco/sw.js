/**
 * @fileoverview AlphaNexus Service Worker
 * Handles caching and offline availability for the PWA.
 */

const CACHE_NAME = 'nexus-protocol-v1';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  'https://www.w3schools.com/w3css/4/w3.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  'https://fonts.googleapis.com/icon?family=Material+Icons'
];

// Install Event: Caching the Shell
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      console.log('Nexus Shell: Caching Assets');
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
});

// Activate Event: Cleaning old caches
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cache) {
          if (cache !== CACHE_NAME) {
            console.log('Nexus Shell: Clearing Old Cache');
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

// Fetch Event: Cache-first strategy for static assets
self.addEventListener('fetch', function(event) {
  // Skip cross-origin requests for the GAS API (we want fresh data)
  if (event.request.url.includes('google.com') || event.request.url.includes('script.google')) {
    return; 
  }

  event.respondWith(
    caches.match(event.request).then(function(response) {
      return response || fetch(event.request);
    })
  );
});
