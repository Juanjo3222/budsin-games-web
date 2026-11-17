import { afterEach, beforeEach, expect, test } from "bun:test";
import { cleanTtsInput, enginesAvailable, resetTtsForTests, speak, ttsBudgetLeft, TtsBudgetError } from "./tts";

const realFetch = globalThis.fetch;
const env = { ...process.env };
beforeEach(() => {
  resetTtsForTests();
  for (const k of ["FISH_API_KEY", "ELEVENLABS_API_KEY", "FISH_DAILY_BYTES", "ELEVENLABS_DAILY_CHARS", "FISH_VOICE_ID", "ELEVENLABS_VOICE_ID"]) delete process.env[k];
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});
const mp3 = () => new Response(new Uint8Array(500).fill(7), { status: 200, headers: { "content-type": "audio/mpeg" } });

test("an engine is available only with its key", () => {
  expect(enginesAvailable()).toEqual({ fish: false, eleven: false });
  process.env.FISH_API_KEY = "a";
  process.env.ELEVENLABS_API_KEY = "b";
  expect(enginesAvailable()).toEqual({ fish: true, eleven: true });
});

test("cleanTtsInput validates engine, text and language, and strips control characters", () => {
  expect(cleanTtsInput({ engine: "fish", text: "Hola\n\tmundo", lang: "es-MX" })).toEqual({ engine: "fish", text: "Hola mundo", lang: "es" });
  expect(cleanTtsInput({ engine: "browser", text: "x" })).toBeNull();
  expect(cleanTtsInput({ engine: "fish", text: "" })).toBeNull();
  expect(cleanTtsInput({ engine: "fish", text: "x".repeat(241) })).toBeNull();
  expect(cleanTtsInput({ engine: "fish", text: "x", lang: "e s" })).toBeNull();
  expect(cleanTtsInput({ engine: "fish", text: 5 })).toBeNull();
  expect(cleanTtsInput(null)).toBeNull();
});

test("Fish: sends the key as a bearer token, the free model header and a balanced latency; caches the audio", async () => {
  process.env.FISH_API_KEY = "fish-secret";
  let calls = 0;
  let seen: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;
  globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
    calls++;
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return mp3();
  }) as never;
  const a = await speak({ engine: "fish", text: "Hola", lang: "es" });
  const b = await speak({ engine: "fish", text: "Hola", lang: "es" });
  expect(a.length).toBe(500);
  expect(b).toBe(a);
  expect(calls).toBe(1);
  expect(seen!.url).toBe("https://api.fish.audio/v1/tts");
  expect(seen!.headers.Authorization).toBe("Bearer fish-secret");
  expect(seen!.headers.model).toBe("s2.1-pro-free");
  expect(seen!.body).toEqual({ text: "Hola", format: "mp3", latency: "balanced" });
  process.env.FISH_VOICE_ID = "voice123";
  await speak({ engine: "fish", text: "Otra", lang: "es" });
  expect(seen!.body.reference_id).toBe("voice123");
});

test("ElevenLabs: key in xi-api-key, fixed voice in the path, language in the body", async () => {
  process.env.ELEVENLABS_API_KEY = "eleven-secret";
  let seen: { url: string; headers: Record<string, string>; body: Record<string, unknown> } | null = null;
  globalThis.fetch = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
    seen = { url, headers: init.headers, body: JSON.parse(init.body) };
    return mp3();
  }) as never;
  await speak({ engine: "eleven", text: "Hola", lang: "pt" });
  expect(seen!.url).toContain("/v1/text-to-speech/FGY2WhTYpPnrIDTdsKH5?output_format=mp3_44100_64");
  expect(seen!.headers["xi-api-key"]).toBe("eleven-secret");
  expect(seen!.body).toEqual({ text: "Hola", model_id: "eleven_flash_v2_5", language_code: "pt" });
});

test("the daily budget stops the engine, counts bytes for Fish and characters for ElevenLabs, and a failure refunds it", async () => {
  process.env.FISH_API_KEY = "k";
  process.env.ELEVENLABS_API_KEY = "k";
  process.env.FISH_DAILY_BYTES = "20";
  process.env.ELEVENLABS_DAILY_CHARS = "10";
  globalThis.fetch = (async () => mp3()) as never;
  await speak({ engine: "fish", text: "ñandú ñandú", lang: "es" });          // 11 chars, 15 bytes
  expect(ttsBudgetLeft("fish")).toBe(5);
  await expect(speak({ engine: "fish", text: "otra línea larga", lang: "es" })).rejects.toBeInstanceOf(TtsBudgetError);
  await speak({ engine: "eleven", text: "ñandú ñan", lang: "es" });           // 9 characters
  expect(ttsBudgetLeft("eleven")).toBe(1);
  globalThis.fetch = (async () => new Response("no", { status: 429 })) as never;
  await expect(speak({ engine: "eleven", text: "a", lang: "es" })).rejects.toThrow("tts HTTP 429");
  expect(ttsBudgetLeft("eleven")).toBe(1);
});

test("an unconfigured engine and a too-short answer both reject", async () => {
  await expect(speak({ engine: "fish", text: "x", lang: "es" })).rejects.toThrow("not configured");
  process.env.FISH_API_KEY = "k";
  globalThis.fetch = (async () => new Response(new Uint8Array(10), { status: 200 })) as never;
  await expect(speak({ engine: "fish", text: "x", lang: "es" })).rejects.toThrow("no audio");
});

test("ElevenLabs: if the language hint is refused (400), the line is retried without it", async () => {
  process.env.ELEVENLABS_API_KEY = "k";
  const bodies: Record<string, unknown>[] = [];
  globalThis.fetch = (async (_u: string, init: { body: string }) => {
    const b = JSON.parse(init.body);
    bodies.push(b);
    return "language_code" in b ? new Response("bad", { status: 400 }) : mp3();
  }) as never;
  const out = await speak({ engine: "eleven", text: "こんにちは", lang: "ja" });
  expect(out.length).toBe(500);
  expect(bodies.length).toBe(2);
  expect("language_code" in bodies[1]).toBe(false);
});
