// Phase 2.3 Offline-first disaster mode
const CACHE_VERSION = 2;
const CACHE_NAME = `sevasetu-v${CACHE_VERSION}-offline`;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/manifest.json'
      ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Clear every cache that doesn't match the current version
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Never cache API routes, auth, or Next.js data requests
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/_next/') ||
    url.pathname.startsWith('/auth')
  ) {
    return; // let the browser handle normally (network only)
  }

  // Network-first for navigations; cache-fallback only for offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Only cache successful GET responses for non-navigation (static assets)
        if (
          event.request.method === 'GET' &&
          response.ok &&
          event.request.mode !== 'navigate'
        ) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-reports') {
    // Implement background sync retry here
  }
});
