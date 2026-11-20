#!/usr/bin/env python3
"""Descarga los archivos GRANDES de «That's Not My Neighbor» (no caben en git: el .pck pesa ~448 MB).

Uso en el VPS (como el usuario que despliega, p. ej. github-runner):
    python3 app/scripts/tnmn-fetch.py --root /var/www/budsin-games-web/public/thats-not-my-neighbor

Solo hace falta la primera vez (o cuando el juego se actualice y cambien los tamaños de abajo). Los archivos pequeños
(index.html, ThatNot.js, worklets de audio) sí están en el repositorio. Si el .pck o el .wasm ya existen con el tamaño
correcto, no se vuelve a descargar. La descarga va a un archivo .part y se renombra al terminar (nunca queda un archivo a medias).
Sin dependencias: solo biblioteca estándar.
"""
import argparse, os, sys, time, urllib.request

BASE = "https://thatsnotmyneighbor.online/game/thatsnotmyneighbor/"
# tamaños que declara el propio juego (GODOT_CONFIG.fileSizes); si el juego se actualiza, cambian
FILES = {"ThatNot.wasm": 36145869, "ThatNot.pck": 448327748}
UA = "Mozilla/5.0 (compatible; BudsinGames/1.0; +https://games.budsin.dev)"


def fetch(name: str, size: int, root: str, force: bool) -> bool:
    dst = os.path.join(root, name)
    if not force and os.path.exists(dst) and os.path.getsize(dst) == size:
        print(f"= {name}: ya está ({size} bytes)")
        return True
    tmp = dst + ".part"
    req = urllib.request.Request(BASE + name, headers={"User-Agent": UA})
    done, t0, last = 0, time.time(), 0.0
    with urllib.request.urlopen(req, timeout=60) as r, open(tmp, "wb") as f:
        total = int(r.headers.get("Content-Length") or size)
        while True:
            chunk = r.read(1 << 20)
            if not chunk:
                break
            f.write(chunk); done += len(chunk)
            if time.time() - last > 5:
                last = time.time(); print(f"  {name}: {done * 100 // max(total, 1)} % ({done >> 20} MB)", flush=True)
    if done != size:
        os.remove(tmp)
        print(f"! {name}: tamaño {done} distinto del esperado {size}. ¿Se actualizó el juego? Revisa FILES en este script.", file=sys.stderr)
        return False
    os.replace(tmp, dst)
    print(f"+ {name}: {done} bytes en {time.time() - t0:.0f} s")
    return True


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", required=True, help="carpeta public/thats-not-my-neighbor")
    ap.add_argument("--force", action="store_true", help="descargar aunque ya existan")
    a = ap.parse_args()
    os.makedirs(a.root, exist_ok=True)
    return 0 if all(fetch(n, s, a.root, a.force) for n, s in FILES.items()) else 1


if __name__ == "__main__":
    sys.exit(main())
