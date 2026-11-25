const CACHE_NAME = 'gotfive-v31';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './js/app.js',
  './js/bot.js',
  './js/engine.js',
  './js/i18n.js',
  './js/rng.js',
  './js/storage.js',
  './js/tiles.js',
  './js/version.js',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-512-maskable.png',
  './icons/flag-fr.svg',
  './icons/flag-en.svg',
  './icons/flag-pl.svg',
];

self.addEventListener('install', (event) => {
  const requests = ASSETS.map(
    (asset) => new Request(new URL(asset, self.location.href), { cache: 'reload' }),
  );
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(requests))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;

      try {
        const response = await fetch(request);
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        await cache.put(request, response.clone());
        return response;
      } catch {
        if (request.mode === 'navigate') {
          return (await cache.match('./index.html')) ?? Response.error();
        }
        return (await cache.match(request)) ?? Response.error();
      }
    })(),
  );
});
