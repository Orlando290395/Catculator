/* Catculator — service worker.
   La app no usa red para nada, así que la estrategia es cache-first pura.
   Al cambiar los archivos hay que subir CACHE de versión: eso descarta el caché
   viejo en activate y el usuario recibe la versión nueva en la siguiente visita. */
const CACHE = 'catculator-v7';

const ASSETS = [
  '.',
  'index.html',
  'style.css',
  'renderer.js',
  'manifest.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(key => key !== CACHE).map(key => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true })
      .then(hit => hit || fetch(event.request))
      .catch(() => caches.match('index.html'))
  );
});
