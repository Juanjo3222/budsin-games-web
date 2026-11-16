// Lyrics from LRCLIB (https://lrclib.net), a community database that carries time-synced lines.
//
// The browser never talks to LRCLIB: this server does, so visitors' addresses stay with us, answers are cached,
// and the route can be rate-limited like the rest. Lookup is by artist + title + length, the way LRCLIB itself
// keys its records: an exact /get first, then a /search, because Tidal's titles carry "(feat. X)" and "- 2011
// Remaster" suffixes that LRCLIB's records usually do not.

import { LruCache } from "./lruCache";

const base = () => (process.env.LRCLIB_BASE || "https://lrclib.net").replace(/\/+$/, "");
// LRCLIB asks every client to identify itself.
const USER_AGENT = "BudsinMusic/1.0 (+https://games.budsin.dev)";
const TIMEOUT_MS = Number(process.env.LYRICS_TIMEOUT_MS) || 6000;
/** Synced timestamps are only right for the recording they were made on. */
const DURATION_WINDOW_S = 6;
const MIN_SYNCED_LINES = 3;

export interface LyricLine {
  /** Seconds from the start of the track. */
  t: number;
  text: string;
}

export interface Lyrics {
  id: number | null;
  synced: LyricLine[];
  plain: string | null;
  instrumental: boolean;
}

interface Row {
  id: number;
  trackName?: string;
  artistName?: string;
  albumName?: string;
  duration?: number;
  instrumental?: boolean;
  plainLyrics?: string | null;
  syncedLyrics?: string | null;
}

/** "[mm:ss.xx] text" lines. A line may carry several stamps (a repeated chorus); tags such as [ar:Name] and
 * enhanced per-word stamps (<mm:ss.xx>) are dropped. Empty text is kept: it marks an instrumental gap. */
export function parseLrc(lrc: string): LyricLine[] {
  const stamp = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const out: LyricLine[] = [];
  for (const raw of lrc.split(/\r?\n/)) {
    const stamps = [...raw.matchAll(stamp)];
    if (stamps.length === 0) continue;
    const text = raw.replace(stamp, "").replace(/<\d{1,3}:\d{2}(?:[.:]\d{1,3})?>/g, "").trim();
    for (const m of stamps) {
      const frac = m[3] ? Number(`0.${m[3]}`) : 0;
      out.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text });
    }
  }
  return out.sort((a, b) => a.t - b.t);
}

/** Without the suffixes streaming catalogues add: "(feat. X)", "- Remastered 2011", "- Single Version". */
export function cleanTitle(title: string): string {
  const cleaned = title
    .replace(/\s*[([][^)\]]*\b(feat|ft|featuring|with|prod)\b[^)\]]*[)\]]/gi, "")
    .replace(/\s*[([]\s*(\d{4}\s+)?remaster(ed)?[^)\]]*[)\]]/gi, "")
    .replace(/\s+[-–—]\s+(\d{4}\s+)?(remaster(ed)?|single version|album version|radio edit|mono|stereo|deluxe).*$/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
  return cleaned || title.trim();
}

/** The first credited artist of "A, B & C" / "A feat. B". */
export function firstArtist(artist: string): string {
  return artist.split(/\s*(?:,|&|;|\bfeat\.?|\bft\.?|\bfeaturing\b|\bx\b)\s*/i)[0].trim() || artist.trim();
}

const norm = (s: string) => s.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function hasLyrics(r: Row): boolean {
  return !!(r.syncedLyrics || r.plainLyrics || r.instrumental);
}

function toLyrics(row: Row, allowSynced: boolean): Lyrics | null {
  const parsed = allowSynced && row.syncedLyrics ? parseLrc(row.syncedLyrics) : [];
  const synced = parsed.length >= MIN_SYNCED_LINES ? parsed : [];
  const plain = row.plainLyrics?.trim() || (synced.length ? synced.map((l) => l.text).join("\n") : null);
  const instrumental = !!row.instrumental && synced.length === 0 && !plain;
  if (!synced.length && !plain && !instrumental) return null;
  return { id: row.id ?? null, synced, plain, instrumental };
}

/** The record to use from a list of candidates. A synced one at the right length wins; failing that, any lyrics
 * at the right length; failing that, plain text of a same-named track (never its timestamps, which belong to
 * another cut). */
export function pickBest(rows: Row[], title: string, duration?: number): Lyrics | null {
  const usable = rows.filter(hasLyrics);
  const near = (r: Row) => !duration || !r.duration || Math.abs(r.duration - duration) <= DURATION_WINDOW_S;
  const byCloseness = (a: Row, b: Row) =>
    Math.abs((a.duration ?? duration ?? 0) - (duration ?? 0)) - Math.abs((b.duration ?? duration ?? 0) - (duration ?? 0));
  const inWindow = usable.filter(near).sort(byCloseness);
  const synced = inWindow.find((r) => r.syncedLyrics && parseLrc(r.syncedLyrics).length >= MIN_SYNCED_LINES);
  if (synced) return toLyrics(synced, true);
  const any = inWindow[0];
  if (any) return toLyrics(any, true);
  const wanted = norm(cleanTitle(title));
  const plain = usable.find((r) => r.plainLyrics && norm(cleanTitle(r.trackName ?? "")) === wanted);
  return plain ? toLyrics(plain, false) : null;
}

async function lrclib<T>(path: string, params: Record<string, string | undefined>): Promise<T | null> {
  const url = new URL(path, `${base()}/`);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (res.status === 404) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`lrclib HTTP ${res.status}`);
  }
  return (await res.json()) as T;
}

async function lookup(artist: string, title: string, album: string | undefined, duration: number | undefined): Promise<Lyrics | null> {
  const attempts: [string, string][] = [];
  const add = (a: string, t: string) => {
    if (!attempts.some(([x, y]) => x === a && y === t)) attempts.push([a, t]);
  };
  add(artist, title);
  add(firstArtist(artist), cleanTitle(title));

  // 1. Exact record: LRCLIB answers /get only when artist, title and length (±2s) agree.
  for (const [a, t] of attempts) {
    const row = await lrclib<Row>("api/get", {
      artist_name: a,
      track_name: t,
      album_name: album,
      duration: duration ? String(duration) : undefined,
    });
    if (row && hasLyrics(row)) {
      const exact = toLyrics(row, true);
      if (exact) return exact;
    }
  }

  // 2. Search with the cleaned names, then with a loose query.
  const [a, t] = attempts[attempts.length - 1];
  const rows = (await lrclib<Row[]>("api/search", { artist_name: a, track_name: t })) ?? [];
  const found = pickBest(Array.isArray(rows) ? rows : [], t, duration);
  if (found) return found;
  const loose = (await lrclib<Row[]>("api/search", { q: `${a} ${t}` })) ?? [];
  return pickBest(Array.isArray(loose) ? loose : [], t, duration);
}

export interface LyricVersion {
  id: number;
  album: string;
  duration: number;
  /** When the first sung line starts: the quickest way to tell two timings of one song apart. */
  start: number;
}

/** Other synced records of the same song. LRCLIB often holds several (single, album, compilations, the video cut)
 * whose timestamps differ by seconds, and nothing in the metadata says which one fits a given audio file. */
export async function lyricVersions(artist: string, title: string, duration?: number, album?: string): Promise<LyricVersion[]> {
  const t = cleanTitle(title);
  const a = firstArtist(artist);
  const key = `${norm(a)}|${norm(t)}|${duration ?? ""}|${norm(album ?? "")}`;
  const hit = versionsCache.get(key);
  if (hit) return hit;
  const rows = (await lrclib<Row[]>("api/search", { artist_name: a, track_name: t })) ?? [];
  const wanted = norm(t);
  const seen = new Set<string>();
  const out: LyricVersion[] = [];
  // The record the song's own album points at is the one lookup() picks, and /search does not always list it.
  const exact = album ? await lrclib<Row>("api/get", { artist_name: artist, track_name: title, album_name: album, duration: duration ? String(duration) : undefined }).catch(() => null) : null;
  const candidates = [...(exact && exact.syncedLyrics ? [exact] : []), ...(Array.isArray(rows) ? rows : [])];
  for (const r of candidates) {
    if (!r.syncedLyrics || norm(cleanTitle(r.trackName ?? "")) !== wanted) continue;
    if (duration && r.duration && Math.abs(r.duration - duration) > 12) continue;
    const lines = parseLrc(r.syncedLyrics);
    const first = lines.find((l) => l.text);
    if (lines.length < MIN_SYNCED_LINES || !first) continue;
    // Same timings under another album name are one choice, not two.
    const sig = `${Math.round(first.t * 2)}|${Math.round(r.duration ?? 0)}|${lines.length}`;
    if (seen.has(sig)) continue;
    seen.add(sig);
    out.push({ id: r.id, album: r.albumName ?? "", duration: Math.round(r.duration ?? 0), start: Math.round(first.t * 10) / 10 });
  }
  out.sort((x, y) => Math.abs(x.duration - (duration ?? x.duration)) - Math.abs(y.duration - (duration ?? y.duration)));
  const top = out.slice(0, 8);
  versionsCache.set(key, top);
  return top;
}

/** One specific record, for a version the listener picked. */
export async function lyricsById(id: number): Promise<Lyrics | null> {
  const key = String(id);
  const hit = byIdCache.get(key);
  if (hit) return hit;
  const row = await lrclib<Row>(`api/get/${id}`, {});
  const lyrics = row && hasLyrics(row) ? toLyrics(row, true) : null;
  if (lyrics) byIdCache.set(key, lyrics);
  return lyrics;
}

const versionsCache = new LruCache<LyricVersion[]>("lyricVersions", 1000, 60 * 60_000);
const byIdCache = new LruCache<Lyrics>("lyricsById", 1000, 24 * 60 * 60_000);

// Lyrics do not change: a day for a hit. A miss is retried sooner, since LRCLIB gains records all the time.
const found = new LruCache<Lyrics>("lyrics", 5000, 24 * 60 * 60_000);
const missing = new LruCache<true>("lyricsMissing", 5000, 30 * 60_000);
const inFlight = new Map<string, Promise<Lyrics | null>>();

/** Lyrics for a track, or null when LRCLIB has none. Throws when LRCLIB cannot be reached (not cached). */
export function lyricsFor(artist: string, title: string, album?: string, duration?: number): Promise<Lyrics | null> {
  const key = `${norm(artist)}|${norm(title)}|${duration ?? ""}`;
  const hit = found.get(key);
  if (hit) return Promise.resolve(hit);
  if (missing.get(key)) return Promise.resolve(null);
  const running = inFlight.get(key);
  if (running) return running;
  const job = lookup(artist, title, album, duration).then((result) => {
    if (result) found.set(key, result);
    else missing.set(key, true);
    return result;
  });
  inFlight.set(key, job);
  job.catch(() => {}).finally(() => inFlight.delete(key));
  return job;
}
