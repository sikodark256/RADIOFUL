# 🔧 Reparación sikodark radio — qué se arregló y cómo dejarlo funcionando

Este paquete es el proyecto `RADIOFUL-main` reparado. Abajo está el detalle
de cada cambio, la estructura final y los pasos manuales que faltan (son
cosas que se hacen en Firebase/RadioBOSS, no en el código).

---

## 1. Cambios realizados

| # | Archivo | Problema encontrado | Arreglo |
|---|---|---|---|
| 1 | `index.html` | El panel ⚙️ del DJ hacía login de email/contraseña **desde el navegador** y el banner de "pedidos pausados" quedaba colgado si no había quien lo controlara | Eliminados: botón ⚙, banner `.pedidos-pausa`, bloque de script del panel y los dos chequeos `sikoPedidosOff`. Los pedidos quedan siempre activos |
| 2 | `index.html` | La cola debía respetar el orden de llegada (FIFO) | Reforzado: los esperados se ordenan del más viejo al más nuevo; subtítulo aclara "orden de llegada (FIFO)" |
| 3 | `REGLAS-FIRESTORE.txt` | `temas_pedidos` solo lo podía leer el admin anónimo → la cola pública de la web mostraba el candado de permiso denegado; el fallback de reglas quedaba débil | `allow read` para autenticados anónimos; `create` validado (campos y largos); `update/delete` solo admin; todo lo demás denegado por defecto |
| 4 | `panelradioboss.html`, `Radiobospanel.html` | Usaban endpoints que la API de RadioBOSS no tiene (`/info`, `/getplaylist`, `/getartwork`), ngrok con URL fija y contraseña escrita en el código | Reemplazados por **`panel-radioboss.html`** con la API documentada: `cmd=play/pause/stop/next/prev/setvol`, `action=playbackinfo`; URL y contraseña se guardan en `localStorage` (sin secretos en el HTML) |
| 5 | `sw.js` | Caché `v26` con pocos assets; los íconos no se precacheaban | `v27` + precache de manifest, offline e íconos 192/512/maskable |
| 6 | `Index.html` (5.361 líneas, versión vieja) | Duplicado que choca en hostings case-sensitive (Linux/GitHub Pages/Netlify) | Movido a `_archivadas/Index.html.old`; el único índice válido es `index.html` |
| 7 | Falta el consumidor de pedidos | Nadie sacaba los `pendiente` de Firestore ni los llevaba a RadioBOSS | Carpeta **`puente-dj/`**: puente Python Firestore → RadioBOSS con match de biblioteca local, modos `songrequest`/`inserttrack`, FIFO y reintentos |

Validación hecha: los 11 bloques de JavaScript de `index.html` y el resto
parsean sin errores (`node --check`); no quedan referencias a los archivos
archivados; los íconos PWA tienen dimensiones exactas (192 y 512).

---

## 2. Estructura final

```
radioful-reparado/
├── index.html               # App pública (reparada) — SUBIR al hosting
├── offline.html             # Pantalla sin conexión — SUBIR
├── manifest.json            # Manifest PWA — SUBIR
├── sw.js                    # Service Worker v27 — SUBIR (verificar que no de 404)
├── panel.html               # Panel de oyentes/me gusta (admin) — SUBIR
├── panel-manifest.json
├── avisos.html              # Panel admin: avisos, publicidad, encuesta, pedidos — SUBIR
├── panel-radioboss.html     # Control remoto de RadioBOSS (nuevo y corregido)
├── preview-embed.html      # Página de previsualización del embed
├── REGLAS-FIRESTORE.txt     # 🔴 Reglas nuevas: PUBLICAR en Firebase
├── INSTALACION-APIs.md      # Claves opcionales (Setlist/Spotify/Genius)
├── LEEME-INSTALACION.txt    # Guía PWA antigua (referencia)
├── *.png / *.ico / *.svg    # Íconos y logos — SUBIR
├── puente-dj/               # 🖥️ Corre en la PC del DJ, NO en el hosting
│   ├── puente_radioboss.py
│   ├── config.ini.example
│   ├── requirements.txt
│   └── iniciar_puente.bat
└── _archivadas/             # Versiones viejas: no subir
```

---

## 3. Pasos para dejarlo funcionando (en orden)

### A. Firebase (5 min)
1. Console → Firestore → Reglas → pegar el contenido de
   `REGLAS-FIRESTORE.txt` → **Publicar**.
2. Authentication → Sign-in method → habilitar **Anónimo**.
3. Project settings → Service accounts → **Generate new private key** →
   guardar el JSON como `serviceAccountKey.json` dentro de `puente-dj/`
   (no subirlo al hosting).

### B. RadioBOSS (PC del DJ)
1. Settings → Options → categoría **API**: Enable Remote Control, puerto
   (ej. `9000`), dejar *localhost only*, poner contraseña.
2. Probar en el navegador de esa PC:
   `http://127.0.0.1:9000/?pass=CLAVE&action=status` (debe dar XML).
3. Modo recomendado `songrequest`: el puente agrega a *View → Song
   Requests*; crear un evento recurrente del Scheduler con acción
   `playrequestedsong 30` (30 = minutos mínimos entre pedido y aire).
4. Abrir `panel-radioboss.html` en esa PC, cargar URL y contraseña, Guardar.

### C. Puente del DJ
1. Instalar Python 3.9+; en `puente-dj/` ejecutar
   `pip install -r requirements.txt`.
2. Copiar `config.ini.example` → `config.ini`; poner contraseña de la API
   y la raíz de música (ej. `D:\Musica`).
3. `python puente_radioboss.py` (o `iniciar_puente.bat`). Para que
   arranque solo al prender la PC: Tarea Programada al iniciar sesión.

### D. Hosting web
1. Subir al hosting **todos los archivos de la raíz** (no `_archivadas/`
   ni `puente-dj/`).
2. Verificar `tu-sitio/sw.js` responde código (no 404) y que el sitio sea
   HTTPS.
3. En el celular: borrar caché del sitio (o usar el botón "🧹 Limpiar
   caché y recargar") y abrir de nuevo.

### E. APIs opcionales (solo si las querés)
Setlist.fm / Spotify / Genius: claves vacías en `index.html`; la guía
paso a paso está en `INSTALACION-APIs.md`. Sin ellas la app igual anda.

---

## 4. Cómo queda la cola de pedidos (FIFO)

- **Web:** los pedidos esperan se listan del más viejo al más nuevo; el
  primero es el próximo en sonar.
- **Puente:** lee solo `pendiente`, los ordena por fecha y los envía en ese
  orden. En modo `inserttrack` usa `pos=-1` (final del playlist) para no
  invertir el orden; en modo `songrequest` agrega al final de la lista
  nativa. Un match fallido reintenta 3 ciclos antes de marcar
  `no_encontrado`; cuando el tema suena en RadioBOSS, el puente lo marca
  `sonado`.

---

## 5. Mejoras sugeridas (no bloquean el funcionamiento)

1. **Anti-spam de pedidos:** máximo 1 pendiente por usuario + cooldown de
   unos minutos; a escala, validar con una Cloud Function `onCreate`.
2. **Propiar los orígenes de datos:** las carátulas usan proxies CORS
   públicos (allorigins, corsproxy, codetabs); un endpoint propio chico
   evita caídas.
3. **Push:** hoy se guardan tokens; falta el backend que envíe la
   notificación (FCM desde una Cloud Function).
4. **`panel.html`:** los bloques/renombres de oyentes hoy los escribe el
   login anónimo; conviene restringir esos writes al admin en las reglas.
5. **`preview-embed.html`:** el iframe apunta a `embed.html` alojado en
   GitHub Pages; si el sitio se autogestiona, hay que subir también ese
   archivo.
6. A futuro, dividir `index.html` (5.600 líneas) en módulos por función.

---

## 6. Verificación rápida de humo

| Prueba | Resultado esperado |
|---|---|
| Abrir la web con HTTPS | Reproductor conecta al stream; título/caratula se actualizan solos |
| Botón "Programá tu tema" | Abre el modal sin mensajes de pausa; envía y aparece ⏳ Pendiente en la cola |
| Cola en vivo | Pedidos de más viejo a más nuevo |
| `panel-radioboss.html` (PC DJ) | Muestra "Reproduciendo", tema actual, siguiente y oyentes; botones responden |
| Puente corriendo | El pedido pasa a 🎧 En cola y luego a ✅ Sonó |
| `avisos.html` con login admin | Lista pedidos con botón Borrar |
| Devtools → Application → Service Workers | `sw.js` activo, versión v27 |
