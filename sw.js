// sw.js - more robust caching with relative paths and safe install
const CACHE_NAME = 'liteclass-v1';
const FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './jszip.min.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // addAll will fail if any resource 404s — add files one-by-one safely
      return Promise.all(FILES.map(path =>
        fetch(path, { cache: 'no-cache' })
          .then(resp => {
            if (!resp.ok) throw new Error('Failed to fetch ' + path + ' ' + resp.status);
            return cache.put(path, resp.clone());
          })
          .catch(err => {
            // log and continue — missing resources won't break install
            console.warn('SW: failed to cache', path, err);
            return Promise.resolve();
          })
      ));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  // claim clients so the SW controls pages immediately (after reload)
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  // For GET requests: try cache first, then network, and update cache
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(resp => {
        // if response is valid, put a copy in cache
        if (!resp || resp.status !== 200 || resp.type === 'opaque') return resp;
        const clone = resp.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, clone);
        });
        return resp;
      }).catch(() => {
        // Optionally return a fallback page or image if offline
        // return caches.match('./offline.html');
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      });
    })
  );
});
