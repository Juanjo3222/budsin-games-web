import { expect, test } from "bun:test";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { clientKey, coldAllowed, musicRoutes, publicStream } from "./music";

const req = (headers: Record<string, string | string[]>, ip = "127.0.0.1") => ({ headers, ip }) as never;

test("clientKey prefers Cloudflare's header, then X-Forwarded-For, then the socket", () => {
  expect(clientKey(req({ "cf-connecting-ip": "1.1.1.1", "x-forwarded-for": "2.2.2.2" }))).toBe("1.1.1.1");
  expect(clientKey(req({ "x-forwarded-for": "2.2.2.2, 10.0.0.1" }))).toBe("2.2.2.2");
  expect(clientKey(req({}))).toBe("127.0.0.1");
});

test("a local stream result never exposes the file path or the loopback URL", () => {
  const out = publicStream(
    {
      url: "http://127.0.0.1:3103/api/music/ytm/audio/abcdefghijk",
      mimeType: "audio/mp4",
      source: "ytm",
      file: "/var/lib/budsin-music/ytm-cache/abcdefghijk.m4a",
    },
    { id: "576533825", isrc: "US1", source: "tidal", title: "Song", artist: "Band", duration: "185", evil: "x" },
  );
  expect(JSON.stringify(out)).not.toContain("/var/lib");
  expect(JSON.stringify(out)).not.toContain("127.0.0.1");
  expect(out).not.toHaveProperty("file");
  expect(out.mimeType).toBe("audio/mp4");
  const url = new URL(out.url, "https://x.test");
  expect(url.pathname).toBe("/api/music/stream");
  expect(url.searchParams.get("id")).toBe("576533825");
  expect(url.searchParams.get("title")).toBe("Song");
  expect(url.searchParams.has("evil")).toBe(false);
});

test("cold resolves are capped per visitor and the window resets", () => {
  const t0 = 1_000_000;
  for (let i = 0; i < 20; i++) expect(coldAllowed("a", t0)).toBe(true);
  expect(coldAllowed("a", t0)).toBe(false);
  expect(coldAllowed("b", t0)).toBe(true);
  expect(coldAllowed("a", t0 + 60_001)).toBe(true);
});

test("a route limit is counted per visitor, not for the whole server", async () => {
  const server = Fastify();
  await server.register(rateLimit, { global: false, keyGenerator: clientKey });
  await server.register(musicRoutes);
  const hit = (ip: string) =>
    server.inject({ method: "GET", url: "/api/music/lookup/artist", headers: { "cf-connecting-ip": ip } });
  // lookup/artist allows 60 a minute; no name is a 400 that needs no network.
  for (let i = 0; i < 60; i++) expect((await hit("9.9.9.9")).statusCode).toBe(400);
  expect((await hit("9.9.9.9")).statusCode).toBe(429);
  expect((await hit("8.8.8.8")).statusCode).toBe(400);
  await server.close();
});
