// Verifica el token de Firebase Auth (un JWT RS256 firmado por Google) sin depender de ninguna librería.
// Las claves públicas salen de los certificados de https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com
// y se guardan en memoria el tiempo que indique su Cache-Control.
import { createPublicKey, verify, type KeyObject } from "node:crypto";

export interface Claims {
  uid: string;
  email: string;
  emailVerified: boolean;
  name: string;
}

export type KeyProvider = (kid: string) => Promise<KeyObject | null>;

const CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

export function googleKeyProvider(fetchImpl: typeof fetch = fetch): KeyProvider {
  let keys = new Map<string, KeyObject>();
  let expires = 0;
  let lastTry = 0;
  async function refresh(): Promise<void> {
    lastTry = Date.now();
    const res = await fetchImpl(CERTS_URL, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) throw new Error(`certs HTTP ${res.status}`);
    const maxAge = Number(/max-age=(\d+)/.exec(res.headers.get("cache-control") ?? "")?.[1]) || 3600;
    const pems = (await res.json()) as Record<string, string>;
    const next = new Map<string, KeyObject>();
    for (const [kid, pem] of Object.entries(pems)) next.set(kid, createPublicKey(pem));
    keys = next;
    expires = Date.now() + maxAge * 1000;
  }
  return async (kid) => {
    if (Date.now() > expires || (!keys.has(kid) && Date.now() - lastTry > 60_000)) await refresh().catch(() => {});
    return keys.get(kid) ?? null;
  };
}

const b64 = (s: string) => Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/"), "base64");

export async function verifyFirebaseToken(token: string, projectId: string, keys: KeyProvider, now = Date.now()): Promise<Claims | null> {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 3 || token.length > 4096) return null;
  try {
    const header = JSON.parse(b64(parts[0]).toString("utf8"));
    if (header.alg !== "RS256" || typeof header.kid !== "string") return null;
    const key = await keys(header.kid);
    if (!key) return null;
    const ok = verify("RSA-SHA256", Buffer.from(`${parts[0]}.${parts[1]}`), key, b64(parts[2]));
    if (!ok) return null;
    const p = JSON.parse(b64(parts[1]).toString("utf8"));
    const sec = Math.floor(now / 1000);
    if (p.aud !== projectId || p.iss !== `https://securetoken.google.com/${projectId}`) return null;
    if (typeof p.sub !== "string" || !p.sub || p.sub.length > 128) return null;
    if (typeof p.exp !== "number" || p.exp <= sec) return null;
    if (typeof p.iat === "number" && p.iat > sec + 120) return null;
    return { uid: p.sub, email: String(p.email ?? "").toLowerCase(), emailVerified: p.email_verified === true, name: String(p.name ?? "") };
  } catch {
    return null;
  }
}
