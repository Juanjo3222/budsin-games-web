"""Pruebas del servicio contra PayPal y Google simulados (sin red ni credenciales reales)."""
import json
import os
import sys
import tempfile
import threading
import unittest
import urllib.request
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
import budsin_paypal as bp  # noqa: E402

PLAN = "P-TEST"
SUBS = {}
TOKENS = {"tok-ana": ("uid-ana", "ana@x.com"), "tok-beto": ("uid-beto", "beto@x.com")}
CALLS = {"sub": 0, "verify": 0}
VERIFY_RESULT = {"verification_status": "SUCCESS"}


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


class Fake(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def send(self, code, data):
        raw = json.dumps(data).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(raw)))
        self.end_headers()
        self.wfile.write(raw)

    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        if self.path.startswith("/v1/oauth2/token"):
            return self.send(200, {"access_token": "pp-token", "expires_in": 3600})
        if self.path.startswith("/lookup"):
            tok = json.loads(body).get("idToken")
            if tok in TOKENS:
                return self.send(200, {"users": [{"localId": TOKENS[tok][0], "email": TOKENS[tok][1]}]})
            return self.send(400, {"error": {"message": "INVALID_ID_TOKEN"}})
        if self.path.startswith("/v1/notifications/verify-webhook-signature"):
            CALLS["verify"] += 1
            return self.send(200, VERIFY_RESULT)
        self.send(404, {})

    def do_GET(self):
        if self.path.startswith("/v1/billing/subscriptions/"):
            CALLS["sub"] += 1
            sub = SUBS.get(self.path.rsplit("/", 1)[1])
            return self.send(200, sub) if sub else self.send(404, {})
        self.send(404, {})


def sub(owner="uid-ana", status="ACTIVE", plan=PLAN, days=30):
    return {"plan_id": plan, "status": status, "custom_id": owner,
            "subscriber": {"email_address": "ana@x.com"},
            "billing_info": {"next_billing_time": iso(datetime.now(timezone.utc) + timedelta(days=days))}}


def call(base, method, path, token=None, body=None, headers=None):
    req = urllib.request.Request(base + path, method=method,
                                 data=json.dumps(body).encode() if body is not None else None)
    if token:
        req.add_header("Authorization", "Bearer " + token)
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req) as r:
            return r.status, json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read() or b"{}")


class ServiceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.fake = HTTPServer(("127.0.0.1", 0), Fake)
        threading.Thread(target=cls.fake.serve_forever, daemon=True).start()
        fp = "http://127.0.0.1:%d" % cls.fake.server_port
        os.environ.update({
            "PAYPAL_API_BASE": fp, "PAYPAL_CLIENT_ID": "cid", "PAYPAL_SECRET": "sec", "PAYPAL_PLAN_ID": PLAN,
            "PAYPAL_WEBHOOK_ID": "WH-1", "FIREBASE_API_KEY": "key", "FIREBASE_LOOKUP_URL": fp + "/lookup",
            "DB_PATH": os.path.join(tempfile.mkdtemp(), "t.sqlite3"), "PORT": "0",
        })
        cfg = bp.Config()
        cls.svc = bp.Service(cfg)
        cls.api = bp.ThreadingHTTPServer(("127.0.0.1", 0), bp.make_handler(cls.svc))
        threading.Thread(target=cls.api.serve_forever, daemon=True).start()
        cls.base = "http://127.0.0.1:%d/api/paypal" % cls.api.server_port

    @classmethod
    def tearDownClass(cls):
        for s in (cls.fake, cls.api):
            s.shutdown()
            s.server_close()

    def test_health_sin_token(self):
        code, body = call(self.base, "GET", "/health")
        self.assertEqual((code, body["configured"], body["webhook"]), (200, True, True))

    def test_status_requiere_token_valido(self):
        self.assertEqual(call(self.base, "GET", "/status")[0], 401)
        self.assertEqual(call(self.base, "GET", "/status", "tok-falso")[0], 401)

    def test_usuario_sin_suscripcion_no_es_pro(self):
        code, body = call(self.base, "GET", "/status", "tok-beto")
        self.assertEqual((code, body["pro"]), (200, False))

    def test_suscripcion_valida_activa_pro(self):
        SUBS["I-OK"] = sub()
        code, body = call(self.base, "POST", "/subscribe", "tok-ana", {"subscriptionId": "I-OK"})
        self.assertEqual(code, 200, body)
        self.assertTrue(body["pro"])
        self.assertEqual(body["subscriptionStatus"], "ACTIVE")
        self.assertTrue(call(self.base, "GET", "/status", "tok-ana")[1]["pro"])
        self.assertFalse(call(self.base, "GET", "/status", "tok-beto")[1]["pro"])

    def test_plan_equivocado_se_rechaza(self):
        SUBS["I-PLAN"] = sub(plan="P-OTRO")
        self.assertEqual(call(self.base, "POST", "/subscribe", "tok-ana", {"subscriptionId": "I-PLAN"})[0], 400)

    def test_suscripcion_de_otro_usuario_se_rechaza(self):
        SUBS["I-AJENA"] = sub(owner="uid-beto")
        code, body = call(self.base, "POST", "/subscribe", "tok-ana", {"subscriptionId": "I-AJENA"})
        self.assertEqual((code, body["error"]), (403, "not_your_subscription"))
        self.assertIsNone(self.svc.store.get("I-AJENA"))

    def test_suscripcion_pendiente_no_da_pro(self):
        SUBS["I-PEND"] = sub(owner="uid-beto", status="APPROVAL_PENDING")
        code, body = call(self.base, "POST", "/subscribe", "tok-beto", {"subscriptionId": "I-PEND"})
        self.assertEqual((code, body["pro"], body["subscriptionStatus"]), (200, False, "APPROVAL_PENDING"))

    def test_id_malformado_y_inexistente(self):
        self.assertEqual(call(self.base, "POST", "/subscribe", "tok-ana", {"subscriptionId": "../x"})[0], 400)
        self.assertEqual(call(self.base, "POST", "/subscribe", "tok-ana", {"subscriptionId": "I-NO"})[0], 404)

    def test_cancelada_conserva_hasta_fin_del_periodo_pagado(self):
        SUBS["I-CAN"] = sub(owner="uid-ana")
        call(self.base, "POST", "/subscribe", "tok-ana", {"subscriptionId": "I-CAN"})
        SUBS["I-CAN"] = {"plan_id": PLAN, "status": "CANCELLED", "custom_id": "uid-ana", "billing_info": {}}
        before = self.svc.store.get("I-CAN")["paid_until"]
        self.svc.refresh("I-CAN")
        row = self.svc.store.get("I-CAN")
        self.assertEqual((row["status"], row["paid_until"]), ("CANCELLED", before))

    def test_expirada_ya_no_es_pro(self):
        SUBS["I-OLD"] = sub(owner="uid-beto", days=-10)
        code, body = call(self.base, "POST", "/subscribe", "tok-beto", {"subscriptionId": "I-OLD"})
        self.assertEqual((code, body["pro"]), (200, False))

    def test_webhook_firma_valida_refresca(self):
        SUBS["I-WH"] = sub(owner="uid-beto")
        hdr = {k: "x" for k in ["PayPal-Auth-Algo", "PayPal-Cert-Url", "PayPal-Transmission-Id",
                                "PayPal-Transmission-Sig", "PayPal-Transmission-Time"]}
        ev = {"event_type": "BILLING.SUBSCRIPTION.ACTIVATED", "resource": {"id": "I-WH"}}
        VERIFY_RESULT["verification_status"] = "SUCCESS"
        self.assertEqual(call(self.base, "POST", "/webhook", body=ev, headers=hdr)[0], 200)
        self.assertEqual(self.svc.store.get("I-WH")["status"], "ACTIVE")

    def test_webhook_firma_invalida_se_rechaza(self):
        SUBS["I-WH2"] = sub(owner="uid-beto")
        hdr = {k: "x" for k in ["PayPal-Auth-Algo", "PayPal-Cert-Url", "PayPal-Transmission-Id",
                                "PayPal-Transmission-Sig", "PayPal-Transmission-Time"]}
        ev = {"event_type": "BILLING.SUBSCRIPTION.ACTIVATED", "resource": {"id": "I-WH2"}}
        VERIFY_RESULT["verification_status"] = "FAILURE"
        try:
            self.assertEqual(call(self.base, "POST", "/webhook", body=ev, headers=hdr)[0], 400)
            self.assertIsNone(self.svc.store.get("I-WH2"))
        finally:
            VERIFY_RESULT["verification_status"] = "SUCCESS"

    def test_webhook_sin_cabeceras_se_rechaza(self):
        self.assertEqual(call(self.base, "POST", "/webhook", body={"event_type": "X"})[0], 400)

    def test_cors_solo_origen_permitido(self):
        req = urllib.request.Request(self.base + "/health", headers={"Origin": "https://games.budsin.dev"})
        self.assertEqual(urllib.request.urlopen(req).headers["Access-Control-Allow-Origin"], "https://games.budsin.dev")
        req = urllib.request.Request(self.base + "/health", headers={"Origin": "https://malo.example"})
        self.assertIsNone(urllib.request.urlopen(req).headers["Access-Control-Allow-Origin"])


class SinConfigurar(unittest.TestCase):
    def test_sin_secret_responde_503(self):
        keep = {k: os.environ.pop(k) for k in ("PAYPAL_SECRET",)}
        try:
            cfg = bp.Config()
            svc = bp.Service(cfg)
            srv = bp.ThreadingHTTPServer(("127.0.0.1", 0), bp.make_handler(svc))
            threading.Thread(target=srv.serve_forever, daemon=True).start()
            base = "http://127.0.0.1:%d/api/paypal" % srv.server_port
            self.assertEqual(call(base, "GET", "/status", "tok-ana")[0], 503)
            self.assertFalse(call(base, "GET", "/health")[1]["configured"])
            srv.shutdown()
            srv.server_close()
        finally:
            os.environ.update(keep)


if __name__ == "__main__":
    unittest.main()
