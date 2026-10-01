const CACHE_NAME = 'radioful-cache-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/panel.html',
  '/Radiobospanel.html',
  '/panelradioboss.html',
  '/avisos.html',
  '/offline.html',
  '/manifest.json',
  '/panel-manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/icon.svg',
  '/logo-radio.png',
  '/placeholder.jpg',
  '/placeholder.svg'
];

// Install Service Worker
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Service Worker
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Strategy (Cache First falling back to Network)
self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(e.request).catch(() => {
        if (e.request.mode === 'navigate') {
          return caches.match('/offline.html');
        }
      });
    })
  );
});

// Push Notification Event - FIXED WITH ICON AND BADGE
self.addEventListener('push', (e) => {
  let data = { title: 'RADIOFUL', body: '¡Nueva notificación disponible!' };
  if (e.data) {
    try {
      data = e.data.json();
    } catch (err) {
      data = { title: 'RADIOFUL', body: e.data.text() };
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',          // Large color icon for the notification body
    badge: '/icon.svg',             // SMALL MONOCHROME (white/transparent) icon for Android status bar
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    },
    actions: [
      { action: 'open', title: 'Escuchar Ahora' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// Notification Click Event
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      const targetUrl = e.notification.data.url;
      for (let client of windowClients) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
