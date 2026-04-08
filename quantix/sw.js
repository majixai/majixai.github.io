// Service Worker for Quantix PWA
self.SW_CONFIG = {
  cacheVersion: 'quantix-v1',
  appShellFiles: ['./', './index.html', './manifest.json'],
};
importScripts('/pwa/sw-core.js');
