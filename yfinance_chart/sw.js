// Service Worker for YFinance Interactive Chart PWA
self.SW_CONFIG = {
  cacheVersion: 'yfinance-chart-v1',
  appShellFiles: ['./', './index.html', './manifest.json', './style.css', './script.js'],
  trustedCdnHosts: ['cdn.plot.ly', 'cdnjs.cloudflare.com'],
};
importScripts('/pwa/sw-core.js');
