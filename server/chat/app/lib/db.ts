// Base de datos de Budsin Chat (SQLite incluido en Bun). Un solo archivo, modo WAL.
import { Database } from "bun:sqlite";
import { nameKey } from "./filter";

export interface User {
  uid: string;
  username: string | null;
  avatar: string;
  email: string;
  created: number;
  last_seen: number;
  uname_changed: number;
  muted_until: number;
  banned: number;
  media_until: number;
}
export interface Room {
  key: string;
  kind: string;
  name: string;
  owner: string | null;
  created: number;
  last_msg: number;
  slow: number;
}
export interface Msg {
  id: number;
  room: string;
  uid: string;
  text: string;
  ts: number;
  deleted: number;
  media: string | null;
  edited: number;
  reply_to: number | null;
}
export interface Media {
  id: string;
  uid: string;
  kind: string;
  mime: string;
  bytes: number;
  w: number;
  h: number;
  dur: number;
  ts: number;
  room: string | null;
  status: string;
}
export interface Report {
  id: number;
  msg_id: number;
  room: string;
  reported_uid: string;
  reporter_uid: string;
  reason: string;
  text: string;
  ts: number;
  status: string;
  media: string | null;
}

/** what an admin reads in a report about a shared song */
function trackLabel(media: string | null): string {
  if (!media?.startsWith("track:")) return "";
  try { const t = JSON.parse(media.slice(6)); return `🎵 ${t.title} — ${t.artist}`; } catch { return "🎵"; }
}

export interface HistoryRow extends Msg {
  username: string | null;
  avatar: string;
  mkind: string | null;
  mw: number | null;
  mh: number | null;
  mdur: number | null;
  mstatus: string | null;
  rtext: string | null;
  rmedia: string | null;
  rdel: number | null;
  runame: string | null;
  rx: Record<string, string[]>;
}

export class ChatDb {
  readonly db: Database;
  constructor(file: string) {
    this.db = new Database(file, { create: true });
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users(
        uid TEXT PRIMARY KEY, username TEXT, name_key TEXT UNIQUE, avatar TEXT NOT NULL DEFAULT 'a01', email TEXT NOT NULL DEFAULT '',
        created INTEGER NOT NULL, last_seen INTEGER NOT NULL DEFAULT 0, uname_changed INTEGER NOT NULL DEFAULT 0,
        muted_until INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS rooms(
        key TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL, name_key TEXT, owner TEXT, created INTEGER NOT NULL, last_msg INTEGER NOT NULL DEFAULT 0);
      CREATE UNIQUE INDEX IF NOT EXISTS rooms_kind_name ON rooms(kind, name_key) WHERE name_key IS NOT NULL;
      CREATE TABLE IF NOT EXISTS members(room TEXT NOT NULL, uid TEXT NOT NULL, joined INTEGER NOT NULL, PRIMARY KEY(room, uid));
      CREATE INDEX IF NOT EXISTS members_uid ON members(uid);
      CREATE TABLE IF NOT EXISTS messages(
        id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, uid TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL, deleted INTEGER NOT NULL DEFAULT 0);
      CREATE INDEX IF NOT EXISTS messages_room ON messages(room, id);
      CREATE TABLE IF NOT EXISTS friends(
        a TEXT NOT NULL, b TEXT NOT NULL, requester TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(a, b));
      CREATE INDEX IF NOT EXISTS friends_b ON friends(b);
      CREATE TABLE IF NOT EXISTS blocks(blocker TEXT NOT NULL, blocked TEXT NOT NULL, created INTEGER NOT NULL, PRIMARY KEY(blocker, blocked));
      CREATE INDEX IF NOT EXISTS blocks_blocked ON blocks(blocked);
      CREATE TABLE IF NOT EXISTS media(
        id TEXT PRIMARY KEY, uid TEXT NOT NULL, kind TEXT NOT NULL, mime TEXT NOT NULL, bytes INTEGER NOT NULL,
        w INTEGER NOT NULL DEFAULT 0, h INTEGER NOT NULL DEFAULT 0, dur REAL NOT NULL DEFAULT 0, ts INTEGER NOT NULL,
        room TEXT, status TEXT NOT NULL DEFAULT 'pending');
      CREATE INDEX IF NOT EXISTS media_uid ON media(uid, ts);
      CREATE TABLE IF NOT EXISTS user_stickers(uid TEXT NOT NULL, media_id TEXT NOT NULL, added INTEGER NOT NULL, PRIMARY KEY(uid, media_id));
      CREATE TABLE IF NOT EXISTS message_edits(msg_id INTEGER NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL);
      CREATE INDEX IF NOT EXISTS message_edits_msg ON message_edits(msg_id);
      CREATE TABLE IF NOT EXISTS reactions(msg_id INTEGER NOT NULL, uid TEXT NOT NULL, emoji TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(msg_id, uid, emoji));
      CREATE TABLE IF NOT EXISTS pins(room TEXT NOT NULL, msg_id INTEGER NOT NULL, by_uid TEXT NOT NULL, ts INTEGER NOT NULL, PRIMARY KEY(room, msg_id));
      CREATE TABLE IF NOT EXISTS reports(
        id INTEGER PRIMARY KEY AUTOINCREMENT, msg_id INTEGER NOT NULL, room TEXT NOT NULL, reported_uid TEXT NOT NULL, reporter_uid TEXT NOT NULL,
        reason TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', UNIQUE(msg_id, reporter_uid));
      CREATE INDEX IF NOT EXISTS reports_status ON reports(status, id);
    `);
    // columnas añadidas después de la primera versión (bases ya existentes)
    const has = (table: string, col: string) => (this.db.query(`PRAGMA table_info(${table})`).all() as { name: string }[]).some((c) => c.name === col);
    if (!has("messages", "media")) this.db.exec("ALTER TABLE messages ADD COLUMN media TEXT");
    if (!has("users", "media_until")) this.db.exec("ALTER TABLE users ADD COLUMN media_until INTEGER NOT NULL DEFAULT 0");
    if (!has("reports", "media")) this.db.exec("ALTER TABLE reports ADD COLUMN media TEXT");
    if (!has("messages", "edited")) this.db.exec("ALTER TABLE messages ADD COLUMN edited INTEGER NOT NULL DEFAULT 0");
    if (!has("messages", "reply_to")) this.db.exec("ALTER TABLE messages ADD COLUMN reply_to INTEGER");
    if (!has("rooms", "slow")) this.db.exec("ALTER TABLE rooms ADD COLUMN slow INTEGER NOT NULL DEFAULT 0");
  }

  // ---- users ----
  user(uid: string): User | null {
    return (this.db.query("SELECT uid,username,avatar,email,created,last_seen,uname_changed,muted_until,banned,media_until FROM users WHERE uid=?").get(uid) as User) ?? null;
  }
  touchUser(uid: string, email: string, now: number): User {
    this.db.query("INSERT INTO users(uid,email,created,last_seen) VALUES(?,?,?,?) ON CONFLICT(uid) DO UPDATE SET last_seen=excluded.last_seen, email=excluded.email").run(uid, email, now, now);
    return this.user(uid)!;
  }
  /** "taken" when another account has a name that reads the same. */
  setProfile(uid: string, username: string, avatar: string, now: number): "ok" | "taken" {
    try {
      this.db.query("UPDATE users SET username=?, name_key=?, avatar=?, uname_changed=? WHERE uid=?").run(username, nameKey(username), avatar, now, uid);
      return "ok";
    } catch (e) {
      if (/UNIQUE/i.test(String(e))) return "taken";
      throw e;
    }
  }
  setAvatar(uid: string, avatar: string) {
    this.db.query("UPDATE users SET avatar=? WHERE uid=?").run(avatar, uid);
  }
  clearUsername(uid: string) {
    this.db.query("UPDATE users SET username=NULL, name_key=NULL, avatar='a01', uname_changed=0 WHERE uid=?").run(uid);
  }
  setMute(uid: string, until: number) {
    this.db.query("UPDATE users SET muted_until=? WHERE uid=?").run(until, uid);
  }
  setBan(uid: string, on: boolean) {
    this.db.query("UPDATE users SET banned=? WHERE uid=?").run(on ? 1 : 0, uid);
  }
  findUsers(q: string, limit = 20): User[] {
    const like = `%${q.replace(/[\\%_]/g, "\\$&")}%`;          // % y _ de lo escrito valen como letras normales
    return this.db.query("SELECT uid,username,avatar,email,created,last_seen,uname_changed,muted_until,banned,media_until FROM users WHERE username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' ORDER BY last_seen DESC LIMIT ?").all(like, like, limit) as User[];
  }
  userByName(name: string): User | null {
    return (this.db.query("SELECT uid,username,avatar,email,created,last_seen,uname_changed,muted_until,banned,media_until FROM users WHERE name_key=?").get(nameKey(name)) as User) ?? null;
  }

  // ---- rooms ----
  room(key: string): Room | null {
    return (this.db.query("SELECT key,kind,name,owner,created,last_msg,slow FROM rooms WHERE key=?").get(key) as Room) ?? null;
  }
  /** Creates the room if it does not exist (idempotent). `nameKey` makes names unique inside a kind (class groups). */
  createRoom(key: string, kind: string, name: string, owner: string | null, now: number, unique?: string): "ok" | "exists" {
    try {
      this.db.query("INSERT INTO rooms(key,kind,name,name_key,owner,created) VALUES(?,?,?,?,?,?)").run(key, kind, name, unique ?? null, owner, now);
      return "ok";
    } catch (e) {
      if (/UNIQUE|PRIMARY/i.test(String(e))) return "exists";
      throw e;
    }
  }
  roomByNameKey(kind: string, unique: string): Room | null {
    return (this.db.query("SELECT key,kind,name,owner,created,last_msg,slow FROM rooms WHERE kind=? AND name_key=?").get(kind, unique) as Room) ?? null;
  }
  activeRooms(kind: string, limit = 40): Room[] {
    return this.db.query("SELECT key,kind,name,owner,created,last_msg,slow FROM rooms WHERE kind=? ORDER BY last_msg DESC, created DESC LIMIT ?").all(kind, limit) as Room[];
  }
  countRooms(kind: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM rooms WHERE kind=?").get(kind) as { n: number }).n;
  }
  countRoomsBy(owner: string, kind: string, since: number): number {
    return (this.db.query("SELECT COUNT(*) n FROM rooms WHERE owner=? AND kind=? AND created>?").get(owner, kind, since) as { n: number }).n;
  }

  // ---- members (class groups) ----
  addMember(room: string, uid: string, now: number) {
    this.db.query("INSERT OR IGNORE INTO members(room,uid,joined) VALUES(?,?,?)").run(room, uid, now);
  }
  removeMember(room: string, uid: string) {
    this.db.query("DELETE FROM members WHERE room=? AND uid=?").run(room, uid);
  }
  isMember(room: string, uid: string): boolean {
    return !!this.db.query("SELECT 1 x FROM members WHERE room=? AND uid=?").get(room, uid);
  }
  memberCount(room: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM members WHERE room=?").get(room) as { n: number }).n;
  }
  /** Rooms of a kind this person belongs to. */
  roomsOf(uid: string, kind: string): Room[] {
    return this.db
      .query("SELECT r.key,r.kind,r.name,r.owner,r.created,r.last_msg,r.slow FROM rooms r JOIN members m ON m.room=r.key WHERE m.uid=? AND r.kind=? ORDER BY r.name")
      .all(uid, kind) as Room[];
  }
  countMemberships(uid: string, kind: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM members m JOIN rooms r ON r.key=m.room WHERE m.uid=? AND r.kind=?").get(uid, kind) as { n: number }).n;
  }
  ownedCount(uid: string, kind: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM rooms WHERE owner=? AND kind=?").get(uid, kind) as { n: number }).n;
  }
  members(room: string): { uid: string; username: string | null; avatar: string }[] {
    return this.db.query("SELECT u.uid,u.username,u.avatar FROM members m JOIN users u ON u.uid=m.uid WHERE m.room=? ORDER BY m.joined").all(room) as { uid: string; username: string | null; avatar: string }[];
  }
  setOwner(room: string, uid: string) {
    this.db.query("UPDATE rooms SET owner=? WHERE key=?").run(uid, room);
  }
  /** Frees the name too: another group may take it afterwards. */
  deleteRoom(key: string) {
    this.db.query("DELETE FROM messages WHERE room=?").run(key);
    this.db.query("DELETE FROM members WHERE room=?").run(key);
    this.db.query("DELETE FROM rooms WHERE key=?").run(key);
  }

  // ---- friends and blocks (direct messages) ----
  private pair(x: string, y: string): [string, string] {
    return x < y ? [x, y] : [y, x];
  }
  friendship(x: string, y: string): { requester: string; status: string } | null {
    const [a, b] = this.pair(x, y);
    return (this.db.query("SELECT requester,status FROM friends WHERE a=? AND b=?").get(a, b) as { requester: string; status: string }) ?? null;
  }
  addFriendRequest(requester: string, target: string, now: number) {
    const [a, b] = this.pair(requester, target);
    this.db.query("INSERT OR IGNORE INTO friends(a,b,requester,status,created) VALUES(?,?,?,'pending',?)").run(a, b, requester, now);
  }
  acceptFriend(x: string, y: string) {
    const [a, b] = this.pair(x, y);
    this.db.query("UPDATE friends SET status='accepted' WHERE a=? AND b=?").run(a, b);
  }
  deleteFriendship(x: string, y: string) {
    const [a, b] = this.pair(x, y);
    this.db.query("DELETE FROM friends WHERE a=? AND b=?").run(a, b);
  }
  /** friends / incoming requests / outgoing requests of a person, with the other side's profile */
  friendRows(uid: string): { uid: string; username: string | null; avatar: string; status: string; requester: string }[] {
    return this.db
      .query(
        `SELECT u.uid,u.username,u.avatar,f.status,f.requester FROM friends f
           JOIN users u ON u.uid = CASE WHEN f.a=? THEN f.b ELSE f.a END
          WHERE f.a=? OR f.b=? ORDER BY u.username`,
      )
      .all(uid, uid, uid) as { uid: string; username: string | null; avatar: string; status: string; requester: string }[];
  }
  countFriends(uid: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM friends WHERE (a=? OR b=?) AND status='accepted'").get(uid, uid) as { n: number }).n;
  }
  countOutgoing(uid: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM friends WHERE requester=? AND status='pending'").get(uid) as { n: number }).n;
  }
  block(blocker: string, blocked: string, now: number) {
    this.db.query("INSERT OR IGNORE INTO blocks(blocker,blocked,created) VALUES(?,?,?)").run(blocker, blocked, now);
    this.deleteFriendship(blocker, blocked);
  }
  unblock(blocker: string, blocked: string) {
    this.db.query("DELETE FROM blocks WHERE blocker=? AND blocked=?").run(blocker, blocked);
  }
  /** blocked in either direction */
  isBlocked(x: string, y: string): boolean {
    return !!this.db.query("SELECT 1 z FROM blocks WHERE (blocker=? AND blocked=?) OR (blocker=? AND blocked=?)").get(x, y, y, x);
  }
  blockedBy(uid: string): { uid: string; username: string | null }[] {
    return this.db.query("SELECT u.uid,u.username FROM blocks b JOIN users u ON u.uid=b.blocked WHERE b.blocker=? ORDER BY u.username").all(uid) as { uid: string; username: string | null }[];
  }

  // ---- messages ----
  addMessage(room: string, uid: string, text: string, now: number, media: string | null = null, replyTo: number | null = null): number {
    const id = Number(this.db.query("INSERT INTO messages(room,uid,text,ts,media,reply_to) VALUES(?,?,?,?,?,?)").run(room, uid, text, now, media, replyTo).lastInsertRowid);
    this.db.query("UPDATE rooms SET last_msg=? WHERE key=?").run(now, room);
    return id;
  }
  message(id: number): Msg | null {
    return (this.db.query("SELECT id,room,uid,text,ts,deleted,media,edited,reply_to FROM messages WHERE id=?").get(id) as Msg) ?? null;
  }
  history(room: string, before: number | null, limit = 50): HistoryRow[] {
    const rows = this.db
      .query(
        `SELECT m.id,m.room,m.uid,m.text,m.ts,m.deleted,m.media,m.edited,m.reply_to,u.username,u.avatar,d.kind mkind,d.w mw,d.h mh,d.dur mdur,d.status mstatus,
                r.text rtext,r.media rmedia,r.deleted rdel,ru.username runame
           FROM messages m LEFT JOIN users u ON u.uid=m.uid LEFT JOIN media d ON d.id=m.media
                LEFT JOIN messages r ON r.id=m.reply_to LEFT JOIN users ru ON ru.uid=r.uid
          WHERE m.room=? AND m.deleted=0 AND (? IS NULL OR m.id<?) ORDER BY m.id DESC LIMIT ?`,
      )
      .all(room, before, before, limit) as HistoryRow[];
    rows.reverse();
    const rx = this.reactionsFor(rows.map((r) => r.id));
    for (const r of rows) r.rx = rx.get(r.id) ?? {};
    return rows;
  }
  // ---- reactions ----
  /** emoji -> usernames, for a batch of messages */
  reactionsFor(ids: number[]): Map<number, Record<string, string[]>> {
    const out = new Map<number, Record<string, string[]>>();
    if (!ids.length) return out;
    const q = ids.map(() => "?").join(",");
    const rows = this.db.query(`SELECT x.msg_id,x.emoji,u.username FROM reactions x JOIN users u ON u.uid=x.uid WHERE x.msg_id IN (${q}) ORDER BY x.ts`).all(...ids) as { msg_id: number; emoji: string; username: string | null }[];
    for (const r of rows) {
      const m = out.get(r.msg_id) ?? {};
      (m[r.emoji] ??= []).push(r.username ?? "?");
      out.set(r.msg_id, m);
    }
    return out;
  }
  /** toggles; returns "on" | "off" | "full" (too many different emoji on one message) */
  toggleReaction(msgId: number, uid: string, emoji: string, now: number, maxKinds = 8): "on" | "off" | "full" {
    const had = this.db.query("SELECT 1 x FROM reactions WHERE msg_id=? AND uid=? AND emoji=?").get(msgId, uid, emoji);
    if (had) {
      this.db.query("DELETE FROM reactions WHERE msg_id=? AND uid=? AND emoji=?").run(msgId, uid, emoji);
      return "off";
    }
    const kinds = (this.db.query("SELECT COUNT(DISTINCT emoji) n FROM reactions WHERE msg_id=?").get(msgId) as { n: number }).n;
    const exists = this.db.query("SELECT 1 x FROM reactions WHERE msg_id=? AND emoji=?").get(msgId, emoji);
    if (!exists && kinds >= maxKinds) return "full";
    this.db.query("INSERT INTO reactions(msg_id,uid,emoji,ts) VALUES(?,?,?,?)").run(msgId, uid, emoji, now);
    return "on";
  }
  // ---- edits ----
  editMessage(id: number, text: string, old: string, now: number) {
    this.db.query("INSERT INTO message_edits(msg_id,text,ts) VALUES(?,?,?)").run(id, old, now);
    this.db.query("UPDATE messages SET text=?, edited=? WHERE id=?").run(text, now, id);
  }
  editsOf(id: number): { text: string; ts: number }[] {
    return this.db.query("SELECT text,ts FROM message_edits WHERE msg_id=? ORDER BY ts").all(id) as { text: string; ts: number }[];
  }
  editCount(id: number): number {
    return (this.db.query("SELECT COUNT(*) n FROM message_edits WHERE msg_id=?").get(id) as { n: number }).n;
  }
  // ---- pins ----
  pins(room: string): { id: number; text: string; username: string | null; media: string | null }[] {
    return this.db
      .query("SELECT m.id,m.text,m.media,u.username FROM pins p JOIN messages m ON m.id=p.msg_id AND m.deleted=0 LEFT JOIN users u ON u.uid=m.uid WHERE p.room=? ORDER BY p.ts DESC")
      .all(room) as { id: number; text: string; username: string | null; media: string | null }[];
  }
  pinCount(room: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM pins p JOIN messages m ON m.id=p.msg_id AND m.deleted=0 WHERE p.room=?").get(room) as { n: number }).n;
  }
  addPin(room: string, msgId: number, by: string, now: number) {
    this.db.query("INSERT OR IGNORE INTO pins(room,msg_id,by_uid,ts) VALUES(?,?,?,?)").run(room, msgId, by, now);
  }
  removePin(room: string, msgId: number) {
    this.db.query("DELETE FROM pins WHERE room=? AND msg_id=?").run(room, msgId);
  }
  setSlow(room: string, seconds: number) {
    this.db.query("UPDATE rooms SET slow=? WHERE key=?").run(seconds, room);
  }
  deleteMessage(id: number) {
    this.db.query("UPDATE messages SET deleted=1 WHERE id=?").run(id);
    this.db.query("DELETE FROM pins WHERE msg_id=?").run(id);
  }
  /** is this media referenced by an open report? then its file must be kept even if the author deletes the message */
  mediaUnderReport(mediaId: string): boolean {
    return !!this.db.query("SELECT 1 x FROM reports WHERE media=? AND status='open'").get(mediaId);
  }
  /** Deletes old messages and returns the media files that are no longer needed (stickers in someone's library and media of open reports stay). */
  purgeOlderThan(ts: number): { messages: number; files: { id: string; mime: string }[] } {
    const messages = this.db.query("DELETE FROM messages WHERE ts<?").run(ts).changes;
    const old = this.db
      .query(
        `SELECT id,mime FROM media WHERE ts<? AND id NOT IN (SELECT media_id FROM user_stickers)
            AND id NOT IN (SELECT substr(avatar,3) FROM users WHERE avatar LIKE 'm:%')
            AND id NOT IN (SELECT media FROM reports WHERE media IS NOT NULL AND status='open')`,
      )
      .all(ts) as { id: string; mime: string }[];
    for (const f of old) this.db.query("DELETE FROM media WHERE id=?").run(f.id);
    return { messages, files: old };
  }

  // ---- media ----
  addMedia(m: Omit<Media, "status"> & { status?: string }) {
    this.db.query("INSERT INTO media(id,uid,kind,mime,bytes,w,h,dur,ts,room,status) VALUES(?,?,?,?,?,?,?,?,?,?,?)").run(m.id, m.uid, m.kind, m.mime, m.bytes, m.w, m.h, m.dur, m.ts, m.room, m.status ?? "pending");
  }
  media(id: string): Media | null {
    return (this.db.query("SELECT id,uid,kind,mime,bytes,w,h,dur,ts,room,status FROM media WHERE id=?").get(id) as Media) ?? null;
  }
  setMediaStatus(id: string, status: string) {
    this.db.query("UPDATE media SET status=? WHERE id=?").run(status, id);
  }
  /** a pending upload becomes part of a message (once) */
  attachMedia(id: string, room: string): boolean {
    return this.db.query("UPDATE media SET status='ok', room=? WHERE id=? AND status='pending'").run(room, id).changes === 1;
  }
  deleteMedia(id: string) {
    this.db.query("DELETE FROM user_stickers WHERE media_id=?").run(id);
    this.db.query("DELETE FROM media WHERE id=?").run(id);
  }
  bytesSince(uid: string, since: number): number {
    return (this.db.query("SELECT COALESCE(SUM(bytes),0) n FROM media WHERE uid=? AND ts>?").get(uid, since) as { n: number }).n;
  }
  countMediaSince(uid: string, kind: string, since: number): number {
    return (this.db.query("SELECT COUNT(*) n FROM media WHERE uid=? AND kind=? AND ts>?").get(uid, kind, since) as { n: number }).n;
  }
  setMediaUntil(uid: string, until: number) {
    this.db.query("UPDATE users SET media_until=? WHERE uid=?").run(until, uid);
  }
  // sticker library
  stickersOf(uid: string): Media[] {
    return this.db.query("SELECT d.id,d.uid,d.kind,d.mime,d.bytes,d.w,d.h,d.dur,d.ts,d.room,d.status FROM user_stickers s JOIN media d ON d.id=s.media_id WHERE s.uid=? AND d.status='ok' ORDER BY s.added DESC").all(uid) as Media[];
  }
  /** was this media sent in one of these rooms? (to save somebody else's sticker you must have seen it) */
  mediaSeenIn(mediaId: string, rooms: string[]): boolean {
    if (!rooms.length) return false;
    const q = rooms.map(() => "?").join(",");
    return !!this.db.query(`SELECT 1 x FROM messages WHERE media=? AND deleted=0 AND room IN (${q}) LIMIT 1`).get(mediaId, ...rooms);
  }
  addSticker(uid: string, mediaId: string, now: number) {
    this.db.query("INSERT OR IGNORE INTO user_stickers(uid,media_id,added) VALUES(?,?,?)").run(uid, mediaId, now);
  }
  removeSticker(uid: string, mediaId: string) {
    this.db.query("DELETE FROM user_stickers WHERE uid=? AND media_id=?").run(uid, mediaId);
  }
  hasSticker(uid: string, mediaId: string): boolean {
    return !!this.db.query("SELECT 1 x FROM user_stickers WHERE uid=? AND media_id=?").get(uid, mediaId);
  }
  countStickers(uid: string): number {
    return (this.db.query("SELECT COUNT(*) n FROM user_stickers WHERE uid=?").get(uid) as { n: number }).n;
  }

  // ---- reports ----
  addReport(msg: Msg, reporter: string, reason: string, now: number): "ok" | "dup" {
    try {
      this.db.query("INSERT INTO reports(msg_id,room,reported_uid,reporter_uid,reason,text,ts,media) VALUES(?,?,?,?,?,?,?,?)").run(msg.id, msg.room, msg.uid, reporter, reason, msg.text || trackLabel(msg.media), now, msg.media && !msg.media.startsWith("preset:") && !msg.media.startsWith("track:") ? msg.media : null);
      return "ok";
    } catch (e) {
      if (/UNIQUE/i.test(String(e))) return "dup";
      throw e;
    }
  }
  reportersOf(msgId: number): number {
    return (this.db.query("SELECT COUNT(DISTINCT reporter_uid) n FROM reports WHERE msg_id=?").get(msgId) as { n: number }).n;
  }
  reportsBy(uid: string, since: number): number {
    return (this.db.query("SELECT COUNT(*) n FROM reports WHERE reporter_uid=? AND ts>?").get(uid, since) as { n: number }).n;
  }
  openReports(limit = 100) {
    return this.db
      .query(
        `SELECT r.id,r.msg_id,r.room,r.reported_uid,r.reporter_uid,r.reason,r.text,r.ts,r.status,r.media,
                a.username reported_name, b.username reporter_name, d.kind media_kind, d.status media_status
           FROM reports r LEFT JOIN users a ON a.uid=r.reported_uid LEFT JOIN users b ON b.uid=r.reporter_uid LEFT JOIN media d ON d.id=r.media
          WHERE r.status='open' ORDER BY r.id DESC LIMIT ?`,
      )
      .all(limit) as (Report & { reported_name: string | null; reporter_name: string | null; media_kind: string | null; media_status: string | null })[];
  }
  report(id: number): Report | null {
    return (this.db.query("SELECT id,msg_id,room,reported_uid,reporter_uid,reason,text,ts,status,media FROM reports WHERE id=?").get(id) as Report) ?? null;
  }
  closeReportsOfMessage(msgId: number, status: string) {
    this.db.query("UPDATE reports SET status=? WHERE msg_id=? AND status='open'").run(status, msgId);
  }
  closeReportsOfMedia(mediaId: string, status: string) {
    this.db.query("UPDATE reports SET status=? WHERE media=? AND status='open'").run(status, mediaId);
  }
  closeReport(id: number, status: string) {
    this.db.query("UPDATE reports SET status=? WHERE id=?").run(status, id);
  }
}
