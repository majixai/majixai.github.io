// Service Worker for AlphaNexus Protocol PWA
self.SW_CONFIG = {
  cacheVersion: 'nexus-protocol-v2',
  appShellFiles: ['./', './index.html', './manifest.json'],
  trustedCdnHosts: [
    'www.w3schools.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com'
  ],
  // Skip caching live Google App Script endpoints
  bypassHosts: ['google.com', 'script.google'],
};
importScripts('/pwa/sw-core.js');
