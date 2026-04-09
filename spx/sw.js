self.SW_CONFIG = {
  cacheVersion: 'spx-v1',
  appShellFiles: ['./', './index.html', './manifest.json'],
  trustedCdnHosts: ['s3.tradingview.com'],
};
importScripts('/pwa/sw-core.js');
