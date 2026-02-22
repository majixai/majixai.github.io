// Service Worker for Option Strategy Lab PWA
const CACHE_VERSION = 'option-strategy-lab-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE   = `${CACHE_VERSION}-runtime`;

const APP_SHELL_FILES = [
    './',
    './index.html',
    './manifest.json'
];

const TRUSTED_CDN_HOSTS = [
    'www.w3schools.com',
    'cdnjs.cloudflare.com',
    'cdn.plot.ly',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(APP_SHELL_CACHE)
            .then((cache) => cache.addAll(APP_SHELL_FILES))
            .then(() => self.skipWaiting())
    );
});

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
        return cached || caches.match('./index.html');
    }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;
    const url = new URL(request.url);

    if (request.mode === 'navigate') {
        event.respondWith(networkFirst(request));
        return;
    }
    if (url.origin === self.location.origin) {
        event.respondWith(cacheFirst(request));
        return;
    }
    if (TRUSTED_CDN_HOSTS.includes(url.hostname)) {
        event.respondWith(cacheFirst(request));
        return;
    }
    event.respondWith(fetch(request));
});
