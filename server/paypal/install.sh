#!/usr/bin/env bash
# Instala el servicio de PayPal en el VPS (Ubuntu + Caddy). Ejecutar como root desde esta carpeta:
#   sudo bash install.sh
# Es idempotente: se puede repetir. No toca el Secret si ya está guardado.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecuta como root (sudo bash install.sh)"; exit 1; }
here=$(cd "$(dirname "$0")" && pwd)
caddyfile=/etc/caddy/Caddyfile
envfile=/etc/budsin-paypal.env

id budsin-paypal >/dev/null 2>&1 || useradd --system --home-dir /var/lib/budsin-paypal --shell /usr/sbin/nologin budsin-paypal
install -d -o budsin-paypal -g budsin-paypal -m 0750 /var/lib/budsin-paypal
install -d -m 0755 /opt/budsin-paypal
install -m 0644 "$here/budsin_paypal.py" /opt/budsin-paypal/budsin_paypal.py

if [ ! -f "$envfile" ]; then
  install -m 0640 -o root -g budsin-paypal "$here/env.example" "$envfile"
  echo "Creado $envfile (falta el Secret: ejecuta budsin-paypal-set-secret)"
fi

cat > /usr/local/sbin/budsin-paypal-set-secret <<'SH'
#!/usr/bin/env bash
# Guarda el Secret de PayPal sin que aparezca en pantalla ni en el historial.
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Ejecuta con sudo"; exit 1; }
read -rsp "PayPal Secret: " secret; echo
[ -n "$secret" ] || { echo "Vacío, no se cambia nada"; exit 1; }
python3 - "$secret" <<'PY'
import re, sys
p = "/etc/budsin-paypal.env"
t = open(p).read()
line = "PAYPAL_SECRET=" + sys.argv[1]
t = re.sub(r"^PAYPAL_SECRET=.*$", lambda m: line, t, flags=re.M) if re.search(r"^PAYPAL_SECRET=", t, re.M) else t + "\n" + line + "\n"
open(p, "w").write(t)
PY
chmod 0640 /etc/budsin-paypal.env
systemctl restart budsin-paypal
echo "Secret guardado y servicio reiniciado."
SH
chmod 0755 /usr/local/sbin/budsin-paypal-set-secret

install -m 0644 "$here/budsin-paypal.service" /etc/systemd/system/budsin-paypal.service
systemctl daemon-reload
systemctl enable budsin-paypal >/dev/null
systemctl restart budsin-paypal

if grep -q '/api/paypal/' "$caddyfile"; then
  echo "Caddy ya tiene la ruta /api/paypal/*"
else
  anchor=$'\tencode gzip zstd'
  grep -qxF "$anchor" "$caddyfile" || { echo "No encuentro '$anchor' en $caddyfile; añade a mano el bloque de caddy-snippet.txt"; exit 1; }
  backup="$caddyfile.bak.$(date +%Y%m%d%H%M%S)"
  cp -a "$caddyfile" "$backup"
  python3 - "$caddyfile" "$here/caddy-snippet.txt" <<'PY'
import sys
path, snippet = sys.argv[1], open(sys.argv[2]).read().rstrip("\n")
t = open(path).read()
a = "\n\tencode gzip zstd"
assert t.count(a) == 1
open(path, "w").write(t.replace(a, "\n" + snippet + "\n" + a))
PY
  if caddy validate --config "$caddyfile" --adapter caddyfile >/dev/null 2>&1; then
    systemctl reload caddy
    echo "Caddy actualizado (copia de seguridad: $backup)"
  else
    cp -a "$backup" "$caddyfile"
    echo "El Caddyfile nuevo no valida; restaurado desde $backup. Nada cambió en Caddy."
    exit 1
  fi
fi

sleep 1
curl -fsS http://127.0.0.1:3101/api/paypal/health && echo
