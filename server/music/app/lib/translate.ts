// Translates a song's lyrics line by line, for the lyrics panel.
//
// The browser never talks to the translation service: this server does, in one request per song, and the answer is
// cached. The service is Google's public "gtx" translate endpoint, which is unofficial (no key, no SLA): if it stops
// answering, the route reports a failure and the lyrics simply stay untranslated.

import { createHash } from "node:crypto";
import { LruCache } from "./lruCache";

const ENDPOINT = process.env.TRANSLATE_URL || "https://translate.googleapis.com/translate_a/single";
const TIMEOUT_MS = Number(process.env.TRANSLATE_TIMEOUT_MS) || 8000;
const UA = "Mozilla/5.0 (compatible; BudsinMusic/1.0; +https://games.budsin.dev)";

export const TARGETS = new Set(["es", "en", "pt"]);
export const MAX_LINES = 220;
export const MAX_LINE_CHARS = 300;
export const MAX_TOTAL_CHARS = 14_000;

export interface Translation {
  to: string;
  /** Language the service detected in the lyrics. */
  src: string;
  /** One translated string per input line, same order. Empty input lines stay empty. */
  lines: string[];
}

/** The response is [[ [translated, original, ...], ... ], null, "detected-lang", ...]. */
export function parseGtx(body: unknown): { text: string; src: string } | null {
  if (!Array.isArray(body) || !Array.isArray(body[0])) return null;
  const text = (body[0] as unknown[]).map((seg) => (Array.isArray(seg) && typeof seg[0] === "string" ? seg[0] : "")).join("");
  const src = typeof body[2] === "string" ? body[2] : "";
  return text ? { text, src } : null;
}

async function gtx(q: string, to: string): Promise<{ text: string; src: string } | null> {
  const res = await fetch(`${ENDPOINT}?client=gtx&sl=auto&tl=${to}&dt=t&dj=0`, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8", Accept: "application/json" },
    body: `q=${encodeURIComponent(q)}`,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`translate HTTP ${res.status}`);
  }
  return parseGtx(await res.json());
}

/** Lines are sent joined by newlines and come back in the same order. If the service merges or splits lines the
 * counts differ, and then each non-empty line is translated on its own (a few at a time). */
async function translateLines(lines: string[], to: string): Promise<{ src: string; out: string[] }> {
  const joined = await gtx(lines.join("\n"), to);
  if (joined) {
    const parts = joined.text.split("\n");
    if (parts.length === lines.length) return { src: joined.src, out: parts.map((p, i) => (lines[i].trim() ? p.trim() : "")) };
  }
  const out: string[] = new Array(lines.length).fill("");
  let src = joined?.src ?? "";
  const todo = lines.map((l, i) => [l, i] as const).filter(([l]) => l.trim());
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const [l, i] = todo[next++];
      const r = await gtx(l, to);
      if (r) {
        out[i] = r.text.replace(/\n+/g, " ").trim();
        if (!src) src = r.src;
      }
    }
  };
  await Promise.all(Array.from({ length: 6 }, worker));
  return { src, out };
}

const cache = new LruCache<Translation>("lyricsTranslation", 1500, 24 * 60 * 60_000);
const inFlight = new Map<string, Promise<Translation>>();

/** Throws on a network/service failure (nothing is cached then). */
export function translateLyrics(lines: string[], to: string): Promise<Translation> {
  const key = `${to}|${createHash("sha1").update(lines.join("\n")).digest("hex")}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inFlight.get(key);
  if (running) return running;
  const job = translateLines(lines, to).then(({ src, out }) => {
    const result: Translation = { to, src, lines: out };
    cache.set(key, result);
    return result;
  });
  inFlight.set(key, job);
  job.catch(() => {}).finally(() => inFlight.delete(key));
  return job;
}

/** Validates what the browser sent: an array of strings within the limits. */
export function cleanLines(input: unknown): string[] | null {
  if (!Array.isArray(input) || input.length === 0 || input.length > MAX_LINES) return null;
  let total = 0;
  const out: string[] = [];
  for (const l of input) {
    if (typeof l !== "string") return null;
    const s = l.replace(/[\r\n]+/g, " ").slice(0, MAX_LINE_CHARS);
    total += s.length;
    out.push(s);
  }
  if (total === 0 || total > MAX_TOTAL_CHARS) return null;
  return out;
}
