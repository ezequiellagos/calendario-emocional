const STATIC_CACHE = 'emotional-calendar-static-v3';
const DYNAMIC_CACHE = 'emotional-calendar-dynamic-v3';
const API_CACHE = 'emotional-calendar-api-v3';

const OFFLINE_DOCUMENT = '/offline.html';
const STATIC_ASSETS = [OFFLINE_DOCUMENT, '/manifest.webmanifest', '/favicon.ico', '/favicon.svg', '/pwa-192.svg', '/pwa-512.svg', '/pwa-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys
        .filter((key) => ![STATIC_CACHE, DYNAMIC_CACHE, API_CACHE].includes(key))
        .map((key) => caches.delete(key)),
    )),
  );
  self.clients.claim();
});

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => cachedResponse);

  return cachedResponse ?? networkPromise;
}

async function networkWithOfflineFallback(request) {
  try {
    return await fetch(request);
  } catch {
    const offlineResponse = await caches.match(OFFLINE_DOCUMENT);
    if (offlineResponse) {
      return offlineResponse;
    }

    return new self.Response('Sin conexión.', {
      status: 503,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  }
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const response = await fetch(request);
  if (response.ok) {
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (url.pathname.startsWith('/api/entries') || url.pathname.startsWith('/api/emotions') || url.pathname.startsWith('/api/stats/monthly')) {
    event.respondWith(staleWhileRevalidate(request, API_CACHE));
    return;
  }

  if (url.pathname.startsWith('/_astro/') || url.pathname.startsWith('/chunks/')) {
    event.respondWith(fetch(request));
    return;
  }

  if (request.mode === 'navigate' || request.destination === 'document') {
    event.respondWith(networkWithOfflineFallback(request));
    return;
  }

  if (request.destination === 'script' || request.destination === 'style') {
    event.respondWith(fetch(request));
    return;
  }

  if (request.destination === 'image' || request.destination === 'font') {
    event.respondWith(cacheFirst(request, DYNAMIC_CACHE));
  }
});