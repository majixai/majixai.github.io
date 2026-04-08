// Service Worker for Best PWA Suite
// Modular architecture supporting main viewer + alpha/beta/performers subapps
self.SW_CONFIG = {
  cacheVersion: 'best-viewer-v2',
  appShellFiles: ['./', './index.html', './manifest.json', './main.js'],
  trustedCdnHosts: [
    'cdnjs.cloudflare.com',
    'www.w3schools.com',
    'w3schools.com',
    'code.jquery.com',
    'unpkg.com',
    'cdn.jsdelivr.net'
  ],
  imageCdnHosts: [
    'thumb.live.mmcdn.com',
    'roomimg.stream.highwebmedia.com',
    'cbjpeg.stream.highwebmedia.com'
  ],
  subappModules: {
    alpha: [
      './alpha/',
      './alpha/index.html',
      './alpha/manifest.json',
      './alpha/config.js',
      './alpha/api.js',
      './alpha/storage.js',
      './alpha/ui.js',
      './alpha/script.js',
      './alpha/style.css'
    ],
    beta: [
      './beta/',
      './beta/index.html',
      './beta/manifest.json',
      './beta/config.js',
      './beta/api.js',
      './beta/storage.js',
      './beta/ui.js',
      './beta/script.js',
      './beta/style.css',
      './beta/autoscroller.js',
      './beta/decorators.js',
      './beta/mappers.js'
    ],
    performers: [
      './performers/',
      './performers/index.html',
      './performers/manifest.json',
      './performers/style.css',
      './performers/engine/config.js',
      './performers/engine/cache.js',
      './performers/engine/api.js',
      './performers/engine/ui.js',
      './performers/engine/main.js'
    ]
  },
  networkFirstExtensions: ['.dat'],
};
importScripts('/pwa/sw-core.js');
