// Turns a pasted Spotify / YouTube link into a search query ("Artist Song").
//
// Only a fixed list of hosts is ever fetched (no SSRF), and the browser never talks to them: this server does.
// Neither service gives us audio here; we only read the public title/artist and the caller searches our catalogue.

import { LruCache } from "./lruCache";

const UA = "Mozilla/5.0 (compatible; BudsinMusic/1.0; +https://games.budsin.dev)";
const TIMEOUT_MS = 6000;

export interface ResolvedLink {
  provider: "spotify" | "youtube";
  kind: "track" | "album" | "artist" | "playlist" | "video";
  title: string;
  artist: string;
  /** What to type in the search box. */
  query: string;
}

const YT_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"]);

/** Recognised link, normalised, or null. Never returns a URL on a host outside the list. */
export function parseLink(raw: string): { provider: "spotify" | "youtube"; url: string; kind: ResolvedLink["kind"] } | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") return null;
  const host = u.hostname.toLowerCase();
  if (host === "open.spotify.com") {
    // /intl-es/track/ID, /embed/track/ID or /track/ID
    const m = u.pathname.match(/\/(track|album|artist|playlist)\/([A-Za-z0-9]{10,30})/);
    if (!m) return null;
    return { provider: "spotify", url: `https://open.spotify.com/${m[1]}/${m[2]}`, kind: m[1] as ResolvedLink["kind"] };
  }
  if (YT_HOSTS.has(host)) {
    let id = "";
    if (host === "youtu.be") id = u.pathname.split("/")[1] ?? "";
    else if (u.pathname === "/watch") id = u.searchParams.get("v") ?? "";
    else {
      const m = u.pathname.match(/^\/(?:shorts|embed|live)\/([A-Za-z0-9_-]{11})/);
      if (m) id = m[1];
    }
    if (/^[A-Za-z0-9_-]{11}$/.test(id)) return { provider: "youtube", url: `https://www.youtube.com/watch?v=${id}`, kind: "video" };
    return null;
  }
  return null;
}

/** "Artist - Song (Official Video) [HD]" -> "Artist - Song"; drops the noise YouTube titles carry. */
export function cleanYoutubeTitle(title: string): string {
  return title
    .replace(/[([](?:[^)\]]*\b(?:official|video|audio|lyrics?|lyric video|visuali[sz]er|hd|4k|hq|remaster(?:ed)?|music video|mv)\b[^)\]]*)[)\]]/gi, "")
    .replace(/\s*\|.*$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Some Spotify pages give "Listen to X - Album by Y | Spotify" instead of just X. */
export function cleanSpotifyTitle(title: string): string {
  return title
    .replace(/\s*\|\s*Spotify\s*$/i, "")
    .replace(/^Listen to\s+/i, "")
    .replace(/\s+-\s+(?:Album|Single|EP|Song|Playlist|Artist)\b.*$/i, "")
    .replace(/\s+-\s+(?:song|album)\s+and\s+lyrics\s+by\b.*$/i, "")
    .trim();
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)));
}

function meta(html: string, prop: string): string {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, "i");
  const alt = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, "i");
  const m = html.match(re) ?? html.match(alt);
  return m ? decodeEntities(m[1]).trim() : "";
}

async function getText(url: string, accept: string): Promise<string | null> {
  const res = await fetch(url, { headers: { "User-Agent": UA, Accept: accept, "Accept-Language": "en" }, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    return null;
  }
  // These pages are small; cap what we read anyway.
  return (await res.text()).slice(0, 400_000);
}

/** Spotify: og:title is the item, og:description is "Artist · Song · 2019" (tracks) or "Artist · Album · 2020 · 12 songs". */
async function spotify(url: string, kind: ResolvedLink["kind"]): Promise<ResolvedLink | null> {
  const html = await getText(url, "text/html");
  if (!html) return null;
  const title = cleanSpotifyTitle(meta(html, "og:title"));
  if (!title) return null;
  const desc = meta(html, "og:description");
  let artist = "";
  if (kind === "track" || kind === "album") artist = desc.split("·")[0]?.trim() ?? "";
  // Artist/playlist pages: the title is all there is.
  if (kind === "artist" || kind === "playlist") artist = "";
  if (artist && /^(song|listen|album|playlist)\b/i.test(artist)) artist = "";
  const query = [artist, title].filter(Boolean).join(" ");
  return { provider: "spotify", kind, title, artist, query };
}

/** YouTube: the public oEmbed endpoint gives the video title and the channel name. */
async function youtube(url: string): Promise<ResolvedLink | null> {
  const body = await getText(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(url)}`, "application/json");
  if (!body) return null;
  let j: { title?: string; author_name?: string };
  try {
    j = JSON.parse(body);
  } catch {
    return null;
  }
  const raw = String(j.title ?? "").trim();
  if (!raw) return null;
  const title = cleanYoutubeTitle(raw);
  const channel = String(j.author_name ?? "").replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
  // "Artist - Song" titles already name the artist; otherwise the channel usually does.
  const hasArtist = title.includes(" - ") || (channel && title.toLowerCase().includes(channel.toLowerCase()));
  const query = (hasArtist ? title.replace(/\s+-\s+/g, " ") : `${channel} ${title}`).trim();
  return { provider: "youtube", kind: "video", title, artist: channel, query };
}

const cache = new LruCache<ResolvedLink>("linkResolve", 2000, 6 * 60 * 60_000);

/** null when the link is not one we understand or the service has nothing for it. Throws on network failure. */
export async function resolveLink(raw: string): Promise<ResolvedLink | null> {
  const parsed = parseLink(raw);
  if (!parsed) return null;
  const hit = cache.get(parsed.url);
  if (hit) return hit;
  const out = parsed.provider === "spotify" ? await spotify(parsed.url, parsed.kind) : await youtube(parsed.url);
  if (out) cache.set(parsed.url, out);
  return out;
}
