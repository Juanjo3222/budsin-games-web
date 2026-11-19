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
}
export interface Room {
  key: string;
  kind: string;
  name: string;
  owner: string | null;
  created: number;
  last_msg: number;
}
export interface Msg {
  id: number;
  room: string;
  uid: string;
  text: string;
  ts: number;
  deleted: number;
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
      CREATE TABLE IF NOT EXISTS reports(
        id INTEGER PRIMARY KEY AUTOINCREMENT, msg_id INTEGER NOT NULL, room TEXT NOT NULL, reported_uid TEXT NOT NULL, reporter_uid TEXT NOT NULL,
        reason TEXT NOT NULL, text TEXT NOT NULL, ts INTEGER NOT NULL, status TEXT NOT NULL DEFAULT 'open', UNIQUE(msg_id, reporter_uid));
      CREATE INDEX IF NOT EXISTS reports_status ON reports(status, id);
    `);
  }

  // ---- users ----
  user(uid: string): User | null {
    return (this.db.query("SELECT uid,username,avatar,email,created,last_seen,uname_changed,muted_until,banned FROM users WHERE uid=?").get(uid) as User) ?? null;
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
    return this.db.query("SELECT uid,username,avatar,email,created,last_seen,uname_changed,muted_until,banned FROM users WHERE username LIKE ? ESCAPE '\\' OR email LIKE ? ESCAPE '\\' ORDER BY last_seen DESC LIMIT ?").all(like, like, limit) as User[];
  }
  userByName(name: string): User | null {
    return (this.db.query("SELECT uid,username,avatar,email,created,last_seen,uname_changed,muted_until,banned FROM users WHERE name_key=?").get(nameKey(name)) as User) ?? null;
  }

  // ---- rooms ----
  room(key: string): Room | null {
    return (this.db.query("SELECT key,kind,name,owner,created,last_msg FROM rooms WHERE key=?").get(key) as Room) ?? null;
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
    return (this.db.query("SELECT key,kind,name,owner,created,last_msg FROM rooms WHERE kind=? AND name_key=?").get(kind, unique) as Room) ?? null;
  }
  activeRooms(kind: string, limit = 40): Room[] {
    return this.db.query("SELECT key,kind,name,owner,created,last_msg FROM rooms WHERE kind=? ORDER BY last_msg DESC, created DESC LIMIT ?").all(kind, limit) as Room[];
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
      .query("SELECT r.key,r.kind,r.name,r.owner,r.created,r.last_msg FROM rooms r JOIN members m ON m.room=r.key WHERE m.uid=? AND r.kind=? ORDER BY r.name")
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
  addMessage(room: string, uid: string, text: string, now: number): number {
    const id = Number(this.db.query("INSERT INTO messages(room,uid,text,ts) VALUES(?,?,?,?)").run(room, uid, text, now).lastInsertRowid);
    this.db.query("UPDATE rooms SET last_msg=? WHERE key=?").run(now, room);
    return id;
  }
  message(id: number): Msg | null {
    return (this.db.query("SELECT id,room,uid,text,ts,deleted FROM messages WHERE id=?").get(id) as Msg) ?? null;
  }
  history(room: string, before: number | null, limit = 50): (Msg & { username: string | null; avatar: string })[] {
    const rows = this.db
      .query(
        `SELECT m.id,m.room,m.uid,m.text,m.ts,m.deleted,u.username,u.avatar FROM messages m LEFT JOIN users u ON u.uid=m.uid
         WHERE m.room=? AND m.deleted=0 AND (? IS NULL OR m.id<?) ORDER BY m.id DESC LIMIT ?`,
      )
      .all(room, before, before, limit) as (Msg & { username: string | null; avatar: string })[];
    return rows.reverse();
  }
  deleteMessage(id: number) {
    this.db.query("UPDATE messages SET deleted=1 WHERE id=?").run(id);
  }
  purgeOlderThan(ts: number): number {
    return this.db.query("DELETE FROM messages WHERE ts<?").run(ts).changes;
  }

  // ---- reports ----
  addReport(msg: Msg, reporter: string, reason: string, now: number): "ok" | "dup" {
    try {
      this.db.query("INSERT INTO reports(msg_id,room,reported_uid,reporter_uid,reason,text,ts) VALUES(?,?,?,?,?,?,?)").run(msg.id, msg.room, msg.uid, reporter, reason, msg.text, now);
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
        `SELECT r.id,r.msg_id,r.room,r.reported_uid,r.reporter_uid,r.reason,r.text,r.ts,r.status,
                a.username reported_name, b.username reporter_name
           FROM reports r LEFT JOIN users a ON a.uid=r.reported_uid LEFT JOIN users b ON b.uid=r.reporter_uid
          WHERE r.status='open' ORDER BY r.id DESC LIMIT ?`,
      )
      .all(limit) as (Report & { reported_name: string | null; reporter_name: string | null })[];
  }
  report(id: number): Report | null {
    return (this.db.query("SELECT id,msg_id,room,reported_uid,reporter_uid,reason,text,ts,status FROM reports WHERE id=?").get(id) as Report) ?? null;
  }
  closeReportsOfMessage(msgId: number, status: string) {
    this.db.query("UPDATE reports SET status=? WHERE msg_id=? AND status='open'").run(status, msgId);
  }
  closeReport(id: number, status: string) {
    this.db.query("UPDATE reports SET status=? WHERE id=?").run(status, id);
  }
}
