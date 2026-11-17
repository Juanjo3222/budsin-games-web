import { afterEach, beforeEach, expect, test } from "bun:test";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { clientKey, musicRoutes } from "./music";
import { resetDjForTests } from "../lib/dj";
import { resetTtsForTests } from "../lib/tts";

const realFetch = globalThis.fetch;
const env = { ...process.env };
beforeEach(() => {
  resetDjForTests();
  delete process.env.DJ_API_KEY;
  delete process.env.DJ_DAILY_MAX;
});
afterEach(() => {
  globalThis.fetch = realFetch;
  process.env = { ...env };
});

async function app() {
  const server = Fastify();
  await server.register(rateLimit, { global: false, keyGenerator: clientKey });
  await server.register(musicRoutes);
  return server;
}
const body = { from: { title: "A", artist: "B" }, to: { title: "C", artist: "D" }, lang: "en", reason: "similar" };
const post = (server: Awaited<ReturnType<typeof app>>, payload: unknown, ip = "1.1.1.1") =>
  server.inject({ method: "POST", url: "/api/music/dj", payload: payload as never, headers: { "cf-connecting-ip": ip } });

test("status says whether the AI is configured", async () => {
  const server = await app();
  expect((await server.inject({ method: "GET", url: "/api/music/dj/status" })).json()).toEqual({ ai: false });
  process.env.DJ_API_KEY = "k";
  expect((await server.inject({ method: "GET", url: "/api/music/dj/status" })).json()).toEqual({ ai: true });
  await server.close();
});

test("with no key the DJ route answers 503 so the page uses its templates", async () => {
  const server = await app();
  expect((await post(server, body)).statusCode).toBe(503);
  await server.close();
});

test("bad input is a 400, a good one returns the text, and the key never leaks into the answer", async () => {
  process.env.DJ_API_KEY = "super-secret-key";
  globalThis.fetch = (async () => new Response(JSON.stringify({ output_text: "Suena C de D." }), { status: 200 })) as never;
  const server = await app();
  expect((await post(server, { ...body, lang: "xx yy" })).statusCode).toBe(400);
  expect((await post(server, { to: {} })).statusCode).toBe(400);
  const ok = await post(server, body);
  expect(ok.statusCode).toBe(200);
  expect(ok.json()).toEqual({ text: "Suena C de D." });
  expect(ok.body).not.toContain("super-secret-key");
  await server.close();
});

test("a gateway error is a 502 and an exhausted budget is a 429", async () => {
  process.env.DJ_API_KEY = "k";
  globalThis.fetch = (async () => new Response("boom", { status: 500 })) as never;
  const server = await app();
  expect((await post(server, { ...body, to: { title: "fails-once", artist: "x" } })).statusCode).toBe(502);
  process.env.DJ_DAILY_MAX = "1";
  resetDjForTests();
  globalThis.fetch = (async () => new Response(JSON.stringify({ output_text: "hola" }), { status: 200 })) as never;
  expect((await post(server, { ...body, to: { title: "uno", artist: "x" } })).statusCode).toBe(200);
  expect((await post(server, { ...body, to: { title: "dos", artist: "x" } })).statusCode).toBe(429);
  await server.close();
});

test("each visitor gets at most 10 requests a minute", async () => {
  const server = await app();
  for (let i = 0; i < 10; i++) expect((await post(server, body, "7.7.7.7")).statusCode).toBe(503);
  expect((await post(server, body, "7.7.7.7")).statusCode).toBe(429);
  expect((await post(server, body, "6.6.6.6")).statusCode).toBe(503);
  await server.close();
});

test("an oversized body is refused", async () => {
  process.env.DJ_API_KEY = "k";
  const server = await app();
  const r = await post(server, { ...body, to: { title: "x".repeat(6000), artist: "y" } });
  expect(r.statusCode).toBe(413);
  await server.close();
});

const songs = (n: number) => Array.from({ length: n }, (_, i) => ({ title: "Song " + i, artist: "Artist " + i, fav: i === 0 }));
const pickBody = { request: "tranquilo", lang: "es", candidates: songs(8), count: 4 };
const postPick = (server: Awaited<ReturnType<typeof app>>, payload: unknown, ip = "2.2.2.2") =>
  server.inject({ method: "POST", url: "/api/music/dj/pick", payload: payload as never, headers: { "cf-connecting-ip": ip } });

test("pick: 503 without a key, 400 for bad input", async () => {
  const server = await app();
  expect((await postPick(server, pickBody)).statusCode).toBe(503);
  process.env.DJ_API_KEY = "k";
  expect((await postPick(server, { ...pickBody, candidates: songs(1) })).statusCode).toBe(400);
  expect((await postPick(server, { ...pickBody, lang: "no no" })).statusCode).toBe(400);
  await server.close();
});

test("pick: returns only numbers that exist in the list, and never the key", async () => {
  process.env.DJ_API_KEY = "super-secret-key";
  globalThis.fetch = (async () => new Response(JSON.stringify({ output_text: '{"picks":[{"n":5,"why":"suave"},{"n":99,"why":"inventada"},{"n":2,"why":"sigue"}],"intro":"Vamos con Song 5."}' }), { status: 200 })) as never;
  const server = await app();
  const r = await postPick(server, pickBody);
  expect(r.statusCode).toBe(200);
  expect(r.json().picks.map((p: { n: number }) => p.n)).toEqual([5, 2]);
  expect(r.json().intro).toBe("Vamos con Song 5.");
  expect(r.body).not.toContain("super-secret-key");
  await server.close();
});

test("pick: an unusable model answer is a 502, a spent budget a 429, and each visitor has 4 a minute", async () => {
  process.env.DJ_API_KEY = "k";
  globalThis.fetch = (async () => new Response(JSON.stringify({ output_text: "no puedo" }), { status: 200 })) as never;
  const server = await app();
  expect((await postPick(server, { ...pickBody, request: "uno" }, "3.3.3.3")).statusCode).toBe(502);
  process.env.DJ_DAILY_MAX = "1";   // the call above already spent it
  expect((await postPick(server, { ...pickBody, request: "dos" }, "3.3.3.4")).statusCode).toBe(429);
  delete process.env.DJ_DAILY_MAX;
  for (let i = 0; i < 4; i++) await postPick(server, { ...pickBody, request: "r" + i }, "4.4.4.4");
  expect((await postPick(server, { ...pickBody, request: "otra" }, "4.4.4.4")).statusCode).toBe(429);
  await server.close();
});

test("pick: an oversized body is refused", async () => {
  process.env.DJ_API_KEY = "k";
  const server = await app();
  const r = await postPick(server, { ...pickBody, request: "x".repeat(20000) });
  expect(r.statusCode).toBe(413);
  await server.close();
});

test("voices: lists configured engines; tts validates, hides the keys and falls back with the right status codes", async () => {
  resetTtsForTests();
  delete process.env.FISH_API_KEY;
  delete process.env.ELEVENLABS_API_KEY;
  const server = await app();
  const tts = (payload: unknown) => server.inject({ method: "POST", url: "/api/music/dj/tts", payload: payload as never, headers: { "cf-connecting-ip": "9.9.9.9" } });
  expect((await server.inject({ method: "GET", url: "/api/music/dj/voices" })).json()).toEqual({ fish: false, eleven: false });
  expect((await tts({ engine: "fish", text: "hola" })).statusCode).toBe(503);
  expect((await tts({ engine: "nope", text: "hola" })).statusCode).toBe(400);
  process.env.FISH_API_KEY = "fish-super-secret";
  globalThis.fetch = (async () => new Response(new Uint8Array(400).fill(1), { status: 200 })) as never;
  const ok = await tts({ engine: "fish", text: "hola" });
  expect(ok.statusCode).toBe(200);
  expect(ok.headers["content-type"]).toContain("audio/mpeg");
  expect(ok.rawPayload.length).toBe(400);
  expect(JSON.stringify(ok.headers)).not.toContain("fish-super-secret");
  globalThis.fetch = (async () => new Response("down", { status: 500 })) as never;
  expect((await tts({ engine: "fish", text: "otra distinta" })).statusCode).toBe(502);
  process.env.FISH_DAILY_BYTES = "1";
  expect((await tts({ engine: "fish", text: "una más" })).statusCode).toBe(429);
  await server.close();
});
