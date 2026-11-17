import { afterEach, beforeEach, expect, test } from "bun:test";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { clientKey, musicRoutes } from "./music";
import { resetDjForTests } from "../lib/dj";

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
