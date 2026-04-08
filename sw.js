// Service Worker for MajixAI Root PWA
self.SW_CONFIG = {
  cacheVersion: 'majixai-pwa-v1',
  appShellFiles: ['./', './index.html', './manifest.webmanifest', './script.js', './style.css'],
};
importScripts('/pwa/sw-core.js');
