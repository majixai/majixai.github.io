// Service Worker for Cos Library PWA
self.SW_CONFIG = {
  cacheVersion: 'majixai-cos-v1',
  appShellFiles: ['./', './index.html', './manifest.json', './cos-core.js'],
  trustedCdnHosts: [
    'www.w3schools.com',
    'cdnjs.cloudflare.com',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
  ],
};
importScripts('/pwa/sw-core.js');
