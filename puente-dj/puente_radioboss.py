# -*- coding: utf-8 -*-
"""
====================================================================
PUENTE SIKODARK RADIO  —  Firestore (temas_pedidos)  ->  RadioBOSS
====================================================================
Corre en la PC del DJ (Windows) junto a RadioBOSS.

Qué hace, en bucle:
  1. Lee de Firestore los pedidos con estado "pendiente" (los que
     programaron los oyentes desde la web).
  2. Busca el archivo de música en la biblioteca local (D:\\Musica\\...).
  3. Lo envía a RadioBOSS por la API HTTP:
       - modo "songrequest"  -> lista nativa de solicitudes de RadioBOSS
                                (View -> Song Requests). Un evento del
                                programador con `playrequestedsong` lo
                                reproduce automáticamente.
       - modo "inserttrack"  -> lo inserta en el playlist que está al
                                aire. pos=-1 (al final) mantiene el orden
                                FIFO de pedidos; -3 después de programados;
                                -2 justo después del tema actual.
  4. Actualiza el pedido en Firestore:
       en_cola / sonado / no_encontrado  (la web ya muestra estos estados).

Requisitos:
  pip install firebase-admin
  Python 3.9+ en la PC del DJ.

Archivo de credenciales de Firebase: serviceAccountKey.json
(Console de Firebase -> Project settings -> Service accounts ->
 Generate new private key). NO subas ese archivo al hosting de la web.
====================================================================
"""

import configparser
import difflib
import json
import os
import re
import sys
import time
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import firebase_admin
from firebase_admin import credentials, firestore

# --------------------------------------------------------------------
# Carga de configuración
# --------------------------------------------------------------------
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CONFIG_PATH = os.path.join(BASE_DIR, "config.ini")
STATE_PATH = os.path.join(BASE_DIR, "puente_state.json")

cfg = configparser.ConfigParser()
if not os.path.exists(CONFIG_PATH):
    sys.exit("Falta config.ini: copiá config.ini.example y editalo.")
cfg.read(CONFIG_PATH, encoding="utf-8")

RB_BASE = cfg.get("radioboss", "base_url", fallback="http://127.0.0.1:9000").rstrip("/")
RB_PATH = cfg.get("radioboss", "path", fallback="/").strip() or "/"
RB_PASS = cfg.get("radioboss", "password", fallback="")
RB_MODO = cfg.get("radioboss", "modo", fallback="songrequest").strip().lower()
RB_POS = cfg.get("radioboss", "insert_pos", fallback="-1")  # -1 = al final (FIFO)
RB_TIMEOUT = cfg.getint("radioboss", "timeout", fallback=6)

FA_JSON = cfg.get("firestore", "service_account", fallback="serviceAccountKey.json")
COL = cfg.get("firestore", "coleccion", fallback="temas_pedidos")

ROOTS = [r.strip() for r in cfg.get("musica", "raices", fallback="D:\\Musica").splitlines() if r.strip()]
EXTS = tuple(e.strip().lower() for e in cfg.get("musica", "extensiones", fallback=".mp3,.m4a,.flac,.ogg,.wav").split(",") if e.strip())
UMBRAL = cfg.getint("musica", "umbral_score", fallback=62)

CADA_SEG = cfg.getint("puente", "cada_seg", fallback=8)
RESCAN_SEG = cfg.getint("puente", "rescan_seg", fallback=1800)
MARCAR_SONADO = cfg.getboolean("puente", "marcar_sonado", fallback=True)
MAX_INTENTOS = cfg.getint("puente", "max_intentos", fallback=3)  # reintentos antes de no_encontrado

# --------------------------------------------------------------------
# Utilidades
# --------------------------------------------------------------------
def log(msg):
    print("[%s] %s" % (datetime.now().strftime("%H:%M:%S"), msg), flush=True)

def normalizar(texto):
    if not texto:
        return ""
    texto = unicodedata.normalize("NFKD", str(texto)).lower()
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r"[^a-z0-9]+", " ", texto)
    return re.sub(r"\s+", " ", texto).strip()

def ahora_ms():
    return int(datetime.now(timezone.utc).timestamp() * 1000)

# --------------------------------------------------------------------
# Biblioteca local de música (índice en memoria + cache en disco)
# --------------------------------------------------------------------
INDICE = []          # lista de dicts: {path, text, artist, title}
ULTIMO_SCAN = 0

def escanear_biblioteca():
    global INDICE, ULTIMO_SCAN
    nuevos = []
    for raiz in ROOTS:
        if not os.path.isdir(raiz):
            log("⚠️ Carpeta no encontrada: %s" % raiz)
            continue
        for carpeta, _, archivos in os.walk(raiz):
            for fn in archivos:
                if not fn.lower().endswith(EXTS):
                    continue
                ruta = os.path.join(carpeta, fn)
                nombre = os.path.splitext(fn)[0]
                partes = [p.strip() for p in nombre.split(" - ")]
                artist = normalizar(partes[0]) if partes else ""
                title = normalizar(partes[-1]) if len(partes) > 1 else normalizar(nombre)
                nuevos.append({
                    "path": ruta,
                    "text": normalizar(nombre),
                    "artist": artist,
                    "title": title,
                })
    INDICE = nuevos
    ULTIMO_SCAN = time.time()
    log("📚 Biblioteca indexada: %d archivos en %d carpeta(s)." % (len(INDICE), len(ROOTS)))

def buscar_pedido(banda, tema):
    """Devuelve (ruta, score) del mejor archivo, o (None, 0)."""
    p_artist = normalizar(banda)
    p_title = normalizar(tema)
    consulta = (p_artist + " " + p_title).strip()
    if not consulta:
        return None, 0
    mejor, mejor_score = None, 0
    for c in INDICE:
        score = difflib.SequenceMatcher(None, c["text"], consulta).ratio() * 100
        if p_title and p_title in c["text"]:
            score += 25
        if p_artist and (p_artist in c["artist"] or p_artist in c["text"]):
            score += 20
        # penalizar si pidieron título y no aparece ningún token largo
        if p_title:
            tokens_t = [t for t in p_title.split() if len(t) > 3]
            if tokens_t and not any(tok in c["text"] for tok in tokens_t):
                score -= 15
        if score > mejor_score:
            mejor, mejor_score = c, score
    if mejor and mejor_score >= UMBRAL:
        return mejor["path"], round(mejor_score, 1)
    return None, round(mejor_score, 1)

# --------------------------------------------------------------------
# API HTTP de RadioBOSS
# --------------------------------------------------------------------
def rb_call(action, params=None):
    """Llamada GET a la API de RadioBOSS. Devuelve el texto de respuesta."""
    query = {"pass": RB_PASS, "action": action}
    if params:
        query.update(params)
    url = RB_BASE + RB_PATH + ("" if RB_PATH.endswith("?") else "?") + urllib.parse.urlencode(query)
    req = urllib.request.Request(url, headers={"User-Agent": "sikodark-puente/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=RB_TIMEOUT) as r:
            cuerpo = r.read().decode("utf-8", "replace").strip()
            return cuerpo
    except urllib.error.HTTPError as e:
        return "HTTPError %s" % e.code
    except Exception as e:
        return "ERROR: %s" % e

def rb_ok(texto):
    return bool(texto) and texto.upper().startswith("OK")

def rb_status():
    return rb_call("status")

def rb_songrequest(ruta, mensaje):
    return rb_call("songrequest", {"filename": ruta, "message": mensaje})

def rb_inserttrack(ruta, titulo_stream, pos):
    return rb_call("inserttrack", {
        "filename": ruta,
        "pos": pos,
        "streamingtitle": titulo_stream,
    })

def rb_ultimos_reproducidos():
    """XML de últimos temas; lista de filas (lowercase) de FILENAME."""
    texto = rb_call("getlastplayed", {"filter": "1"})
    archivos = []
    try:
        raiz = ET.fromstring(texto)
        for tr in raiz.iter("TRACK"):
            fn = tr.get("FILENAME")
            if fn:
                archivos.append(fn.lower())
    except Exception:
        pass
    return archivos

# --------------------------------------------------------------------
# Estado local (qué documento de Firestore ya mandamos y a qué archivo)
# --------------------------------------------------------------------
def cargar_estado():
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"activos": {}}

def guardar_estado(estado):
    try:
        with open(STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(estado, f, ensure_ascii=False, indent=1)
    except Exception as e:
        log("No pude guardar estado local: %s" % e)

# --------------------------------------------------------------------
# Firestore
# --------------------------------------------------------------------
firebase_admin.initialize_app(credentials.Certificate(
    os.path.join(BASE_DIR, FA_JSON) if not os.path.isabs(FA_JSON) else FA_JSON
))
db = firestore.client()

def actualizar_pedido(doc_id, datos):
    db.collection(COL).document(doc_id).set(datos, merge=True)

# --------------------------------------------------------------------
# Bucle principal
# --------------------------------------------------------------------
def procesar_pendientes(estado):
    snap = db.collection(COL).where("estado", "==", "pendiente").get()
    pendientes = []
    for d in snap:
        data = d.to_dict() or {}
        data["_id"] = d.id
        pendientes.append(data)
    # más viejo primero (respeta el orden de pedido)
    pendientes.sort(key=lambda x: x.get("fecha") or 0)

    for p in pendientes:
        doc_id = p["_id"]
        banda = (p.get("banda") or "").strip()
        tema = (p.get("tema") or "").strip()
        nombre = (p.get("nombre") or "").strip()
        if not banda and not tema:
            continue

        ruta, score = buscar_pedido(banda, tema)
        if not ruta:
            intentos = int(p.get("intentos") or 0) + 1
            if intentos >= MAX_INTENTOS:
                actualizar_pedido(doc_id, {
                    "estado": "no_encontrado",
                    "motivo": "no está en la biblioteca de la radio (score %s)" % score,
                    "intentos": intentos,
                    "revisado_en": ahora_ms(),
                })
                log("❌ %s - %s  → NO ENCONTRADO tras %d intentos (score %s)"
                    % (banda, tema, intentos, score))
            else:
                # sigue pendiente: reintenta en el próximo ciclo (la biblioteca
                # puede escanearse de nuevo) sin romper el orden FIFO de la cola
                actualizar_pedido(doc_id, {"intentos": intentos, "ultimo_score": score})
                log("⏳ Sin coincidencia aún (%d/%d) %s - %s (score %s)"
                    % (intentos, MAX_INTENTOS, banda, tema, score))
            continue

        titulo = (banda + " - " + tema).strip(" -")
        mensaje = ("%s pidió: %s" % (nombre, titulo)) if nombre else "Pedidos de oyentes: %s" % titulo

        if RB_MODO == "inserttrack":
            resp = rb_inserttrack(ruta, titulo, RB_POS)
        else:
            resp = rb_songrequest(ruta, mensaje)

        if rb_ok(resp):
            actualizar_pedido(doc_id, {
                "estado": "en_cola",
                "rb_archivo": ruta,
                "rb_modo": RB_MODO,
                "rb_score": score,
                "rb_enviado_en": ahora_ms(),
            })
            estado["activos"][doc_id] = {"file": ruta.lower(), "desde": ahora_ms()}
            log("🎧 EN COLA [%s] %s  (%s, score %s)" % (RB_MODO, titulo, os.path.basename(ruta), score))
        else:
            log("⚠️ RadioBOSS rechazó '%s' para %s — respuesta: %s (reintento en el próximo ciclo)"
                % (titulo, ruta, resp))

def marcar_sonados(estado):
    if not estado["activos"]:
        return
    recientes = rb_ultimos_reproducidos()
    if not recientes:
        return
    for doc_id, info in list(estado["activos"].items()):
        if any(info["file"] in fn or fn in info["file"] for fn in recientes):
            actualizar_pedido(doc_id, {"estado": "sonado", "reproducido_en": ahora_ms()})
            del estado["activos"][doc_id]
            log("✅ Sonó: %s" % os.path.basename(info["file"]))

def main():
    log("=== Puente sikodark → RadioBOSS iniciado ===")
    log("Modo: %s | RadioBOSS: %s%s" % (RB_MODO, RB_BASE, RB_PATH))
    test = rb_status()
    if test.upper().startswith("<?xml") or "Status" in test:
        log("Conexión con RadioBOSS OK.")
    else:
        log("⚠️ No respondió la API de RadioBOSS (%s). Revisá Settings → Options → API y puerto." % test)

    escanear_biblioteca()
    estado = cargar_estado()

    while True:
        try:
            if time.time() - ULTIMO_SCAN > RESCAN_SEG:
                escanear_biblioteca()
            procesar_pendientes(estado)
            if MARCAR_SONADO:
                marcar_sonados(estado)
            guardar_estado(estado)
        except KeyboardInterrupt:
            log("Detenido por el usuario.")
            break
        except Exception as e:
            log("❌ Error en el ciclo: %s" % e)
        time.sleep(CADA_SEG)

if __name__ == "__main__":
    main()
