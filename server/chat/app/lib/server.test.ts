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
  async req(o: unknown, pred: (m: any) => boolean) { this.inbox = this.inbox.filter((m) => !pred(m)); this.send(o); return this.next(pred); }   // solo cuenta lo que llega DESPUÉS de pedirlo
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
    expect((await fake.next((x) => x.t === "err")).code).toBe("email_unverified");   // un correo sin verificar ni siquiera entra (y menos como admin)
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
    const u = await boss.req({ t: "admin.find", q: "Rita_A" }, (x) => x.t === "admin.users");   // el guion bajo es una letra más, no un comodín
    expect(u.items.map((i: any) => i.username)).toEqual(["Rita_A"]);
    expect((await boss.req({ t: "admin.find", q: "R_ta" }, (x) => x.t === "admin.users")).items).toEqual([]);
    expect((await boss.req({ t: "admin.find", q: "%" }, (x) => x.t === "admin.users")).items).toEqual([]);
  });
});

describe("grupos de clase", () => {
  let ana: Client, beto: Client, eve: Client;
  let code = "", key = "";
  beforeAll(async () => {
    clock += 3600_000 * 10;
    ana = await user("k1", "Ana_Prof"); beto = await user("k2", "Beto_Alu"); eve = await user("k3", "Eve_Ext");
  });
  afterAll(() => { for (const x of [ana, beto, eve]) x.close(); });

  test("crear un grupo: nombre filtrado y con largo válido", async () => {
    expect((await ana.req({ t: "class.create", name: "ab" }, (m) => m.t === "err")).code).toBe("class_name_length");
    expect((await ana.req({ t: "class.create", name: "los pendejos de 3A" }, (m) => m.t === "err")).code).toBe("class_name_blocked");
    expect((await ana.req({ t: "class.create", name: "grupo www.malo.com" }, (m) => m.t === "err")).code).toBe("class_name_blocked");
  });
  test("crear: devuelve un código de 8 caracteres y la creadora ya es miembro", async () => {
    const r = await ana.req({ t: "class.create", name: "3A Matemáticas" }, (m) => m.t === "class.created" || m.t === "err");
    expect(r.t).toBe("class.created");
    key = r.item.key; code = r.item.code;
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect(r.item).toMatchObject({ name: "3A Matemáticas", owner: true, members: 1 });
    expect((await ana.req({ t: "class.list" }, (m) => m.t === "classes")).items.map((x: any) => x.name)).toEqual(["3A Matemáticas"]);
  });
  test("no se puede duplicar: mismo nombre aunque cambien mayúsculas, tildes, espacios o símbolos", async () => {
    for (const n of ["3a matematicas", "3A  MATEMATICAS", "3°A - Matemáticas", "3a.matematicas"]) {
      expect((await beto.req({ t: "class.create", name: n }, (m) => m.t === "err" || m.t === "class.created")).code).toBe("class_exists");
    }
    expect((await beto.req({ t: "class.create", name: "3B Matemáticas" }, (m) => m.t === "class.created" || m.t === "err")).t).toBe("class.created");
  });
  test("un grupo no es público: sin código no se entra, ni adivinando la clave", async () => {
    expect((await eve.req({ t: "join", room: key }, (m) => m.t === "err" || m.t === "joined")).code).toBe("forbidden");
    expect((await eve.req({ t: "class.join", code: "ZZZZZZZZ" }, (m) => m.t === "err" || m.t === "class.joined")).code).toBe("class_not_found");
    expect((await eve.req({ t: "class.join", code: "abc" }, (m) => m.t === "err" || m.t === "class.joined")).code).toBe("class_not_found");
    const l = await eve.req({ t: "rooms" }, (m) => m.t === "rooms");
    expect(JSON.stringify(l)).not.toContain("Matem");
  });
  test("con el código se entra y se chatea solo entre miembros", async () => {
    const r = await beto.req({ t: "class.join", code: code.toLowerCase() }, (m) => m.t === "class.joined" || m.t === "err");
    expect(r.t).toBe("class.joined");
    expect(r.item.members).toBe(2);
    await ana.req({ t: "join", room: key }, (m) => m.t === "joined");
    await beto.req({ t: "join", room: key }, (m) => m.t === "joined");
    clock += 60_000;
    ana.send({ t: "send", room: key, text: "mañana examen, estudien" });
    expect((await beto.next((m) => m.t === "msg")).m.text).toBe("mañana examen, estudien");
    // quien no es miembro no recibe nada ni puede escribir
    eve.send({ t: "send", room: key, text: "intruso" });
    expect((await eve.next((m) => m.t === "err")).code).toBe("not_joined");
  });
  test("el filtro y el anti-spam también valen en los grupos", async () => {
    clock += 60_000;
    beto.send({ t: "send", room: key, text: "llámame al 987654321" });
    expect((await beto.next((m) => m.t === "err")).why).toBe("contact");
  });
  test("límites: 3 grupos creados por persona", async () => {
    clock += 3600_000 * 2;
    for (const n of ["Clase uno", "Clase dos"]) await ana.req({ t: "class.create", name: n }, (m) => m.t === "class.created" || m.t === "err");
    clock += 3600_000 * 2;
    expect((await ana.req({ t: "class.create", name: "Clase tres" }, (m) => m.t === "err" || m.t === "class.created")).code).toBe("class_limit_created");
  });
  test("solo la dueña expulsa", async () => {
    expect((await beto.req({ t: "class.kick", room: key, uid: "k1" }, (m) => m.t === "err")).code).toBe("forbidden");
    const gone = beto.next((m) => m.t === "class.left");
    await ana.req({ t: "class.kick", room: key, uid: "k2" }, (m) => m.t === "ok");
    expect((await gone).kicked).toBe(true);
    beto.send({ t: "send", room: key, text: "sigo aquí" });
    expect((await beto.next((m) => m.t === "err")).code).toBe("not_joined");
  });
  test("al irse la dueña el grupo pasa a otro; al irse el último se borra y el nombre queda libre", async () => {
    await beto.req({ t: "class.join", code }, (m) => m.t === "class.joined");
    await ana.req({ t: "class.leave", room: key }, (m) => m.t === "class.left");
    expect(db.room(key)!.owner).toBe("k2");
    await beto.req({ t: "class.leave", room: key }, (m) => m.t === "class.left");
    expect(db.room(key)).toBeNull();
    const again = await eve.req({ t: "class.create", name: "3A Matemáticas" }, (m) => m.t === "class.created" || m.t === "err");
    expect(again.t).toBe("class.created");
  });
});

describe("amigos y mensajes directos", () => {
  let ana: Client, beto: Client, eve: Client;
  let dm = "";
  beforeAll(async () => {
    clock += 3600_000 * 20;
    ana = await user("d1", "Ana_Dm"); beto = await user("d2", "Beto_Dm"); eve = await user("d3", "Eve_Dm");
  });
  afterAll(() => { for (const x of [ana, beto, eve]) x.close(); });
  const friends = (c: Client) => c.req({ t: "friend.list" }, (m) => m.t === "friends");

  test("sin ser amigos no hay mensajes directos, ni adivinando la clave", async () => {
    const key = "dm:d1:d2";
    expect((await ana.req({ t: "join", room: key }, (m) => m.t === "err")).code).toBe("dm_closed");
    expect((await ana.req({ t: "dm.open", uid: "d2" }, (m) => m.t === "err")).code).toBe("dm_closed");
    expect((await eve.req({ t: "join", room: key }, (m) => m.t === "err")).code).toBe("dm_closed");     // ni siendo de otra persona
  });
  test("solicitud: llega a la otra persona en vivo y no se puede repetir ni a uno mismo", async () => {
    const note = beto.next((m) => m.t === "friends" && m.incoming.length === 1);
    ana.send({ t: "friend.request", username: "Beto_Dm" });
    expect((await note).incoming[0]).toMatchObject({ uid: "d1", username: "Ana_Dm" });
    expect((await friends(ana)).outgoing.map((x: any) => x.username)).toEqual(["Beto_Dm"]);
    expect((await ana.req({ t: "friend.request", username: "Beto_Dm" }, (m) => m.t === "err")).code).toBe("friend_exists");
    expect((await ana.req({ t: "friend.request", username: "Ana_Dm" }, (m) => m.t === "err")).code).toBe("friend_self");
    expect((await ana.req({ t: "friend.request", username: "NadieExiste" }, (m) => m.t === "err")).code).toBe("friend_not_found");
  });
  test("mientras es solo una solicitud sigue sin haber chat", async () => {
    expect((await ana.req({ t: "dm.open", uid: "d2" }, (m) => m.t === "err")).code).toBe("dm_closed");
  });
  test("solo quien recibe puede aceptar", async () => {
    expect((await ana.req({ t: "friend.accept", uid: "d2" }, (m) => m.t === "err")).code).toBe("bad_request");
    await beto.req({ t: "friend.accept", uid: "d1" }, (m) => m.t === "friends" && m.friends.length === 1);
    const f = await friends(ana);
    expect(f.friends[0]).toMatchObject({ username: "Beto_Dm", online: true });
    dm = f.friends[0].room;
    expect(dm).toBe("dm:d1:d2");
  });
  test("ya amigos: chatean en privado, con el mismo filtro, y terceros no ven nada", async () => {
    await ana.req({ t: "dm.open", uid: "d2" }, (m) => m.t === "joined");
    // beto no tiene la sala abierta: recibe un aviso
    const note = beto.next((m) => m.t === "dm.notify");
    clock += 60_000;
    ana.send({ t: "send", room: dm, text: "¿juegas esta tarde?" });
    expect((await note)).toMatchObject({ room: dm, u: "Ana_Dm" });
    await beto.req({ t: "dm.open", uid: "d1" }, (m) => m.t === "joined");
    beto.send({ t: "send", room: dm, text: "dale" });
    expect((await ana.next((m) => m.t === "msg" && m.m.text === "dale")).m.u).toBe("Beto_Dm");
    clock += 60_000;
    ana.send({ t: "send", room: dm, text: "mi whatsapp es 987654321" });
    expect((await ana.next((m) => m.t === "err")).why).toBe("contact");
    expect((await eve.req({ t: "join", room: dm }, (m) => m.t === "err")).code).toBe("dm_closed");
    eve.send({ t: "send", room: dm, text: "intruso" });
    expect((await eve.next((m) => m.t === "err")).code).toBe("not_joined");
  });
  test("reportar un mensaje directo lo oculta enseguida y llega al admin", async () => {
    clock += 60_000;
    ana.send({ t: "send", room: dm, text: "mensaje que molesta" });
    const m = await beto.next((x) => x.t === "msg" && x.m.text === "mensaje que molesta");
    const hidden = ana.next((x) => x.t === "del");
    await beto.req({ t: "report", id: m.m.id, reason: "insult" }, (x) => x.t === "reported");
    expect((await hidden).id).toBe(m.m.id);
    expect(db.openReports().some((r) => r.text === "mensaje que molesta" && r.room === dm)).toBe(true);
  });
  test("bloquear corta la conversación, borra la amistad y no deja volver a pedirla", async () => {
    const closed = ana.next((m) => m.t === "dm.closed");
    await beto.req({ t: "block", uid: "d1" }, (m) => m.t === "friends" && m.blocked.length === 1);
    expect((await closed).room).toBe(dm);
    clock += 60_000;
    ana.send({ t: "send", room: dm, text: "hola?" });
    expect((await ana.next((m) => m.t === "err")).code).toBe("not_joined");
    expect((await ana.req({ t: "dm.open", uid: "d2" }, (m) => m.t === "err")).code).toBe("dm_closed");
    expect((await ana.req({ t: "friend.request", username: "Beto_Dm" }, (m) => m.t === "err")).code).toBe("friend_not_found");   // no revela que la bloquearon
    expect((await friends(ana)).friends).toEqual([]);
    await beto.req({ t: "unblock", uid: "d1" }, (m) => m.t === "friends" && m.blocked.length === 0);
    expect((await ana.req({ t: "friend.request", username: "Beto_Dm" }, (m) => m.t === "friends" || m.t === "err")).t).toBe("friends");   // desbloqueada: puede pedir de nuevo
  });
  test("pedirse mutuamente acepta solo; quitar amigo cierra el chat", async () => {
    // beto ya tiene una solicitud de ana; si beto también le pide, quedan amigos
    await beto.req({ t: "friend.request", username: "Ana_Dm" }, (m) => m.t === "friends" && m.friends.length === 1);
    await ana.req({ t: "dm.open", uid: "d2" }, (m) => m.t === "joined");
    const closed = ana.next((m) => m.t === "dm.closed");
    await beto.req({ t: "friend.remove", uid: "d1" }, (m) => m.t === "friends");
    await closed;
    expect((await friends(ana)).friends).toEqual([]);
  });
  test("límite de solicitudes por hora", async () => {
    clock += 3600_000 * 3;
    let last: any;
    for (let i = 0; i < 11; i++) last = await eve.req({ t: "friend.request", username: "NoExiste" + i }, (m) => m.t === "err");
    expect(last.code).toBe("rate");
  });
});

describe("admin: salas", () => {
  test("el admin lista y borra un grupo inapropiado; los demás no pueden", async () => {
    clock += 3600_000 * 30;
    const boss = await Client.open(); await boss.login("boss", "boss@x.com");
    const owner = await user("z1", "Zeta_Uno");
    const made = await owner.req({ t: "class.create", name: "Grupo para borrar" }, (m) => m.t === "class.created");
    await owner.req({ t: "join", room: made.item.key }, (m) => m.t === "joined");
    expect((await owner.req({ t: "admin.rooms" }, (m) => m.t === "err")).code).toBe("forbidden");
    const list = await boss.req({ t: "admin.rooms" }, (m) => m.t === "admin.rooms");
    expect(list.items.some((r: any) => r.key === made.item.key && r.members === 1)).toBe(true);
    expect((await boss.req({ t: "admin.deleteroom", key: "global" }, (m) => m.t === "err")).code).toBe("bad_request");
    const left = owner.next((m) => m.t === "class.left");
    await boss.req({ t: "admin.deleteroom", key: made.item.key }, (m) => m.t === "ok");
    expect((await left).room).toBe(made.item.key);
    expect(db.room(made.item.key)).toBeNull();
    boss.close(); owner.close();
  });
});

describe("solo cuentas de colegio", () => {
  test("con reglas de dominio, un Gmail no entra, un correo de colegio sí, y el admin siempre", async () => {
    const restricted = createChatServer({ db: new ChatDb(":memory:"), projectId: "juanjo-games", keys: async (k) => (k === "k1" ? publicKey : null), adminEmails: ["boss@gmail.com"], origins: ["https://games.budsin.dev"], now: () => clock, allowedDomains: ["*.edu", "*.edu.??", "colegiosanjose.com"] });
    const open = async (uid: string, email: string) => {
      const ws = new WebSocket(`ws://127.0.0.1:${restricted.port}/api/chat/ws`, { headers: { origin: "https://games.budsin.dev" } } as any);
      const got: any[] = []; let closed = false;
      ws.onmessage = (e) => got.push(JSON.parse(String(e.data))); ws.onclose = () => { closed = true; };
      await new Promise((r) => (ws.onopen = r));
      ws.send(JSON.stringify({ t: "auth", token: token(uid, email) }));
      await Bun.sleep(200);
      const res = { first: got[0], closed };
      ws.close();
      return res;
    };
    try {
      const g = await open("e1", "ana@gmail.com");
      expect(g.first).toMatchObject({ t: "err", code: "domain_not_allowed" });
      expect(g.closed).toBe(true);
      expect((await open("e2", "juan@ucv.edu.pe")).first.t).toBe("hello");
      expect((await open("e3", "maria@colegiosanjose.com")).first.t).toBe("hello");
      expect((await open("e4", "x@school.edu.evil.com")).first.code).toBe("domain_not_allowed");
      expect((await open("e5", "boss@gmail.com")).first.t).toBe("hello");
    } finally { restricted.stop(); }
  });
});
