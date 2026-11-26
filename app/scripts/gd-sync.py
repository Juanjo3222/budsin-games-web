#!/usr/bin/env python3
"""Sincroniza public/geometry-dash-play.html con el HTML del port de Ale7208 (https://github.com/Ale7208/Geometry-Dash-webport).

Descarga su index.html (rama main) y le aplica los ajustes de Budsin (los assets obligatorios de AGENTS.md y desactivar su
service worker, porque el portal ya tiene el suyo en «/»). El HTML trae un <base href> que apunta al repo de assets
(Ale7208/geometry-dash-wasm en jsDelivr), así que el juego sigue SIEMPRE esos archivos: si el autor cambia los assets y su
HTML nuevo ya no coincide con nuestra copia, el juego deja de cargar. Cuando pase, ejecutar esto de nuevo:

    python3 app/scripts/gd-sync.py            # reescribe public/geometry-dash-play.html
    python3 app/scripts/gd-sync.py --check    # solo dice si el HTML del autor cambió respecto a nuestra copia

Solo usa la biblioteca estándar de Python 3.
"""
import hashlib, os, re, sys, urllib.request

SRC = "https://raw.githubusercontent.com/Ale7208/Geometry-Dash-webport/main/index.html"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "public", "geometry-dash-play.html")

GTM_HEAD = """<!-- Google Tag Manager -->
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-WKVW2STJ');</script>
<!-- End Google Tag Manager -->
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-2866089236522641" crossorigin="anonymous"></script>
"""
GTM_BODY = """<!-- Google Tag Manager (noscript) -->
<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-WKVW2STJ"
height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>
<!-- End Google Tag Manager (noscript) -->
"""
HOTKEY = '<script async src="https://games.budsin.dev/classroom-hotkey.js"></script>\n'


def patch(html):
    def once(old, new, label):
        nonlocal html
        if html.count(old) != 1:
            sys.exit(f"No se pudo aplicar el ajuste «{label}»: el HTML del autor cambió ({html.count(old)} coincidencias de {old[:60]!r}). Revisar a mano.")
        html = html.replace(old, new)
    once('<meta charset="utf-8">', '<meta charset="utf-8">\n' + GTM_HEAD, "GTM + AdSense")
    once('<link rel="icon" href="ref/favicon.ico">', '<link rel="icon" type="image/jpeg" href="https://games.budsin.dev/images.jpeg">', "favicon")
    once("if (!('serviceWorker' in navigator)) return;", "return; /* Budsin: sin service worker propio (el portal ya tiene el suyo en «/») */", "service worker")
    once("<body>", "<body>\n" + GTM_BODY, "noscript GTM")
    once("</body>", HOTKEY + "</body>", "classroom-hotkey")
    return html


def main():
    req = urllib.request.Request(SRC, headers={"User-Agent": "budsin-gd-sync"})
    upstream = urllib.request.urlopen(req, timeout=60).read().decode("utf-8")
    new = patch(upstream)
    if "--check" in sys.argv:
        old = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        same = hashlib.sha256(old.encode()).hexdigest() == hashlib.sha256(new.encode()).hexdigest()
        print("sin cambios" if same else "EL HTML DEL AUTOR CAMBIÓ: ejecuta gd-sync.py sin --check")
        sys.exit(0 if same else 1)
    with open(OUT, "w", encoding="utf-8") as fh:
        fh.write(new)
    print(f"escrito {os.path.relpath(OUT)} ({len(new)} bytes)")


main()
