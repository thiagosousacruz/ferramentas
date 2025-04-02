// sw.js
const CACHE_NAME = 'ferramentas-praticas-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/fipe/fipe.html',
  '/comparador.html',
  '/regra.html',
  '/taco/taco.html',
  // Adicione outros recursos que deseja armazenar em cache
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => response || fetch(event.request))
  );
});