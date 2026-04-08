// Service Worker for Ticker Analyses PWA
self.SW_CONFIG = {
  cacheVersion: 'ticker-analyses-v1',
  appShellFiles: ['./', './index.html', './manifest.json'],
};
importScripts('/pwa/sw-core.js');
