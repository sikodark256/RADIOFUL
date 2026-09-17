/* Sikodark Radio v6 — Service Worker */
const CACHE_VERSION = "sikodark-radio-v6";
const ASSETS = ["./","./index.html","./manifest.json","./apple-icon.png","./icon-192.png","./icon-512.png"];

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
});/* ===== 🔔 NOTIFICACIONES PUSH ===== */
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
    icon: "apple-icon.png",
    badge: "icon-192.png",
    image: n.image || undefined,
    data: { url: "/RADIOFUL/" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/RADIOFUL/"));
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
    icon: "apple-icon.png",
    badge: "icon-192.png",
    image: n.image || undefined,
    data: { url: "/RADIOFUL/" }
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/RADIOFUL/"));
});
