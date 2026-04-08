// Service Worker for Market Data PWA
self.SW_CONFIG = {
  cacheVersion: 'market-data-v1',
  appShellFiles: [
    './',
    './index.html',
    './manifest.json',
    './style/main.css',
    './script/main.js',
    './script/menuSystem.js'
  ],
  trustedCdnHosts: [
    'cdnjs.cloudflare.com',
    'www.w3schools.com',
    'ajax.googleapis.com',
    'cdn.jsdelivr.net'
  ],
};
importScripts('/pwa/sw-core.js');
