// Service Worker da Régua.
// Estratégia: rede primeiro (com revalidação HTTP) e cache como reserva offline.
// Assim, uma nova publicação nunca mistura index.html novo com módulos antigos.
// Chamadas para outros domínios (APIs de IA) não são interceptadas.

const VERSION = '2026.11.23.8';
const CACHE_NAME = 'regua-shell-' + VERSION;
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './assets/styles.css',
  './assets/regua-icone.svg',
  './assets/regua-logo.svg',
  './src/theme-boot.js',
  './src/app.js',
  './src/quality-engine.js',
  './src/ai-provider.js',
  './src/draft-template.js',
  './src/comment-parser.js',
  './src/storage.js',
  './src/reporting.js',
  './data/maptec-locations.json'
];

self.addEventListener('install', event => {
  // Sem skipWaiting automático: a página mostra o aviso e o usuário decide quando atualizar.
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' })))));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k.startsWith('regua-shell-') && k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

async function networkFirst(request, fallbackKey) {
  const cache = await caches.open(CACHE_NAME);
  try {
    // Requisições de navegação não aceitam RequestInit; usa-se a URL.
    const response = await fetch(request.mode === 'navigate' ? request.url : request, { cache: 'no-cache' });
    if (response && response.ok && response.type === 'basic') {
      cache.put(fallbackKey || request, response.clone()).catch(() => {});
    }
    return response;
  } catch (err) {
    const cached = await cache.match(fallbackKey || request, { ignoreSearch: true });
    if (cached) return cached;
    if (request.mode === 'navigate') {
      const shell = await cache.match('./index.html');
      if (shell) return shell;
    }
    throw err;
  }
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, './index.html'));
    return;
  }
  event.respondWith(networkFirst(request));
});
