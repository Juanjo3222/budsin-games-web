// Servidor de Budsin Chat: WebSocket en /api/chat/ws (Caddy lo reenvía desde games.budsin.dev).
// Todo pasa por un solo canal JSON. Primer mensaje obligatorio: {t:"auth", token} con el token de Firebase (Google).
import type { ServerWebSocket } from "bun";
import { verifyFirebaseToken, type KeyProvider, type Claims } from "./auth";
import { ChatDb, type Room, type User } from "./db";
import { checkMessage, checkRoomName, checkUsername, nameKey, roomKey } from "./filter";
import { randomBytes, randomInt } from "node:crypto";
import { mkdirSync, promises as fsp } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { LIMITS, MediaError, NSFW_THRESHOLD, processAudio, processImage, type MediaKind, type Scanner, type Tools } from "./media";
import { PRESET_IDS } from "./presets";
import { emailAllowed } from "./access";

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
  mediaDir?: string;       // dónde se guardan imágenes, stickers y audios
  scan?: Scanner;          // detector de contenido sexual; sin él NO se aceptan imágenes ni stickers (falla cerrado)
  tools?: Tools;           // rutas de ffmpeg y ffprobe
  /** Reglas de correo permitidas (ver access.ts). Sin esta opción entra cualquiera (null/undefined); index.ts pasa las de colegios por defecto. */
  allowedDomains?: string[] | null;
  /** Imágenes y stickers propios: APAGADO por defecto. Sin una defensa real contra material de abuso infantil (hashes + revisión) no deben activarse con menores en el sitio. */
  imagesEnabled?: boolean;
  mediaMinAgeMs?: number;  // cuánto debe tener una cuenta para subir imágenes (el audio pide la mitad); por defecto 30 min
  scanHealth?: () => Promise<boolean>;   // ¿responde el detector? (solo para /api/chat/health)
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

// ---- canciones compartidas desde Budsin Music ----
// Lo que llega es dato no confiable (el cliente podría inventarlo): se limpian los campos, el texto pasa por el mismo filtro
// que un mensaje y la portada solo puede venir de los servidores de imágenes de Music.
const ART_HOSTS = /^https:\/\/(resources\.tidal\.com|i\.ytimg\.com|yt3\.ggpht\.com|[a-z0-9-]+\.googleusercontent\.com)\/[^\s"'<>]{1,300}$/;
export interface SharedTrack { id: string; title: string; artist: string; artwork?: string; duration?: number; isrc?: string; source?: string; album?: string }
export function cleanTrack(raw: unknown): SharedTrack | "blocked" | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  // eslint-disable-next-line no-control-regex
  const txt = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f\u200b-\u200f\u202a-\u202e\u2066-\u2069]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
  const id = String(r.id ?? "");
  if (!/^[A-Za-z0-9_-]{1,40}$/.test(id)) return null;
  const title = txt(r.title, 90), artist = txt(r.artist, 90), album = txt(r.album, 90);
  if (!title || !artist) return null;
  // un título que sea un enlace, un teléfono o una grosería no se comparte (mismo criterio que un mensaje)
  for (const t of [title, artist, album]) if (t && checkMessage(t) && checkMessage(t) !== "empty") return "blocked";
  const out: SharedTrack = { id, title, artist };
  if (album) out.album = album;
  if (typeof r.artwork === "string" && ART_HOSTS.test(r.artwork)) out.artwork = r.artwork;
  const d = Number(r.duration); if (Number.isFinite(d) && d > 0 && d < 7200) out.duration = Math.round(d);
  if (typeof r.isrc === "string" && /^[A-Za-z0-9]{12}$/.test(r.isrc)) out.isrc = r.isrc.toUpperCase();
  if (r.source === "tidal" || r.source === "ytm") out.source = r.source;
  return out;
}

export function createChatServer(opts: ServerOptions) {
  const { db, projectId, keys } = opts;
  const now = opts.now ?? Date.now;
  const admins = new Set(opts.adminEmails.map((e) => e.toLowerCase()));
  const origins = opts.origins ?? ["https://games.budsin.dev"];
  const mediaDir = opts.mediaDir ?? path.join(tmpdir(), "budsin-chat-media");
  mkdirSync(mediaDir, { recursive: true });
  const tools: Tools = opts.tools ?? { ffmpeg: "ffmpeg", ffprobe: "ffprobe" };
  const MAX_STICKERS = 24;
  const MIN_AGE_MEDIA = opts.mediaMinAgeMs ?? 30 * 60_000, MIN_AGE_AUDIO = Math.round(MIN_AGE_MEDIA / 3);     // una cuenta recién creada no sube nada todavía
  const DAILY_BYTES = 25_000_000;
  const imgBurst = new Limiter(1, 15_000), imgHour = new Limiter(20, 3600_000), audBurst = new Limiter(1, 8_000), audHour = new Limiter(30, 3600_000), stickHour = new Limiter(6, 3600_000);
  const strikes = new Map<string, number[]>();
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
      if (!claims.emailVerified) {
        err(ws, "email_unverified");
        return ws.close(1008, "email");
      }
      if (!emailAllowed(claims.email, claims.emailVerified, opts.allowedDomains ?? null, admins)) {
        err(ws, "domain_not_allowed");
        return ws.close(1008, "domain");
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
      return send(ws, { t: "hello", me: me(ws), avatars: AVATARS, features: { images: !!opts.imagesEnabled, audio: true } });
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
      case "sticker.list":
      case "sticker.remove":
      case "sticker.save":
        return stickerCmd(ws, t, m);
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

  const wire = (r: { id: number; uid: string; text: string; ts: number; username: string | null; avatar: string; media?: string | null; mkind?: string | null; mw?: number | null; mh?: number | null; mdur?: number | null; mstatus?: string | null }) => {
    const o: Record<string, unknown> = { id: r.id, uid: r.uid, u: r.username ?? "?", a: r.avatar ?? "a01", text: r.text, ts: r.ts };
    if (r.media?.startsWith("track:")) { try { o.track = JSON.parse(r.media.slice(6)); } catch { /* corrupto: se ignora */ } }
    else if (r.media?.startsWith("preset:")) o.sticker = r.media.slice(7);
    else if (r.media && r.mkind) o.media = r.mstatus === "ok" ? { id: r.media, kind: r.mkind, w: r.mw ?? 0, h: r.mh ?? 0, dur: r.mdur ?? 0 } : { id: r.media, kind: r.mkind, hidden: true };
    return o;
  };

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
    let sharedTrack: SharedTrack | null = null;
    if (m.track != null) {
      const tr = cleanTrack(m.track);
      if (!tr) return err(ws, "bad_request", { cid: m.cid });
      if (tr === "blocked") return err(ws, "blocked", { why: "profanity", cid: m.cid });
      sharedTrack = tr;
    }
    const mediaRef = sharedTrack ? null : (m.media == null ? null : String(m.media));
    if (mediaRef && text.length > 120) return err(ws, "too_long");        // el pie de una imagen es corto
    const why = text || !(mediaRef || sharedTrack) ? checkMessage(text) : null;
    if (why) return err(ws, "blocked", { why, cid: m.cid });
    // ---- medios: sticker predefinido, sticker propio, imagen o audio ya subido ----
    let mediaId: string | null = sharedTrack ? "track:" + JSON.stringify(sharedTrack) : null;
    if (mediaRef) {
      if (mediaRef.startsWith("preset:")) {
        if (!PRESET_IDS.has(mediaRef.slice(7))) return err(ws, "bad_request");
        mediaId = mediaRef;
      } else {
        const md = db.media(mediaRef);
        if (!md || md.uid !== u.uid || md.status === "hidden") return err(ws, "bad_media", { cid: m.cid });
        if (md.kind !== "audio" && !opts.imagesEnabled) return err(ws, "images_disabled", { cid: m.cid });
        if (u.media_until > now()) return err(ws, "media_suspended", { cid: m.cid });
        if (md.kind === "audio" && !(key.startsWith("dm:") || key.startsWith("class:"))) return err(ws, "audio_not_allowed", { cid: m.cid });
        if (md.kind === "sticker") { if (!db.hasSticker(u.uid, md.id)) return err(ws, "bad_media", { cid: m.cid }); }
        else if (!db.attachMedia(md.id, key)) return err(ws, "bad_media", { cid: m.cid });   // una imagen o audio se envía una sola vez
        mediaId = md.id;
      }
    }
    const wait = Math.max(burst.take(u.uid, now()), 0) || minute.take(u.uid, now());
    if (wait) return err(ws, "rate", { retry: wait, cid: m.cid });
    const last = lastText.get(u.uid);
    if (!mediaId && last && last.text === text.toLowerCase() && now() - last.at < 30_000) return err(ws, "duplicate", { cid: m.cid });
    if (!mediaId) lastText.set(u.uid, { text: text.toLowerCase(), at: now() });
    if (key.startsWith("dm:") && !dmAllowed(key, u.uid)) return err(ws, "dm_closed", { cid: m.cid });
    const id = db.addMessage(key, u.uid, text, now(), mediaId);
    const row = db.history(key, id + 1, 1)[0];
    broadcast(key, { t: "msg", room: key, m: wire({ ...row, username: u.username, avatar: u.avatar }), cid: m.cid });
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
    // una imagen o audio reportado se oculta YA (hasta que un admin lo revise): es lo que más daño puede hacer
    if (msg.media && !msg.media.startsWith("preset:") && !msg.media.startsWith("track:") && db.media(msg.media)?.status === "ok") {
      db.setMediaStatus(msg.media, "hidden");
      broadcast(msg.room, { t: "media.hidden", room: msg.room, id: msg.media });
      strike(msg.uid);
    }
    if (db.reportersOf(msg.id) >= (msg.room.startsWith("dm:") ? 1 : AUTO_HIDE_REPORTS)) {   // en un directo solo hay una persona que pueda reportar
      db.deleteMessage(msg.id);
      broadcast(msg.room, { t: "del", room: msg.room, id: msg.id });
    }
    send(ws, { t: "reported", id: msg.id });
  }

  /** 3 strikes in 24 h (an image blocked by the scanner, or reported) take away the right to upload for a day. */
  function strike(uid: string) {
    const t = now();
    const list = (strikes.get(uid) ?? []).filter((x) => t - x < 24 * 3600_000);
    list.push(t);
    strikes.set(uid, list);
    if (list.length >= 3) { db.setMediaUntil(uid, t + 24 * 3600_000); strikes.delete(uid); notify(uid, { t: "me", me: undefined }); }
  }

  // ---- biblioteca de stickers ----
  const stickerWire = (x: { id: string; w: number; h: number }) => ({ id: x.id, w: x.w, h: x.h });
  function stickerCmd(ws: Sock, t: string, m: Record<string, unknown>) {
    const uid = ws.data.claims!.uid;
    if (t === "sticker.list") return send(ws, { t: "stickers", items: db.stickersOf(uid).map(stickerWire) });
    const id = String(m.id ?? "");
    if (t === "sticker.remove") { db.removeSticker(uid, id); return send(ws, { t: "stickers", items: db.stickersOf(uid).map(stickerWire) }); }
    if (t === "sticker.save") {
      // guardar el sticker de otra persona: solo si salió en una sala en la que estás
      const md = db.media(id);
      if (!md || md.kind !== "sticker" || md.status !== "ok") return err(ws, "bad_media");
      if (md.uid !== uid && !db.mediaSeenIn(id, [...ws.data.rooms])) return err(ws, "bad_media");
      if (db.countStickers(uid) >= MAX_STICKERS) return err(ws, "sticker_limit");
      db.addSticker(uid, id, now());
      return send(ws, { t: "stickers", items: db.stickersOf(uid).map(stickerWire) });
    }
  }

  // ---- subida y descarga de archivos (HTTP) ----
  const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  const bearer = (req: Request) => /^Bearer (.+)$/.exec(req.headers.get("authorization") ?? "")?.[1] ?? "";

  async function upload(req: Request): Promise<Response> {
    const origin = req.headers.get("origin");
    if (origin && !origins.includes(origin)) return json({ error: "forbidden" }, 403);
    const url = new URL(req.url);
    const kind = url.searchParams.get("kind") as MediaKind;
    if (!["image", "sticker", "audio"].includes(kind)) return json({ error: "bad_request" }, 400);
    if (kind !== "audio" && !opts.imagesEnabled) return json({ error: "images_disabled" }, 403);
    const claims = await verifyFirebaseToken(bearer(req), projectId, keys, now());
    if (!claims) return json({ error: "auth_failed" }, 401);
    if (!emailAllowed(claims.email, claims.emailVerified, opts.allowedDomains ?? null, admins)) return json({ error: "domain_not_allowed" }, 403);
    const user = db.touchUser(claims.uid, claims.email, now());
    if (user.banned) return json({ error: "banned" }, 403);
    if (!user.username) return json({ error: "need_username" }, 403);
    if (user.muted_until > now()) return json({ error: "muted", until: user.muted_until }, 403);
    if (user.media_until > now()) return json({ error: "media_suspended", until: user.media_until }, 403);
    if (now() - user.created < (kind === "audio" ? MIN_AGE_AUDIO : MIN_AGE_MEDIA)) return json({ error: "media_new_account" }, 403);
    // dónde se puede usar: el audio solo en privados y grupos de clase; la imagen, donde ya estés dentro
    const room = url.searchParams.get("room") ?? "";
    if (kind !== "sticker") {
      const r = db.room(room) ?? (room === "global" ? { kind: "global" } : room.startsWith("dm:") ? { kind: "dm" } : null);   // un privado se crea al abrirlo: aún puede no tener fila
      if (!r) return json({ error: "no_room" }, 400);
      if (kind === "audio" && r.kind !== "dm" && r.kind !== "class") return json({ error: "audio_not_allowed" }, 403);
      if (r.kind === "dm" && !dmAllowed(room, user.uid)) return json({ error: "dm_closed" }, 403);
      if (r.kind === "class" && !db.isMember(room, user.uid)) return json({ error: "forbidden" }, 403);
    }
    // límites de ritmo y de volumen
    const t = now();
    const wait = kind === "audio" ? Math.max(audBurst.take(user.uid, t), audHour.take(user.uid, t)) : kind === "sticker" ? stickHour.take(user.uid, t) : Math.max(imgBurst.take(user.uid, t), imgHour.take(user.uid, t));
    if (wait) return json({ error: "media_rate", retry: wait }, 429);
    if (db.bytesSince(user.uid, t - 24 * 3600_000) > DAILY_BYTES) return json({ error: "media_quota" }, 429);
    if (kind === "sticker" && db.countStickers(user.uid) >= MAX_STICKERS) return json({ error: "sticker_limit" }, 400);
    const max = kind === "audio" ? LIMITS.audioIn : LIMITS.imageIn;
    const declared = Number(req.headers.get("content-length"));
    if (!declared || declared > max) return json({ error: "media_too_large" }, 413);
    const body = new Uint8Array(await req.arrayBuffer());
    if (body.length > max) return json({ error: "media_too_large" }, 413);
    try {
      const out = kind === "audio" ? await processAudio(body, tools) : await processImage(body, kind, tools);
      if (kind !== "audio") {
        if (!opts.scan) throw new MediaError("scan_unavailable");
        let score: number;
        try { score = await opts.scan(out.bytes); } catch { throw new MediaError("scan_unavailable"); }   // si el detector falla, NO se acepta
        if (score >= NSFW_THRESHOLD) { strike(user.uid); return json({ error: "media_blocked" }, 422); }
      }
      const id = randomBytes(16).toString("hex");
      await fsp.writeFile(path.join(mediaDir, `${id}.${out.ext}`), out.bytes);
      db.addMedia({ id, uid: user.uid, kind, mime: out.mime, bytes: out.bytes.length, w: out.w, h: out.h, dur: out.dur, ts: t, room: null });
      if (kind === "sticker") { db.addSticker(user.uid, id, t); db.setMediaStatus(id, "ok"); }
      return json({ id, kind, w: out.w, h: out.h, dur: out.dur });
    } catch (e) {
      if (e instanceof MediaError) return json({ error: e.code }, e.code === "scan_unavailable" ? 503 : 400);
      console.error("[chat] upload failed:", e instanceof Error ? e.message : e);
      return json({ error: "server_error" }, 500);
    }
  }

  async function serveMedia(req: Request, id: string): Promise<Response> {
    if (!/^[a-f0-9]{32}$/.test(id)) return new Response("not found", { status: 404 });
    const md = db.media(id);
    if (!md) return new Response("not found", { status: 404 });
    // un archivo oculto (reportado) solo lo ve un admin, que lo pide con su token
    if (md.status === "hidden") {
      const claims = await verifyFirebaseToken(bearer(req), projectId, keys, now());
      if (!claims || !claims.emailVerified || !admins.has(claims.email)) return new Response("not found", { status: 404 });
    }
    const file = path.join(mediaDir, `${id}.${md.mime === "audio/mp4" ? "m4a" : "webp"}`);
    let size: number;
    try { size = (await fsp.stat(file)).size; } catch { return new Response("not found", { status: 404 }); }
    const headers: Record<string, string> = {
      "content-type": md.mime,
      "accept-ranges": "bytes",
      "cache-control": md.status === "hidden" ? "no-store" : "private, max-age=86400",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
      "cross-origin-resource-policy": "same-origin",
    };
    const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.get("range") ?? "");
    if (range) {
      const start = Number(range[1] || 0), end = Math.min(Number(range[2] || size - 1), size - 1);
      if (!(start <= end) || start >= size) return new Response(null, { status: 416, headers: { ...headers, "content-range": `bytes */${size}` } });
      return new Response(Bun.file(file).slice(start, end + 1), { status: 206, headers: { ...headers, "content-range": `bytes ${start}-${end}/${size}`, "content-length": String(end - start + 1) } });
    }
    return new Response(Bun.file(file), { headers: { ...headers, "content-length": String(size) } });
  }

  async function deleteFiles(files: { id: string; mime: string }[]) {
    for (const f of files) await fsp.rm(path.join(mediaDir, `${f.id}.${f.mime === "audio/mp4" ? "m4a" : "webp"}`), { force: true }).catch(() => {});
  }

  // ---- administración ----
  function adminCmd(ws: Sock, t: string, m: Record<string, unknown>) {
    if (!ws.data.admin) return err(ws, "forbidden");
    switch (t) {
      case "admin.reports":
        return send(ws, { t: "admin.reports", items: db.openReports(100) });
      case "admin.find":
        return send(ws, { t: "admin.users", items: db.findUsers(String(m.q ?? "").slice(0, 40)).map((u) => ({ uid: u.uid, username: u.username, avatar: u.avatar, email: u.email, muted_until: u.muted_until, banned: u.banned, last_seen: u.last_seen, media_until: u.media_until })) });
      case "admin.delete": {
        const msg = db.message(Number(m.id));
        if (!msg) return err(ws, "bad_request");
        db.deleteMessage(msg.id);
        db.closeReportsOfMessage(msg.id, "deleted");
        broadcast(msg.room, { t: "del", room: msg.room, id: msg.id });
        return send(ws, { t: "ok", cmd: t });
      }
      case "admin.rooms": {
        const rooms = [...db.activeRooms("class", 200), ...db.activeRooms("game", 200)].map((r) => ({ key: r.key, kind: r.kind, name: r.name, members: r.kind === "class" ? db.memberCount(r.key) : undefined, online: onlineCount(r.key), last_msg: r.last_msg }));
        return send(ws, { t: "admin.rooms", items: rooms });
      }
      case "admin.deleteroom": {
        // un grupo o sala con nombre inapropiado: se borra con sus mensajes y todos salen
        const key = String(m.key ?? "");
        const r = db.room(key);
        if (!r || r.kind === "global" || r.kind === "dm") return err(ws, "bad_request");
        for (const s of [...(roomSockets.get(key) ?? [])]) { s.data.rooms.delete(key); send(s, { t: r.kind === "class" ? "class.left" : "dm.closed", room: key, kicked: true }); }
        roomSockets.delete(key);
        db.deleteRoom(key);
        return send(ws, { t: "ok", cmd: t });
      }
      case "admin.media.restore": {
        const md = db.media(String(m.id ?? ""));
        if (!md) return err(ws, "bad_request");
        db.setMediaStatus(md.id, "ok");
        db.closeReportsOfMedia(md.id, "dismissed");
        if (md.room) broadcast(md.room, { t: "media.restored", room: md.room, id: md.id, media: { id: md.id, kind: md.kind, w: md.w, h: md.h, dur: md.dur } });
        return send(ws, { t: "ok", cmd: t });
      }
      case "admin.media.delete": {
        const md = db.media(String(m.id ?? ""));
        if (!md) return err(ws, "bad_request");
        void deleteFiles([{ id: md.id, mime: md.mime }]);
        db.deleteMedia(md.id);
        db.closeReportsOfMedia(md.id, "deleted");
        if (md.room) broadcast(md.room, { t: "media.hidden", room: md.room, id: md.id });
        return send(ws, { t: "ok", cmd: t });
      }
      case "admin.nomedia": {
        const target = db.user(String(m.uid ?? ""));
        if (!target) return err(ws, "bad_request");
        const hours = Math.max(0, Math.min(24 * 365, Number(m.hours) || 0));
        db.setMediaUntil(target.uid, hours ? now() + hours * 3600_000 : 0);
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
    maxRequestBodySize: 6_000_000,
    fetch(req, srv) {
      const url = new URL(req.url);
      if (url.pathname === "/api/chat/health") return opts.scanHealth ? opts.scanHealth().then((ok) => Response.json({ ok: true, online: sockets.size, scanner: ok })) : Response.json({ ok: true, online: sockets.size, scanner: !!opts.scan });
      if (url.pathname === "/api/chat/upload" && req.method === "POST") return upload(req);
      const mm = /^\/api\/chat\/media\/([a-f0-9]{32})$/.exec(url.pathname);
      if (mm && (req.method === "GET" || req.method === "HEAD")) return serveMedia(req, mm[1]);
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
    void deleteFiles(db.purgeOlderThan(t - RETENTION_MS).files);
    for (const l of [burst, minute, reportLimit, roomCreate, profileLimit, imgBurst, imgHour, audBurst, audHour, stickHour]) l.sweep(t);
    for (const [k, v] of lastText) if (t - v.at > 60_000) lastText.delete(k);
  }, 3600_000);
  sweepTimer.unref?.();
  void deleteFiles(db.purgeOlderThan(now() - RETENTION_MS).files);

  return {
    server,
    port: server.port,
    stop() {
      clearInterval(sweepTimer);
      server.stop(true);
    },
  };
}
