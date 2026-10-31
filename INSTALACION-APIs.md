# 🎵 Guía de Instalación de APIs — sikodark radio

Tu radio ahora usa **10 APIs profesionales en paralelo** para encontrar la info de cualquier banda. 6 de ellas funcionan sin configuración, pero las 4 más poderosas requieren que consigas **API keys gratis** (1-2 minutos cada una).

## 📋 Tabla rápida

| API | Para qué sirve | Requiere | Tiempo |
|---|---|---|---|
| Wikipedia | Bio + imágenes | Nada | ✅ Ya anda |
| TheAudioDB | Fanarts HD | Nada | ✅ Ya anda |
| Bandsintown | Giras futuras | Nada | ✅ Ya anda |
| MusicBrainz | Miembros + MBID + type filter | Nada | ✅ Ya anda (ahora filtra por tipo) |
| Deezer | Imágenes HD | Nada | ✅ Ya anda |
| Discogs | Imágenes alternativas | Nada | ✅ Ya anda |
| Cover Art Archive | Portadas de álbumes | Nada | ✅ Ya anda |
| **Setlist.fm** | Giras históricas + setlists | API key gratis | ⏱️ 1 min |
| **Spotify** | Imágenes HD + top tracks | Client ID + Secret | ⏱️ 2 min |
| **Genius** | Anécdotas sobre letras | Access Token | ⏱️ 1 min |

---

## 1️⃣ Setlist.fm (giras históricas + setlists reales)

### Cómo conseguir la API key

1. Andá a: **https://www.setlist.fm/signup**
2. Llená el form (cualquier email + password)
3. Confirmá el email (te llega al toque)
4. Andá a: **https://www.setlist.fm/settings/api**
5. Ahí te aparece tu **API key** (un string largo tipo `7a2b-BLAH-BLAH-BLAH`)

### Dónde pegarla

Abrí `index.html` y buscá esta línea (cerca del inicio del script):

```js
SETLISTFM_KEY: "",
```

Reemplazala por:

```js
SETLISTFM_KEY: "7a2b-tu-key-aqui",
```

### Qué vas a ver cuando la actives

Nueva categoría en el ticker:

> **📊 ÚLTIMAS GIRAS**
> **BILLY IDOL**
> 12 MAR 2024 · Buenos Aires · Argentina @ Teatro Gran Rex · Setlist: Rebel Yell, Dancing With Myself, Eyes Without a Face, White Wedding, Mony Mony

---

## 2️⃣ Spotify Web API (imágenes HD + top tracks + related artists)

### Cómo conseguir Client ID + Secret

1. Andá a: **https://developer.spotify.com/dashboard**
2. Loguéate con tu cuenta de Spotify (si no tenés, creala gratis)
3. Aceptá los términos
4. Clic en **"Create app"**
5. Llená:
   - **App name**: `sikodark radio`
   - **App description**: `Info de bandas para la radio`
   - **Website**: `https://tu-sitio.com` (o cualquier URL)
   - **Redirect URI**: `https://tu-sitio.com` (no se usa pero es obligatorio)
6. Clic en **"Save"**
7. En la pantalla de la app, vas a ver:
   - **Client ID** (string corto tipo `abc123def456...`)
   - **Client Secret** (clic en "View client secret" para verlo)

### Dónde pegarlos

En `index.html`, buscá estas líneas:

```js
SPOTIFY_CLIENT_ID: "",
SPOTIFY_CLIENT_SECRET: "",
```

Reemplazalas por:

```js
SPOTIFY_CLIENT_ID: "abc123-tu-client-id-aqui",
SPOTIFY_CLIENT_SECRET: "xyz789-tu-client-secret-aqui",
```

### Qué vas a ver cuando lo actives

- 🎵 **TEMAS MÁS ESCUCHADOS**: "Los más escuchados en Spotify: 1. Sweet Child O' Mine (Appetite for Destruction) 5:56 · 2. Paradise City..."
- 🎯 **SI TE GUSTA, ESCUCHÁ**: "Si te gusta Metallica, también te puede interesar: Megadeth, Slayer, Anthrax, Iron Maiden."
- Imágenes HD oficiales en el carrusel (las mejores quality)

---

## 3️⃣ Genius API (anécdotas sobre letras + samples)

### Cómo conseguir el Access Token

1. Andá a: **https://genius.com/signup**
2. Creá una cuenta (gratis, con Google o email)
3. Andá a: **https://genius.com/api-clients**
4. Clic en **"Create an API Client"**
5. Llená:
   - **App Name**: `sikodark radio`
   - **App Website URL**: `https://tu-sitio.com`
   - **Redirect URI**: `https://tu-sitio.com` (no se usa pero es obligatorio)
6. Clic en **"Save"**
7. En la lista de tus apps, clic en la nueva
8. Vas a ver **"Client Access Token"** — copialo (NO el "Client ID" ni "Client Secret", el ACCESS TOKEN)

### Dónde pegarlo

En `index.html`, buscá:

```js
GENIUS_ACCESS_TOKEN: "",
```

Reemplazala por:

```js
GENIUS_ACCESS_TOKEN: "tu-access-token-aqui",
```

### Qué vas a ver cuando lo actives

- 📰 **SOBRE LA LETRA**: Descripción detallada del artista con anécdotas sobre sus canciones + lista de canciones destacadas.
- Imágenes adicionales para el carrusel
- Link a la página del artista en Genius

---

## ✅ Cómo verificar que todo anda

Después de configurar las 3 keys:

1. Subí `index.html` a tu hosting
2. **Borrá caché** en el celular (botón "🧹 Limpiar caché y recargar")
3. Abrí la consola del navegador (F12 → Console)
4. Dale play a una banda conocida (Metallica, Soda Stereo, etc.)
5. En la consola vas a ver los logs de cada API:
   ```
   [Metadata] SSE conectado OK
   ```
6. Vas a ver en el ticker nuevas categorías:
   - 📊 ÚLTIMAS GIRAS (Setlist.fm)
   - 🎵 TEMAS MÁS ESCUCHADOS (Spotify)
   - 📰 SOBRE LA LETRA (Genius)
   - 🎯 SI TE GUSTA, ESCUCHÁ (Spotify)

---

## 🆘 Problemas comunes

### "Mi API key de Setlist.fm no anda"
- Verificá que confirmaste el email
- Asegurate de no tener espacios al principio/final
- Setlist.fm limita a 1000 requests por día — debería alcanzar

### "Spotify me da error 401"
- Verificá que pusiste Client ID y Client Secret (no solo uno)
- Si tu cuenta de Spotify es nueva, esperá 24h antes de usar la API
- Asegurate de que la app en developer.spotify.com esté en estado "Development Mode" (no hace falta publicarla)

### "Genius me da error 403"
- Tenés que usar el **Client Access Token**, NO el "API Key"
- El token es muy largo (como 80 caracteres)

### "Las 3 APIs funcionan pero la info es de otra banda (caso Tiësto)"
- Eso ya está arreglado con el filtro `type` de MusicBrainz
- Si pasa con otra banda, decime el nombre y lo investigamos
- Mientras tanto, podés forzar el nombre con paréntesis: "Club Nouveau (band)"

---

## 🔒 Seguridad de las keys

⚠️ **Importante**: las API keys van dentro del `index.html` que se sirve al navegador. Cualquiera con acceso al sitio puede verlas. Esto es así porque la app corre 100% en el cliente (no hay backend).

Para mayor seguridad, podrías:
- **CORS Proxy**: poner las keys en un servidor proxy tuyo (más trabajo pero más seguro)
- **Rate limiting**: las APIs gratuitas ya tienen límites que las protegen de abuso

Para uso de radio chica como la tuya, no es un problema real. Las keys son personales pero no dan acceso a datos sensibles.

---

## 📞 ¿Pasa algo raro?

Si una banda específica sigue trayendo info incorrecta después de configurar todo, mandame:
- Nombre de la banda
- Screenshot de lo que muestra
- Screenshot de la consola (F12 → Console)

Y lo investigamos. 🤘
