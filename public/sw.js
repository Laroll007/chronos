// Service Worker pour Chronos PWA
const CACHE_NAME = 'chronos-v19';
const STATIC_CACHE = 'chronos-static-v10';
const STATIC_ASSETS = [
  '/',
  '/dashboard',
  '/onboarding',
  '/offline.html',
  '/manifest.json',
];

// Installation - mise en cache des assets statiques
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }),
  );
  // Ne PAS appeler self.skipWaiting() ici :
  // on attend le message SKIP_WAITING du client pour contrôler la mise à jour
});

// Message du client pour déclencher l'activation
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Activation - nettoyage des anciens caches (tous ceux ≠ CACHE_NAME et ≠ STATIC_CACHE)
// Volontairement PAS de self.clients.claim() ici : sur iOS Safari PWA, combiné à
// l'event `controllerchange`, cela peut provoquer une boucle de reload à la
// réouverture de la PWA. Le nouveau SW prendra le contrôle au prochain cold-start.
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name)),
      );
    }),
  );
});

function isVersionedStatic(url) {
  return (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    /\.(png|jpg|jpeg|webp|avif|svg|ico|woff2|ttf)$/.test(url.pathname)
  );
}

// Fetch - stratégies différenciées :
// - /_next/static/*, /icons/*, fonts, images → Cache First (versionnés, safe)
// - pages HTML et /api (hors POST) → Network First + fallback cache + /offline.html
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  // Cache First pour assets versionnés
  if (isVersionedStatic(url)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          if (response.status === 200) {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        });
      }),
    );
    return;
  }

  // Network First pour pages/API GET
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => {
          if (cached) return cached;
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html').then(
              (offline) =>
                offline ??
                new Response(
                  '<!doctype html><meta charset=utf-8><title>Hors ligne</title><h1>Hors ligne</h1><p>Reconnectez-vous pour continuer.</p>',
                  { headers: { 'Content-Type': 'text/html; charset=utf-8' }, status: 503 },
                ),
            );
          }
          return new Response('Offline', { status: 503 });
        }),
      ),
  );
});

// Gestion des notifications push (préparé pour le futur)
self.addEventListener('push', (event) => {
  if (!event.data) return;

  const data = event.data.json();
  const options = {
    body: data.body || 'Nouvelle notification My Chronos',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-96x96.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/dashboard',
    },
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'My Chronos', options),
  );
});

// Clic sur notification
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(event.notification.data?.url || '/dashboard');
      }
    }),
  );
});
