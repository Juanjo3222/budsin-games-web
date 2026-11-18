// "Ver el video oficial": finds a song's official music video on YouTube Music.
//
// YT Music's own search, filtered to videos, labels every row with a musicVideoType: OMV is the artist's official
// music video (the others are fan uploads, concert recordings, tutorials…). A row is accepted only when it is an OMV,
// the channel/artist is the song's artist, the title names the same song and the same version (no "Live", "Remix"…).
// The answer is just a video id: the page plays it with YouTube's own embedded player, nothing is downloaded here.

import { LruCache } from "./lruCache";
import { ytmBase } from "./ytm";

const VIDEOS_ONLY_PARAMS = "EgWKAQIQAWoKEAkQBRALEAoQBA==";
const TIMEOUT_MS = Number(process.env.YTM_SEARCH_TIMEOUT_MS) || 6000;
const CLIENT_VERSION = "1.20260927.17.00";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36";

export interface VideoRow {
  id: string;
  title: string;
  artist: string;
  type: string;
  duration: number | null;
}

const norm = (s: string) =>
  s.normalize("NFKD").replace(/\p{M}|['’]/gu, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();
const songOf = (title: string) =>
  norm(title.replace(/[([][^)\]]*[)\]]/g, " ").split(/\s[-–—]\s/)[0]) || norm(title);
const VERSION_WORDS =
  /\b(live|remix|rmx|acoustic|instrumental|cover|karaoke|demo|a ?cappella|acapella|sped[\s-]?up|slowed|reverb|nightcore|rework|bootleg|mashup|8d|piano version|stripped|unplugged|lyrics?|reaction)\b/gi;
const versionKey = (t: string) =>
  [...new Set((t.match(VERSION_WORDS) ?? []).map((w) => w.toLowerCase()))].sort().join(",");

/** Artists of a track ("A, B & C", "A feat. B") as comparable names. */
function artistsOf(artist: string): string[] {
  return artist
    .split(/\s*(?:,|&|;|\bx\b|\bfeat\.?|\bft\.?|\bwith\b)\s*/i)
    .map((a) => norm(a).replace(/ /g, ""))
    .filter(Boolean);
}

/** The official video among the rows of a videos search, or null. Pure: tested without the network. */
export function pickOfficialVideo(rows: VideoRow[], title: string, artist: string, duration?: number): VideoRow | null {
  const wantedSong = songOf(title);
  const wantedArtists = artistsOf(artist);
  if (!wantedSong || !wantedArtists.length) return null;
  const wantedVersion = versionKey(title);
  for (const r of rows) {
    if (r.type !== "MUSIC_VIDEO_TYPE_OMV") continue;
    const channel = norm(r.artist).replace(/ /g, "");
    const rowArtists = artistsOf(r.artist);
    const sameArtist = rowArtists.some((a) => wantedArtists.includes(a)) || wantedArtists.some((a) => channel.includes(a));
    if (!sameArtist) continue;
    if (songOf(r.title) !== wantedSong) continue;
    if (versionKey(r.title) !== wantedVersion) continue;
    // Videos have intros and skits, but a different cut of the song (an hour long, half as long) is another thing.
    if (duration && r.duration && (r.duration < duration - 25 || r.duration > duration + 90)) continue;
    return r;
  }
  return null;
}

interface Run {
  text: string;
  navigationEndpoint?: {
    watchEndpoint?: {
      videoId?: string;
      watchEndpointMusicSupportedConfigs?: { watchEndpointMusicConfig?: { musicVideoType?: string } };
    };
  };
}
interface Renderer {
  flexColumns?: { musicResponsiveListItemFlexColumnRenderer?: { text?: { runs?: Run[] } } }[];
}

function collect(node: unknown, out: Renderer[]): void {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const c of node) collect(c, out);
    return;
  }
  const o = node as Record<string, unknown>;
  if (o.musicResponsiveListItemRenderer) out.push(o.musicResponsiveListItemRenderer as Renderer);
  for (const v of Object.values(o)) collect(v, out);
}

function toSeconds(v: string): number | null {
  if (!/^\d+(:\d{2}){1,2}$/.test(v)) return null;
  const p = v.split(":").map(Number);
  return p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
}

export function parseVideoRows(json: unknown): VideoRow[] {
  const items: Renderer[] = [];
  collect(json, items);
  const out: VideoRow[] = [];
  for (const item of items) {
    const cols = item.flexColumns ?? [];
    const first = cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs?.[0];
    const we = first?.navigationEndpoint?.watchEndpoint;
    if (!first?.text || !we?.videoId) continue;
    const meta = cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? [];
    const fields: string[] = [];
    let cur = "";
    for (const r of meta) {
      if (r.text === " • ") {
        if (cur.trim()) fields.push(cur.trim());
        cur = "";
      } else cur += r.text;
    }
    if (cur.trim()) fields.push(cur.trim());
    const duration = fields.map(toSeconds).find((d): d is number => d !== null) ?? null;
    out.push({
      id: we.videoId,
      title: first.text,
      artist: (fields[0] ?? "").replace(/ - Topic$/, ""),
      type: we.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType ?? "",
      duration,
    });
  }
  return out;
}

async function search(q: string): Promise<VideoRow[]> {
  const base = ytmBase();
  if (!base) throw new Error("ytm not configured");
  const origin = new URL(base).origin;
  const res = await fetch(`${base}/youtubei/v1/search?prettyPrint=false`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Origin": origin,
      Origin: origin,
      Referer: `${origin}/`,
      "User-Agent": UA,
      "Accept-Language": "en-US,en;q=0.9",
      "X-Youtube-Client-Name": "67",
      "X-Youtube-Client-Version": CLIENT_VERSION,
    },
    body: JSON.stringify({
      context: { client: { clientName: "WEB_REMIX", clientVersion: CLIENT_VERSION, hl: "en", gl: "US", userAgent: UA, platform: "DESKTOP" } },
      query: q,
      params: VIDEOS_ONLY_PARAMS,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`innertube HTTP ${res.status}`);
  }
  return parseVideoRows(await res.json());
}

// A found video stays valid for days; "no official video" is also remembered, so a song is searched once.
const cache = new LruCache<{ id: string | null; title?: string }>("ytmVideo", 2000, 12 * 60 * 60_000);
// Ids this lookup has vouched for: the only ones the file route will download (nobody can use it to fetch any video).
const known = new LruCache<true>("ytmVideoKnown", 4000, 24 * 60 * 60_000);
export const isKnownOfficialVideo = (id: string): boolean => known.get(id) === true;
const inFlight = new Map<string, Promise<{ id: string | null; title?: string }>>();

export function officialVideo(title: string, artist: string, duration?: number): Promise<{ id: string | null; title?: string }> {
  const key = `${norm(artist)}|${norm(title)}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inFlight.get(key);
  if (running) return running;
  // The plain search sometimes buries the official video under fan uploads; asking for it by name finds it.
  const job = search(`${artist} ${title}`)
    .then((rows) => pickOfficialVideo(rows, title, artist, duration) ?? search(`${artist} ${title} official video`).then((r2) => pickOfficialVideo(r2, title, artist, duration)))
    .then((p) => {
      const v = p ? { id: p.id, title: p.title } : { id: null };
      if (p) known.set(p.id, true);
      cache.set(key, v);
      return v;
    });
  inFlight.set(key, job);
  job.catch(() => {}).finally(() => inFlight.delete(key));
  return job;
}
