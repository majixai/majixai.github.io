const CACHE_NAME = 'stock-analyzer-cache-v2'; // Incremented cache version
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/index.css',
  '/index.tsx', // In a real build, this would be the bundled JS file
  'https://cdn.plot.ly/plotly-2.32.0.min.js',
  'https://esm.sh/@google/genai@^0.7.0',
  'https://esm.sh/marked@^15.0.7',
  'https://fonts.googleapis.com/css2?family=Montserrat:wght@300;400;500;600;700&display=swap', // Google Font
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css', // Bootstrap CSS
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/js/bootstrap.bundle.min.js', // Bootstrap JS
  'https://www.w3schools.com/w3css/4/w3.css' // W3.CSS
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('ServiceWorker: Caching app shell and assets');
        // Use addAll with a catch for individual asset failures if necessary for robustness
        return Promise.all(ASSETS_TO_CACHE.map(url => {
          return cache.add(url).catch(err => {
            console.warn(`ServiceWorker: Failed to cache ${url}`, err);
          });
        }));
      })
      .catch(error => {
        console.error('ServiceWorker: Failed to open cache or cache initial assets', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('ServiceWorker: Clearing old cache', cacheName);
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

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // For navigation requests (HTML), try network first, then cache, then fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // If network fetch is successful, cache it dynamically
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then(cache => {
              cache.put(request, responseToCache);
            });
          }
          return response;
        })
        .catch(() => {
          // Network failed, try to serve from cache
          return caches.match(request).then(cachedResponse => {
            return cachedResponse || caches.match('/index.html'); // Fallback to cached index.html
          });
        })
    );
    return;
  }

  // For other requests (CSS, JS, fonts, images, CDNs), use cache-first strategy.
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        // Not in cache, fetch from network
        return fetch(request).then((networkResponse) => {
          // If the request is for a CDN asset we pre-cached, we don't need to re-cache it here unless strategy changes.
          // For other dynamic assets not in ASSETS_TO_CACHE, you might cache them.
          // Example: Caching other basic same-origin requests (e.g. images loaded by the app)
          if (networkResponse && networkResponse.status === 200 && new URL(request.url).origin === self.location.origin) {
            // const responseToCache = networkResponse.clone();
            // caches.open(CACHE_NAME).then(cache => {
            //   cache.put(request, responseToCache);
            // });
          }
          return networkResponse;
        }).catch(error => {
            console.warn(`ServiceWorker: Fetch failed for ${request.url}; returning offline page or error.`, error);
            // You could return a generic offline fallback for specific asset types if needed.
            // e.g., if (request.destination === 'image') return caches.match('/offline-image.png');
        });
      })
  );
});
