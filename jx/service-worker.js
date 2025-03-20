const cacheName = 'pwa-alert-cache-v1';
const assetsToCache = [
  '/',
  '/index.html',
  '/index.js',
  '/style.css',
  '/manifest.json',
  '/icon.png'
];

self.addEventListener('install', event => {
  console.log('Service Worker installed');
});

self.addEventListener('activate', event => {
  console.log('Service Worker activated');
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  // You can add custom actions here when a notification is clicked
  console.log('Notification clicked');
});
