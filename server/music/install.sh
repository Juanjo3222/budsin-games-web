#!/usr/bin/env bash
# Instala el backend de música (x8rr/music) en el VPS (Ubuntu + Caddy). Ejecutar como root desde esta carpeta:
#   sudo bash install.sh
# Es idempotente: se puede repetir. No toca /etc/budsin-music.env si ya existe.
# Descarga bun y yt-dlp desde sus releases oficiales de GitHub y verifica el SHA-256 publicado.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecuta como root (sudo bash install.sh)"; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
caddyfile=/etc/caddy/Caddyfile
envfile=/etc/budsin-music.env
BUN_VERSION=1.3.14   # la versión con la que se probó en local

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# --- bun (sin curl|sh: release oficial + checksum) ---
if ! [ -x /usr/local/bin/bun ] || [ "$(/usr/local/bin/bun --version 2>/dev/null)" != "$BUN_VERSION" ]; then
  base="https://github.com/oven-sh/bun/releases/download/bun-v${BUN_VERSION}"
  curl -fsSL -o "$tmp/bun.zip" "$base/bun-linux-x64.zip"
  curl -fsSL -o "$tmp/SHASUMS256.txt" "$base/SHASUMS256.txt"
  want=$(grep ' bun-linux-x64.zip$' "$tmp/SHASUMS256.txt" | awk '{print $1}')
  got=$(sha256sum "$tmp/bun.zip" | awk '{print $1}')
  [ -n "$want" ] && [ "$want" = "$got" ] || { echo "Checksum de bun no coincide; no se instala"; exit 1; }
  python3 - "$tmp/bun.zip" "$tmp" <<'PY'
import sys, zipfile
zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])
PY
  install -m 0755 "$tmp/bun-linux-x64/bun" /usr/local/bin/bun
fi
echo "bun $(/usr/local/bin/bun --version)"

# --- yt-dlp (binario standalone, sin depender del Python del sistema) ---
ydl="https://github.com/yt-dlp/yt-dlp/releases/latest/download"
curl -fsSL -o "$tmp/yt-dlp_linux" "$ydl/yt-dlp_linux"
curl -fsSL -o "$tmp/SHA2-256SUMS" "$ydl/SHA2-256SUMS"
want=$(grep ' yt-dlp_linux$' "$tmp/SHA2-256SUMS" | awk '{print $1}')
got=$(sha256sum "$tmp/yt-dlp_linux" | awk '{print $1}')
[ -n "$want" ] && [ "$want" = "$got" ] || { echo "Checksum de yt-dlp no coincide; no se instala"; exit 1; }
install -m 0755 "$tmp/yt-dlp_linux" /usr/local/bin/yt-dlp
echo "yt-dlp $(/usr/local/bin/yt-dlp --version)"

# --- ffmpeg (solo para «Ver video oficial»: une la imagen y el audio en un mp4) ---
if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "Instalando ffmpeg (puede tardar varios minutos en un VPS pequeño; se ve el progreso)..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg || echo "AVISO: no se pudo instalar ffmpeg; el video oficial puede no funcionar"
  else
    echo "AVISO: instala ffmpeg a mano para que funcione el video oficial"
  fi
fi
command -v ffmpeg >/dev/null 2>&1 && echo "ffmpeg listo"

# --- usuario, carpetas y código ---
id budsin-music >/dev/null 2>&1 || useradd --system --home-dir /var/lib/budsin-music --shell /usr/sbin/nologin budsin-music
install -d -o budsin-music -g budsin-music -m 0750 /var/lib/budsin-music /var/lib/budsin-music/cache
install -d -m 0755 /opt/budsin-music/app
cp -a "$here/app/." /opt/budsin-music/app/
chown -R root:root /opt/budsin-music
( cd /opt/budsin-music/app && HOME=/var/lib/budsin-music /usr/local/bin/bun install --frozen-lockfile --production )

if [ ! -f "$envfile" ]; then
  install -m 0640 -o root -g budsin-music "$here/env.example" "$envfile"
  echo "Creado $envfile"
fi

# --- prueba como el usuario del servicio: ¿yt-dlp arranca? ---
sudo -u budsin-music env HOME=/var/lib/budsin-music XDG_CACHE_HOME=/var/lib/budsin-music/cache /usr/local/bin/yt-dlp --version >/dev/null

# --- systemd ---
install -m 0644 "$here/budsin-music.service" /etc/systemd/system/budsin-music.service
systemctl daemon-reload
systemctl enable budsin-music >/dev/null
systemctl restart budsin-music

# --- Caddy: la ruta se añade justo después del bloque de PayPal; si ya existe, se actualiza en el sitio ---
backup="$caddyfile.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$caddyfile" "$backup"
status=$(python3 - "$caddyfile" "$here/caddy-snippet.txt" <<'PY' || true
import re, sys
path, snippet = sys.argv[1], open(sys.argv[2]).read().rstrip("\n")
t = open(path).read()
# Bloque ya instalado: de su comentario "# Budsin Music" hasta el "\t}" que lo cierra (el interior va con 2+ tabs).
block = re.compile(r"^\t# Budsin Music:[^\n]*\n\thandle /api/music/\*[ \t]*\{\n.*?^\t\}\n", re.S | re.M)
if block.search(t):
    new = block.sub(lambda m: snippet + "\n", t, count=1)
else:
    a = "\t\treverse_proxy 127.0.0.1:3101\n\t}\n"
    if t.count(a) != 1:
        print("NOANCHOR"); sys.exit(0)
    new = t.replace(a, a + snippet + "\n")
if new == t:
    print("SAME")
else:
    open(path, "w").write(new)
    print("CHANGED")
PY
)
case "$status" in
  SAME)
    echo "Caddy ya tiene la ruta /api/music/* al día"; rm -f "$backup" ;;
  CHANGED)
    if caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null 2>&1; then
      systemctl reload caddy
      echo "Caddy actualizado (copia de seguridad: $backup)"
    else
      cp -a "$backup" "$caddyfile"
      echo "El Caddyfile nuevo no valida; restaurado desde $backup. Nada cambió en Caddy."
      exit 1
    fi ;;
  *)
    cp -a "$backup" "$caddyfile"
    echo "No encuentro el bloque de PayPal en $caddyfile; añade a mano caddy-snippet.txt. Nada cambió."
    exit 1 ;;
esac

sleep 2
curl -fsS "http://127.0.0.1:3103/api/music/source" && echo
