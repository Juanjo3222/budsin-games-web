#!/usr/bin/env python3
"""Descarga el cliente web oficial de Roblox (WebClientApp, Emscripten) a <raíz>/engine/.

El motor (~255 MB) NO va en git (public/webblox/engine/ está en .gitignore): se ejecuta esto en el VPS tras desplegar, solo la primera
vez o cuando se quiera otra versión. La carpeta queda como la espera el host de x8rr/webblox-built (webblox/host.js + sw.js):

  engine/WasmPlayer.js, WebClient.js, WebClient.wasm (+ .gz), audio-processor-fast.js, y la lista de archivos
  (WebClient.fsindex.txt desde la 0.748; WebClient.metadata.json hasta la 0.747)
  engine/<los ~2900 archivos de contenido que lista el metadata>
  engine/PinnedFlags.json   las flags de Roblox del momento de la descarga: una actualización de flags de Roblox no rompe este motor
  engine/version.json       versión, origen y si la descarga terminó

  python3 app/scripts/webblox-fetch.py version-1ef59424f70d4932 la 0.748 (actual el 20-nov-2026); version-f807b21caba84809 es la 0.747 de respaldo
  python3 app/scripts/webblox-fetch.py                          la versión actual de producción de Roblox (puede no estar completa: ver abajo)
  python3 app/scripts/webblox-fetch.py --root DIR               carpeta webblox (por defecto: ../../public/webblox)

Cambiar de versión borra la anterior antes de bajar la nueva (comparten casi nada byte a byte). Una descarga interrumpida solo puede
reanudar la MISMA versión: lo que está en disco con el tamaño correcto se salta. Se escribe a .part y se renombra: nunca queda un archivo
a medias. También borra las carpetas engine/version-*/ del formato anterior de este proyecto.
Solo usa la biblioteca estándar de Python 3. Basado en scripts/fetch-webblox.mjs de x8rr/webblox-built.
"""
import argparse, gzip, json, os, re, shutil, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

BINARY = "WebClientApp"
VERSION_API = f"https://clientsettings.roblox.com/v2/client-version/{BINARY}"
FLAGS_URL = f"https://clientsettingscdn.roblox.com/v2/settings/application/{BINARY}"
CDN = "https://setup.rbxcdn.com/webclient"
CORE = ["WasmPlayer.js", "WebClient.js", "WebClient.wasm", "audio-processor-fast.js"]
# Roblox cambió la lista de archivos del motor: hasta la 0.747 es WebClient.metadata.json (JSON); desde la 0.748 es WebClient.fsindex.txt
# (texto «rbxfsindex 1», rutas con prefijo comprimido). El script prueba el formato nuevo primero y cae al viejo.
INDEXES = ["WebClient.fsindex.txt", "WebClient.metadata.json"]
GZIP = ["WebClient.wasm"]
VERSION_RE = re.compile(r"^version-[0-9a-f]{16}$")
KNOWN_GOOD = "version-f807b21caba84809"   # 0.747 (la lista de archivos era WebClient.metadata.json): la versión de respaldo; la 0.748 usa WebClient.fsindex.txt

ap = argparse.ArgumentParser()
ap.add_argument("version", nargs="?", help="version-<16 hex> (por defecto, la actual de Roblox)")
ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "webblox"))
args = ap.parse_args()
root = os.path.abspath(args.root)
out = os.path.join(root, "engine")
version_file = os.path.join(out, "version.json")


def get(url, retries=4):
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "budsin-webblox-fetch"}), timeout=60) as r:
                return r.read(), r.headers
        except Exception:
            if i == retries - 1:
                raise
            time.sleep(0.5 * (i + 1))


def get_json(url):
    return json.loads(get(url)[0])


if args.version is not None and not VERSION_RE.match(args.version):
    sys.exit(f'"{args.version}" no es un id de subida version-<16 hex>')
live = None if args.version else get_json(VERSION_API)
upload = args.version or (live or {}).get("clientVersionUpload", "")
if not VERSION_RE.match(upload or ""):
    sys.exit(f"respuesta inesperada de client-version: {live}")
base = f"{CDN}/{upload}-RobloxWebClient"
print(f"motor {upload} ({live['version'] if live else 'fijada'})\norigen {base}")

# carpetas del formato anterior (engine/<versión>/): ya no se usan
if os.path.isdir(out):
    for name in os.listdir(out):
        if VERSION_RE.match(name) and os.path.isdir(os.path.join(out, name)):
            shutil.rmtree(os.path.join(out, name))
            print("borrada la carpeta del formato anterior:", name)

# Antes de borrar nada: la versión tiene que tener su lista de archivos publicada (Roblox sube el motor y a veces la lista tarda: 403).
index_name = None
index_raw = None
for name in INDEXES:
    try:
        index_raw, _ = get(f"{base}/{name}")
        index_name = name
        break
    except Exception as e:
        last = e
if index_name is None:
    sys.exit(f"La versión {upload} no tiene lista de archivos disponible ({last}). No se toca el motor actual. "
             f"Prueba una anterior que funcione, por ejemplo: python3 app/scripts/webblox-fetch.py {KNOWN_GOOD}")
print("lista de archivos:", index_name)


def parse_fsindex(raw):
    """rbxfsindex 1: «<bytes que comparte con la ruta anterior>\t<resto de la ruta>\t<tamaño>\n» por línea (la misma lectura que hace WasmPlayer.js)."""
    head = b"rbxfsindex 1\n"
    if not raw.startswith(head):
        raise ValueError("cabecera de fsindex no reconocida")
    out, prev, pos = [], b"", len(head)

    def take(sep):
        nonlocal pos
        end = raw.find(sep, pos)
        if end < 0:
            raise ValueError("fsindex truncado")
        piece = raw[pos:end]
        pos = end + 1
        return piece

    while pos < len(raw):
        a = take(b"\t")
        suffix = take(b"\t")
        size = take(b"\n")
        if not (a.isdigit() and size.isdigit()) or b"\n" in suffix or int(a) > len(prev):
            raise ValueError("línea de fsindex mal formada")
        prev = prev[: int(a)] + suffix
        out.append({"path": prev.decode("utf-8"), "size": int(size)})
    return out


previous = None
try:
    with open(version_file) as fh:
        previous = json.load(fh).get("clientVersionUpload")
except Exception:
    pass
if previous != upload:
    if previous:
        print("reemplazando", previous)
    shutil.rmtree(out, ignore_errors=True)
os.makedirs(out, exist_ok=True)
record = {"clientVersionUpload": upload, "version": live["version"] if live else None, "source": base, "index": index_name, "complete": False}
with open(version_file, "w") as fh:
    json.dump(record, fh, indent=2)
    fh.write("\n")


def safe_dest(p):
    d = os.path.abspath(os.path.join(out, p.lstrip("/")))
    if not d.startswith(out + os.sep) or ".." in p.split("/"):
        raise ValueError("ruta fuera del motor: " + p)
    return d


def download(url, dest, size=None):
    """True si bajó algo; False si ya estaba bien."""
    if os.path.exists(dest) and (size is None or os.path.getsize(dest) == size):
        return False
    data, headers = get(url)
    if size is not None and len(data) != size:
        raise ValueError(f"tamaño {len(data)} != {size}")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    tmp = dest + ".part"
    with open(tmp, "wb") as fh:
        fh.write(data)
    os.replace(tmp, dest)
    return True


for name in CORE + [index_name]:
    print(("bajado " if download(f"{base}/{name}", os.path.join(out, name)) else "ya estaba ") + name)
for name in GZIP:
    path = os.path.join(out, name)
    if not os.path.exists(path + ".gz"):
        with open(path, "rb") as src, gzip.open(path + ".gz.part", "wb", compresslevel=9) as dst:
            shutil.copyfileobj(src, dst)
        os.replace(path + ".gz.part", path + ".gz")
        print(f"comprimido {name} ({os.path.getsize(path + '.gz') / 1e6:.1f} MB)")

if index_name.endswith(".txt"):
    metadata = parse_fsindex(index_raw)
else:
    metadata = json.loads(index_raw)
if not isinstance(metadata, list):
    sys.exit(f"{index_name} no es una lista de archivos")
files = []
for e in metadata:
    ok = isinstance(e, dict) and isinstance(e.get("path"), str) and e["path"].startswith("/") and ".." not in e["path"].split("/") and isinstance(e.get("size"), int)
    if ok:
        files.append(e)
    else:
        print("se omite una entrada mala del metadata:", e, file=sys.stderr)
print(f"{len(files)} archivos de contenido, {sum(e['size'] for e in files) / 1e6:.1f} MB")

state = {"done": 0}
failures = []


def work(e):
    try:
        download(base + urllib.parse.quote(e["path"], safe="/"), safe_dest(e["path"]), e["size"])
    except Exception as err:
        failures.append(f"{e['path']}: {err}")
    state["done"] += 1


with ThreadPoolExecutor(max_workers=16) as ex:
    futs = [ex.submit(work, e) for e in files]
    while not all(f.done() for f in futs):
        time.sleep(5)
        print(f"{state['done']}/{len(files)}", flush=True)
if failures:
    print(f"{len(failures)} fallos:\n" + "\n".join(failures[:10]), file=sys.stderr)
    sys.exit(1)

flags = get_json(FLAGS_URL)
pinned_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
with open(os.path.join(out, "PinnedFlags.json"), "w") as fh:
    json.dump({"engine": upload, "pinnedAt": pinned_at, "applicationSettings": flags["applicationSettings"]}, fh)
print("flags fijadas:", len(flags["applicationSettings"]))
record.update({"complete": True, "fetchedAt": pinned_at})
with open(version_file, "w") as fh:
    json.dump(record, fh, indent=2)
    fh.write("\n")
print("listo:", out)
