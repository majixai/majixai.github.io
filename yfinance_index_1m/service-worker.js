// Service Worker for YFinance PWA - Full Offline Support
const CACHE_NAME = 'yfinance-pwa-v3.0.0';
const DYNAMIC_CACHE = 'yfinance-dynamic-v3';
const DATA_CACHE = 'yfinance-data-v3';
const CACHE_VERSION = 'v3.0.0';

// Assets to cache on install - using relative paths
const STATIC_ASSETS = [
  './',
  './index.html',
  './dashboard.html',
  './features.html',
  './forecast.html',
  './style.css',
  './script.js',
  './script_enhanced.js',
  './pwa-installer.js',
  './webhook-handler.js',
  './manifest.json',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-152x152.png',
  './icons/icon-192x192.png',
  './icons/icon-256x256.png',
  './icons/icon-384x384.png',
  './icons/icon-512x512.png'
];

// Data files to cache for offline access
const DATA_FILES = [
  './index_1m.json',
  './multi_timeframe.json',
  './multi_timeframe_ml.json',
  './forecast_monday_1pm.json'
];

// Install event - cache static assets and data files
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker version', CACHE_VERSION);
  event.waitUntil(
    Promise.all([
      // Cache static assets
      caches.open(CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static assets');
        return cache.addAll(STATIC_ASSETS).catch(error => {
          console.warn('[SW] Some static assets failed to cache:', error);
          // Try to cache individually
          return Promise.allSettled(
            STATIC_ASSETS.map(url => 
              cache.add(url).catch(e => console.warn(`Failed to cache ${url}:`, e))
            )
          );
        });
      }),
      // Cache data files
      caches.open(DATA_CACHE).then((cache) => {
        console.log('[SW] Caching data files for offline');
        return Promise.allSettled(
          DATA_FILES.map(url => 
            fetch(url)
              .then(response => response.ok ? cache.put(url, response) : null)
              .catch(e => console.warn(`Failed to cache ${url}:`, e))
          )
        );
      })
    ])
    .then(() => {
      console.log('[SW] Installation complete, skipping waiting');
      return self.skipWaiting();
    })
    .catch((error) => {
      console.error('[SW] Cache install failed:', error);
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker version', CACHE_VERSION);
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => 
              name !== CACHE_NAME && 
              name !== DYNAMIC_CACHE && 
              name !== DATA_CACHE
            )
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated and claiming clients');
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip cross-origin requests
  if (url.origin !== location.origin) {
    return;
  }

  // JSON data files - cache first with background update
  if (url.pathname.endsWith('.json')) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          const fetchPromise = fetch(request)
            .then((response) => {
              if (response.ok) {
                const responseClone = response.clone();
                caches.open(DATA_CACHE).then((cache) => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            })
            .catch(() => null);
          
          // Return cached immediately if available, otherwise wait for network
          return cached || fetchPromise || new Response(
            JSON.stringify({ 
              error: 'Offline - no cached data available',
              offline: true 
            }),
            { 
              headers: { 'Content-Type': 'application/json' },
              status: 503
            }
          );
        })
    );
    return;
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
          .then((response) => {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
            return response;
          }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 5000)
        )
      ])
      .catch(() => {
        return caches.match(request)
          .then((cached) => {
            if (cached) {
              return cached;
            }
            return new Response(
              JSON.stringify({ error: 'Offline - no cached data available' }),
              { 
                headers: { 'Content-Type': 'application/json' },
                status: 503
              }
            );
          });
      })
    );
    return;
  }

  // Images - cache first, network fallback
  if (url.pathname.endsWith('.png') || url.pathname.endsWith('.jpg') || url.pathname.endsWith('.svg')) {
    event.respondWith(
      caches.match(request)
        .then((cached) => {
          if (cached) {
            // Return cached and update in background
            fetch(request).then((response) => {
              caches.open(DYNAMIC_CACHE).then((cache) => {
                cache.put(request, response);
              });
            });
            return cached;
          }
          return fetch(request).then((response) => {
            const responseClone = response.clone();
            caches.open(DYNAMIC_CACHE).then((cache) => {
              cache.put(request, responseClone);
            });
            return response;
          });
        })
    );
    return;
  }

  // HTML/other - stale-while-revalidate
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          cache.put(request, response.clone());
          return response;
        });
        return cached || fetchPromise;
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag);
  
  if (event.tag === 'sync-forecasts') {
    event.waitUntil(
      fetch('/api/generate', { method: 'POST' })
        .then((response) => {
          console.log('[SW] Forecast sync completed');
          return response.json();
        })
        .then((data) => {
          // Notify all clients
          return self.clients.matchAll().then((clients) => {
            clients.forEach((client) => {
              client.postMessage({
                type: 'FORECAST_UPDATED',
                data: data
              });
            });
          });
        })
        .catch((error) => {
          console.error('[SW] Sync failed:', error);
        })
    );
  }
});

// Push notifications
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'GenAI Forecast';
  const options = {
    body: data.body || 'New market forecast available',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    vibrate: [200, 100, 200],
    tag: 'forecast-update',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'View Forecast'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ],
    data: {
      url: data.url || '/'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  
  event.notification.close();

  if (event.action === 'view') {
    const urlToOpen = event.notification.data.url;
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Focus existing window if available
          for (const client of clientList) {
            if (client.url === urlToOpen && 'focus' in client) {
              return client.focus();
            }
          }
          // Open new window if no existing window
          if (clients.openWindow) {
            return clients.openWindow(urlToOpen);
          }
        })
    );
  }
});

// Message handler for communication with main app
self.addEventListener('message', (event) => {
  console.log('[SW] Message received:', event.data);
  
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data.type === 'CACHE_FORECAST') {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then((cache) => {
        return cache.put('/forecast_monday_1pm.json', new Response(
          JSON.stringify(event.data.forecast),
          { headers: { 'Content-Type': 'application/json' } }
        ));
      })
    );
  }
  
  if (event.data.type === 'CLEAR_CACHE') {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => caches.delete(name))
        );
      })
    );
  }
});

// ============= ENHANCED PERMISSIONS & FEATURES =============

// Push Notification Handler
self.addEventListener('push', (event) => {
  console.log('[SW] Push notification received');
  
  let data = { title: 'Market Update', body: 'New data available' };
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }
  
  const options = {
    body: data.body || 'New market data available',
    icon: './icons/icon-192x192.png',
    badge: './icons/icon-96x96.png',
    vibrate: [200, 100, 200],
    data: data.data || {},
    actions: [
      { action: 'view', title: 'View Dashboard', icon: './icons/icon-96x96.png' },
      { action: 'dismiss', title: 'Dismiss' }
    ],
    tag: 'market-update',
    renotify: true,
    requireInteraction: false
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title || 'Market Update', options)
  );
});

// Notification Click Handler
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event.action);
  event.notification.close();
  
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Focus existing window or open new one
          for (let client of clientList) {
            if (client.url.includes('index.html') && 'focus' in client) {
              return client.focus();
            }
          }
          if (clients.openWindow) {
            return clients.openWindow('./index.html');
          }
        })
    );
  }
});

// Background Sync Handler
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync triggered:', event.tag);
  
  if (event.tag === 'sync-market-data') {
    event.waitUntil(
      fetch('./multi_timeframe.json')
        .then(response => response.json())
        .then(data => {
          return caches.open(DATA_CACHE).then(cache => {
            cache.put('./multi_timeframe.json', new Response(JSON.stringify(data)));
            
            // Notify all clients
            return self.clients.matchAll().then(clients => {
              clients.forEach(client => {
                client.postMessage({
                  type: 'DATA_SYNCED',
                  timestamp: Date.now()
                });
              });
            });
          });
        })
        .catch(err => {
          console.error('[SW] Sync failed:', err);
          return self.registration.showNotification('Sync Failed', {
            body: 'Unable to update market data',
            icon: './icons/icon-192x192.png'
          });
        })
    );
  }
});

// Periodic Background Sync Handler (requires permission)
self.addEventListener('periodicsync', (event) => {
  console.log('[SW] Periodic sync triggered:', event.tag);
  
  if (event.tag === 'update-market-data') {
    event.waitUntil(
      fetch('./multi_timeframe.json')
        .then(response => response.json())
        .then(data => {
          return caches.open(DATA_CACHE).then(cache => {
            cache.put('./multi_timeframe.json', new Response(JSON.stringify(data)));
          });
        })
        .catch(err => console.error('[SW] Periodic sync failed:', err))
    );
  }
});

console.log('[SW] Service Worker loaded');
