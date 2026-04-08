// Service Worker for Stock Projection Analyzer PWA
self.SW_CONFIG = {
  cacheVersion: 'stock-analyzer-v1',
  appShellFiles: ['./', './index.html', './manifest.json'],
  trustedCdnHosts: [
    'cdn.plot.ly',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
    'www.w3schools.com'
  ],
};
importScripts('/pwa/sw-core.js');
