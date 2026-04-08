'use strict';
// Service Worker for Room Viewer Gamma PWA
self.SW_CONFIG = {
  cacheVersion: 'best-gamma-v1',
  appShellFiles: ['./index.html', './style.css', './script.js'],
};
importScripts('/pwa/sw-core.js');

// Background sync (gamma-specific)
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-updates') {
    event.waitUntil(
      Promise.resolve(console.log('Background Sync Triggered'))
    );
  }
});
