// Service Worker for TCP/IP Processing Dashboard PWA
self.SW_CONFIG = {
  cacheVersion: 'tcp-ip-processing-v1',
  appShellFiles: [
    './',
    './index.html',
    './manifest.json',
    './style.css',
    './script.js',
  ],
  trustedCdnHosts: [
    'cdn.jsdelivr.net',
  ],
};
importScripts('/pwa/sw-core.js');
