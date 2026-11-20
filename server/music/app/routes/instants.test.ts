import { afterAll, beforeAll, expect, test } from "bun:test";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";
import { clientKey, musicRoutes } from "./music";

let dir: string;
let upstream: ReturnType<typeof Bun.serve>;
let app: ReturnType<typeof Fastify>;

beforeAll(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "inst-route-"));
  upstream = Bun.serve({
    port: 0,
    fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/en/search/") return new Response(`<div class="instant"><div class="circle" style="background-color:#112233;"></div><button class="small-button" onclick="play('/media/sounds/boom.mp3', 'l', 'b-1')"></button><div class="small-button-shadow"></div><a href="/en/instant/b-1/" class="instant-link link-secondary">BOOM</a></div>`, { headers: { "content-type": "text/html" } });
      if (u.pathname === "/media/sounds/boom.mp3") return new Response(new Uint8Array(1000).map((_, i) => i % 251), { headers: { "content-type": "audio/mpeg" } });
      return new Response("no", { status: 404 });
    },
  });
  process.env.INSTANTS_BASE = `http://127.0.0.1:${upstream.port}`;
  process.env.INSTANTS_CACHE_DIR = dir;
  app = Fastify();
  await app.register(rateLimit, { global: false, keyGenerator: clientKey });
  await app.register(musicRoutes);
  await app.ready();
});
afterAll(async () => { await app.close(); upstream.stop(true); await fsp.rm(dir, { recursive: true, force: true }); });

test("search returns the sounds as JSON with a short public cache", async () => {
  const r = await app.inject({ method: "GET", url: "/api/music/sb/search?q=boom" });
  expect(r.statusCode).toBe(200);
  expect(r.json()).toEqual({ items: [{ name: "BOOM", file: "boom.mp3", color: "#112233" }] });
  expect(r.headers["cache-control"]).toContain("public");
  expect((await app.inject({ method: "GET", url: "/api/music/sb/search?q=" + "x".repeat(61) })).statusCode).toBe(400);
});

test("a sound is served as audio/mpeg from this site, with ranges", async () => {
  const r = await app.inject({ method: "GET", url: "/api/music/sb/mp3/boom.mp3" });
  expect(r.statusCode).toBe(200);
  expect(r.headers["content-type"]).toBe("audio/mpeg");
  expect(r.rawPayload.length).toBe(1000);
  const part = await app.inject({ method: "GET", url: "/api/music/sb/mp3/boom.mp3", headers: { range: "bytes=10-19" } });
  expect(part.statusCode).toBe(206);
  expect(part.rawPayload.length).toBe(10);
});

test("it is not an open proxy: odd names and unknown sounds are refused", async () => {
  for (const bad of ["..%2fetc%2fpasswd", "x.mp4", "a%2fb.mp3", "boom.mp3%00"]) {
    const r = await app.inject({ method: "GET", url: "/api/music/sb/mp3/" + bad });
    expect(r.statusCode).toBe(404);
  }
  expect((await app.inject({ method: "GET", url: "/api/music/sb/mp3/nope.mp3" })).statusCode).toBe(404);
});
