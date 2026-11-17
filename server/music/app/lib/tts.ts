// Spoken voices for "DJ Juanjo": two cloud engines (Fish Audio and ElevenLabs) next to the browser's own voice.
//
// The browser never talks to either service and never sees a key: it sends the short line to this server, which asks
// the engine, caches the audio and answers with an MP3. Keys live only in the server's environment file
// (/etc/budsin-music.env). A engine without its key is simply not offered (the page then keeps the browser voice).
//
// Costs are bounded three ways: a rate limit per visitor (in the route), a cache by text (the same line is paid once)
// and a daily budget per engine (bytes for Fish, characters for ElevenLabs) so a free plan cannot be drained in an
// afternoon. When a budget or the service fails, the route answers an error and the page speaks with the browser voice.

import { createHash } from "node:crypto";
import { LruCache } from "./lruCache";

export type Engine = "fish" | "eleven";
export const ENGINES: readonly Engine[] = ["fish", "eleven"];

const TIMEOUT_MS = Number(process.env.TTS_TIMEOUT_MS) || 15_000;
export const MAX_TEXT = 240;
const UA = "Mozilla/5.0 (compatible; BudsinMusic/1.0; +https://games.budsin.dev)";

const fishUrl = () => (process.env.FISH_API_URL || "https://api.fish.audio").replace(/\/+$/, "");
const elevenUrl = () => (process.env.ELEVENLABS_API_URL || "https://api.elevenlabs.io").replace(/\/+$/, "");
const fishModel = () => process.env.FISH_MODEL || "s2.1-pro-free";
const elevenModel = () => process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";
// A fixed voice keeps the DJ sounding the same every time (Fish's default voice is not promised to be stable).
const elevenVoice = () => process.env.ELEVENLABS_VOICE_ID || "FGY2WhTYpPnrIDTdsKH5";
const fishVoice = () => process.env.FISH_VOICE_ID || "";

export function enginesAvailable(): Record<Engine, boolean> {
  return { fish: !!process.env.FISH_API_KEY, eleven: !!process.env.ELEVENLABS_API_KEY };
}

export class TtsBudgetError extends Error {}

// ---- daily budget (UTC day) ----
const budget: Record<Engine, { day: string; used: number }> = { fish: { day: "", used: 0 }, eleven: { day: "", used: 0 } };
const dailyMax = (e: Engine) => (e === "fish" ? Number(process.env.FISH_DAILY_BYTES) || 300_000 : Number(process.env.ELEVENLABS_DAILY_CHARS) || 3_000);
const cost = (e: Engine, text: string) => (e === "fish" ? Buffer.byteLength(text, "utf8") : [...text].length);
function today(now = new Date()) {
  return now.toISOString().slice(0, 10);
}
export function ttsBudgetLeft(e: Engine, now = new Date()): number {
  const b = budget[e];
  if (b.day !== today(now)) {
    b.day = today(now);
    b.used = 0;
  }
  return Math.max(0, dailyMax(e) - b.used);
}
export function resetTtsForTests() {
  budget.fish = { day: "", used: 0 };
  budget.eleven = { day: "", used: 0 };
  cache.clear();
  inFlight.clear();
}

export interface TtsInput {
  engine: Engine;
  text: string;
  lang: string;
}

/** What arrives from the browser is data: capped, stripped of control characters, and the engine must be one we know. */
export function cleanTtsInput(body: unknown): TtsInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const engine = String(b.engine ?? "");
  if (!ENGINES.includes(engine as Engine)) return null;
  if (typeof b.text !== "string") return null;
  // eslint-disable-next-line no-control-regex
  const text = b.text.replace(/[\u0000-\u001f\u007f]+/g, " ").replace(/\s{2,}/g, " ").trim();
  if (!text || text.length > MAX_TEXT) return null;
  const lang = String(b.lang ?? "es").toLowerCase().split(/[-_]/)[0];
  if (!/^[a-z]{2,3}$/.test(lang)) return null;
  return { engine: engine as Engine, text, lang };
}

async function post(url: string, headers: Record<string, string>, body: unknown): Promise<Buffer> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "User-Agent": UA, "Content-Type": "application/json", Accept: "audio/mpeg", ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) {
    await res.body?.cancel().catch(() => {});
    throw new Error(`tts HTTP ${res.status}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) throw new Error("tts returned no audio");
  return buf;
}

async function synthesize(i: TtsInput): Promise<Buffer> {
  if (i.engine === "fish") {
    const body: Record<string, unknown> = { text: i.text, format: "mp3", latency: "balanced" };
    if (fishVoice()) body.reference_id = fishVoice();
    return post(`${fishUrl()}/v1/tts`, { Authorization: `Bearer ${process.env.FISH_API_KEY}`, model: fishModel() }, body);
  }
  const url = `${elevenUrl()}/v1/text-to-speech/${encodeURIComponent(elevenVoice())}?output_format=mp3_44100_64`;
  const headers = { "xi-api-key": String(process.env.ELEVENLABS_API_KEY) };
  // The language hint helps short lines; if the model does not know it (a 400), it detects the language by itself.
  return post(url, headers, { text: i.text, model_id: elevenModel(), language_code: i.lang }).catch((err) => {
    if (err instanceof Error && err.message === "tts HTTP 400") return post(url, headers, { text: i.text, model_id: elevenModel() });
    throw err;
  });
}

// An hour of lines is a few dozen entries; 250 keeps the memory around 20 MB.
const cache = new LruCache<Buffer>("djTts", 250, 7 * 24 * 60 * 60_000);
const inFlight = new Map<string, Promise<Buffer>>();

/** MP3 for a line. Throws TtsBudgetError when today's budget for that engine is spent, Error when the service fails.
 * A cached line costs nothing. */
export function speak(i: TtsInput): Promise<Buffer> {
  if (!enginesAvailable()[i.engine]) return Promise.reject(new Error("engine not configured"));
  const key = `${i.engine}|${i.lang}|${createHash("sha1").update(i.text).digest("hex")}`;
  const hit = cache.get(key);
  if (hit) return Promise.resolve(hit);
  const running = inFlight.get(key);
  if (running) return running;
  const c = cost(i.engine, i.text);
  if (ttsBudgetLeft(i.engine) < c) return Promise.reject(new TtsBudgetError("daily budget spent"));
  budget[i.engine].used += c;
  const job = synthesize(i)
    .then((buf) => {
      cache.set(key, buf);
      return buf;
    })
    .catch((err) => {
      budget[i.engine].used = Math.max(0, budget[i.engine].used - c);   // a failed call did not spend the plan
      throw err;
    });
  inFlight.set(key, job);
  job.catch(() => {}).finally(() => inFlight.delete(key));
  return job;
}
