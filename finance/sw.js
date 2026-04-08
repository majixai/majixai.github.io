// Service Worker for Finance Hub PWA
self.SW_CONFIG = {
  cacheVersion: 'finance-hub-v1',
  appShellFiles: ['./', './index.html', './manifest.json', './style.css'],
  trustedCdnHosts: [
    'cdnjs.cloudflare.com',
    'www.w3schools.com',
    'w3schools.com',
    'cdn.jsdelivr.net',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ],
};
importScripts('/pwa/sw-core.js');
