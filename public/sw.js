/* Agendaí — service worker enxuto: cache de assets estáticos e páginas.
   Nunca intercepta /api (dados, pagamentos e auth são sempre ao vivo). */
const CACHE = 'agendai-v1';
self.addEventListener('install', (e) => { self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const chaves = await caches.keys();
    await Promise.all(chaves.filter((c) => c !== CACHE).map((c) => caches.delete(c)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.pathname.startsWith('/api/')) return;
  if (url.pathname.startsWith('/_next/static/')) {
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      const guardado = await cache.match(request);
      if (guardado) return guardado;
      const resposta = await fetch(request);
      if (resposta.ok) cache.put(request, resposta.clone());
      return resposta;
    })());
    return;
  }
  if (request.mode === 'navigate') {
    e.respondWith((async () => {
      try { return await fetch(request); }
      catch { const cache = await caches.open(CACHE); return (await cache.match(request)) ?? Response.error(); }
    })());
  }
});
