// sw.js - Service Worker for GNote PWA offline capability

const CACHE_NAME = 'gnote-cache-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/db.js',
  '/notes-view.js',
  '/tasks-view.js',
  '/milestones-view.js',
  '/insights-view.js',
  '/api-client.js',
  '/sync-engine.js',
  '/dev-settings.js',
  '/manifest.json'
];

// Install Event - Pre-cache static files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('Service Worker pre-caching static assets...');
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            console.log('Service Worker deleting old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Network First, falling back to cache
self.addEventListener('fetch', event => {
  const requestUrl = new URL(event.request.url);

  // Bypass service worker cache for API requests
  if (requestUrl.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // If valid response, update the cache clone
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(() => {
        // If network offline, return from cache
        return caches.match(event.request).then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to root index.html for SPA client-side routes if matching fails
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }
        });
      })
  );
});
