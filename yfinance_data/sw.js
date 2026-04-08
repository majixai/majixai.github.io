// Service Worker for YFinance Data PWA
self.SW_CONFIG = {
  cacheVersion: 'yfinance-data-v1',
  appShellFiles: ['./', './index.html', './manifest.json', './style.css', './script.js'],
  trustedCdnHosts: ['cdn.jsdelivr.net', 'cdnjs.cloudflare.com'],
};
importScripts('/pwa/sw-core.js');
