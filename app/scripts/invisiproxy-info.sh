#!/usr/bin/env bash
# Escribe public/webblox/proxy.json con la ruta del Wisp de InvisiProxy (se aleatoriza en cada build). Ejecutar en el VPS
# después de construir InvisiProxy:  bash invisiproxy-info.sh
set -euo pipefail
state=${INVISI_STATE:-/opt/invisiproxy/app/views/dist/.obfuscation.json}
out=${WEBBLOX_DIR:-/var/www/budsin-games-web/public/webblox}/proxy.json
python3 - "$state" "$out" <<'PY'
import json, sys
aliases = json.load(open(sys.argv[1]))["aliases"]
wisp = aliases.get("prefixes/wisp", "wisp")
json.dump({"wisp": f"/{wisp}/"}, open(sys.argv[2], "w"))
print(f"{sys.argv[2]} -> /{wisp}/")
PY
chown --reference="$(dirname "$out")" "$out" 2>/dev/null || true
chmod 644 "$out"
