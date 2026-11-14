#!/usr/bin/env python3
"""Budsin Pro por PayPal: servicio de suscripciones.

Solo biblioteca estándar de Python 3 (sin dependencias que instalar).

- La identidad del usuario sale de Firebase Auth: el token de sesión se valida contra
  `accounts:lookup` de Google. Este servicio no escribe nada en Firebase.
- PayPal es la fuente de verdad: nunca se cree lo que diga el navegador. Cada suscripción se
  consulta a la API de PayPal con el Secret y se comprueba plan, estado y propietario.
- Guarda las suscripciones en SQLite y expone GET /status, POST /subscribe y POST /webhook.

Configuración por variables de entorno (ver env.example). El Secret nunca va en el repositorio.
"""
import base64
import contextlib
import hashlib
import json
import os
import sqlite3
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

PREFIX = "/api/paypal"
GRACE_SECONDS = 2 * 24 * 3600          # margen tras la fecha de cobro por si PayPal tarda en cobrar
FALLBACK_PERIOD = 32 * 24 * 3600       # si PayPal no informa del próximo cobro
STATUS_TTL = 3600                      # cada cuánto se vuelve a preguntar a PayPal por /status
TOKEN_TTL = 300                        # caché de tokens de Firebase ya validados
MAX_BODY = 64 * 1024
RATE_LIMIT = 40                        # peticiones por minuto y por IP


def env(name, default=""):
    return os.environ.get(name, default).strip()


class Config:
    def __init__(self):
        self.host = env("HOST", "127.0.0.1")
        self.port = int(env("PORT", "3101"))
        self.db_path = env("DB_PATH", "/var/lib/budsin-paypal/subs.sqlite3")
        self.paypal_api = env("PAYPAL_API_BASE", "https://api-m.sandbox.paypal.com").rstrip("/")
        self.client_id = env("PAYPAL_CLIENT_ID")
        self.secret = env("PAYPAL_SECRET")
        self.plan_id = env("PAYPAL_PLAN_ID")
        self.webhook_id = env("PAYPAL_WEBHOOK_ID")
        self.firebase_key = env("FIREBASE_API_KEY")
        self.lookup_url = env("FIREBASE_LOOKUP_URL", "https://identitytoolkit.googleapis.com/v1/accounts:lookup")
        self.origins = [o.strip() for o in env("ALLOWED_ORIGINS", "https://games.budsin.dev").split(",") if o.strip()]

    def configured(self):
        return bool(self.client_id and self.secret and self.plan_id and self.firebase_key)


class HttpError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def http_json(url, data=None, headers=None, method=None, timeout=15):
    body = None
    hdrs = dict(headers or {})
    if data is not None:
        body = data if isinstance(data, bytes) else json.dumps(data).encode()
        hdrs.setdefault("Content-Type", "application/json")
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            return resp.status, (json.loads(raw) if raw else {})
    except urllib.error.HTTPError as err:
        raw = err.read()
        try:
            return err.code, json.loads(raw) if raw else {}
        except ValueError:
            return err.code, {}


def parse_time(value):
    if not value:
        return 0
    try:
        return int(datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp())
    except ValueError:
        return 0


def iso(ts):
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ") if ts else None


class Store:
    def __init__(self, path):
        self.path = path
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        with self.conn() as db:
            db.execute(
                """CREATE TABLE IF NOT EXISTS subs (
                    sub_id TEXT PRIMARY KEY, uid TEXT NOT NULL, email TEXT, status TEXT,
                    plan_id TEXT, paid_until INTEGER NOT NULL DEFAULT 0,
                    last_checked INTEGER NOT NULL DEFAULT 0, created INTEGER NOT NULL)"""
            )
            db.execute("CREATE INDEX IF NOT EXISTS subs_uid ON subs(uid)")

    @contextlib.contextmanager
    def conn(self):
        """Conexión por operación: confirma al salir y siempre se cierra."""
        db = sqlite3.connect(self.path, timeout=10)
        db.row_factory = sqlite3.Row
        try:
            db.execute("PRAGMA journal_mode=WAL")
            with db:
                yield db
        finally:
            db.close()

    def get(self, sub_id):
        with self.conn() as db:
            return db.execute("SELECT * FROM subs WHERE sub_id=?", (sub_id,)).fetchone()

    def for_uid(self, uid):
        with self.conn() as db:
            return db.execute("SELECT * FROM subs WHERE uid=? ORDER BY paid_until DESC", (uid,)).fetchall()

    def save(self, sub_id, uid, email, status, plan_id, paid_until):
        now = int(time.time())
        with self.conn() as db:
            db.execute(
                """INSERT INTO subs (sub_id, uid, email, status, plan_id, paid_until, last_checked, created)
                   VALUES (?,?,?,?,?,?,?,?)
                   ON CONFLICT(sub_id) DO UPDATE SET status=excluded.status, plan_id=excluded.plan_id,
                     paid_until=excluded.paid_until, last_checked=excluded.last_checked,
                     email=COALESCE(excluded.email, subs.email)""",
                (sub_id, uid, email, status, plan_id, paid_until, now, now),
            )


class Service:
    def __init__(self, cfg):
        self.cfg = cfg
        self.store = Store(cfg.db_path)
        self._pp_token = ("", 0)
        self._tokens = {}
        self._hits = {}
        self._lock = threading.Lock()

    # --- identidad (Firebase Auth) -------------------------------------------------
    def verify_user(self, bearer):
        if not bearer or not bearer.lower().startswith("bearer "):
            raise HttpError(401, "missing_token")
        token = bearer[7:].strip()
        key = hashlib.sha256(token.encode()).hexdigest()
        now = time.time()
        with self._lock:
            hit = self._tokens.get(key)
            if hit and hit[2] > now:
                return hit[0], hit[1]
        status, data = http_json(f"{self.cfg.lookup_url}?key={self.cfg.firebase_key}", {"idToken": token})
        users = data.get("users") if isinstance(data, dict) else None
        if status != 200 or not users:
            raise HttpError(401, "invalid_token")
        uid, email = users[0].get("localId"), users[0].get("email")
        if not uid:
            raise HttpError(401, "invalid_token")
        with self._lock:
            self._tokens = {k: v for k, v in self._tokens.items() if v[2] > now}
            self._tokens[key] = (uid, email, now + TOKEN_TTL)
        return uid, email

    # --- PayPal ---------------------------------------------------------------------
    def paypal_token(self):
        token, exp = self._pp_token
        if token and exp > time.time() + 30:
            return token
        basic = base64.b64encode(f"{self.cfg.client_id}:{self.cfg.secret}".encode()).decode()
        status, data = http_json(
            f"{self.cfg.paypal_api}/v1/oauth2/token",
            b"grant_type=client_credentials",
            {"Authorization": f"Basic {basic}", "Content-Type": "application/x-www-form-urlencoded"},
            "POST",
        )
        if status != 200 or "access_token" not in data:
            raise HttpError(502, "paypal_auth_failed")
        self._pp_token = (data["access_token"], time.time() + int(data.get("expires_in", 300)))
        return self._pp_token[0]

    def paypal_get(self, path):
        return http_json(f"{self.cfg.paypal_api}{path}", headers={"Authorization": f"Bearer {self.paypal_token()}"})

    def paypal_post(self, path, body):
        return http_json(f"{self.cfg.paypal_api}{path}", body, {"Authorization": f"Bearer {self.paypal_token()}"}, "POST")

    def refresh(self, sub_id, expect_uid=None):
        """Consulta la suscripción a PayPal y actualiza la base. Devuelve la fila guardada."""
        if not sub_id or not all(c.isalnum() or c in "-_" for c in sub_id) or len(sub_id) > 64:
            raise HttpError(400, "bad_subscription_id")
        status, sub = self.paypal_get(f"/v1/billing/subscriptions/{sub_id}")
        if status == 404:
            raise HttpError(404, "subscription_not_found")
        if status != 200:
            raise HttpError(502, "paypal_error")
        if sub.get("plan_id") != self.cfg.plan_id:
            raise HttpError(400, "wrong_plan")
        owner = sub.get("custom_id") or ""
        if expect_uid is not None and owner != expect_uid:
            raise HttpError(403, "not_your_subscription")
        known = self.store.get(sub_id)
        uid = known["uid"] if known else owner
        if not uid:
            raise HttpError(400, "no_owner")
        if known and expect_uid is not None and known["uid"] != expect_uid:
            raise HttpError(403, "not_your_subscription")
        state = sub.get("status", "")
        paid_until = known["paid_until"] if known else 0
        if state == "ACTIVE":
            info = sub.get("billing_info") or {}
            nxt = parse_time(info.get("next_billing_time"))
            last = parse_time((info.get("last_payment") or {}).get("time"))
            base = nxt or (last + FALLBACK_PERIOD if last else int(time.time()) + FALLBACK_PERIOD)
            paid_until = max(paid_until, base + GRACE_SECONDS)
        email = (sub.get("subscriber") or {}).get("email_address")
        self.store.save(sub_id, uid, email, state, sub.get("plan_id"), paid_until)
        return self.store.get(sub_id)

    # --- API ------------------------------------------------------------------------
    def status_for(self, uid):
        now = int(time.time())
        rows = self.store.for_uid(uid)
        best = None
        for row in rows:
            if row["status"] == "ACTIVE" and now - row["last_checked"] > STATUS_TTL:
                try:
                    row = self.refresh(row["sub_id"])
                except HttpError:
                    pass  # si PayPal no responde se conserva el último dato conocido
            if best is None or row["paid_until"] > best["paid_until"]:
                best = row
        if not best:
            return {"pro": False, "paidUntil": None, "status": None}
        return {
            "pro": best["paid_until"] > now,
            "paidUntil": iso(best["paid_until"]),
            "status": best["status"],
            "active": best["status"] == "ACTIVE",
        }

    def subscribe(self, uid, sub_id):
        row = self.refresh(sub_id, expect_uid=uid)
        out = self.status_for(uid)
        out["subscriptionStatus"] = row["status"]
        return out

    def cancel(self, uid):
        """Cancela la suscripción activa del usuario. El Pro sigue hasta el fin del periodo pagado."""
        active = [r for r in self.store.for_uid(uid) if r["status"] == "ACTIVE"]
        if not active:
            raise HttpError(404, "no_active_subscription")
        for row in active:
            status, _ = self.paypal_post(f"/v1/billing/subscriptions/{row['sub_id']}/cancel",
                                         {"reason": "Cancelado por el usuario desde Budsin Games"})
            if status not in (200, 204, 422):  # 422: ya estaba cancelada
                raise HttpError(502, "paypal_cancel_failed")
            self.refresh(row["sub_id"])
        return self.status_for(uid)

    def webhook(self, headers, raw_body):
        if not self.cfg.webhook_id:
            raise HttpError(503, "webhook_not_configured")
        try:
            event = json.loads(raw_body)
        except ValueError:
            raise HttpError(400, "bad_json")
        need = ["paypal-auth-algo", "paypal-cert-url", "paypal-transmission-id",
                "paypal-transmission-sig", "paypal-transmission-time"]
        if any(not headers.get(h) for h in need):
            raise HttpError(400, "missing_signature_headers")
        status, res = http_json(
            f"{self.cfg.paypal_api}/v1/notifications/verify-webhook-signature",
            {
                "auth_algo": headers["paypal-auth-algo"],
                "cert_url": headers["paypal-cert-url"],
                "transmission_id": headers["paypal-transmission-id"],
                "transmission_sig": headers["paypal-transmission-sig"],
                "transmission_time": headers["paypal-transmission-time"],
                "webhook_id": self.cfg.webhook_id,
                "webhook_event": event,
            },
            {"Authorization": f"Bearer {self.paypal_token()}"},
            "POST",
        )
        if status != 200 or res.get("verification_status") != "SUCCESS":
            raise HttpError(400, "bad_signature")
        kind = event.get("event_type", "")
        res_obj = event.get("resource") or {}
        sub_id = res_obj.get("billing_agreement_id") if kind.startswith("PAYMENT.") else res_obj.get("id")
        if sub_id and (kind.startswith("BILLING.SUBSCRIPTION.") or kind == "PAYMENT.SALE.COMPLETED"):
            try:
                self.refresh(sub_id)
            except HttpError as err:
                if err.status >= 500:
                    raise
        return {"ok": True}

    def rate_ok(self, ip):
        now = time.time()
        with self._lock:
            hits = [t for t in self._hits.get(ip, []) if now - t < 60]
            hits.append(now)
            self._hits[ip] = hits
            if len(self._hits) > 5000:
                self._hits = {k: v for k, v in self._hits.items() if v and now - v[-1] < 60}
        return len(hits) <= RATE_LIMIT


def make_handler(svc):
    class Handler(BaseHTTPRequestHandler):
        server_version = "BudsinPaypal"
        sys_version = ""

        def log_message(self, fmt, *args):
            sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))

        def cors(self):
            origin = self.headers.get("Origin", "")
            if origin in svc.cfg.origins:
                self.send_header("Access-Control-Allow-Origin", origin)
                self.send_header("Vary", "Origin")
                self.send_header("Access-Control-Allow-Headers", "Authorization, Content-Type")
                self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
                self.send_header("Access-Control-Max-Age", "600")

        def reply(self, status, payload):
            raw = json.dumps(payload).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Cache-Control", "no-store")
            self.send_header("CDN-Cache-Control", "no-store")
            self.send_header("Cloudflare-CDN-Cache-Control", "no-store")
            self.send_header("Content-Length", str(len(raw)))
            self.cors()
            self.end_headers()
            self.wfile.write(raw)

        def client_ip(self):
            return self.headers.get("CF-Connecting-IP") or self.headers.get("X-Forwarded-For", "").split(",")[0].strip() or self.client_address[0]

        def read_body(self):
            try:
                length = int(self.headers.get("Content-Length", "0"))
            except ValueError:
                raise HttpError(400, "bad_length")
            if length > MAX_BODY:
                raise HttpError(413, "too_large")
            return self.rfile.read(length) if length else b""

        def route(self, method):
            path = self.path.split("?", 1)[0]
            if not path.startswith(PREFIX):
                raise HttpError(404, "not_found")
            sub = path[len(PREFIX):] or "/"
            if method == "GET" and sub == "/health":
                return {"ok": True, "configured": svc.cfg.configured(),
                        "webhook": bool(svc.cfg.webhook_id), "env": "sandbox" if "sandbox" in svc.cfg.paypal_api else "live"}
            if not svc.cfg.configured():
                raise HttpError(503, "not_configured")
            if not svc.rate_ok(self.client_ip()):
                raise HttpError(429, "rate_limited")
            if method == "GET" and sub == "/status":
                uid, _ = svc.verify_user(self.headers.get("Authorization"))
                return svc.status_for(uid)
            if method == "POST" and sub == "/subscribe":
                uid, _ = svc.verify_user(self.headers.get("Authorization"))
                try:
                    body = json.loads(self.read_body() or b"{}")
                except ValueError:
                    raise HttpError(400, "bad_json")
                return svc.subscribe(uid, str(body.get("subscriptionId", "")))
            if method == "POST" and sub == "/cancel":
                uid, _ = svc.verify_user(self.headers.get("Authorization"))
                return svc.cancel(uid)
            if method == "POST" and sub == "/webhook":
                headers = {k.lower(): v for k, v in self.headers.items()}
                return svc.webhook(headers, self.read_body())
            raise HttpError(404, "not_found")

        def handle_any(self, method):
            try:
                self.reply(200, self.route(method))
            except HttpError as err:
                self.reply(err.status, {"error": err.message})
            except Exception as err:  # no filtrar detalles al cliente
                sys.stderr.write("error: %r\n" % (err,))
                self.reply(500, {"error": "internal"})

        def do_GET(self):
            self.handle_any("GET")

        def do_POST(self):
            self.handle_any("POST")

        def do_OPTIONS(self):
            self.send_response(204)
            self.cors()
            self.end_headers()

    return Handler


def main():
    cfg = Config()
    svc = Service(cfg)
    srv = ThreadingHTTPServer((cfg.host, cfg.port), make_handler(svc))
    sys.stderr.write("budsin-paypal en %s:%d (%s, configurado=%s)\n" % (
        cfg.host, cfg.port, "sandbox" if "sandbox" in cfg.paypal_api else "live", cfg.configured()))
    srv.serve_forever()


if __name__ == "__main__":
    main()
