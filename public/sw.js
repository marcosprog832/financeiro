const CACHE = 'fluxo-v3'
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(
  caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()),
))

self.addEventListener('fetch', e => {
  const req = e.request
  const url = new URL(req.url)
  if (req.method !== 'GET' || url.origin !== self.location.origin) return
  // Páginas, manifest e API ficam por conta do navegador (login da Vercel, redirecionamentos etc.)
  if (req.mode === 'navigate' || url.pathname.endsWith('manifest.webmanifest') || url.pathname.startsWith('/api/')) return

  // Arquivos estáticos: rede primeiro, cópia guardada se estiver offline
  e.respondWith(
    fetch(req)
      .then(res => {
        if (res.ok && res.type === 'basic') { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)) }
        return res
      })
      .catch(async () => (await caches.match(req)) || Response.error()),
  )
})