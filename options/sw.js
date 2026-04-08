// Service Worker for Options Strategy Visualizer PWA
self.SW_CONFIG = {
  cacheVersion: 'options-visualizer-v1',
  appShellFiles: [
    './',
    './index.html',
    './manifest.json',
    './script.js',
    './style.css',
    './strategies.json'
  ],
  trustedCdnHosts: ['www.w3schools.com', 'cdnjs.cloudflare.com', 'cdn.plot.ly'],
};
importScripts('/pwa/sw-core.js');
