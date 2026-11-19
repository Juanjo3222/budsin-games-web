import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ChatDb } from "./db";
import { createChatServer } from "./server";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"]).status === 0;
const d = hasFfmpeg ? describe : describe.skip;

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(uid: string, email = `${uid}@x.com`) {
  const head = enc({ alg: "RS256", kid: "k1" });
  const body = enc({ aud: "juanjo-games", iss: "https://securetoken.google.com/juanjo-games", sub: uid, exp: Math.floor(Date.now() / 1000) + 90 * 24 * 3600, iat: Math.floor(Date.now() / 1000) - 5, email, email_verified: true });
  return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url")}`;
}
const ff = (args: string[]) => Buffer.from(spawnSync("ffmpeg", ["-v", "error", "-y", ...args, "pipe:1"], { maxBuffer: 50_000_000 }).stdout);

let clock = Date.now();
let nsfw = 0.01;
let scannerDown = false;
const scanned: number[] = [];
const mediaDir = mkdtempSync(path.join(tmpdir(), "bchat-test-"));
const db = new ChatDb(":memory:");
const chat = createChatServer({
  db, projectId: "juanjo-games", keys: async (k) => (k === "k1" ? publicKey : null), adminEmails: ["boss@x.com"], origins: ["https://games.budsin.dev"], now: () => clock, mediaDir, imagesEnabled: true,
  scan: async (b) => { scanned.push(b.length); if (scannerDown) throw new Error("down"); return nsfw; },
});
const base = `http://127.0.0.1:${chat.port}`;
afterAll(() => chat.stop());

class Client {
  ws!: WebSocket; inbox: any[] = []; waiters: ((m: any) => boolean)[] = [];
  static async open(): Promise<Client> {
    const c = new Client();
    c.ws = new WebSocket(`ws://127.0.0.1:${chat.port}/api/chat/ws`, { headers: { origin: "https://games.budsin.dev" } } as any);
    c.ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); c.inbox.push(m); c.waiters = c.waiters.filter((w) => !w(m)); };
    await new Promise<void>((res, rej) => { c.ws.onopen = () => res(); c.ws.onerror = () => rej(new Error("ws")); });
    return c;
  }
  send(o: unknown) { this.ws.send(JSON.stringify(o)); }
  next(pred: (m: any) => boolean, ms = 3000): Promise<any> {
    const hit = this.inbox.find(pred);
    if (hit) { this.inbox.splice(this.inbox.indexOf(hit), 1); return Promise.resolve(hit); }
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout; inbox=" + JSON.stringify(this.inbox.slice(-3)))), ms);
      this.waiters.push((m) => { if (!pred(m)) return false; clearTimeout(t); this.inbox.splice(this.inbox.indexOf(m), 1); res(m); return true; });
    });
  }
  async req(o: unknown, pred: (m: any) => boolean) { this.inbox = this.inbox.filter((m) => !pred(m)); this.send(o); return this.next(pred); }
  close() { this.ws.close(); }
}
async function user(uid: string, name: string, email?: string) {
  const c = await Client.open();
  c.send({ t: "auth", token: token(uid, email) });
  await c.next((m) => m.t === "hello");
  expect((await c.req({ t: "profile", username: name, avatar: "a02" }, (m) => m.t === "me" || m.t === "err")).t).toBe("me");
  return c;
}
async function up(uid: string, kind: string, body: Uint8Array, room = "global", email?: string) {
  const res = await fetch(`${base}/api/chat/upload?kind=${kind}&room=${encodeURIComponent(room)}`, { method: "POST", headers: { authorization: `Bearer ${token(uid, email)}`, origin: "https://games.budsin.dev" }, body });
  return { status: res.status, json: (await res.json()) as any };
}

let png: Buffer, wav: Buffer;
beforeAll(() => {
  if (!hasFfmpeg) return;
  png = ff(["-f", "lavfi", "-i", "testsrc=size=640x480", "-frames:v", "1", "-f", "image2pipe", "-c:v", "png"]);
  wav = ff(["-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-f", "wav"]);
});

d("subir imágenes", () => {
  let ana: Client, beto: Client;
  beforeAll(async () => {
    ana = await user("m1", "Ana_Med"); beto = await user("m2", "Beto_Med");
    for (const c of [ana, beto]) await c.req({ t: "join", room: "global" }, (m) => m.t === "joined");
  });
  afterAll(() => { ana.close(); beto.close(); });

  test("sin token, o con origen ajeno, no se sube nada", async () => {
    expect((await fetch(`${base}/api/chat/upload?kind=image&room=global`, { method: "POST", body: png })).status).toBe(401);
    const bad = await fetch(`${base}/api/chat/upload?kind=image&room=global`, { method: "POST", headers: { authorization: `Bearer ${token("m1")}`, origin: "https://malo.example" }, body: png });
    expect(bad.status).toBe(403);
    expect((await up("m1", "video", png)).status).toBe(400);
  });
  test("una cuenta recién creada todavía no puede subir (30 min)", async () => {
    const r = await up("m1", "image", png);
    expect([r.status, r.json.error]).toEqual([403, "media_new_account"]);
    clock += 31 * 60_000;
  });
  test("sube una imagen: se re-codifica a WebP, pasa por el detector y se sirve con cabeceras seguras", async () => {
    const before = scanned.length;
    const r = await up("m1", "image", png);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ kind: "image", w: 640, h: 480 });
    expect(scanned.length).toBe(before + 1);
    const res = await fetch(`${base}/api/chat/media/${r.json.id}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    expect(res.headers.get("x-content-type-options")).toBe("nosniff");
    expect(res.headers.get("content-security-policy")).toContain("sandbox");
    expect(new Uint8Array(await res.arrayBuffer()).slice(8, 12)).toEqual(new Uint8Array([0x57, 0x45, 0x42, 0x50]));   // "WEBP"
    expect(readdirSync(mediaDir).some((f) => f.startsWith(r.json.id))).toBe(true);
  });
  test("se pueden pedir rangos (necesario para el audio)", async () => {
    clock += 60_000;
    const r = await up("m1", "image", png);
    const part = await fetch(`${base}/api/chat/media/${r.json.id}`, { headers: { range: "bytes=0-99" } });
    expect(part.status).toBe(206);
    expect((await part.arrayBuffer()).byteLength).toBe(100);
    expect((await fetch(`${base}/api/chat/media/${"0".repeat(32)}`)).status).toBe(404);
    expect((await fetch(`${base}/api/chat/media/../../etc/passwd`)).status).toBe(404);
  });
  test("ritmo: una imagen cada 15 s", async () => {
    clock += 60_000;
    expect((await up("m1", "image", png)).status).toBe(200);
    const r = await up("m1", "image", png);
    expect([r.status, r.json.error]).toEqual([429, "media_rate"]);
    clock += 16_000;
  });
  test("el detector bloquea: no se guarda nada y 3 bloqueos quitan el permiso de subir un día", async () => {
    const c3 = await user("m3", "Carla_Med");
    clock += 31 * 60_000;
    const files = readdirSync(mediaDir).length;
    nsfw = 0.9;
    try {
      const res: string[] = [];
      for (let i = 0; i < 3; i++) { clock += 20_000; res.push((await up("m3", "image", png)).json.error); }
      expect(res).toEqual(["media_blocked", "media_blocked", "media_blocked"]);
      clock += 20_000;
      expect((await up("m3", "image", png)).json.error).toBe("media_suspended");
      expect(readdirSync(mediaDir).length).toBe(files);            // nada se guardó
    } finally { nsfw = 0.01; c3.close(); }
  });
  test("si el detector no responde (o no existe) se rechaza: nunca pasa sin revisar", async () => {
    scannerDown = true;
    clock += 60_000;
    const r = await up("m1", "image", png);
    expect([r.status, r.json.error]).toEqual([503, "scan_unavailable"]);
    scannerDown = false;
  });
  test("archivos que no son imagen o son demasiado grandes", async () => {
    clock += 60_000;
    expect((await up("m1", "image", Buffer.from("<svg onload=alert(1)>"))).json.error).toBe("bad_media");
    clock += 60_000;
    const big = await fetch(`${base}/api/chat/upload?kind=image&room=global`, { method: "POST", headers: { authorization: `Bearer ${token("m1")}` }, body: Buffer.alloc(5_100_000, 1) });
    expect(big.status).toBe(413);
  });
  test("enviar la imagen en un mensaje: la otra persona la recibe; no se puede reenviar ni usar la de otro", async () => {
    clock += 60_000;
    const r = await up("m1", "image", png);
    ana.send({ t: "send", room: "global", media: r.json.id, text: "mira esto" });
    const got = await beto.next((m) => m.t === "msg" && m.m.media);
    expect(got.m).toMatchObject({ u: "Ana_Med", text: "mira esto", media: { id: r.json.id, kind: "image", w: 640, h: 480 } });
    clock += 30_000;
    expect((await ana.req({ t: "send", room: "global", media: r.json.id }, (m) => m.t === "err")).code).toBe("bad_media");        // ya se usó
    expect((await beto.req({ t: "send", room: "global", media: r.json.id }, (m) => m.t === "err")).code).toBe("bad_media");        // es de Ana
    // el pie de la imagen también pasa por el filtro
    clock += 60_000;
    const r2 = await up("m1", "image", png);
    expect((await ana.req({ t: "send", room: "global", media: r2.json.id, text: "mi numero 987654321" }, (m) => m.t === "err")).why).toBe("contact");
  });
  test("reportar una imagen la oculta al instante; solo un admin la ve; al restaurar vuelve", async () => {
    clock += 60_000;
    const r = await up("m1", "image", png);
    ana.send({ t: "send", room: "global", media: r.json.id });
    const msg = await beto.next((m) => m.t === "msg" && m.m.media?.id === r.json.id);
    const hidden = ana.next((m) => m.t === "media.hidden");
    await beto.req({ t: "report", id: msg.m.id, reason: "sexual" }, (m) => m.t === "reported");
    expect((await hidden).id).toBe(r.json.id);
    expect((await fetch(`${base}/api/chat/media/${r.json.id}`)).status).toBe(404);
    expect((await fetch(`${base}/api/chat/media/${r.json.id}`, { headers: { authorization: `Bearer ${token("m2")}` } })).status).toBe(404);   // un usuario normal no
    expect((await fetch(`${base}/api/chat/media/${r.json.id}`, { headers: { authorization: `Bearer ${token("boss", "boss@x.com")}` } })).status).toBe(200);   // el admin sí
    const boss = await Client.open(); boss.send({ t: "auth", token: token("boss", "boss@x.com") }); await boss.next((m) => m.t === "hello");
    const reps = await boss.req({ t: "admin.reports" }, (m) => m.t === "admin.reports");
    expect(reps.items.find((x: any) => x.media === r.json.id)).toMatchObject({ media_kind: "image", media_status: "hidden" });
    const back = beto.next((m) => m.t === "media.restored");
    await boss.req({ t: "admin.media.restore", id: r.json.id }, (m) => m.t === "ok");
    expect((await back).media.id).toBe(r.json.id);
    expect((await fetch(`${base}/api/chat/media/${r.json.id}`)).status).toBe(200);
    // historial: una imagen oculta llega marcada, sin ruta
    await boss.req({ t: "admin.media.delete", id: r.json.id }, (m) => m.t === "ok");
    expect((await fetch(`${base}/api/chat/media/${r.json.id}`)).status).toBe(404);
    boss.close();
  });
});

d("notas de voz", () => {
  let ana: Client, beto: Client;
  const ids: Record<string, string> = {};
  beforeAll(async () => {
    clock += 3600_000;
    ana = await user("a1", "Ana_Voz"); beto = await user("a2", "Beto_Voz");
    clock += 31 * 60_000;
  });
  afterAll(() => { ana.close(); beto.close(); });

  test("en la sala global y en las de juego NO hay audio", async () => {
    await ana.req({ t: "join", room: "global" }, (m) => m.t === "joined");
    const r = await up("a1", "audio", wav, "global");
    expect([r.status, r.json.error]).toEqual([403, "audio_not_allowed"]);
    const g = await ana.req({ t: "join", room: "game:pacman", name: "Pacman" }, (m) => m.t === "joined");
    expect((await up("a1", "audio", wav, g.room)).json.error).toBe("audio_not_allowed");
  });
  test("en un grupo de clase sí: se guarda como M4A y lo oyen los miembros", async () => {
    const made = await ana.req({ t: "class.create", name: "Clase de Voz" }, (m) => m.t === "class.created");
    await ana.req({ t: "join", room: made.item.key }, (m) => m.t === "joined");
    await beto.req({ t: "class.join", code: made.item.code }, (m) => m.t === "class.joined");
    await beto.req({ t: "join", room: made.item.key }, (m) => m.t === "joined");
    const r = await up("a1", "audio", wav, made.item.key);
    expect(r.status).toBe(200);
    expect(r.json.kind).toBe("audio");
    expect(r.json.dur).toBeGreaterThan(1.5);
    clock += 30_000;
    ana.send({ t: "send", room: made.item.key, media: r.json.id });
    const got = await beto.next((m) => m.t === "msg" && m.m.media?.kind === "audio");
    expect(got.m.media.dur).toBeGreaterThan(1.5);
    const f = await fetch(`${base}/api/chat/media/${r.json.id}`);
    expect(f.headers.get("content-type")).toBe("audio/mp4");
    expect(scanned.length).toBeGreaterThan(0);
    ids.class = made.item.key;
    // quien no es miembro no puede subir audio a ese grupo
    const eve = await user("a3", "Eve_Voz"); clock += 31 * 60_000;
    expect((await up("a3", "audio", wav, made.item.key)).json.error).toBe("forbidden");
    eve.close();
  });
  test("entre amigos (mensaje directo) sí; sin ser amigos no", async () => {
    await ana.req({ t: "friend.request", username: "Beto_Voz" }, (m) => m.t === "friends");
    clock += 40_000;
    const dm = "dm:a1:a2";
    expect((await up("a1", "audio", wav, dm)).json.error).toBe("dm_closed");
    await beto.req({ t: "friend.accept", uid: "a1" }, (m) => m.t === "friends" && m.friends.length === 1);
    await ana.req({ t: "dm.open", uid: "a2" }, (m) => m.t === "joined");
    expect((await up("a1", "audio", wav, dm)).status).toBe(200);
  });
  test("ritmo y archivos que no son audio", async () => {
    clock += 60_000;
    expect((await up("a1", "audio", png, ids.class)).json.error).toBe("bad_media");
    clock += 60_000;
    expect((await up("a1", "audio", wav, ids.class)).status).toBe(200);
    expect((await up("a1", "audio", wav, ids.class)).json.error).toBe("media_rate");
  });
});

d("stickers", () => {
  let ana: Client, beto: Client;
  beforeAll(async () => {
    clock += 3600_000 * 2;
    ana = await user("s1", "Ana_Stk"); beto = await user("s2", "Beto_Stk");
    for (const c of [ana, beto]) await c.req({ t: "join", room: "global" }, (m) => m.t === "joined");
    clock += 31 * 60_000;
  });
  afterAll(() => { ana.close(); beto.close(); });

  test("los predefinidos se envían sin subir nada; un id inventado no", async () => {
    ana.send({ t: "send", room: "global", media: "preset:rocket" });
    expect((await beto.next((m) => m.t === "msg" && m.m.sticker)).m.sticker).toBe("rocket");
    clock += 10_000;
    expect((await ana.req({ t: "send", room: "global", media: "preset:../../x" }, (m) => m.t === "err")).code).toBe("bad_request");
  });
  test("crear un sticker propio: 256x256, pasa por el detector y queda en tu biblioteca", async () => {
    const r = await up("s1", "sticker", png);
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ kind: "sticker", w: 256, h: 256 });
    const list = await ana.req({ t: "sticker.list" }, (m) => m.t === "stickers");
    expect(list.items.map((x: any) => x.id)).toEqual([r.json.id]);
    clock += 10_000;
    ana.send({ t: "send", room: "global", media: r.json.id });
    const got = await beto.next((m) => m.t === "msg" && m.m.media?.kind === "sticker");
    expect(got.m.media.id).toBe(r.json.id);
    clock += 10_000;
    ana.send({ t: "send", room: "global", media: r.json.id });         // un sticker se puede enviar muchas veces
    await beto.next((m) => m.t === "msg" && m.m.media?.kind === "sticker");
    // Beto no puede enviarlo sin tenerlo, pero puede guardarlo si lo vio en la sala
    expect((await beto.req({ t: "send", room: "global", media: r.json.id }, (m) => m.t === "err")).code).toBe("bad_media");
    const saved = await beto.req({ t: "sticker.save", id: r.json.id }, (m) => m.t === "stickers");
    expect(saved.items.length).toBe(1);
    clock += 10_000;
    beto.send({ t: "send", room: "global", media: r.json.id });
    await ana.next((m) => m.t === "msg" && m.m.media?.id === r.json.id);
    const removed = await beto.req({ t: "sticker.remove", id: r.json.id }, (m) => m.t === "stickers");
    expect(removed.items).toEqual([]);
  });
  test("un sticker bloqueado por el detector no entra a la biblioteca", async () => {
    nsfw = 0.8; clock += 60_000;
    expect((await up("s1", "sticker", png)).json.error).toBe("media_blocked");
    nsfw = 0.01;
  });
  test("máximo 24 stickers por persona", async () => {
    for (let i = 0; i < 30 && db.countStickers("s1") < 24; i++) db.addSticker("s1", "f".repeat(30) + String(i).padStart(2, "0"), clock + i);
    clock += 3600_000;
    expect((await up("s1", "sticker", png)).json.error).toBe("sticker_limit");
  });
});

d("retención", () => {
  test("a los 14 días se borran imágenes y audios, pero no los stickers de una biblioteca ni lo reportado sin revisar", async () => {
    clock += 3600_000;
    const old = clock - 20 * 24 * 3600_000;
    const mk = async (kind: string, status = "ok") => { const id = (Math.random().toString(16).slice(2) + "0".repeat(32)).slice(0, 32); const ext = kind === "audio" ? "m4a" : "webp"; await Bun.write(path.join(mediaDir, `${id}.${ext}`), "x"); db.addMedia({ id, uid: "s1", kind, mime: kind === "audio" ? "audio/mp4" : "image/webp", bytes: 1, w: 1, h: 1, dur: 0, ts: old, room: "global", status }); return { id, ext }; };
    const img = await mk("image"), aud = await mk("audio"), stk = await mk("sticker"), rep = await mk("image", "hidden");
    db.addSticker("s1", stk.id, old);
    db.db.query("INSERT INTO reports(msg_id,room,reported_uid,reporter_uid,reason,text,ts,media) VALUES(1,'global','s1','x','sexual','',?,?)").run(old, rep.id);
    const r = db.purgeOlderThan(clock - 14 * 24 * 3600_000);
    const gone = r.files.map((f) => f.id);
    expect(gone).toContain(img.id);
    expect(gone).toContain(aud.id);
    expect(gone).not.toContain(stk.id);
    expect(gone).not.toContain(rep.id);
    expect(existsSync(path.join(mediaDir, `${stk.id}.${stk.ext}`))).toBe(true);
  });
});

d("imágenes apagadas (valor por defecto)", () => {
  test("sin activarlas, imágenes y stickers propios se rechazan pero audios y stickers predefinidos siguen", async () => {
    const off = createChatServer({ db: new ChatDb(":memory:"), projectId: "juanjo-games", keys: async (k) => (k === "k1" ? publicKey : null), adminEmails: [], origins: ["https://games.budsin.dev"], now: () => clock, mediaDir, scan: async () => 0, mediaMinAgeMs: 0 });
    try {
      for (const kind of ["image", "sticker"]) {
        const r = await fetch(`http://127.0.0.1:${off.port}/api/chat/upload?kind=${kind}&room=global`, { method: "POST", headers: { authorization: `Bearer ${token("x1")}` }, body: png });
        expect([r.status, (await r.json() as any).error]).toEqual([403, "images_disabled"]);
      }
      const ws = new WebSocket(`ws://127.0.0.1:${off.port}/api/chat/ws`, { headers: { origin: "https://games.budsin.dev" } } as any);
      const got: any[] = []; ws.onmessage = (e) => got.push(JSON.parse(String(e.data)));
      await new Promise((r) => (ws.onopen = r));
      ws.send(JSON.stringify({ t: "auth", token: token("x1") })); await Bun.sleep(150);
      expect(got.find((m) => m.t === "hello").features).toEqual({ images: false, audio: true, links: [] });
      ws.send(JSON.stringify({ t: "profile", username: "Off_Test", avatar: "a01" })); await Bun.sleep(150);
      ws.send(JSON.stringify({ t: "join", room: "global" })); await Bun.sleep(150);
      ws.send(JSON.stringify({ t: "send", room: "global", media: "preset:rocket" })); await Bun.sleep(200);
      expect(got.some((m) => m.t === "msg" && m.m.sticker === "rocket")).toBe(true);
      ws.close();
    } finally { off.stop(); }
  });
});

d("borrar mis imágenes", () => {
  test("borrar el mensaje borra el archivo; si estaba reportado se conserva oculto para el admin", async () => {
    clock += 3600_000 * 80;
    const a = await user("w1", "Ana_Del"), b = await user("w2", "Beto_Del");
    for (const c of [a, b]) await c.req({ t: "join", room: "global" }, (m) => m.t === "joined");
    clock += 31 * 60_000;
    // 1) sin reporte: el archivo desaparece
    const r1 = await up("w1", "image", png);
    a.send({ t: "send", room: "global", media: r1.json.id });
    const m1 = await b.next((m) => m.t === "msg" && m.m.media?.id === r1.json.id);
    expect(existsSync(path.join(mediaDir, `${r1.json.id}.webp`))).toBe(true);
    a.send({ t: "delete", id: m1.m.id });
    await b.next((m) => m.t === "del" && m.id === m1.m.id);
    await Bun.sleep(100);
    expect(existsSync(path.join(mediaDir, `${r1.json.id}.webp`))).toBe(false);
    expect(db.media(r1.json.id)).toBeNull();
    // 2) con reporte abierto: se oculta pero el archivo se queda (evidencia)
    clock += 60_000;
    const r2 = await up("w1", "image", png);
    a.send({ t: "send", room: "global", media: r2.json.id });
    const m2 = await b.next((m) => m.t === "msg" && m.m.media?.id === r2.json.id);
    await b.req({ t: "report", id: m2.m.id, reason: "sexual" }, (m) => m.t === "reported");
    a.send({ t: "delete", id: m2.m.id });
    await b.next((m) => m.t === "del" && m.id === m2.m.id);
    await Bun.sleep(100);
    expect(existsSync(path.join(mediaDir, `${r2.json.id}.webp`))).toBe(true);
    expect(db.media(r2.json.id)?.status).toBe("hidden");
    a.close(); b.close();
  });
});
