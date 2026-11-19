import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";
import { ChatDb } from "./db";
import { createChatServer } from "./server";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const enc = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
function token(uid: string, email = `${uid}@x.com`, verified = true) {
  const head = enc({ alg: "RS256", kid: "k1" });
  const body = enc({ aud: "juanjo-games", iss: "https://securetoken.google.com/juanjo-games", sub: uid, exp: Math.floor(Date.now() / 1000) + 60 * 24 * 3600, iat: Math.floor(Date.now() / 1000) - 5, email, email_verified: verified });
  return `${head}.${body}.${sign("RSA-SHA256", Buffer.from(`${head}.${body}`), privateKey).toString("base64url")}`;
}

let clock = Date.now();
const db = new ChatDb(":memory:");
const chat = createChatServer({ db, projectId: "juanjo-games", keys: async (k) => (k === "k1" ? publicKey : null), adminEmails: ["boss@x.com"], origins: ["https://games.budsin.dev"], now: () => clock });
const url = `ws://127.0.0.1:${chat.port}/api/chat/ws`;
afterAll(() => chat.stop());

class Client {
  ws!: WebSocket;
  inbox: any[] = [];
  waiters: ((m: any) => boolean)[] = [];
  static async open(origin = "https://games.budsin.dev"): Promise<Client> {
    const c = new Client();
    c.ws = new WebSocket(url, { headers: { origin } } as any);
    c.ws.onmessage = (e) => { const m = JSON.parse(String(e.data)); c.inbox.push(m); c.waiters = c.waiters.filter((w) => !w(m)); };
    await new Promise<void>((res, rej) => { c.ws.onopen = () => res(); c.ws.onerror = () => rej(new Error("ws error")); });
    return c;
  }
  send(o: unknown) { this.ws.send(JSON.stringify(o)); }
  next(pred: (m: any) => boolean, ms = 2000): Promise<any> {
    const hit = this.inbox.find(pred);
    if (hit) { this.inbox.splice(this.inbox.indexOf(hit), 1); return Promise.resolve(hit); }
    return new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error("timeout waiting; inbox=" + JSON.stringify(this.inbox.slice(-4)))), ms);
      this.waiters.push((m) => { if (!pred(m)) return false; clearTimeout(t); this.inbox.splice(this.inbox.indexOf(m), 1); res(m); return true; });
    });
  }
  async req(o: unknown, pred: (m: any) => boolean) { this.send(o); return this.next(pred); }
  async login(uid: string, email?: string) { this.send({ t: "auth", token: token(uid, email) }); return this.next((m) => m.t === "hello" || m.t === "err"); }
  close() { this.ws.close(); }
}
async function user(uid: string, name: string, email?: string) {
  const c = await Client.open();
  const h = await c.login(uid, email);
  expect(h.t).toBe("hello");
  const r = await c.req({ t: "profile", username: name, avatar: "a03" }, (m) => m.t === "me" || m.t === "err");
  expect(r.t).toBe("me");
  return c;
}

describe("conexión y cuenta", () => {
  test("sin token válido no entra", async () => {
    const c = await Client.open();
    c.send({ t: "auth", token: "basura" });
    expect((await c.next((m) => m.t === "err")).code).toBe("auth_failed");
    const d = await Client.open();
    d.send({ t: "join", room: "global" });
    expect((await d.next((m) => m.t === "err")).code).toBe("not_authed");
    d.close();
  });
  test("un origen ajeno no puede abrir el socket", async () => {
    await expect(Client.open("https://malo.example")).rejects.toThrow();
  });
  test("hay que elegir nombre antes de entrar a una sala", async () => {
    const c = await Client.open();
    const h = await c.login("nuevo1");
    expect(h.me.username).toBeNull();
    expect((await c.req({ t: "join", room: "global" }, (m) => m.t === "err")).code).toBe("need_username");
    c.close();
  });
  test("nombres: filtro, reservados, únicos aunque se disfracen", async () => {
    const a = await user("u1", "Ana_Gamer");
    const b = await Client.open(); await b.login("u2");
    for (const [name, code] of [["puta123", "name_profanity"], ["Admin", "name_reserved"], ["ab", "name_length"], ["Ana.Gamer", "name_taken"], ["An4_G4m3r", "name_taken"], ["hola mundo", "name_chars"]] as const) {
      const r = await b.req({ t: "profile", username: name, avatar: "a01" }, (m) => m.t === "me" || m.t === "err");
      expect(r.code ?? r.t).toBe(code === "name_chars" ? "name_chars" : code);
    }
    expect((await b.req({ t: "profile", username: "Beto", avatar: "zzz" }, (m) => m.t === "err")).code).toBe("bad_avatar");
    a.close(); b.close();
  });
  test("cambiar de nombre: una vez por semana", async () => {
    const c = await user("u3", "Carlos77");
    const r = await c.req({ t: "profile", username: "Carlos88", avatar: "a03" }, (m) => m.t === "err" || m.t === "me");
    expect(r.code).toBe("name_cooldown");
    clock += 8 * 24 * 3600_000;
    expect((await c.req({ t: "profile", username: "Carlos88", avatar: "a03" }, (m) => m.t === "err" || m.t === "me")).t).toBe("me");
    c.close();
  });
});

describe("chat", () => {
  let a: Client, b: Client;
  beforeAll(async () => { a = await user("c1", "Luna_A"); b = await user("c2", "Mario_B"); });
  afterAll(() => { a.close(); b.close(); });

  test("sala global: mensajes en tiempo real entre dos personas", async () => {
    const ja = await a.req({ t: "join", room: "global" }, (m) => m.t === "joined");
    expect(ja.room).toBe("global");
    await b.req({ t: "join", room: "global" }, (m) => m.t === "joined");
    a.send({ t: "send", room: "global", text: "hola a todos 👋", cid: "x1" });
    const got = await b.next((m) => m.t === "msg");
    expect(got.m).toMatchObject({ u: "Luna_A", text: "hola a todos 👋" });
    expect((await a.next((m) => m.t === "msg")).cid).toBe("x1");
  });
  test("el historial llega al entrar", async () => {
    const c = await user("c3", "Sofi_C");
    const j = await c.req({ t: "join", room: "global" }, (m) => m.t === "joined");
    expect(j.history.some((x: any) => x.text.startsWith("hola a todos"))).toBe(true);
    c.close();
  });
  test("el filtro bloquea groserías, enlaces y teléfonos antes de enviar", async () => {
    clock += 60_000;
    for (const [text, why] of [["eres un pendejo", "profanity"], ["entra a www.malo.com", "link"], ["mi número 987654321", "contact"]] as const) {
      a.send({ t: "send", room: "global", text });
      const e = await a.next((m) => m.t === "err");
      expect([e.code, e.why]).toEqual(["blocked", why]);
      clock += 5000;
    }
  });
  test("anti-spam: ráfagas, repetidos y mensajes largos", async () => {
    clock += 120_000;
    a.send({ t: "send", room: "global", text: "uno" }); await a.next((m) => m.t === "msg");
    a.send({ t: "send", room: "global", text: "uno" });
    expect((await a.next((m) => m.t === "err")).code).toBe("duplicate");
    for (const w of ["dos", "tres", "cuatro"]) { a.send({ t: "send", room: "global", text: w }); await a.next((m) => m.t === "msg"); }
    a.send({ t: "send", room: "global", text: "seis" });
    expect((await a.next((m) => m.t === "err")).code).toBe("rate");
    clock += 60_000;
    a.send({ t: "send", room: "global", text: "x".repeat(400) });
    expect((await a.next((m) => m.t === "err")).code).toBe("too_long");
  });
  test("no se puede escribir en una sala a la que no te uniste", async () => {
    clock += 60_000;
    const c = await user("c4", "Pepe_D");
    c.send({ t: "send", room: "global", text: "hola" });
    expect((await c.next((m) => m.t === "err")).code).toBe("not_joined");
    c.close();
  });
  test("salas por juego: se crean al entrar y se listan", async () => {
    const j = await a.req({ t: "join", room: "game:pacman", name: "Pacman" }, (m) => m.t === "joined" || m.t === "err");
    expect([j.t, j.name]).toEqual(["joined", "Pacman"]);
    const l = await a.req({ t: "rooms" }, (m) => m.t === "rooms");
    expect(l.game.map((g: any) => g.key)).toContain("game:pacman");
    expect((await a.req({ t: "join", room: "game:Bad Slug!" }, (m) => m.t === "err")).code).toBe("no_room");
    expect((await a.req({ t: "join", room: "game:puta", name: "pendejos del juego" }, (m) => m.t === "err")).code).toBe("room_name");
  });
});

describe("reportes y administración", () => {
  let a: Client, b: Client, c: Client, d: Client, boss: Client;
  let victimMsg = 0;
  beforeAll(async () => {
    clock += 3600_000 * 5;
    a = await user("r1", "Rita_A"); b = await user("r2", "Raul_B"); c = await user("r3", "Rosa_C"); d = await user("r4", "Rene_D");
    boss = await Client.open(); await boss.login("boss", "boss@x.com");
    for (const x of [a, b, c, d]) await x.req({ t: "join", room: "global" }, (m) => m.t === "joined");
  });
  afterAll(() => { for (const x of [a, b, c, d, boss]) x.close(); });

  test("tres reportes distintos ocultan el mensaje; uno solo no", async () => {
    a.send({ t: "send", room: "global", text: "mensaje molesto pero sin groserías" });
    const m = await b.next((x) => x.t === "msg" && x.m.text.startsWith("mensaje molesto"));
    victimMsg = m.m.id;
    expect((await a.req({ t: "report", id: victimMsg, reason: "spam" }, (x) => x.t === "err")).code).toBe("own_message");
    expect((await b.req({ t: "report", id: victimMsg, reason: "spam" }, (x) => x.t === "reported")).id).toBe(victimMsg);
    expect((await b.req({ t: "report", id: victimMsg, reason: "spam" }, (x) => x.t === "err")).code).toBe("already_reported");
    await c.req({ t: "report", id: victimMsg, reason: "insult" }, (x) => x.t === "reported");
    expect(db.message(victimMsg)!.deleted).toBe(0);
    await d.req({ t: "report", id: victimMsg, reason: "other" }, (x) => x.t === "reported");
    expect((await a.next((x) => x.t === "del")).id).toBe(victimMsg);
  });
  test("solo los admins usan los comandos de admin", async () => {
    expect((await a.req({ t: "admin.reports" }, (x) => x.t === "err")).code).toBe("forbidden");
    const nonVerified = await Client.open(); await nonVerified.login("boss2", "boss@x.com"); // mismo correo pero este token sí está verificado: es admin
    nonVerified.close();
    const fake = await Client.open();
    fake.send({ t: "auth", token: token("imp", "boss@x.com", false) });
    await fake.next((x) => x.t === "hello");
    expect((await fake.req({ t: "admin.reports" }, (x) => x.t === "err")).code).toBe("forbidden");   // correo sin verificar no vale
    fake.close();
  });
  test("el admin ve los reportes y los resuelve", async () => {
    const list = await boss.req({ t: "admin.reports" }, (x) => x.t === "admin.reports");
    expect(list.items.length).toBe(3);
    expect(list.items[0]).toMatchObject({ reported_name: "Rita_A", text: "mensaje molesto pero sin groserías" });
    await boss.req({ t: "admin.delete", id: victimMsg }, (x) => x.t === "ok");
    expect((await boss.req({ t: "admin.reports" }, (x) => x.t === "admin.reports")).items.length).toBe(0);
  });
  test("silenciar impide escribir, y se acaba solo", async () => {
    const uid = "r2";
    await boss.req({ t: "admin.mute", uid, minutes: 10 }, (x) => x.t === "ok");
    clock += 61_000;
    b.send({ t: "send", room: "global", text: "hola" });
    expect((await b.next((x) => x.t === "err" && x.code !== undefined)).code).toBe("muted");
    clock += 11 * 60_000;
    b.send({ t: "send", room: "global", text: "ya puedo" });
    expect((await b.next((x) => x.t === "msg")).m.text).toBe("ya puedo");
  });
  test("renombrar borra nombre y avatar para que elija otro", async () => {
    await boss.req({ t: "admin.rename", uid: "r3" }, (x) => x.t === "ok");
    await c.next((x) => x.t === "reset_profile");
    expect(db.user("r3")!.username).toBeNull();
    const again = await c.req({ t: "profile", username: "Rosa_Nueva", avatar: "a05" }, (x) => x.t === "me" || x.t === "err");
    expect(again.t).toBe("me");
  });
  test("banear corta la conexión y no deja volver", async () => {
    const closed = new Promise<void>((res) => { d.ws.onclose = () => res(); });
    await boss.req({ t: "admin.ban", uid: "r4", on: true }, (x) => x.t === "ok");
    await closed;
    const back = await Client.open();
    expect((await back.login("r4")).code).toBe("banned");
    back.close();
    await boss.req({ t: "admin.ban", uid: "r4", on: false }, (x) => x.t === "ok");
  });
  test("buscar usuarios", async () => {
    const r = await boss.req({ t: "admin.find", q: "rita" }, (x) => x.t === "admin.users");
    expect(r.items[0]).toMatchObject({ username: "Rita_A", uid: "r1" });
  });
});
