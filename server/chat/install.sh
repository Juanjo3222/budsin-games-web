#!/usr/bin/env bash
# Instala el backend de Budsin Chat en el VPS (Ubuntu + Caddy). Ejecutar como root desde esta carpeta:
#   sudo bash install.sh
# Es idempotente: se puede repetir. No toca /etc/budsin-chat.env ni la base de datos si ya existen.
# No tiene dependencias: usa bun (que ya instala Budsin Music) con su WebSocket y SQLite integrados.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecuta como root (sudo bash install.sh)"; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
caddyfile=/etc/caddy/Caddyfile
envfile=/etc/budsin-chat.env
BUN_VERSION=1.3.14

tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT

# --- bun (release oficial + checksum), solo si falta ---
if ! [ -x /usr/local/bin/bun ]; then
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

# --- ffmpeg: el chat re-codifica imagenes, stickers y audios (lo instala tambien el instalador de Budsin Music) ---
if ! command -v ffmpeg >/dev/null 2>&1; then
  if command -v apt-get >/dev/null 2>&1; then
    echo "Instalando ffmpeg (puede tardar varios minutos en un VPS pequeño; se ve el progreso)..."
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends ffmpeg
  else
    echo "Instala ffmpeg a mano: el chat lo necesita para imagenes y audios"; exit 1
  fi
fi
command -v ffprobe >/dev/null 2>&1 || { echo "Falta ffprobe (viene con ffmpeg)"; exit 1; }

# --- usuario, carpetas y código ---
id budsin-chat >/dev/null 2>&1 || useradd --system --home-dir /var/lib/budsin-chat --shell /usr/sbin/nologin budsin-chat
install -d -o budsin-chat -g budsin-chat -m 0750 /var/lib/budsin-chat /var/lib/budsin-chat/media
install -d -m 0755 /opt/budsin-chat/app
cp -a "$here/app/." /opt/budsin-chat/app/
rm -f /opt/budsin-chat/app/lib/*.test.ts
chown -R root:root /opt/budsin-chat

if [ ! -f "$envfile" ]; then
  install -m 0640 -o root -g budsin-chat "$here/env.example" "$envfile"
  echo "Creado $envfile"
fi

# --- detector de contenido sexual (servicio aparte): modelo ONNX con revision y SHA-256 fijos ---
MODEL_REV=8587de998f441aac03fdd57a85d2e4cb808c7d64
MODEL_SHA=d25aa73fe1eec78459e35ff911e2af98f652ee919b48d9c54316c86d5ff435fa
id budsin-chat-scan >/dev/null 2>&1 || useradd --system --home-dir /var/lib/budsin-chat-scan --shell /usr/sbin/nologin budsin-chat-scan
install -d -o budsin-chat-scan -g budsin-chat-scan -m 0750 /var/lib/budsin-chat-scan
model=/var/lib/budsin-chat-scan/model_int8.onnx
if ! [ -f "$model" ] || [ "$(sha256sum "$model" | awk '{print $1}')" != "$MODEL_SHA" ]; then
  echo "Descargando el modelo del detector (88 MB)..."
  curl -fSL -o "$tmp/model.onnx" "https://huggingface.co/AdamCodd/vit-base-nsfw-detector/resolve/$MODEL_REV/onnx/model_int8.onnx"
  [ "$(sha256sum "$tmp/model.onnx" | awk '{print $1}')" = "$MODEL_SHA" ] || { echo "El SHA-256 del modelo no coincide; no se instala"; exit 1; }
  install -m 0640 -o budsin-chat-scan -g budsin-chat-scan "$tmp/model.onnx" "$model"
fi
install -d -m 0755 /opt/budsin-chat/scan
cp -a "$here/scan/." /opt/budsin-chat/scan/
( cd /opt/budsin-chat/scan && HOME=/var/lib/budsin-chat-scan /usr/local/bin/bun install --production )
# onnxruntime trae binarios de todos los sistemas: aqui solo hace falta linux/x64
find /opt/budsin-chat/scan/node_modules/onnxruntime-node/bin -mindepth 2 -maxdepth 2 \( -name darwin -o -name win32 \) -exec rm -rf {} + 2>/dev/null || true
find /opt/budsin-chat/scan/node_modules/onnxruntime-node/bin -path '*linux/arm64' -exec rm -rf {} + 2>/dev/null || true
chown -R root:root /opt/budsin-chat

# --- systemd ---
install -m 0644 "$here/budsin-chat-scan.service" /etc/systemd/system/budsin-chat-scan.service
install -m 0644 "$here/budsin-chat.service" /etc/systemd/system/budsin-chat.service
systemctl daemon-reload
systemctl enable budsin-chat-scan budsin-chat >/dev/null
systemctl restart budsin-chat-scan
for i in 1 2 3 4 5 6 7 8 9 10; do curl -fsS http://127.0.0.1:3105/health >/dev/null 2>&1 && break; sleep 1; done
curl -fsS http://127.0.0.1:3105/health >/dev/null || { echo "El detector no arranco: journalctl -u budsin-chat-scan -n 30"; exit 1; }
echo "Detector listo"
systemctl restart budsin-chat

# --- Caddy: el bloque se añade justo después del de Budsin Music (o del de PayPal); si ya existe, se actualiza en el sitio ---
backup="$caddyfile.bak.$(date +%Y%m%d%H%M%S)"
cp -a "$caddyfile" "$backup"
status=$(python3 - "$caddyfile" "$here/caddy-snippet.txt" <<'PY' || true
import re, sys
path, snippet = sys.argv[1], open(sys.argv[2]).read().rstrip("\n")
t = open(path).read()
def blk(name, route):
    return re.compile(r"^\t# Budsin " + name + r":[^\n]*\n\thandle " + route + r"[ \t]*\{\n.*?^\t\}\n", re.S | re.M)
chat, music = blk("Chat", r"/api/chat/\*"), blk("Music", r"/api/music/\*")
if chat.search(t):
    new = chat.sub(lambda m: snippet + "\n", t, count=1)
elif music.search(t):
    new = music.sub(lambda m: m.group(0) + snippet + "\n", t, count=1)
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
    echo "Caddy ya tiene la ruta /api/chat/* al día"; rm -f "$backup" ;;
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
    echo "No encuentro dónde insertar el bloque en $caddyfile; añade a mano caddy-snippet.txt. Nada cambió."
    exit 1 ;;
esac

sleep 2
curl -fsS "http://127.0.0.1:3104/api/chat/health" && echo
systemctl is-active budsin-chat budsin-chat-scan
