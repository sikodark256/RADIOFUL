/* =========================================================
   sikodark radio — Service Worker
   Cachea la app + página offline propia (adiós dinosaurio de Chrome)
   ========================================================= */
const CACHE = 'sikodark-v3';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './apple-icon.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  /* Solo GET */
  if (req.method !== 'GET') return;
  /* El stream de audio y la metadata NUNCA se cachean */
  if (url.hostname.includes('zeno.fm')) return;
  if (req.headers.has('range')) return;
  /* Firebase: dejar pasar directo */
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('firebasedatabase')) return;
  /* Sonda de la página offline: red pura, sin fallback */
  if (url.searchParams.has('__probe__')) { e.respondWith(fetch(req)); return; }

  /* Navegación (abrir la app): red primero → cache → página offline */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const cp = res.clone();
        caches.open(CACHE).then(c => c.put('./index.html', cp));
        return res;
      }).catch(() =>
        caches.match('./index.html').then(r => r || caches.match('./offline.html'))
      ).then(r => r || caches.match('./offline.html'))
    );
    return;
  }

  /* Recursos propios (css, js, imágenes): cache primero + actualiza de fondo */
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then(r => {
        const red = fetch(req).then(res => {
          if (res && res.ok) {
            const cp = res.clone();
            caches.open(CACHE).then(c => c.put(req, cp));
          }
          return res;
        }).catch(() => r);
        return r || red;
      })
    );
  }
  /* El resto (APIs externas, proxies): pasa directo a la red */
});
