// Service Worker for Option Strategy Lab PWA
self.SW_CONFIG = {
  cacheVersion: 'option-strategy-lab-v1',
  appShellFiles: ['./', './index.html', './manifest.json'],
  trustedCdnHosts: [
    'www.w3schools.com',
    'cdnjs.cloudflare.com',
    'cdn.plot.ly',
    'fonts.googleapis.com',
    'fonts.gstatic.com'
  ],
};
importScripts('/pwa/sw-core.js');
