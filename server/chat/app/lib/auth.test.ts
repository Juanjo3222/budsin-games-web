import { describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { verifyFirebaseToken } from "./auth";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });
const keys = async (kid: string) => (kid === "k1" ? publicKey : null);
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function jwt(payload: Record<string, unknown>, opts: { key?: typeof privateKey; kid?: string; alg?: string } = {}) {
  const head = enc({ alg: opts.alg ?? "RS256", kid: opts.kid ?? "k1", typ: "JWT" });
  const body = enc(payload);
  const sig = sign("RSA-SHA256", Buffer.from(`${head}.${body}`), opts.key ?? privateKey).toString("base64url");
  return `${head}.${body}.${sig}`;
}
const now = 1_800_000_000_000;
const good = { aud: "juanjo-games", iss: "https://securetoken.google.com/juanjo-games", sub: "uid1", exp: now / 1000 + 3600, iat: now / 1000 - 10, email: "Ana@X.com", email_verified: true, name: "Ana" };

describe("verifyFirebaseToken", () => {
  test("acepta un token válido", async () => {
    expect(await verifyFirebaseToken(jwt(good), "juanjo-games", keys, now)).toEqual({ uid: "uid1", email: "ana@x.com", emailVerified: true, name: "Ana" });
  });
  test("rechaza firma ajena, caducado, otro proyecto o sin kid conocido", async () => {
    expect(await verifyFirebaseToken(jwt(good, { key: other.privateKey }), "juanjo-games", keys, now)).toBeNull();
    expect(await verifyFirebaseToken(jwt({ ...good, exp: now / 1000 - 1 }), "juanjo-games", keys, now)).toBeNull();
    expect(await verifyFirebaseToken(jwt({ ...good, aud: "otro" }), "juanjo-games", keys, now)).toBeNull();
    expect(await verifyFirebaseToken(jwt({ ...good, iss: "https://securetoken.google.com/otro" }), "juanjo-games", keys, now)).toBeNull();
    expect(await verifyFirebaseToken(jwt(good, { kid: "zzz" }), "juanjo-games", keys, now)).toBeNull();
    expect(await verifyFirebaseToken(jwt({ ...good, sub: "" }), "juanjo-games", keys, now)).toBeNull();
  });
  test("rechaza alg none/HS256 y basura", async () => {
    expect(await verifyFirebaseToken(jwt(good, { alg: "none" }), "juanjo-games", keys, now)).toBeNull();
    expect(await verifyFirebaseToken(jwt(good, { alg: "HS256" }), "juanjo-games", keys, now)).toBeNull();
    for (const t of ["", "a.b", "a.b.c", "x".repeat(5000), "…"]) expect(await verifyFirebaseToken(t, "juanjo-games", keys, now)).toBeNull();
  });
  test("un payload manipulado no pasa", async () => {
    const [h, , s] = jwt(good).split(".");
    expect(await verifyFirebaseToken(`${h}.${enc({ ...good, sub: "admin" })}.${s}`, "juanjo-games", keys, now)).toBeNull();
  });
});
