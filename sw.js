/* Sikodark Radio v6 — Service Worker */
const CACHE_VERSION = "sikodark-radio-v9";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./favicon.ico",
  "./icons/favicon.ico",
  "./icons/favicon-16x16.png",
  "./icons/favicon-32x32.png",
  "./icons/apple-touch-icon.png",
  "./icons/icon-72x72.png",
  "./icons/icon-96x96.png",
  "./icons/icon-128x128.png",
  "./icons/icon-144x144.png",
  "./icons/icon-152x152.png",
  "./icons/icon-192x192.png",
  "./icons/icon-192x192-maskable.png",
  "./icons/icon-256x256.png",
  "./icons/icon-384x384.png",
  "./icons/icon-512x512.png",
  "./icons/icon-512x512-maskable.png"
];

self.addEventListener("install", e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  
  if (url.pathname.endsWith("index.html") || url.pathname === "/" || url.pathname.endsWith("/")) {
    e.respondWith(
      fetch(e.request)
        .then(resp => {
          const copia = resp.clone();
          caches.open(CACHE_VERSION).then(c => c.put(e.request, copia));
          return resp;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }
  
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request).catch(() => caches.match("./index.html")))
  );
});

/* ===== 🔔 NOTIFICACIONES PUSH ===== */
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyC9Q9N1TTqWRUpeh2lo7tGuG8lwTrvbHrA",
  authDomain: "sikodarkradio-26a07.firebaseapp.com",
  projectId: "sikodarkradio-26a07",
  storageBucket: "sikodarkradio-26a07.firebasestorage.app",
  messagingSenderId: "941041207378",
  appId: "1:941041207378:web:994e34372109d30acf778b"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {};
  self.registration.showNotification(n.title || "sikodark radio", {
    body: n.body || "",
    icon: "icons/icon-192x192.png",
    badge: "icons/icon-192x192.png",
    image: n.image || undefined,
    data: { url: "/RADIOFUL/" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/RADIOFUL/"));
});
