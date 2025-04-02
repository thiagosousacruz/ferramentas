// sw.js
const CACHE_NAME = 'ferramentas-praticas-v1';
const urlsToCache = [
  '/ferramentas/',
  '/ferramentas/index.html',
  '/ferramentas/fipe/fipe.html',
  '/ferramentas/comparador.html',
  '/ferramentas/regra.html',
  '/ferramentas/taco/taco.html',
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