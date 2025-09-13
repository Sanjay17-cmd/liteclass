const CACHE_NAME = "liteclass-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./student-online.html",
  "./teacher-online.html",
  "./student-offline.html",
  "./teacher-offline.html",
  "./style.css",
  "./app.js",
  "./supabase.js",
  "./teacher.js",
  "./student.js",
  "./jszip.min.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
});

self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(res => res || fetch(event.request))
  );
});
