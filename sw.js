// Service Worker for MajixAI Root PWA
self.SW_CONFIG = {
  cacheVersion: 'majixai-pwa-v1',
  appShellFiles: [
    './',
    './index.html',
    './manifest.webmanifest',
    './script.js',
    './style.css',
    './menu/index.html',
    './menu/script.js',
    './menu/style.css',
    './menu/calendar.js',
    './menu/menu.json',
    './menu/calendar.json',
    './menu/clicks.json',
    './router/index.html',
    './router/router.js',
    './router/routes.json',
    './logging/index.html',
    './logging/logging-core.js'
  ],
  subappModules: {
    menu: [
      './menu/index.html',
      './menu/script.js',
      './menu/style.css',
      './menu/calendar.js',
      './menu/menu.json',
      './menu/calendar.json',
      './menu/clicks.json'
    ],
    router: [
      './router/index.html',
      './router/router.js',
      './router/routes.json'
    ],
    logging: [
      './logging/index.html',
      './logging/logging-core.js'
    ]
  },
};
importScripts('/pwa/sw-core.js');
