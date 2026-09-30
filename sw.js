/* =========================================================
   sikodark radio — Service Worker (v4)
   - Cachea la app + página offline propia
   - Firebase Cloud Messaging (notificaciones push con logo y nombre)
   ========================================================= */

/* Firebase Messaging (debe estar al inicio, antes de cualquier otra lógica) */
importScripts(
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js"
);

firebase.initializeApp({
  apiKey: "AIzaSyC9Q9N1TTqWRUpeh2lo7tGuG8lwTrvbHrA",
  authDomain: "sikodarkradio-26a07.firebaseapp.com",
  projectId: "sikodarkradio-26a07",
  storageBucket: "sikodarkradio-26a07.firebasestorage.app",
  messagingSenderId: "941041207378",
  appId: "1:941041207378:web:994e34372109d30acf778b"
});

const messaging = firebase.messaging();

/* URLs absolutas de los iconos para las notificaciones */
const SCOPE = self.registration.scope;
const ICON_NOTIF = SCOPE + "icon-512.png";
const BADGE_NOTIF = SCOPE + "icon-192.png";
const APP_NAME = "sikodark radio";

/* Maneja mensajes push de tipo DATA (sin payload "notification") */
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {};
  const title = data.title || APP_NAME;
  const body = data.body || data.message || "Estamos en vivo";
  self.registration.showNotification(title, {
    body: body,
    icon: ICON_NOTIF,
    badge: BADGE_NOTIF,
    image: data.image || ICON_NOTIF,
    tag: data.tag || "sikodark-radio",
    renotify: true,
    requireInteraction: false,
    data: { url: data.url || SCOPE + "index.html" }
  });
});

/* Al hacer clic en la notificación: abrir/focus de la app */
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const target = (e.notification.data && e.notification.data.url) || SCOPE + "index.html";
  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((lista) => {
      for (const c of lista) {
        if ("focus" in c) return c.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});

/* ---------- Cache de la app ---------- */
const CACHE = "sikodark-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./offline.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-icon.png",
  "./logo-radio.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);

  if (req.method !== "GET") return;

  /* El stream de audio y la metadata NUNCA se cachean */
  if (url.hostname.includes("zeno.fm")) return;
  if (req.headers.has("range")) return;

  /* Firebase: dejar pasar directo */
  if (
    url.hostname.includes("firebase") ||
    url.hostname.includes("googleapis") ||
    url.hostname.includes("firebasedatabase") ||
    url.hostname.includes("gstatic")
  ) return;

  /* Sonda de la página offline: red pura, sin fallback */
  if (url.searchParams.has("__probe__")) { e.respondWith(fetch(req)); return; }

  /* Navegación (abrir la app): red primero → cache → página offline */
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const cp = res.clone();
          caches.open(CACHE).then((c) => c.put("./index.html", cp));
          return res;
        })
        .catch(() => caches.match("./index.html").then((r) => r || caches.match("./offline.html")))
        .then((r) => r || caches.match("./offline.html"))
    );
    return;
  }

  /* Recursos propios (css, js, imágenes): cache primero + actualiza de fondo */
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(req).then((r) => {
        const red = fetch(req)
          .then((res) => {
            if (res && res.ok) {
              const cp = res.clone();
              caches.open(CACHE).then((c) => c.put(req, cp));
            }
            return res;
          })
          .catch(() => r);
        return r || red;
      })
    );
  }
  /* El resto (APIs externas, proxies): pasa directo a la red */
});
