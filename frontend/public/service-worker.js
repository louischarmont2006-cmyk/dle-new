/* eslint-disable no-undef */
const CACHE_NAME = 'mangadle-v6-no-json';

// ✅ En développement (localhost), on désactive tout le cache
const IS_DEV = self.location.hostname === 'localhost' || self.location.hostname === '127.0.0.1';

const ESSENTIAL_ASSETS = [
  '/',
  '/index.html',
  '/background-manga.webp',
  '/background-jeux.jpg',
  '/background-films.jpg',
  '/images/logo.jpg',
  '/images/logo.png',
  '/images/logo-film.avif',
];

self.addEventListener('install', (event) => {
  console.log(IS_DEV ? '🔧 SW Dev: pas de cache' : '🔧 SW V6: Installation...');
  if (!IS_DEV) {
    event.waitUntil(
      caches.open(CACHE_NAME)
        .then((cache) => cache.addAll(ESSENTIAL_ASSETS).catch(() => Promise.resolve()))
    );
  }
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  return self.clients.claim();
});

function isJsonFile(url) {
  return url.endsWith('.json') || url.includes('characters.json');
}

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  if (event.request.method !== 'GET') return;
  if (requestUrl.origin !== location.origin) return;

  // ✅ En localhost : toujours aller sur le réseau, jamais le cache
  if (IS_DEV) {
    event.respondWith(fetch(event.request));
    return;
  }

  // JSON : Network First (jamais en cache)
  if (isJsonFile(requestUrl.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then(response => response)
        .catch(() => new Response('{"error": "JSON non disponible"}', {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }))
    );
    return;
  }

  // Production : Cache First
  event.respondWith(
    (async () => {
      let cachedResponse = await caches.match(event.request);
      if (cachedResponse) return cachedResponse;

      const decodedRequest = new Request(decodeURIComponent(event.request.url));
      cachedResponse = await caches.match(decodedRequest);
      if (cachedResponse) return cachedResponse;

      try {
        const networkResponse = await fetch(event.request);
        if (!networkResponse || networkResponse.status !== 200) return networkResponse;

        const cache = await caches.open(CACHE_NAME);
        const responseToCache = networkResponse.clone();
        await cache.put(event.request, responseToCache.clone());
        try { await cache.put(decodedRequest, responseToCache.clone()); } catch (_) {}

        return networkResponse;
      } catch (networkError) {
        const cache = await caches.open(CACHE_NAME);
        const cachedRequests = await cache.keys();
        const pathname = requestUrl.pathname;
        const matchingRequest = cachedRequests.find(req => {
          const reqUrl = new URL(req.url);
          return reqUrl.pathname === pathname ||
            decodeURIComponent(reqUrl.pathname) === pathname ||
            reqUrl.pathname === decodeURIComponent(pathname);
        });
        if (matchingRequest) return cache.match(matchingRequest);

        if (event.request.headers.get('accept')?.includes('text/html')) {
          const indexResponse = await caches.match('/index.html');
          if (indexResponse) return indexResponse;
        }
        if (event.request.headers.get('accept')?.includes('image')) {
          const logoResponse = await caches.match('/images/logo.jpg');
          if (logoResponse) return logoResponse;
        }

        return new Response('Contenu non disponible hors ligne', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      }
    })()
  );
});

console.log(`🎮 Service Worker V6 - ${IS_DEV ? 'MODE DEV (pas de cache)' : 'MODE PROD (cache actif)'}`);
/* eslint-enable no-undef */