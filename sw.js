// sw.js - improved offline behavior (network-first for navigations, cache-first for assets)

const CACHE_NAME = "liteclass-v2"; // <- bump this when you change assets
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

// Install - pre-cache assets and activate immediately
self.addEventListener("install", event => {
  self.skipWaiting(); // make the new SW take over more quickly
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

// Activate - delete old caches and claim clients
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.map(key => (key !== CACHE_NAME ? caches.delete(key) : Promise.resolve()))
      )
    ).then(() => self.clients.claim())
  );
});

// Fetch handler:
// - Navigation requests (HTML) -> try network first, fall back to cached index.html (so reloads work offline).
// - Other GET requests -> cache-first then network (and store network responses in cache).
self.addEventListener("fetch", event => {
  const req = event.request;

  // Only handle GET
  if (req.method !== "GET") return;

  // Handle navigations (page reloads, address bar, PWA reloads)
  if (req.mode === "navigate") {
    event.respondWith(
      caches.match("./index.html").then(cached =>
        cached ||
        fetch("./index.html").then(res => {
          return caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", res.clone());
            return res;
          });
        })
      )
    );
    return;
  }

  // For other requests (CSS, JS, images) → cache-first
  event.respondWith(
    caches.match(req).then(cachedRes => {
      if (cachedRes) return cachedRes;
      return fetch(req)
        .then(networkRes => {
          if (!networkRes || networkRes.status !== 200) return networkRes;
          caches.open(CACHE_NAME).then(cache => {
            cache.put(req, networkRes.clone());
          });
          return networkRes;
        })
        .catch(() => {
          if (req.destination === "image") {
            return caches.match("./icon-192.png");
          }
          return new Response("", { status: 503, statusText: "Offline" });
        });
    })
  );
});
