// Service Worker for Ticker Tape PWA
self.SW_CONFIG = {
  cacheVersion: 'ticker-tape-v1',
  appShellFiles: ['./', './index.html', './manifest.json'],
  trustedCdnHosts: ['s3.tradingview.com'],
};
importScripts('/pwa/sw-core.js');
