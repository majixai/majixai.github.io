// Service Worker for Best PWA Suite
// Modular architecture supporting main viewer + alpha/beta subapps
const CACHE_VERSION = 'best-viewer-v2';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;

// Main app shell files
const APP_SHELL_FILES = [
  './',
  './index.html',
  './manifest.json',
  './main.js'
];

// Modular subapp configurations
const SUBAPP_MODULES = {
  alpha: [
    './alpha/',
    './alpha/index.html',
    './alpha/manifest.json',
    './alpha/config.js',
    './alpha/api.js',
    './alpha/storage.js',
    './alpha/ui.js',
    './alpha/script.js',
    './alpha/style.css'
  ],
  beta: [
    './beta/',
    './beta/index.html',
    './beta/manifest.json',
    './beta/config.js',
    './beta/api.js',
    './beta/storage.js',
    './beta/ui.js',
    './beta/script.js',
    './beta/style.css',
    './beta/autoscroller.js',
    './beta/decorators.js',
    './beta/mappers.js'
  ],
  performers: [
    './performers/',
    './performers/index.html',
    './performers/manifest.json',
    './performers/style.css',
    './performers/engine/config.js',
    './performers/engine/cache.js',
    './performers/engine/api.js',
    './performers/engine/ui.js',
    './performers/engine/main.js'
  ]
};

// Trusted CDN hostnames for cache-first strategy
const TRUSTED_CDN_HOSTS = [
  'cdnjs.cloudflare.com',
  'www.w3schools.com',
  'w3schools.com',
  'code.jquery.com',
  'unpkg.com',
  'cdn.jsdelivr.net'
];

// Install event - cache app shell (subapps are cached on-demand)
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

// Helper to cache a subapp's modules on-demand
async function cacheSubappModules(subappName) {
  const modules = SUBAPP_MODULES[subappName];
  if (!modules) return;
  const cache = await caches.open(RUNTIME_CACHE);
  await Promise.allSettled(
    modules.map(async (path) => {
      try {
        const response = await fetch(path);
        if (response.ok) {
          await cache.put(path, response);
        }
      } catch {
        // Ignore cache failures for individual modules
      }
    })
  );
}

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first strategy for static assets
async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response && response.ok) {
    const cache = await caches.open(RUNTIME_CACHE);
    cache.put(request, response.clone());
  }
  return response;
}

// Network-first strategy for navigation and data
async function networkFirst(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      const cache = await caches.open(RUNTIME_CACHE);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return caches.match('./index.html');
  }
}

// Fetch event handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Navigation requests use network-first
  // Subapp module caching is fire-and-forget for non-blocking navigation performance
  if (request.mode === 'navigate') {
    // Check if navigating to a subapp and cache its modules (non-blocking)
    for (const subappName of Object.keys(SUBAPP_MODULES)) {
      if (url.pathname.includes(`/${subappName}/`)) {
        cacheSubappModules(subappName);
        break;
      }
    }
    event.respondWith(networkFirst(request));
    return;
  }

  // Data files (.dat) use network-first for freshness
  if (url.pathname.endsWith('.dat')) {
    event.respondWith(networkFirst(request));
    return;
  }

  // Same-origin static assets use cache-first
  if (url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request));
    return;
  }

  // Trusted CDN resources use cache-first
  if (TRUSTED_CDN_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(request));
  }
});
