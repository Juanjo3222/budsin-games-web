#!/usr/bin/env python3
"""Descarga el cliente web oficial de Roblox (WebClientApp, Emscripten) a <raíz>/engine/.

La versión está fijada en <raíz>/engine.json; las flags se guardan al lado (flags.json) para que una actualización
de flags de Roblox no rompa un motor más antiguo. El motor (~220 MB) NO se sube a git (public/webblox/engine/ está
en .gitignore): se ejecuta esto en el VPS tras desplegar (solo hace falta al fijar una versión nueva).

  python3 scripts/webblox-fetch.py                  descarga la versión fijada (reanuda lo que ya esté bien)
  python3 scripts/webblox-fetch.py --latest         consulta la versión actual de Roblox, la fija y la descarga
  python3 scripts/webblox-fetch.py --flags          vuelve a guardar las flags actuales (solo si cambias de motor)
  python3 scripts/webblox-fetch.py --root DIR       carpeta webblox (por defecto: ../public/webblox)
Solo usa la biblioteca estándar de Python 3.
"""
import argparse, json, os, sys, time, urllib.parse, urllib.request
from concurrent.futures import ThreadPoolExecutor

SETTINGS = "https://clientsettingscdn.roblox.com/v2/settings/application/WebClientApp"
VERSION_API = "https://clientsettings.roblox.com/v2/client-version/WebClientApp"
CORE = ["WasmPlayer.js", "WebClient.js", "WebClient.wasm", "audio-processor-fast.js"]

ap = argparse.ArgumentParser()
ap.add_argument("--latest", action="store_true")
ap.add_argument("--flags", action="store_true")
ap.add_argument("--root", default=os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "webblox"))
args = ap.parse_args()
root = os.path.abspath(args.root)
out = os.path.join(root, "engine")
pin_file = os.path.join(root, "engine.json")


def get(url, retries=4):
    for i in range(retries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "budsin-webblox-fetch"}), timeout=60) as r:
                return r.read()
        except Exception as e:
            if i == retries - 1:
                raise
            time.sleep(0.5 * (i + 1))


pin = {}
if os.path.exists(pin_file):
    with open(pin_file) as fh:
        pin = json.load(fh)
if args.latest or not pin.get("version"):
    cur = json.loads(get(VERSION_API))
    pin = {"version": cur["clientVersionUpload"], "robloxVersion": cur["version"], "pinnedAt": time.strftime("%Y-%m-%d")}
    with open(pin_file, "w") as fh:
        json.dump(pin, fh, indent=2)
        fh.write("\n")
    print("versión fijada:", pin["version"], f"({pin['robloxVersion']})")
flags_file = os.path.join(root, "flags.json")
if args.latest or args.flags or not os.path.exists(flags_file):
    data = get(SETTINGS)
    with open(flags_file, "wb") as fh:
        fh.write(data)
    print("flags guardadas:", len(json.loads(data).get("applicationSettings", {})))

base = f"https://setup.rbxcdn.com/webclient/{pin['version']}-RobloxWebClient"
os.makedirs(out, exist_ok=True)
meta_raw = get(base + "/WebClient.metadata.json")
with open(os.path.join(out, "WebClient.metadata.json"), "wb") as fh:
    fh.write(meta_raw)
files = [{"path": "/" + f, "size": None} for f in CORE] + json.loads(meta_raw)
ver_file = os.path.join(out, ".version")
same_version = os.path.exists(ver_file) and open(ver_file).read().strip() == pin["version"]   # los 4 archivos del núcleo no traen tamaño
state = {"done": 0, "bytes": 0}
failed = []


def dest_of(p):
    d = os.path.abspath(os.path.join(out, p.lstrip("/")))
    if not d.startswith(out + os.sep):
        raise ValueError("ruta fuera del motor: " + p)
    return d


def fetch(f):
    dest = dest_of(f["path"])
    if os.path.exists(dest) and (os.path.getsize(dest) == f["size"] if f["size"] is not None else same_version):
        state["done"] += 1
        return
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    try:
        data = get(base + urllib.parse.quote(f["path"]))
        if f["size"] is not None and len(data) != f["size"]:
            raise ValueError(f"tamaño {len(data)} != {f['size']}")
        tmp = dest + ".part"
        with open(tmp, "wb") as fh:
            fh.write(data)
        os.replace(tmp, dest)
        state["done"] += 1
        state["bytes"] += len(data)
    except Exception as e:
        failed.append(f"{f['path']}: {e}")


with ThreadPoolExecutor(max_workers=16) as ex:
    futs = [ex.submit(fetch, f) for f in files]
    while not all(x.done() for x in futs):
        time.sleep(5)
        print(f"{state['done']}/{len(files)}  {state['bytes'] / 1e6:.0f} MB nuevos", flush=True)
print(f"listo: {state['done']}/{len(files)} archivos")
if failed:
    print(f"{len(failed)} fallos:\n" + "\n".join(failed[:10]), file=sys.stderr)
    sys.exit(1)
with open(os.path.join(out, ".version"), "w") as fh:
    fh.write(pin["version"])
