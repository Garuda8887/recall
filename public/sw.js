const CACHE = 'recall-v2';
const SHELL = [
  '/',
  '/auth.html',
  '/favicon.svg',
  '/logo.svg',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/apple-touch-icon.png'
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL))
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Always hit the network for API calls — never serve stale auth/data
  if (url.pathname.startsWith('/api/')) return;

  // App shell: cache-first, then network, update cache in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(resp => {
        if (resp.ok) {
          caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        }
        return resp;
      });
      return cached || networkFetch;
    })
  );
});
