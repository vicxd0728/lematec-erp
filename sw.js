const CACHE_NAME = 'lematec-erp-v36';
const CORE_ASSETS = [
  './manifest.webmanifest',
  './erp-action-receipts.js',
  './icons/icon-192-v2.png',
  './icons/icon-512-v2.png',
  './icons/maskable-512-v2.png',
  './icons/apple-touch-icon-v2.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', responseCopy));
          return response;
        })
        .catch(() => caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  // Prefer fresh app logic, including extracted helpers, while retaining offline fallback.
  if (url.origin === self.location.origin && (url.pathname === '/' || url.pathname.endsWith('.html') || url.pathname.endsWith('/erp-action-receipts.js'))) {
    event.respondWith(
      fetch(request, { cache: 'no-store' })
        .then((response) => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
          return response;
        })
        .catch(() => caches.match(request) || caches.match('./index.html') || caches.match('./'))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const fetchPromise = fetch(request).then((response) => {
        const responseCopy = response.clone();
        if (url.origin === self.location.origin) {
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseCopy));
        }
        return response;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
