// Service worker das Ferramentas Práticas.
//
// Estratégia: rede primeiro (com tempo limite) e cópia em cache como reserva.
// Assim as atualizações chegam sozinhas e as ferramentas funcionam offline.
//
// Ao publicar mudanças, NÃO é preciso alterar nada aqui. Só aumente VERSAO se
// mudar a lista PRECACHE (para guardar arquivos novos já na instalação).
//
// Importante: este arquivo só mexe no Cache Storage. Placar do Tetris,
// progresso do Sudoku etc. ficam no localStorage e nunca são apagados aqui.

const VERSAO = 'v2';
const PREFIXO = 'ferramentas-praticas-';
const CACHE = `${PREFIXO}${VERSAO}`;
const BASE = '/ferramentas/';
const TEMPO_LIMITE_REDE_MS = 4000;

// Guardados na instalação para funcionar offline desde o primeiro uso.
const PRECACHE = [
  '',
  'index.html',
  'manifest.json',
  'icons/icon-192x192.png',
  'icons/icon-512x512.png',
  'comparador.html',
  'regra.html',
  'taco/taco.html',
  'taco/assets/taco.csv',
  'fipe/fipe.html',
  'fipe/app.js',
  'fipe/style.css',
  'sudoku/index.html',
  'sudoku/style.css',
  'sudoku/js/sudoku.js',
  'sudoku/js/storage.js',
  'sudoku/js/ui.js',
  'sudoku/js/app.js',
  'tetris/index.html',
  'tetris/style.css',
  'tetris/script.js',
  'impar_par/index.html',
  'impar_par/assets/0.png',
  'impar_par/assets/1.png',
  'impar_par/assets/2.png',
  'impar_par/assets/3.png',
  'impar_par/assets/4.png',
  'impar_par/assets/5.png'
].map(caminho => BASE + caminho);

// Páginas pessoais: sempre direto da rede, nunca guardadas.
const FORA_DO_CACHE = ['gestacao/', 'fn/', 'rastreio_ostomania/'].map(caminho => BASE + caminho);

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // Um arquivo que falhar não impede a instalação dos demais.
    await Promise.allSettled(PRECACHE.map(async (url) => {
      const resposta = await fetch(url, { cache: 'no-cache' });
      if (resposta.ok) await cache.put(url, resposta);
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    // Apaga só os caches antigos DESTE app (outros projetos no mesmo domínio ficam intactos).
    const nomes = await caches.keys();
    await Promise.all(nomes
      .filter(nome => nome.startsWith(PREFIXO) && nome !== CACHE)
      .map(nome => caches.delete(nome)));
    await self.clients.claim();
  })());
});

function deveTratar(request) {
  if (request.method !== 'GET') return false;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return false; // APIs, CDN, fontes
  if (!url.pathname.startsWith(BASE)) return false;
  return !FORA_DO_CACHE.some(prefixo => url.pathname.startsWith(prefixo));
}

async function redePrimeiro(request) {
  const cache = await caches.open(CACHE);
  const daRede = fetch(request).then((resposta) => {
    if (resposta.ok && resposta.type === 'basic') {
      cache.put(request, resposta.clone());
    }
    return resposta;
  });
  daRede.catch(() => {}); // evita "rejeição não tratada" quando a cópia já foi usada

  const emCache = await cache.match(request, { ignoreSearch: true });
  if (!emCache) {
    try {
      return await daRede;
    } catch (erro) {
      // Offline e sem cópia: para páginas, mostra o menu inicial.
      if (request.mode === 'navigate') {
        const inicio = await cache.match(BASE + 'index.html');
        if (inicio) return inicio;
      }
      throw erro;
    }
  }

  // Tem cópia: espera a rede por alguns segundos; se falhar ou demorar, usa a cópia.
  const tempoLimite = new Promise(resolve => setTimeout(() => resolve(null), TEMPO_LIMITE_REDE_MS));
  try {
    const resposta = await Promise.race([daRede, tempoLimite]);
    return resposta || emCache;
  } catch (erro) {
    return emCache;
  }
}

self.addEventListener('fetch', (evento) => {
  if (!deveTratar(evento.request)) return;
  evento.respondWith(redePrimeiro(evento.request));
});
