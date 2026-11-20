// Soundboard: search and play sounds from MyInstants through this server.
//
// Why a proxy: school networks (Fortinet etc.) block myinstants.com ("Streaming Media and Download"), so the browser
// cannot ask it for anything. The browser asks games.budsin.dev instead; this server asks MyInstants once, keeps the MP3
// on disk and serves it from there. MyInstants has no public API: the search page is read as HTML, and if its markup
// changes the search simply returns nothing (the soundboard keeps its own list).
//
// Security boundary: the host is fixed (INSTANTS_BASE) and a sound is only ever fetched at /media/sounds/<name>.mp3 where
// <name> matches NAME_RE. Nothing the caller sends becomes a host or a free-form path, so this is not an open proxy.

import { promises as fsp } from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { readBodyAtMost } from "./readBodyAtMost";
import { LruCache } from "./lruCache";

const base = () => (process.env.INSTANTS_BASE || "https://www.myinstants.com").replace(/\/+$/, "");
const UA = "Mozilla/5.0 (compatible; BudsinGames/1.0; +https://games.budsin.dev)";
const TIMEOUT_MS = Number(process.env.INSTANTS_TIMEOUT_MS) || 8000;
const MAX_HTML = 2 * 1024 * 1024;
const MAX_MP3 = Number(process.env.INSTANTS_MAX_BYTES) || 3 * 1024 * 1024;

export const NAME_RE = /^[A-Za-z0-9_.%-]{1,120}\.mp3$/;
export const isInstantName = (n: string) => NAME_RE.test(n) && !n.includes("..");

export function instantsCacheDir(): string {
  return process.env.INSTANTS_CACHE_DIR || path.join(process.cwd(), "data", "instants-cache");
}

export interface Instant {
  name: string;
  /** file name inside /media/sounds/ (served by /api/music/sb/mp3/:file) */
  file: string;
  color: string;
}

const decode = (s: string) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Reads the sounds out of a MyInstants results page. Defensive: anything that does not fit is skipped. */
export function parseInstants(html: string, limit = 60): Instant[] {
  const out: Instant[] = [];
  const seen = new Set<string>();
  const re = /<div class="instant">([\s\S]*?)<div class="small-button-shadow">[\s\S]*?<a [^>]*class="instant-link[^"]*"[^>]*>([^<]*)<\/a>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) && out.length < limit) {
    const block = m[1];
    const mp3 = /play\('\/media\/sounds\/([^'"\\/]+\.mp3)'/.exec(block)?.[1];
    if (!mp3 || !isInstantName(mp3) || seen.has(mp3)) continue;
    const color = /background-color:\s*(#[0-9a-fA-F]{3,8})/.exec(block)?.[1] ?? "#888888";
    const name = decode(m[2]).replace(/\s+/g, " ").trim().slice(0, 80);
    if (!name) continue;
    seen.add(mp3);
    out.push({ name, file: mp3, color });
  }
  return out;
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": UA, accept: "text/html" }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
  if (!res.ok || !res.body) throw new Error(`MyInstants answered ${res.status}`);
  const buf = await readBodyAtMost(res.body, MAX_HTML);
  if (!buf) throw new Error("MyInstants page too large");
  return buf.toString("utf8");
}

const searches = new LruCache<Instant[]>("instants-search", 500, 10 * 60_000);

/** `q` empty: what is trending. Cached for 10 minutes. */
export async function searchInstants(q: string): Promise<Instant[]> {
  const term = q.trim().toLowerCase().replace(/\s+/g, " ").slice(0, 60);
  const hit = searches.get(term);
  if (hit) return hit;
  const url = term ? `${base()}/en/search/?name=${encodeURIComponent(term)}` : `${base()}/en/index/us/`;
  const list = parseInstants(await fetchText(url));
  searches.set(term, list);
  return list;
}

// ---- sounds on disk ----
function fileFor(name: string): string {
  const key = crypto.createHash("sha256").update(name).digest("hex").slice(0, 32);
  return path.join(instantsCacheDir(), key.slice(0, 2), `${key}.mp3`);
}

const inflight = new Map<string, Promise<string>>();
const negative = new Map<string, number>();
const NEGATIVE_MS = 10 * 60_000;

export class InstantUnavailableError extends Error {}

async function download(name: string, final: string): Promise<string> {
  const res = await fetch(`${base()}/media/sounds/${name}`, { headers: { "user-agent": UA, accept: "audio/*" }, signal: AbortSignal.timeout(TIMEOUT_MS) });
  const type = res.headers.get("content-type") ?? "";
  if (!res.ok || !res.body) throw new InstantUnavailableError(`MyInstants answered ${res.status}`);
  if (!/^audio\//i.test(type)) throw new InstantUnavailableError("not audio");
  const declared = Number(res.headers.get("content-length"));
  if (declared && declared > MAX_MP3) throw new InstantUnavailableError("too large");
  const body = await readBodyAtMost(res.body, MAX_MP3);
  if (!body || body.length < 200) throw new InstantUnavailableError("empty or too large");
  await fsp.mkdir(path.dirname(final), { recursive: true });
  const tmp = `${final}.${crypto.randomBytes(4).toString("hex")}.tmp`;
  await fsp.writeFile(tmp, body);
  await fsp.rename(tmp, final);
  return final;
}

/** Path of the cached MP3, fetching it from MyInstants the first time. Throws InstantUnavailableError when it cannot be had. */
export async function instantFile(name: string): Promise<string> {
  if (!isInstantName(name)) throw new InstantUnavailableError("bad name");
  const final = fileFor(name);
  try {
    const st = await fsp.stat(final);
    if (st.isFile() && st.size > 0) return final;
  } catch {}
  const bad = negative.get(name);
  if (bad && bad > Date.now()) throw new InstantUnavailableError("recently failed");
  let job = inflight.get(name);
  if (!job) {
    job = download(name, final).finally(() => inflight.delete(name));
    inflight.set(name, job);
  }
  try {
    return await job;
  } catch (e) {
    if (negative.size > 5000) negative.clear();
    negative.set(name, Date.now() + NEGATIVE_MS);
    throw e instanceof InstantUnavailableError ? e : new InstantUnavailableError(e instanceof Error ? e.message : String(e));
  }
}
