/* eslint-disable no-undef */
// Service Worker pour Mangadle PWA - VERSION AVEC EXCLUSION JSON
const CACHE_NAME = 'mangadle-v5-no-json';

// Fichiers essentiels (SANS les JSON des jeux)
const ESSENTIAL_ASSETS = [
  '/',
  '/index.html',
  '/background-manga.webp',
  '/background-jeux.jpg',
  '/images/logo.jpg',
  '/images/logo.png',
];

// Installation
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker V5: Installation...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Mise en cache des fichiers essentiels...');
        return cache.addAll(ESSENTIAL_ASSETS).catch(() => {
          console.warn('⚠️ Certains fichiers essentiels échoués');
          return Promise.resolve();
        });
      })
      .then(() => {
        console.log('✅ Installation terminée');
      })
  );
  self.skipWaiting();
});

// Activation
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker V5: Activation');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('🗑️ Suppression ancien cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

// Fonction pour vérifier si c'est un fichier JSON
function isJsonFile(url) {
  return url.endsWith('.json') || url.includes('characters.json');
}

// Fetch - NE PAS mettre en cache les JSON !
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);
  
  // Ignorer les requêtes non-GET
  if (event.request.method !== 'GET') {
    return;
  }
  
  // Ignorer les requêtes externes
  if (requestUrl.origin !== location.origin) {
    return;
  }

  // IMPORTANT: Ne JAMAIS mettre en cache les fichiers JSON !
  if (isJsonFile(requestUrl.pathname)) {
    console.log('🔄 JSON (Network First):', requestUrl.pathname);
    event.respondWith(
      fetch(event.request)
        .then(response => {
          console.log('✅ JSON récupéré depuis le réseau');
          return response;
        })
        .catch(() => {
          console.error('❌ Erreur réseau pour JSON:', requestUrl.pathname);
          // En cas d'erreur réseau, ne rien retourner (pas de fallback pour JSON)
          return new Response('{"error": "JSON non disponible"}', {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }

  // Pour les autres fichiers, stratégie Cache First normale
  event.respondWith(
    (async () => {
      // 1. Essayer avec l'URL originale
      let cachedResponse = await caches.match(event.request);
      
      if (cachedResponse) {
        console.log('✅ Cache (original):', requestUrl.pathname);
        return cachedResponse;
      }
      
      // 2. Essayer avec l'URL décodée (pour les %20, etc.)
      const decodedRequest = new Request(decodeURIComponent(event.request.url));
      cachedResponse = await caches.match(decodedRequest);
      
      if (cachedResponse) {
        console.log('✅ Cache (décodé):', requestUrl.pathname);
        return cachedResponse;
      }
      
      // 3. Essayer avec l'URL encodée (pour les espaces, etc.)
      const encodedRequest = new Request(encodeURI(event.request.url));
      cachedResponse = await caches.match(encodedRequest);
      
      if (cachedResponse) {
        console.log('✅ Cache (encodé):', requestUrl.pathname);
        return cachedResponse;
      }

      // 4. Pas en cache, fetch depuis le réseau
      try {
        console.log('🌐 Network:', requestUrl.pathname);
        const networkResponse = await fetch(event.request);
        
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }

        // Mettre en cache avec les 3 variantes
        const cache = await caches.open(CACHE_NAME);
        const responseToCache = networkResponse.clone();
        
        // Stocker l'URL originale
        console.log('💾 Cache:', requestUrl.pathname);
        await cache.put(event.request, responseToCache.clone());
        
        // Stocker aussi la version décodée
        try {
          await cache.put(decodedRequest, responseToCache.clone());
        } catch (cacheError) {
          console.log('Cache décodé échoué:', cacheError.message);
        }
        
        // Stocker aussi la version encodée
        try {
          await cache.put(encodedRequest, responseToCache.clone());
        } catch (cacheError) {
          console.log('Cache encodé échoué:', cacheError.message);
        }

        return networkResponse;
        
      } catch (networkError) {
        console.error('❌ Erreur réseau:', requestUrl.pathname, networkError.message);
        
        // Hors ligne - Chercher dans le cache de manière plus flexible
        const cache = await caches.open(CACHE_NAME);
        const cachedRequests = await cache.keys();
        
        // Chercher une correspondance partielle
        const pathname = requestUrl.pathname;
        const matchingRequest = cachedRequests.find(req => {
          const reqUrl = new URL(req.url);
          return reqUrl.pathname === pathname || 
                 decodeURIComponent(reqUrl.pathname) === pathname ||
                 reqUrl.pathname === decodeURIComponent(pathname);
        });
        
        if (matchingRequest) {
          console.log('✅ Cache (recherche flexible):', pathname);
          return cache.match(matchingRequest);
        }
        
        // Si c'est une page HTML, retourner index
        if (event.request.headers.get('accept')?.includes('text/html')) {
          const indexResponse = await caches.match('/index.html');
          if (indexResponse) return indexResponse;
        }
        
        // Pour les images, retourner le logo comme placeholder
        if (event.request.headers.get('accept')?.includes('image')) {
          const logoResponse = await caches.match('/images/logo.jpg');
          if (logoResponse) return logoResponse;
        }
        
        // Dernière option : erreur
        return new Response('Contenu non disponible hors ligne', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: new Headers({
            'Content-Type': 'text/plain'
          })
        });
      }
    })()
  );
});

console.log('🎮 Service Worker V5 - JSON jamais mis en cache (toujours à jour)');
/* eslint-enable no-undef */