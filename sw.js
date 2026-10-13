/* sikodark radio — Service Worker v2 con auto-update */
const CACHE = 'sikodark-v26';
const ASSETS = [
  './',
  './index.html',
  './offline.html',
  './manifest.json',
  './apple-icon.png'
];

self.addEventListener('install', e => {
  /* ⭐ Clave 1: activar el SW nuevo INMEDIATAMENTE (sin esperar) */
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  /* ⭐ Clave 2: borrar TODOS los cachés viejos + tomar control de las pestañas abiertas */
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== 'GET') return;
  if (url.hostname.includes('zeno.fm')) return;            /* stream: nunca cachear */
  if (req.headers.has('range')) return;
  if (url.hostname.includes('firebase') || url.hostname.includes('googleapis')) return;
  if (url.searchParams.has('__probe__')) { e.respondWith(fetch(req)); return; }

  /* ⭐ Clave 3: el index.html SIEMPRE se pide a la red primero.
     Solo si no hay internet se usa el caché. Así cada apertura
     de la PWA trae la versión nueva (si hay conexión). */
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          const cp = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', cp));
          return res;
        })
        .catch(() =>
          caches.match('./index.html').then(r => r || caches.match('./offline.html'))
        )
    );
    return;
  }

  /* Recursos propios: caché primero + actualización silenciosa de fondo */
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
});
