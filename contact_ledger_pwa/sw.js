// Service Worker for Contact & Ledger Manager PWA
self.SW_CONFIG = {
  cacheVersion: 'contact-ledger-v2',
  appShellFiles: ['./', './index.html', './app.js', './style.css', './manifest.json'],
};
importScripts('/pwa/sw-core.js');
