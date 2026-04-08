// /pwa/sw-core.js  —  Enhanced Unified Service Worker Core for MajixAI PWAs
//
// Usage: set self.SW_CONFIG before calling importScripts('/pwa/sw-core.js')
//
// SW_CONFIG options (all optional):
//
//   cacheVersion           {string}
//     Cache key prefix.  Bump to invalidate all caches.
//     default: 'majixai-pwa-v1'
//
//   appShellFiles          {(string | { url: string, integrity?: string })[]}
//     Files pre-cached on install.  Object form lets you pin a per-file hash.
//     default: ['./', './index.html']
//
//   integrity              { [urlOrPath: string]: 'sha256-<base64>' }
//     SHA-256 integrity map.  Any fetched URL whose key matches (exact URL,
//     pathname, or relative './...' path) has its body verified via
//     crypto.subtle before being cached.
//     default: {}
//
//   integrityMode          'warn' | 'enforce'
//     'warn'    — log a warning and skip caching on mismatch; response is
//                 still served to the page.
//     'enforce' — throw on mismatch; the request falls back to cached copy
//                 or the offline fallback page.
//     default: 'warn'
//
//   offlineFallback        {string}
//     URL served when a navigation request fails and no cache is available.
//     default: './index.html'
//
//   networkTimeoutMs       {number}
//     Milliseconds to wait for a network response before falling back to
//     cache.  0 disables the timeout.
//     default: 0
//
//   cacheStrategy          { [pathPrefix: string]: 'cache-first' | 'network-first' | 'stale-while-revalidate' }
//     Per-path-prefix strategy overrides.  Matched against url.pathname via
//     startsWith(); first match wins.
//     default: {}
//
//   maxCacheAgeSeconds     {number}
//     Runtime-cache TTL.  Entries older than this are treated as stale and
//     re-fetched.  A timestamp is stored in the x-sw-cached-at response
//     header.  0 disables TTL checking.
//     default: 0
//
//   skipCachingPatterns    {string[]}
//     Array of RegExp source strings.  Matching URLs are never written to
//     the runtime cache.
//     default: []
//
//   customHandlers         { test(url: URL, req: Request): boolean,
//                            handle(req: Request): Promise<Response> }[]
//     Fully custom fetch handlers evaluated before all built-in routing.
//     First matching handler wins.
//     default: []
//
//   trustedCdnHosts        {string[]}
//     CDN hostnames served with cache-first strategy.
//     default: common CDNs
//
//   imageCdnHosts          {string[]}
//     Image CDN hostnames served with stale-while-revalidate.
//     default: []
//
//   subappModules          { [subappName: string]: string[] }
//     Paths cached on-demand when the matching subapp is navigated to.
//     default: {}
//
//   networkFirstExtensions {string[]}
//     File extensions always served network-first.
//     default: ['.dat']
//
//   bypassHosts            {string[]}
//     Hostnames the SW leaves completely unhandled (live APIs, etc.).
//     default: []

(() => {
  'use strict';

  const cfg = (self.SW_CONFIG != null) ? self.SW_CONFIG : {};

  // ── Configuration constants ────────────────────────────────────────────────

  const CACHE_VERSION    = cfg.cacheVersion     || 'majixai-pwa-v1';
  const SHELL_CACHE      = `${CACHE_VERSION}-shell`;
  const RUNTIME_CACHE    = `${CACHE_VERSION}-runtime`;
  const SLIDESHOW_CACHE  = `${CACHE_VERSION}-slideshow`;

  const APP_SHELL_FILES  = cfg.appShellFiles    || ['./', './index.html'];
  const OFFLINE_FALLBACK = cfg.offlineFallback  || './index.html';
  const INTEGRITY_MAP    = cfg.integrity        || {};
  const INTEGRITY_MODE   = (cfg.integrityMode === 'enforce') ? 'enforce' : 'warn';
  const NETWORK_TIMEOUT  = (Number(cfg.networkTimeoutMs) > 0) ? Number(cfg.networkTimeoutMs) : 0;
  const MAX_CACHE_AGE    = (Number(cfg.maxCacheAgeSeconds) > 0) ? Number(cfg.maxCacheAgeSeconds) : 0;
  const SUBAPP_MODULES   = cfg.subappModules    || {};
  const CUSTOM_STRATEGIES = cfg.cacheStrategy   || {};
  const CUSTOM_HANDLERS  = Array.isArray(cfg.customHandlers) ? cfg.customHandlers : [];

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

  const IMAGE_CDN_HOSTS          = cfg.imageCdnHosts         || [];
  const NETWORK_FIRST_EXTENSIONS = cfg.networkFirstExtensions || ['.dat'];
  const BYPASS_HOSTS             = cfg.bypassHosts            || [];

  const SKIP_CACHING_RES = (cfg.skipCachingPatterns || [])
    .map(p => { try { return new RegExp(p); } catch { return null; } })
    .filter(Boolean);

  // ── SHA-256 integrity ──────────────────────────────────────────────────────

  // Responses that failed integrity in warn mode — must not be cached.
  const NO_CACHE = new WeakSet();

  // Resolve the expected 'sha256-<base64>' hash for a given URL string.
  // Resolution order: exact URL → pathname → relative ./path.
  function getExpectedHash(urlString) {
    if (INTEGRITY_MAP[urlString]) return INTEGRITY_MAP[urlString];
    try {
      const { pathname } = new URL(urlString, self.location.origin);
      if (INTEGRITY_MAP[pathname]) return INTEGRITY_MAP[pathname];
      const rel = './' + pathname.replace(/^\/+/, '');
      if (INTEGRITY_MAP[rel]) return INTEGRITY_MAP[rel];
    } catch { /* ignore parse errors */ }
    return null;
  }

  // Compute the SHA-256 digest of a response body; returns 'sha256-<base64>'.
  // Uses a clone so the original response stream is not consumed.
  async function hashResponse(response) {
    const buf    = await response.clone().arrayBuffer();
    const digest = await crypto.subtle.digest('SHA-256', buf);
    return 'sha256-' + btoa(String.fromCharCode(...new Uint8Array(digest)));
  }

  // Verify a response against its expected hash.
  //   enforce mode → throws TypeError on mismatch (caller falls back to cache/offline).
  //   warn mode    → logs a warning and adds response to NO_CACHE (not stored in cache,
  //                  but still served to the page).
  async function verifyIntegrity(response, expectedHash) {
    const actual = await hashResponse(response);
    if (actual === expectedHash) return; // ✓ integrity verified
    const msg = `[SW] Integrity mismatch for "${response.url}": `
              + `expected ${expectedHash}, got ${actual}`;
    if (INTEGRITY_MODE === 'enforce') throw new TypeError(msg);
    console.warn(msg);
    NO_CACHE.add(response);
  }

  // ── Cache TTL ──────────────────────────────────────────────────────────────

  const CACHED_AT_HDR = 'x-sw-cached-at';

  function isFresh(response) {
    if (!MAX_CACHE_AGE || !response) return true;
    const ts = response.headers.get(CACHED_AT_HDR);
    if (!ts) return true; // No timestamp → treat as fresh (legacy entry)
    return (Date.now() - Number(ts)) < MAX_CACHE_AGE * 1000;
  }

  // Store a response in cache.  When TTL is enabled, a timestamp header is
  // embedded by reading the body into a buffer and reconstructing the Response.
  // In both cases the original response stream is never consumed (a clone is used).
  async function cacheEntry(cache, request, response) {
    if (!MAX_CACHE_AGE) {
      cache.put(request, response.clone());
      return;
    }
    const body    = await response.clone().arrayBuffer();
    const headers = new Headers(response.headers);
    headers.set(CACHED_AT_HDR, String(Date.now()));
    cache.put(request, new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers
    }));
  }

  // ── Fetch helpers ──────────────────────────────────────────────────────────

  function shouldSkipCaching(urlString) {
    return SKIP_CACHING_RES.some(re => re.test(urlString));
  }

  function isOkToCache(response) {
    return response && response.ok && !NO_CACHE.has(response);
  }

  // Fetch with optional timeout and SHA-256 integrity verification.
  // Throws on network timeout or enforce-mode integrity failure.
  async function safeFetch(request) {
    const urlString    = (typeof request === 'string') ? request : request.url;
    const expectedHash = getExpectedHash(urlString);

    let response;
    if (NETWORK_TIMEOUT > 0) {
      response = await Promise.race([
        fetch(request),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('SW_TIMEOUT')), NETWORK_TIMEOUT)
        )
      ]);
    } else {
      response = await fetch(request);
    }

    if (expectedHash && response && response.ok) {
      await verifyIntegrity(response, expectedHash); // may throw or add to NO_CACHE
    }
    return response;
  }

  // ── Caching strategies ─────────────────────────────────────────────────────

  async function cacheFirst(request) {
    const cached = await caches.match(request);
    if (cached && isFresh(cached)) return cached;
    try {
      const response = await safeFetch(request);
      if (isOkToCache(response) && !shouldSkipCaching(request.url)) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cacheEntry(cache, request, response);
      }
      // Prefer stale cache over a non-ok network response
      if (!response || !response.ok) return cached || response;
      return response;
    } catch {
      // Network failure or enforce-mode integrity error → use cache / offline
      return cached || caches.match(OFFLINE_FALLBACK);
    }
  }

  async function networkFirst(request) {
    try {
      const response = await safeFetch(request);
      if (isOkToCache(response) && !shouldSkipCaching(request.url)) {
        const cache = await caches.open(RUNTIME_CACHE);
        await cacheEntry(cache, request, response);
      }
      return response;
    } catch {
      const cached = await caches.match(request);
      if (cached) return cached;
      return caches.match(OFFLINE_FALLBACK);
    }
  }

  // Serves the cached copy immediately while revalidating in the background.
  async function staleWhileRevalidate(request) {
    const cache  = await caches.open(SLIDESHOW_CACHE);
    const cached = await cache.match(request);
    const revalidate = safeFetch(request).then(async (response) => {
      if (isOkToCache(response)) await cacheEntry(cache, request, response);
      return response;
    }).catch(() => null);
    return cached || revalidate;
  }

  // ── Per-URL strategy overrides ─────────────────────────────────────────────

  function getStrategyOverride(pathname) {
    for (const [prefix, strategy] of Object.entries(CUSTOM_STRATEGIES)) {
      if (pathname.startsWith(prefix)) return strategy;
    }
    return null;
  }

  function applyStrategy(event, request, strategy) {
    switch (strategy) {
      case 'network-first':          event.respondWith(networkFirst(request));         break;
      case 'stale-while-revalidate': event.respondWith(staleWhileRevalidate(request)); break;
      default:                       event.respondWith(cacheFirst(request));
    }
  }

  // ── Subapp module caching ──────────────────────────────────────────────────

  async function cacheSubappModules(subappName) {
    const modules = SUBAPP_MODULES[subappName];
    if (!modules) return;
    const cache = await caches.open(RUNTIME_CACHE);
    await Promise.allSettled(
      modules.map(async (path) => {
        try {
          const response = await safeFetch(path);
          if (isOkToCache(response)) await cacheEntry(cache, path, response);
        } catch { /* ignore individual failures */ }
      })
    );
  }

  // ── Install: pre-cache app shell ───────────────────────────────────────────

  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open(SHELL_CACHE).then(async (cache) => {
        // Build Requests, attaching integrity where defined (object form or
        // matching a key in INTEGRITY_MAP).  The browser verifies SRI natively
        // when a Request carries an integrity attribute.
        const requests = APP_SHELL_FILES.map(entry => {
          const url  = (typeof entry === 'string') ? entry : entry.url;
          const hash = (typeof entry === 'object' && entry.integrity)
                       ? entry.integrity
                       : getExpectedHash(url);
          return hash ? new Request(url, { integrity: hash }) : url;
        });
        await cache.addAll(requests);
      }).then(() => self.skipWaiting())
    );
  });

  // ── Activate: purge stale caches ──────────────────────────────────────────

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys()
        .then(keys =>
          Promise.all(
            keys
              .filter(key => !key.startsWith(CACHE_VERSION))
              .map(key => caches.delete(key))
          )
        )
        .then(() => self.clients.claim())
    );
  });

  // ── Fetch ──────────────────────────────────────────────────────────────────

  self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET') return;

    const url = new URL(request.url);

    // 1. Custom handlers — evaluated first (highest priority)
    for (const handler of CUSTOM_HANDLERS) {
      if (typeof handler.test === 'function' &&
          typeof handler.handle === 'function' &&
          handler.test(url, request)) {
        event.respondWith(handler.handle(request));
        return;
      }
    }

    // 2. Bypassed hosts — no SW involvement
    if (BYPASS_HOSTS.some(h => url.hostname.includes(h))) return;

    // 3. Per-path strategy overrides
    const override = getStrategyOverride(url.pathname);
    if (override) { applyStrategy(event, request, override); return; }

    // 4. Navigation — network-first; opportunistically cache subapp modules
    if (request.mode === 'navigate') {
      for (const name of Object.keys(SUBAPP_MODULES)) {
        if (url.pathname.includes(`/${name}/`)) { cacheSubappModules(name); break; }
      }
      event.respondWith(networkFirst(request));
      return;
    }

    // 5. Dynamic data extensions — network-first
    if (NETWORK_FIRST_EXTENSIONS.some(ext => url.pathname.endsWith(ext))) {
      event.respondWith(networkFirst(request));
      return;
    }

    // 6. Same-origin — cache-first
    if (url.origin === self.location.origin) {
      event.respondWith(cacheFirst(request));
      return;
    }

    // 7. Trusted CDNs — cache-first
    if (TRUSTED_CDN_HOSTS.includes(url.hostname)) {
      event.respondWith(cacheFirst(request));
      return;
    }

    // 8. Image CDNs — stale-while-revalidate
    if (IMAGE_CDN_HOSTS.includes(url.hostname)) {
      event.respondWith(staleWhileRevalidate(request));
      return;
    }

    // 9. Other cross-origin — direct fetch (integrity checked if configured)
    event.respondWith(safeFetch(request));
  });

  // ── Message channel ────────────────────────────────────────────────────────
  //
  // Pages can post messages to control the SW at runtime:
  //
  //   { type: 'SW_GET_STATUS' }
  //     → posts back { type: 'SW_STATUS', payload: { cacheVersion, integrityMode,
  //                                                   networkTimeout, maxCacheAge } }
  //
  //   { type: 'SW_CLEAR_RUNTIME_CACHE' }
  //     → deletes RUNTIME_CACHE, posts back { type: 'SW_CACHE_CLEARED',
  //                                           payload: { cache: '<name>' } }
  //
  //   { type: 'SW_SKIP_WAITING' }
  //     → forces the waiting SW to activate immediately

  self.addEventListener('message', (event) => {
    const { type } = (event.data || {});

    if (type === 'SW_GET_STATUS') {
      event.source?.postMessage({
        type: 'SW_STATUS',
        payload: {
          cacheVersion:    CACHE_VERSION,
          integrityMode:   INTEGRITY_MODE,
          networkTimeout:  NETWORK_TIMEOUT,
          maxCacheAge:     MAX_CACHE_AGE
        }
      });
      return;
    }

    if (type === 'SW_CLEAR_RUNTIME_CACHE') {
      caches.delete(RUNTIME_CACHE).then(() =>
        event.source?.postMessage({
          type: 'SW_CACHE_CLEARED',
          payload: { cache: RUNTIME_CACHE }
        })
      );
      return;
    }

    if (type === 'SW_SKIP_WAITING') {
      self.skipWaiting();
    }
  });

})();
