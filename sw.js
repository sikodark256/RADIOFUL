/* =========================================================
   📻 Sikodark Radio — Service Worker  (sikodark-v33)
   - Navegación: red primero (cada versión nueva entra al toque)
     con caché de respaldo para offline.
   - Stream, Firestore y carátulas: directo a la red, SIN caché
     (nunca se sirve música o datos viejos).
   - Push: Firebase Messaging (mismas credenciales que la página).
   ========================================================= */

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

const CACHE = "sikodark-v33";
const NUCLEO = ["./", "./index.html"];

firebase.initializeApp({
  apiKey: "AIzaSyC9Q9N1TTqWRUpeh2lo7tGuG8lwTrvbHrA",
  authDomain: "sikodarkradio-26a07.firebaseapp.com",
  projectId: "sikodarkradio-26a07",
  storageBucket: "sikodarkradio-26a07.firebasestorage.app",
  messagingSenderId: "941041207378",
  appId: "1:941041207378:web:994e34372109d30acf778b"
});

const messaging = firebase.messaging();

/* Mensajes en background (celular con la app cerrada) */
messaging.onBackgroundMessage(function(payload){
  try{
    const n = payload.notification || {};
    const d = payload.data || {};
    const titulo = n.title || d.title || "Sikodark Radio";
    const cuerpo = n.body || d.body || "Toca para escuchar la radio 🤘";
    self.registration.showNotification(titulo, {
      body: cuerpo,
      icon: "./apple-icon.png",
      badge: "./apple-icon.png",
      tag: "sikodark",
      data: { url: "./" }
    });
  }catch(e){}
});

self.addEventListener("install", function(e){
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE)
      .then(function(c){ return c.addAll(NUCLEO); })
      .catch(function(){ /* si falta algún archivo, no romper el install */ })
  );
});

self.addEventListener("activate", function(e){
  e.waitUntil(
    caches.keys().then(function(keys){
      return Promise.all(
        keys.filter(function(k){ return k !== CACHE; })
            .map(function(k){ return caches.delete(k); })
      );
    }).then(function(){ return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function(e){
  const req = e.request;
  if (req.method !== "GET") return;

  /* Solo la navegación pasa por acá — el resto va directo a la red */
  if (req.mode === "navigate"){
    e.respondWith(
      fetch(req).then(function(res){
        const copia = res.clone();
        caches.open(CACHE).then(function(c){
          c.put("./index.html", copia);
        }).catch(function(){});
        return res;
      }).catch(function(){
        return caches.match("./index.html")
          .then(function(r){ return r || caches.match("./"); });
      })
    );
  }
  /* sin respondWith → el navegador la busca a la red como siempre */
});
