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

  // ignore non-GET methods
  if (req.method !== "GET") return;

  // navigation (page loads / reloads)
  if (req.mode === "navigate" || (req.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(
      fetch(req)
        .then(networkRes => {
          // cache the fresh HTML response (optional)
          return caches.open(CACHE_NAME).then(cache => {
            try { cache.put(req, networkRes.clone()); } catch(e){/* ignore opaque errors */ }
            return networkRes;
          });
        })
        .catch(() => {
          // fallback to index.html from cache when offline
          return caches.match("./index.html");
        })
    );
    return;
  }

  // other assets: CSS/JS/images, etc. -> cache-first
  event.respondWith(
    caches.match(req).then(cachedRes => {
      if (cachedRes) return cachedRes;
      return fetch(req)
        .then(networkRes => {
          // cache successful responses for future
          if (!networkRes || networkRes.status !== 200) return networkRes;
          caches.open(CACHE_NAME).then(cache => {
            try { cache.put(req, networkRes.clone()); } catch(e){/* ignore */ }
          });
          return networkRes;
        })
        .catch(() => {
          // final fallback for images/icons (if missing) - try cached icon
          if ((req.destination === "image") || req.headers.get("accept").includes("image/*")) {
            return caches.match("./icon-192.png");
          }
          return new Response("",""); // minimal empty response
        });
    })
  );
});
