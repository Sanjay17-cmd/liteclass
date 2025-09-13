// sw.js - Service Worker

const CACHE_NAME = "remoteclass-v1";
const ASSETS = [
  "/", // root
  "/index.html",
  "/student-online.html",
  "/teacher-online.html",
  "/student-offline.html",
  "/teacher-offline.html",
  "/style.css",
  "/app.js",
  "/supabase.js",
  "/teacher.js",
  "/student.js",
  "/jszip.min.js",
  "/manifest.json"
];

// Install - cache all assets
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
});

// Activate - clean old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) return caches.delete(key);
        })
      )
    )
  );
});

// Fetch - serve from cache first, then network
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return (
        response ||
        fetch(event.request).then(fetchRes =>
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, fetchRes.clone());
            return fetchRes;
          })
        )
      );
    })
  );
});
