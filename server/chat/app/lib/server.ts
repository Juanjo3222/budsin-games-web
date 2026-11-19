// Servidor de Budsin Chat: WebSocket en /api/chat/ws (Caddy lo reenvía desde games.budsin.dev).
// Todo pasa por un solo canal JSON. Primer mensaje obligatorio: {t:"auth", token} con el token de Firebase (Google).
import type { ServerWebSocket } from "bun";
import { verifyFirebaseToken, type KeyProvider, type Claims } from "./auth";
import { ChatDb, type Room, type User } from "./db";
import { checkMessage, checkRoomName, checkUsername, nameKey, roomKey } from "./filter";
import { randomInt } from "node:crypto";

export const AVATARS = Array.from({ length: 24 }, (_, i) => `a${String(i + 1).padStart(2, "0")}`);
export const REPORT_REASONS = ["spam", "insult", "sexual", "personal", "other"];
export const MAX_TEXT = 300;
const HISTORY = 50;
const RETENTION_MS = 14 * 24 * 3600_000;
const AUTO_HIDE_REPORTS = 3;       // tres personas distintas reportan un mensaje: se oculta hasta que lo revise un admin

export interface ServerOptions {
  db: ChatDb;
  projectId: string;
  keys: KeyProvider;
  adminEmails: string[];
  port?: number;
  hostname?: string;
  origins?: string[];
  now?: () => number;
}

interface Conn {
  id: number;
  ip: string;
  claims: Claims | null;
  user: User | null;
  admin: boolean;
  rooms: Set<string>;
}

type Sock = ServerWebSocket<Conn>;

/** Sliding-window counter per key: allows `max` events in `windowMs`. */
class Limiter {
  private hits = new Map<string, number[]>();
  constructor(private max: number, private windowMs: number) {}
  take(key: string, now: number): number {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length >= this.max) {
      this.hits.set(key, list);
      return this.windowMs - (now - list[0]);
    }
    list.push(now);
    this.hits.set(key, list);
    return 0;
  }
  sweep(now: number) {
    for (const [k, l] of this.hits) if (!l.some((t) => now - t < this.windowMs)) this.hits.delete(k);
  }
}

export function createChatServer(opts: ServerOptions) {
  const { db, projectId, keys } = opts;
  const now = opts.now ?? Date.now;
  const admins = new Set(opts.adminEmails.map((e) => e.toLowerCase()));
  const origins = opts.origins ?? ["https://games.budsin.dev"];
  const sockets = new Set<Sock>();
  const roomSockets = new Map<string, Set<Sock>>();
  const burst = new Limiter(5, 10_000);       // 5 mensajes cada 10 s
  const minute = new Limiter(30, 60_000);     // 30 por minuto
  const reportLimit = new Limiter(10, 3600_000);
  const roomCreate = new Limiter(3, 3600_000);
  const profileLimit = new Limiter(10, 3600_000);
  const lastText = new Map<string, { text: string; at: number }>();
  let nextId = 1;

  const send = (ws: Sock, o: unknown) => ws.send(JSON.stringify(o));
  const err = (ws: Sock, code: string, extra: Record<string, unknown> = {}) => send(ws, { t: "err", code, ...extra });
  const clean = (s: unknown, max: number) =>
    // eslint-disable-next-line no-control-regex
    String(s ?? "").replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);

  function broadcast(room: string, o: unknown, except?: Sock) {
    const set = roomSockets.get(room);
    if (!set) return;
    const data = JSON.stringify(o);
    for (const s of set) if (s !== except) s.send(data);
  }
  function onlineCount(room: string): number {
    const ids = new Set<string>();
    for (const s of roomSockets.get(room) ?? []) if (s.data.claims) ids.add(s.data.claims.uid);
    return ids.size;
  }
  function leaveAll(ws: Sock) {
    for (const r of ws.data.rooms) {
      roomSockets.get(r)?.delete(ws);
      if (!roomSockets.get(r)?.size) roomSockets.delete(r);
      else broadcast(r, { t: "online", room: r, n: onlineCount(r) });
    }
    ws.data.rooms.clear();
  }
  const publicUser = (u: User | null) => (u ? { uid: u.uid, username: u.username, avatar: u.avatar } : null);
  const me = (ws: Sock) => ({ ...publicUser(ws.data.user), admin: ws.data.admin, muted: ws.data.user && ws.data.user.muted_until > now() ? ws.data.user.muted_until : 0 });
  const refresh = (ws: Sock) => {
    if (ws.data.claims) ws.data.user = db.user(ws.data.claims.uid);
  };

  // ---- acceso a salas ----
  const GAME = /^game:[a-z0-9][a-z0-9-]{0,59}$/;
  function canAccess(ws: Sock, room: Room | null): boolean {
    if (!room) return false;
    if (room.kind === "global" || room.kind === "game") return true;
    if (room.kind === "class") return db.isMember(room.key, ws.data.claims!.uid);
    if (room.kind === "dm") return dmAllowed(room.key, ws.data.claims!.uid);
    return false;
  }
  // ---- mensajes directos: solo entre amigos aceptados y sin bloqueos ----
  const dmKey = (x: string, y: string) => (x < y ? `dm:${x}:${y}` : `dm:${y}:${x}`);
  const DM = /^dm:([^:]{1,128}):([^:]{1,128})$/;
  function dmPeer(key: string, uid: string): string | null {
    const m = DM.exec(key);
    if (!m || (m[1] !== uid && m[2] !== uid)) return null;
    return m[1] === uid ? m[2] : m[1];
  }
  function dmAllowed(key: string, uid: string): boolean {
    const peer = dmPeer(key, uid);
    if (!peer || key !== dmKey(uid, peer)) return false;
    const f = db.friendship(uid, peer);
    return !!f && f.status === "accepted" && !db.isBlocked(uid, peer);
  }
  const isOnline = (uid: string) => { for (const s of sockets) if (s.data.claims?.uid === uid) return true; return false; };

  async function handle(ws: Sock, raw: string | Buffer) {
    if (typeof raw !== "string" || raw.length > 8192) return err(ws, "bad_request");
    let m: Record<string, unknown>;
    try {
      m = JSON.parse(raw);
      if (!m || typeof m !== "object") throw new Error("shape");
    } catch {
      return err(ws, "bad_request");
    }
    const t = String(m.t ?? "");
    const c = ws.data;

    if (t === "auth") {
      if (c.claims) return;
      const claims = await verifyFirebaseToken(String(m.token ?? ""), projectId, keys, now());
      if (!claims) {
        err(ws, "auth_failed");
        return ws.close(1008, "auth");
      }
      c.claims = claims;
      c.admin = claims.emailVerified && admins.has(claims.email);
      c.user = db.touchUser(claims.uid, claims.email, now());
      if (c.user.banned) {
        err(ws, "banned");
        return ws.close(1008, "banned");
      }
      // un usuario, máximo 4 pestañas
      let n = 0;
      for (const s of sockets) if (s.data.claims?.uid === claims.uid) n++;
      if (n > 4) {
        err(ws, "too_many_tabs");
        return ws.close(1008, "tabs");
      }
      return send(ws, { t: "hello", me: me(ws), avatars: AVATARS });
    }
    if (!c.claims) return err(ws, "not_authed");
    refresh(ws);
    if (c.user?.banned) {
      err(ws, "banned");
      return ws.close(1008, "banned");
    }

    switch (t) {
      case "profile":
        return setProfile(ws, m);
      case "join":
        return join(ws, m);
      case "leave": {
        const r = String(m.room ?? "");
        if (c.rooms.delete(r)) {
          roomSockets.get(r)?.delete(ws);
          broadcast(r, { t: "online", room: r, n: onlineCount(r) });
        }
        return;
      }
      case "send":
        return sendMessage(ws, m);
      case "history":
        return historyOf(ws, m);
      case "rooms":
        return send(ws, { t: "rooms", game: db.activeRooms("game", 30).map((r) => ({ key: r.key, name: r.name, online: onlineCount(r.key) })) });
      case "report":
        return report(ws, m);
      case "class.create":
        return classCreate(ws, m);
      case "class.join":
        return classJoin(ws, m);
      case "class.leave":
        return classLeave(ws, m);
      case "class.list":
        return send(ws, { t: "classes", items: myClasses(ws.data.claims!.uid) });
      case "class.kick":
        return classKick(ws, m);
      case "friend.list":
        return send(ws, friendList(ws.data.claims!.uid));
      case "friend.request":
        return friendRequest(ws, m);
      case "friend.accept":
      case "friend.decline":
      case "friend.remove":
        return friendAct(ws, t, m);
      case "block":
      case "unblock":
        return blockAct(ws, t, m);
      case "dm.open":
        return dmOpen(ws, m);
      case "class.members": {
        const key = String(m.room ?? "");
        const r = db.room(key);
        if (!r || r.kind !== "class" || !db.isMember(key, ws.data.claims!.uid)) return err(ws, "forbidden");
        return send(ws, { t: "class.members", room: key, owner: r.owner, items: db.members(key) });
      }
      default:
        if (t.startsWith("admin.")) return adminCmd(ws, t, m);
        return err(ws, "bad_request");
    }
  }

  function setProfile(ws: Sock, m: Record<string, unknown>) {
    const c = ws.data;
    if (profileLimit.take(c.claims!.uid, now())) return err(ws, "rate");
    const avatar = String(m.avatar ?? c.user!.avatar);
    if (!AVATARS.includes(avatar)) return err(ws, "bad_avatar");
    const wanted = m.username === undefined ? c.user!.username : clean(m.username, 21);
    if (!wanted) return err(ws, "name_length");
    if (/\s/.test(wanted)) return err(ws, "name_chars");
    if (wanted !== c.user!.username) {
      // cambiar un nombre ya elegido: una vez por semana (evita nombres "para molestar" en cadena)
      if (c.user!.username && now() - c.user!.uname_changed < 7 * 24 * 3600_000) return err(ws, "name_cooldown", { until: c.user!.uname_changed + 7 * 24 * 3600_000 });
      const bad = checkUsername(wanted, c.admin);
      if (bad) return err(ws, `name_${bad}`);
      if (db.setProfile(c.claims!.uid, wanted, avatar, now()) === "taken") return err(ws, "name_taken");
    } else db.setAvatar(c.claims!.uid, avatar);
    refresh(ws);
    send(ws, { t: "me", me: me(ws) });
  }

  function ensureGameRoom(ws: Sock, key: string, name: string): Room | null {
    const ex = db.room(key);
    if (ex) return ex;
    const n = clean(name, 40) || key.slice(5).replace(/-/g, " ");
    if (checkRoomName(n)) { err(ws, "room_name"); return null; }
    if (db.countRooms("game") >= 500) { err(ws, "rooms_full"); return null; }
    if (roomCreate.take(ws.data.claims!.uid, now())) { err(ws, "rate"); return null; }
    db.createRoom(key, "game", n, ws.data.claims!.uid, now());
    return db.room(key);
  }

  function join(ws: Sock, m: Record<string, unknown>) {
    const c = ws.data;
    if (!c.user?.username) return err(ws, "need_username");
    const key = String(m.room ?? "");
    let room: Room | null = null;
    if (key === "global") {
      if (!db.room("global")) db.createRoom("global", "global", "Budsin", null, now());
      room = db.room("global");
    } else if (GAME.test(key)) room = ensureGameRoom(ws, key, String(m.name ?? ""));
    else if (key.startsWith("dm:")) {
      if (!dmAllowed(key, c.claims!.uid)) return err(ws, "dm_closed");
      if (!db.room(key)) db.createRoom(key, "dm", "dm", null, now());
      room = db.room(key);
    } else room = db.room(key);
    if (!room) return err(ws, "no_room");
    if (!canAccess(ws, room)) return err(ws, "forbidden");
    if (!c.rooms.has(room.key)) {
      if (c.rooms.size >= 30) return err(ws, "too_many_rooms");
      c.rooms.add(room.key);
      (roomSockets.get(room.key) ?? roomSockets.set(room.key, new Set()).get(room.key)!).add(ws);
    }
    send(ws, { t: "joined", room: room.key, name: room.name, kind: room.kind, history: db.history(room.key, null, HISTORY).map(wire), online: onlineCount(room.key) });
    broadcast(room.key, { t: "online", room: room.key, n: onlineCount(room.key) }, ws);
  }

  // ---- amigos y bloqueos ----
  const MAX_FRIENDS = 30, MAX_OUTGOING = 20;
  function friendList(uid: string) {
    const rows = db.friendRows(uid);
    return {
      t: "friends",
      friends: rows.filter((r) => r.status === "accepted").map((r) => ({ uid: r.uid, username: r.username, avatar: r.avatar, online: isOnline(r.uid), room: dmKey(uid, r.uid) })),
      incoming: rows.filter((r) => r.status === "pending" && r.requester !== uid).map((r) => ({ uid: r.uid, username: r.username, avatar: r.avatar })),
      outgoing: rows.filter((r) => r.status === "pending" && r.requester === uid).map((r) => ({ uid: r.uid, username: r.username, avatar: r.avatar })),
      blocked: db.blockedBy(uid),
    };
  }
  const pushFriends = (uid: string) => { for (const s of sockets) if (s.data.claims?.uid === uid) send(s, friendList(uid)); };

  function friendRequest(ws: Sock, m: Record<string, unknown>) {
    const c = ws.data, uid = c.claims!.uid;
    if (!c.user?.username) return err(ws, "need_username");
    if (profileLimit.take("fr:" + uid, now())) return err(ws, "rate");
    const name = clean(m.username, 20);
    const target = name ? db.userByName(name) : null;
    // la misma respuesta si no existe, si te bloqueó o si no tiene nombre: no se puede "rastrear" gente
    if (!target || !target.username || target.banned || db.isBlocked(uid, target.uid)) return err(ws, "friend_not_found");
    if (target.uid === uid) return err(ws, "friend_self");
    const f = db.friendship(uid, target.uid);
    if (f?.status === "accepted") return err(ws, "friend_exists");
    if (f?.status === "pending") {
      if (f.requester === uid) return err(ws, "friend_exists");
      db.acceptFriend(uid, target.uid);                          // la otra persona ya te había pedido: queda aceptada
      pushFriends(uid); pushFriends(target.uid);
      return;
    }
    if (db.countFriends(uid) >= MAX_FRIENDS) return err(ws, "friend_limit");
    if (db.countOutgoing(uid) >= MAX_OUTGOING) return err(ws, "friend_pending_limit");
    db.addFriendRequest(uid, target.uid, now());
    pushFriends(uid); pushFriends(target.uid);
  }

  function friendAct(ws: Sock, t: string, m: Record<string, unknown>) {
    const uid = ws.data.claims!.uid, other = String(m.uid ?? "");
    const f = db.friendship(uid, other);
    if (!f) return err(ws, "bad_request");
    if (t === "friend.accept") {
      if (f.status !== "pending" || f.requester === uid) return err(ws, "bad_request");
      if (db.countFriends(uid) >= MAX_FRIENDS) return err(ws, "friend_limit");
      db.acceptFriend(uid, other);
    } else db.deleteFriendship(uid, other);                        // rechazar, cancelar o quitar amistad
    if (t === "friend.remove") closeDm(uid, other);
    pushFriends(uid); pushFriends(other);
  }

  /** The conversation is over for both: their sockets leave the room and are told. */
  function closeDm(x: string, y: string) {
    const key = dmKey(x, y);
    for (const s of [...(roomSockets.get(key) ?? [])]) {
      s.data.rooms.delete(key); roomSockets.get(key)?.delete(s);
      send(s, { t: "dm.closed", room: key });
    }
  }

  function blockAct(ws: Sock, t: string, m: Record<string, unknown>) {
    const uid = ws.data.claims!.uid, other = String(m.uid ?? "");
    if (!other || other === uid || !db.user(other)) return err(ws, "bad_request");
    if (t === "block") { db.block(uid, other, now()); closeDm(uid, other); pushFriends(other); }
    else db.unblock(uid, other);
    pushFriends(uid);
  }

  function dmOpen(ws: Sock, m: Record<string, unknown>) {
    const uid = ws.data.claims!.uid, other = String(m.uid ?? "");
    const key = dmKey(uid, other);
    if (!dmAllowed(key, uid)) return err(ws, "dm_closed");
    join(ws, { room: key });
  }

  // ---- grupos de clase ----
  // Un grupo no es público: no aparece en ninguna lista y se entra solo con su código (los 8 caracteres del final de su clave).
  // El nombre es único (sin importar mayúsculas, tildes, espacios ni símbolos) para que no haya dos «3A Matemáticas».
  const CODE_ABC = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const MAX_CLASS_MEMBERS = 80, MAX_CLASSES_CREATED = 3, MAX_CLASSES_JOINED = 8;
  const classCode = (key: string) => key.slice(6);
  const myClasses = (uid: string) => db.roomsOf(uid, "class").map((r) => ({ key: r.key, name: r.name, code: classCode(r.key), owner: r.owner === uid, members: db.memberCount(r.key) }));

  function classCreate(ws: Sock, m: Record<string, unknown>) {
    const c = ws.data, uid = c.claims!.uid;
    if (!c.user?.username) return err(ws, "need_username");
    const name = clean(m.name, 40);
    const bad = checkRoomName(name);
    if (bad) return err(ws, bad === "length" ? "class_name_length" : "class_name_blocked", { why: bad });
    if (db.ownedCount(uid, "class") >= MAX_CLASSES_CREATED) return err(ws, "class_limit_created");
    if (db.countMemberships(uid, "class") >= MAX_CLASSES_JOINED) return err(ws, "class_limit_joined");
    const unique = roomKey(name);
    if (db.roomByNameKey("class", unique)) return err(ws, "class_exists");     // antes del límite: un intento repetido no gasta cupo
    if (roomCreate.take(uid, now())) return err(ws, "rate");
    let key = "";
    for (let i = 0; i < 5; i++) {
      key = "class:" + Array.from({ length: 8 }, () => CODE_ABC[randomInt(CODE_ABC.length)]).join("");
      if (db.createRoom(key, "class", name, uid, now(), unique) === "ok") break;
      if (db.roomByNameKey("class", unique)) return err(ws, "class_exists");   // otro creó el mismo nombre en este instante
      key = "";
    }
    if (!key) return err(ws, "server_error");
    db.addMember(key, uid, now());
    send(ws, { t: "class.created", item: myClasses(uid).find((x) => x.key === key) });
  }

  function classJoin(ws: Sock, m: Record<string, unknown>) {
    const c = ws.data, uid = c.claims!.uid;
    if (!c.user?.username) return err(ws, "need_username");
    const code = clean(m.code, 8).toUpperCase().replace(/[^A-Z0-9]/g, "");
    const key = "class:" + code;
    const r = code.length === 8 ? db.room(key) : null;
    // el mismo error si no existe o el código está mal escrito: no se puede "buscar" grupos
    if (!r || r.kind !== "class") return err(ws, "class_not_found");
    if (db.isMember(key, uid)) return send(ws, { t: "class.joined", item: myClasses(uid).find((x) => x.key === key) });
    if (db.countMemberships(uid, "class") >= MAX_CLASSES_JOINED) return err(ws, "class_limit_joined");
    if (db.memberCount(key) >= MAX_CLASS_MEMBERS) return err(ws, "class_full");
    if (profileLimit.take("cj:" + uid, now())) return err(ws, "rate");     // 10 intentos por hora: frena adivinar códigos
    db.addMember(key, uid, now());
    send(ws, { t: "class.joined", item: myClasses(uid).find((x) => x.key === key) });
    broadcast(key, { t: "sys", room: key, text: "join", u: c.user.username });
  }

  function classLeave(ws: Sock, m: Record<string, unknown>) {
    const uid = ws.data.claims!.uid, key = String(m.room ?? "");
    const r = db.room(key);
    if (!r || r.kind !== "class" || !db.isMember(key, uid)) return err(ws, "bad_request");
    db.removeMember(key, uid);
    if (ws.data.rooms.delete(key)) { roomSockets.get(key)?.delete(ws); }
    const left = db.members(key);
    if (!left.length) db.deleteRoom(key);                         // último en salir: se borra el grupo y se libera el nombre
    else if (r.owner === uid) db.setOwner(key, left[0].uid);       // el dueño se va: pasa al miembro más antiguo
    broadcast(key, { t: "online", room: key, n: onlineCount(key) });
    send(ws, { t: "class.left", room: key });
  }

  function classKick(ws: Sock, m: Record<string, unknown>) {
    const uid = ws.data.claims!.uid, key = String(m.room ?? ""), target = String(m.uid ?? "");
    const r = db.room(key);
    if (!r || r.kind !== "class" || (r.owner !== uid && !ws.data.admin) || target === uid || !db.isMember(key, target)) return err(ws, "forbidden");
    db.removeMember(key, target);
    for (const s of roomSockets.get(key) ?? []) if (s.data.claims?.uid === target) { s.data.rooms.delete(key); roomSockets.get(key)?.delete(s); send(s, { t: "class.left", room: key, kicked: true }); }
    send(ws, { t: "ok", cmd: "class.kick" });
  }

  const wire = (r: { id: number; uid: string; text: string; ts: number; username: string | null; avatar: string }) => ({ id: r.id, uid: r.uid, u: r.username ?? "?", a: r.avatar ?? "a01", text: r.text, ts: r.ts });

  function historyOf(ws: Sock, m: Record<string, unknown>) {
    const key = String(m.room ?? "");
    if (!ws.data.rooms.has(key)) return err(ws, "not_joined");
    const before = Number(m.before);
    send(ws, { t: "history", room: key, items: db.history(key, Number.isFinite(before) && before > 0 ? before : null, HISTORY).map(wire) });
  }

  function sendMessage(ws: Sock, m: Record<string, unknown>) {
    const c = ws.data;
    const u = c.user!;
    if (!u.username) return err(ws, "need_username");
    if (u.muted_until > now()) return err(ws, "muted", { until: u.muted_until });
    const key = String(m.room ?? "");
    if (!c.rooms.has(key)) return err(ws, "not_joined");
    const text = clean(m.text, MAX_TEXT + 1);
    if (text.length > MAX_TEXT) return err(ws, "too_long");
    const why = checkMessage(text);
    if (why) return err(ws, "blocked", { why, cid: m.cid });
    const wait = Math.max(burst.take(u.uid, now()), 0) || minute.take(u.uid, now());
    if (wait) return err(ws, "rate", { retry: wait, cid: m.cid });
    const last = lastText.get(u.uid);
    if (last && last.text === text.toLowerCase() && now() - last.at < 30_000) return err(ws, "duplicate", { cid: m.cid });
    lastText.set(u.uid, { text: text.toLowerCase(), at: now() });
    if (key.startsWith("dm:") && !dmAllowed(key, u.uid)) return err(ws, "dm_closed", { cid: m.cid });
    const id = db.addMessage(key, u.uid, text, now());
    broadcast(key, { t: "msg", room: key, m: { id, uid: u.uid, u: u.username, a: u.avatar, text, ts: now() }, cid: m.cid });
    if (key.startsWith("dm:")) {
      // la otra persona puede no tener el chat abierto: se le avisa para que cargue la conversación
      const peer = dmPeer(key, u.uid)!;
      for (const s of sockets) if (s.data.claims?.uid === peer && !s.data.rooms.has(key)) send(s, { t: "dm.notify", room: key, from: u.uid, u: u.username });
    }
  }

  function report(ws: Sock, m: Record<string, unknown>) {
    const c = ws.data;
    const msg = db.message(Number(m.id));
    const reason = String(m.reason ?? "other");
    if (!msg || msg.deleted || !REPORT_REASONS.includes(reason)) return err(ws, "bad_request");
    if (!c.rooms.has(msg.room)) return err(ws, "not_joined");
    if (msg.uid === c.claims!.uid) return err(ws, "own_message");
    if (reportLimit.take(c.claims!.uid, now())) return err(ws, "rate");
    if (db.addReport(msg, c.claims!.uid, reason, now()) === "dup") return err(ws, "already_reported");
    if (db.reportersOf(msg.id) >= (msg.room.startsWith("dm:") ? 1 : AUTO_HIDE_REPORTS)) {   // en un directo solo hay una persona que pueda reportar
      db.deleteMessage(msg.id);
      broadcast(msg.room, { t: "del", room: msg.room, id: msg.id });
    }
    send(ws, { t: "reported", id: msg.id });
  }

  // ---- administración ----
  function adminCmd(ws: Sock, t: string, m: Record<string, unknown>) {
    if (!ws.data.admin) return err(ws, "forbidden");
    switch (t) {
      case "admin.reports":
        return send(ws, { t: "admin.reports", items: db.openReports(100) });
      case "admin.find":
        return send(ws, { t: "admin.users", items: db.findUsers(String(m.q ?? "").slice(0, 40)).map((u) => ({ uid: u.uid, username: u.username, avatar: u.avatar, email: u.email, muted_until: u.muted_until, banned: u.banned, last_seen: u.last_seen })) });
      case "admin.delete": {
        const msg = db.message(Number(m.id));
        if (!msg) return err(ws, "bad_request");
        db.deleteMessage(msg.id);
        db.closeReportsOfMessage(msg.id, "deleted");
        broadcast(msg.room, { t: "del", room: msg.room, id: msg.id });
        return send(ws, { t: "ok", cmd: t });
      }
      case "admin.dismiss":
        db.closeReport(Number(m.id), "dismissed");
        return send(ws, { t: "ok", cmd: t });
      case "admin.mute": {
        const mins = Math.max(0, Math.min(60 * 24 * 30, Number(m.minutes) || 0));
        const target = db.user(String(m.uid ?? ""));
        if (!target) return err(ws, "bad_request");
        db.setMute(target.uid, mins ? now() + mins * 60_000 : 0);
        notify(target.uid, { t: "me", me: undefined });
        return send(ws, { t: "ok", cmd: t });
      }
      case "admin.ban": {
        const target = db.user(String(m.uid ?? ""));
        if (!target) return err(ws, "bad_request");
        db.setBan(target.uid, !!m.on);
        if (m.on) for (const s of [...sockets]) if (s.data.claims?.uid === target.uid) { err(s, "banned"); s.close(1008, "banned"); }
        return send(ws, { t: "ok", cmd: t });
      }
      case "admin.rename": {
        // nombre o avatar inapropiado: se borra y la persona debe elegir otro
        const target = db.user(String(m.uid ?? ""));
        if (!target) return err(ws, "bad_request");
        db.clearUsername(target.uid);
        notify(target.uid, { t: "reset_profile" });
        return send(ws, { t: "ok", cmd: t });
      }
      default:
        return err(ws, "bad_request");
    }
  }
  function notify(uid: string, o: unknown) {
    for (const s of sockets) if (s.data.claims?.uid === uid) {
      refresh(s);
      send(s, o && (o as { t: string }).t === "me" ? { t: "me", me: me(s) } : o);
    }
  }

  // ---- servidor ----
  const perIp = new Map<string, number>();
  const server = Bun.serve<Conn>({
    port: opts.port ?? 0,
    hostname: opts.hostname ?? "127.0.0.1",
    fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === "/api/chat/health") return Response.json({ ok: true, online: sockets.size });
      if (url.pathname !== "/api/chat/ws") return new Response("not found", { status: 404 });
      const origin = req.headers.get("origin");
      if (origin && !origins.includes(origin)) return new Response("forbidden", { status: 403 });
      const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || srv.requestIP(req)?.address || "?";
      if ((perIp.get(ip) ?? 0) >= 8) return new Response("too many connections", { status: 429 });
      if (srv.upgrade(req, { data: { id: nextId++, ip, claims: null, user: null, admin: false, rooms: new Set() } as Conn })) return undefined;
      return new Response("expected websocket", { status: 426 });
    },
    websocket: {
      maxPayloadLength: 8192,
      idleTimeout: 120,
      open(ws) {
        sockets.add(ws);
        perIp.set(ws.data.ip, (perIp.get(ws.data.ip) ?? 0) + 1);
        // quien no se identifica en 10 s se corta
        setTimeout(() => { if (!ws.data.claims && sockets.has(ws)) ws.close(1008, "auth timeout"); }, 10_000).unref?.();
      },
      message(ws, raw) {
        handle(ws, raw as string).catch((e) => {
          console.error("[chat] handler failed:", e instanceof Error ? e.message : e);
          err(ws, "server_error");
        });
      },
      close(ws) {
        sockets.delete(ws);
        leaveAll(ws);
        const n = (perIp.get(ws.data.ip) ?? 1) - 1;
        if (n <= 0) perIp.delete(ws.data.ip); else perIp.set(ws.data.ip, n);
      },
    },
  });

  const sweepTimer = setInterval(() => {
    const t = now();
    db.purgeOlderThan(t - RETENTION_MS);
    for (const l of [burst, minute, reportLimit, roomCreate, profileLimit]) l.sweep(t);
    for (const [k, v] of lastText) if (t - v.at > 60_000) lastText.delete(k);
  }, 3600_000);
  sweepTimer.unref?.();
  db.purgeOlderThan(now() - RETENTION_MS);

  return {
    server,
    port: server.port,
    stop() {
      clearInterval(sweepTimer);
      server.stop(true);
    },
  };
}
