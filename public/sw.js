/* Минимальный офлайн-кэш: приложение открывается без сети,
   данные и так лежат в IndexedDB. */
const CACHE = 'odometer-v1';
const SCOPE = self.registration.scope; // работает и в корне, и в подкаталоге

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SCOPE, SCOPE + 'index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  // Сеть в приоритете, кэш — запасной вариант: так обновления доезжают сразу.
  event.respondWith(
    fetch(request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE).then((cache) => cache.put(request, copy));
        return response;
      })
      .catch(() => caches.match(request).then((cached) => cached ?? caches.match(SCOPE + 'index.html'))),
  );
});
