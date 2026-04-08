// Service Worker for Stock Signals PWA
self.SW_CONFIG = {
  cacheVersion: 'stock-signals-v1',
  appShellFiles: ['./', './index.html', './manifest.json', './menu.html'],
  trustedCdnHosts: ['www.w3schools.com'],
};
importScripts('/pwa/sw-core.js');
