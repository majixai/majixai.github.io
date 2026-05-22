self.SW_CONFIG = {
  cacheVersion: 'majixai-bitcoin-miner-v1',
  appShellFiles: [
    './',
    './index.html',
    './manifest.json',
    './login.html',
    './login.js',
    './login.css',
    './data/live_data.json'
  ],
  trustedCdnHosts: [
    'cdn.jsdelivr.net',
    'cdnjs.cloudflare.com'
  ],
  networkFirstExtensions: ['.json', '.dat'],
};
importScripts('/pwa/sw-core.js');
