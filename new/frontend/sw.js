const CACHE_NAME = 'vendora-static-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/app.js',
  '/style.css',
  '/style-responsive.css',
  '/app-inventory.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS_TO_CACHE)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (e) => {
  // Network-first for API calls; cache-first for static assets
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/bill') || e.request.method !== 'GET') {
    // Let requests go to network (do not intercept POSTs) — fallback to network error
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(resp => {
      // cache fetched asset for offline
      if (resp && resp.status === 200 && resp.type === 'basic') {
        const respClone = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, respClone));
      }
      return resp;
    }).catch(() => caches.match('/index.html')))
  );
});
