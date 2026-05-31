const CACHE = 'recall-v6';

// Static assets only — index.html is intentionally excluded so CSS/JS
// changes are always served fresh from the server without a cache bust.
const SHELL = [
  '/auth.html',
  '/setup.html',
  '/local-api.js',
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

  // Always hit network for API calls and main HTML — never serve stale
  if (url.pathname.startsWith('/api/') || url.pathname === '/') return;

  // Cache-first for static assets, update cache in background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const networkFetch = fetch(e.request).then(resp => {
        if (resp.ok) caches.open(CACHE).then(c => c.put(e.request, resp.clone()));
        return resp;
      });
      return cached || networkFetch;
    })
  );
});
