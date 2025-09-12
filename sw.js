// LiteClass Service Worker - Production Ready
const CACHE_NAME = 'liteclass-v2';
const STATIC_CACHE = 'liteclass-static-v2';
const DYNAMIC_CACHE = 'liteclass-dynamic-v2';

// Files to cache immediately
const STATIC_FILES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './supabase.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './jszip.min.js'
];

// Dynamic files that can be cached on demand
const DYNAMIC_FILES = [
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
  'https://cdn.jsdelivr.net/npm/dexie@3/dist/dexie.min.js'
];

// Install event - cache static files
self.addEventListener('install', event => {
  console.log('Service Worker: Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE).then(cache => {
        console.log('Service Worker: Caching static files');
        return Promise.all(
          STATIC_FILES.map(url => {
            return fetch(url, { cache: 'no-cache' })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch ${url}: ${response.status}`);
                }
                return cache.put(url, response.clone());
              })
              .catch(error => {
                console.warn(`Service Worker: Failed to cache ${url}:`, error);
                return Promise.resolve(); // Continue with other files
              });
          })
        );
      }),
      
      // Cache dynamic files
      caches.open(DYNAMIC_CACHE).then(cache => {
        console.log('Service Worker: Caching dynamic files');
        return Promise.all(
          DYNAMIC_FILES.map(url => {
            return fetch(url, { cache: 'no-cache' })
              .then(response => {
                if (!response.ok) {
                  throw new Error(`Failed to fetch ${url}: ${response.status}`);
                }
                return cache.put(url, response.clone());
              })
              .catch(error => {
                console.warn(`Service Worker: Failed to cache ${url}:`, error);
                return Promise.resolve(); // Continue with other files
              });
          })
        );
      })
    ]).then(() => {
      console.log('Service Worker: Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('Service Worker: Activating...');
  
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then(cacheNames => {
        return Promise.all(
          cacheNames.map(cacheName => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log('Service Worker: Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // Take control of all clients
      self.clients.claim()
    ]).then(() => {
      console.log('Service Worker: Activation complete');
    })
  );
});

// Fetch event - serve from cache with network fallback
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Skip external requests (except Supabase)
  if (url.origin !== location.origin && !url.hostname.includes('supabase')) {
    return;
  }
  
  event.respondWith(
    caches.match(request).then(cachedResponse => {
      // Return cached version if available
      if (cachedResponse) {
        // Update cache in background for dynamic content
        if (isDynamicContent(request.url)) {
          updateCacheInBackground(request);
        }
        return cachedResponse;
      }
      
      // Fetch from network
      return fetch(request).then(networkResponse => {
        // Don't cache if response is not ok
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type === 'opaque') {
          return networkResponse;
        }
        
        // Clone response for caching
        const responseToCache = networkResponse.clone();
        
        // Cache the response
        caches.open(getDynamicCacheName(request.url)).then(cache => {
          cache.put(request, responseToCache);
        });
        
        return networkResponse;
      }).catch(error => {
        console.error('Service Worker: Fetch failed:', error);
        
        // Return offline fallback for HTML requests
        if (request.headers.get('accept').includes('text/html')) {
          return caches.match('./index.html');
        }
        
        // Return generic offline response
        return new Response('Offline', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      });
    })
  );
});

// Background sync for offline actions
self.addEventListener('sync', event => {
  console.log('Service Worker: Background sync triggered:', event.tag);
  
  if (event.tag === 'background-sync') {
    event.waitUntil(performBackgroundSync());
  }
});

// Push notifications
self.addEventListener('push', event => {
  console.log('Service Worker: Push notification received');
  
  const options = {
    body: event.data ? event.data.text() : 'New notification from LiteClass',
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1
    },
    actions: [
      {
        action: 'explore',
        title: 'Open LiteClass',
        icon: './icons/icon-192.png'
      },
      {
        action: 'close',
        title: 'Close',
        icon: './icons/icon-192.png'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('LiteClass', options)
  );
});

// Notification click handling
self.addEventListener('notificationclick', event => {
  console.log('Service Worker: Notification clicked');
  
  event.notification.close();
  
  if (event.action === 'explore') {
    event.waitUntil(
      clients.openWindow('./')
    );
  }
});

// Message handling from main thread
self.addEventListener('message', event => {
  console.log('Service Worker: Message received:', event.data);
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'CACHE_LECTURE') {
    event.waitUntil(cacheLecture(event.data.lectureData));
  }
  
  if (event.data && event.data.type === 'QUEUE_SYNC') {
    event.waitUntil(queueForSync(event.data.syncData));
  }
});

// Helper functions
function isDynamicContent(url) {
  return url.includes('/api/') || 
         url.includes('supabase') || 
         url.includes('.json') ||
         url.includes('dynamic');
}

function getDynamicCacheName(url) {
  if (url.includes('supabase')) {
    return 'liteclass-api-cache';
  }
  return DYNAMIC_CACHE;
}

function updateCacheInBackground(request) {
  fetch(request).then(response => {
    if (response && response.status === 200) {
      caches.open(getDynamicCacheName(request.url)).then(cache => {
        cache.put(request, response);
      });
    }
  }).catch(error => {
    console.warn('Service Worker: Background update failed:', error);
  });
}

async function performBackgroundSync() {
  try {
    console.log('Service Worker: Performing background sync...');
    
    // Open IndexedDB to get sync queue
    const db = await openDB();
    const transaction = db.transaction(['sync_queue'], 'readonly');
    const store = transaction.objectStore('sync_queue');
    const syncItems = await getAllFromStore(store);
    
    for (const item of syncItems) {
      try {
        await processSyncItem(item);
        
        // Remove from queue after successful sync
        const deleteTransaction = db.transaction(['sync_queue'], 'readwrite');
        const deleteStore = deleteTransaction.objectStore('sync_queue');
        await deleteFromStore(deleteStore, item.id);
        
        console.log('Service Worker: Synced item:', item.type);
      } catch (error) {
        console.error('Service Worker: Failed to sync item:', item.type, error);
        
        // Increment retry count
        const updateTransaction = db.transaction(['sync_queue'], 'readwrite');
        const updateStore = updateTransaction.objectStore('sync_queue');
        item.retries = (item.retries || 0) + 1;
        
        // Remove if too many retries
        if (item.retries > 3) {
          await deleteFromStore(updateStore, item.id);
          console.log('Service Worker: Removed item after max retries:', item.type);
        } else {
          await putInStore(updateStore, item);
        }
      }
    }
    
    // Notify main thread
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'SYNC_COMPLETE',
        timestamp: Date.now()
      });
    });
    
    console.log('Service Worker: Background sync completed');
  } catch (error) {
    console.error('Service Worker: Background sync failed:', error);
  }
}

async function processSyncItem(item) {
  const { type, data } = item;
  
  switch (type) {
    case 'quiz_response':
      await syncQuizResponse(data);
      break;
    case 'assignment_submission':
      await syncAssignmentSubmission(data);
      break;
    case 'lecture_upload':
      await syncLectureUpload(data);
      break;
    default:
      console.warn('Service Worker: Unknown sync type:', type);
  }
}

async function syncQuizResponse(data) {
  const response = await fetch('/api/quiz-responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(data)
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync quiz response: ${response.status}`);
  }
}

async function syncAssignmentSubmission(data) {
  const formData = new FormData();
  Object.keys(data).forEach(key => {
    formData.append(key, data[key]);
  });
  
  const response = await fetch('/api/assignments/submit', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync assignment submission: ${response.status}`);
  }
}

async function syncLectureUpload(data) {
  const formData = new FormData();
  formData.append('lecture', data.file);
  formData.append('metadata', JSON.stringify(data.metadata));
  
  const response = await fetch('/api/lectures/upload', {
    method: 'POST',
    body: formData
  });
  
  if (!response.ok) {
    throw new Error(`Failed to sync lecture upload: ${response.status}`);
  }
}

async function cacheLecture(lectureData) {
  try {
    const cache = await caches.open('liteclass-lectures');
    
    // Cache lecture metadata
    await cache.put(
      `/lectures/${lectureData.id}/metadata`,
      new Response(JSON.stringify(lectureData.metadata))
    );
    
    // Cache lecture files if provided
    if (lectureData.files) {
      for (const [filename, file] of Object.entries(lectureData.files)) {
        await cache.put(`/lectures/${lectureData.id}/${filename}`, new Response(file));
      }
    }
    
    console.log('Service Worker: Lecture cached:', lectureData.id);
  } catch (error) {
    console.error('Service Worker: Failed to cache lecture:', error);
  }
}

async function queueForSync(syncData) {
  try {
    const db = await openDB();
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');
    
    const item = {
      ...syncData,
      timestamp: Date.now(),
      retries: 0
    };
    
    await putInStore(store, item);
    
    // Register for background sync
    if ('serviceWorker' in navigator && 'sync' in window.ServiceWorkerRegistration.prototype) {
      await self.registration.sync.register('background-sync');
    }
    
    console.log('Service Worker: Item queued for sync:', syncData.type);
  } catch (error) {
    console.error('Service Worker: Failed to queue for sync:', error);
  }
}

// IndexedDB helpers
function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('LiteClassDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      
      if (!db.objectStoreNames.contains('sync_queue')) {
        const store = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('timestamp', 'timestamp', { unique: false });
      }
    };
  });
}

function getAllFromStore(store) {
  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function putInStore(store, item) {
  return new Promise((resolve, reject) => {
    const request = store.put(item);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

function deleteFromStore(store, id) {
  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
  });
}

// Periodic cleanup
setInterval(() => {
  // Clean up old cache entries
  caches.keys().then(cacheNames => {
    cacheNames.forEach(cacheName => {
      if (cacheName.includes('temp') || cacheName.includes('old')) {
        caches.delete(cacheName);
      }
    });
  });
}, 24 * 60 * 60 * 1000); // Daily cleanup