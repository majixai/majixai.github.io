// /pwa/sw-core.js  —  Unified Service Worker Core for MajixAI PWAs
//
// Usage: set self.SW_CONFIG before calling importScripts('/pwa/sw-core.js')
//
// SW_CONFIG options (all optional):
//   cacheVersion           {string}   Cache key prefix              default: 'majixai-pwa-v1'
//   appShellFiles          {string[]} Files to pre-cache on install  default: ['./', './index.html']
//   trustedCdnHosts        {string[]} CDN hostnames → cache-first    default: common CDNs
//   imageCdnHosts          {string[]} Image CDN hostnames → SWR      default: []
//   subappModules          {Object}   { subappName: [paths] }        default: {}
//   networkFirstExtensions {string[]} File extensions → network-first default: ['.dat']
//   bypassHosts            {string[]} Hostnames → skip SW entirely    default: []

(() => {
  'use strict';

  const cfg = self.SW_CONFIG || {};

  const CACHE_VERSION  = cfg.cacheVersion || 'majixai-pwa-v1';
  const SHELL_CACHE    = `${CACHE_VERSION}-shell`;
  const RUNTIME_CACHE  = `${CACHE_VERSION}-runtime`;
  const SLIDESHOW_CACHE = `${CACHE_VERSION}-slideshow`;

  const APP_SHELL_FILES = cfg.appShellFiles || ['./', './index.html'];

  const TRUSTED_CDN_HOSTS = cfg.trustedCdnHosts || [
    'cdnjs.cloudflare.com',
    'www.w3schools.com',
    'w3schools.com',
    'code.jquery.com',
    'unpkg.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'cdn.plot.ly',
    'ajax.googleapis.com',
    's3.tradingview.com'
  ];

  const IMAGE_CDN_HOSTS          = cfg.imageCdnHosts          || [];
  const SUBAPP_MODULES           = cfg.subappModules           || {};
  const NETWORK_FIRST_EXTENSIONS = cfg.networkFirstExtensions  || ['.dat'];
  const BYPASS_HOSTS             = cfg.bypassHosts             || [];

  // ── Install: pre-cache app shell ──────────────────────────────────────────
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(SHELL_CACHE)
        .then((cache) => cache.addAll(APP_SHELL_FILES))
        .then(() => self.skipWaiting())
    );
  });

  // ── Activate: purge stale caches ──────────────────────────────────────────
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => !key.startsWith(CACHE_VERSION))
              .map((key) => caches.delete(key))
          )
        )
        .then(() => self.clients.claim())
    );
  });

  // ── Cache strategies ──────────────────────────────────────────────────────

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
      if (cached) return cached;
      return caches.match('./index.html');
    }
  }

  // Returns cached copy immediately; refreshes in background (great for images)
  async function staleWhileRevalidate(request) {
    const cache  = await caches.open(SLIDESHOW_CACHE);
    const cached = await cache.match(request);
    const fetchPromise = fetch(request).then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    }).catch(() => null);
    return cached || fetchPromise;
  }

  // Cache a subapp's modules on-demand (non-blocking)
  async function cacheSubappModules(subappName) {
    const modules = SUBAPP_MODULES[subappName];
    if (!modules) return;
    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.allSettled(
      modules.map(async (path) => {
        try {
          const response = await fetch(path);
          if (response.ok) cache.put(path, response);
        } catch { /* ignore individual failures */ }
      })
    );
  }

  // ── Fetch ─────────────────────────────────────────────────────────────────
  self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // Explicitly bypassed hosts pass through to the browser unmodified
    if (BYPASS_HOSTS.some((h) => url.hostname.includes(h))) return;

    // Navigation: network-first; cache subapp modules as a side-effect
    if (request.mode === 'navigate') {
      for (const subappName of Object.keys(SUBAPP_MODULES)) {
        if (url.pathname.includes(`/${subappName}/`)) {
          cacheSubappModules(subappName);
          break;
        }
      }
      event.respondWith(networkFirst(request));
      return;
    }

    // Dynamic data files: network-first for freshness
    if (NETWORK_FIRST_EXTENSIONS.some((ext) => url.pathname.endsWith(ext))) {
      event.respondWith(networkFirst(request));
      return;
    }

    // Same-origin static assets: cache-first
    if (url.origin === self.location.origin) {
      event.respondWith(cacheFirst(request));
      return;
    }

    // Trusted CDNs: cache-first
    if (TRUSTED_CDN_HOSTS.includes(url.hostname)) {
      event.respondWith(cacheFirst(request));
      return;
    }

    // Image CDNs: stale-while-revalidate for offline slideshow support
    if (IMAGE_CDN_HOSTS.includes(url.hostname)) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }

    // All other cross-origin requests: let the browser handle them
    event.respondWith(fetch(request));
  });
})();
