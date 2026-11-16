import { afterEach, expect, test } from "bun:test";
import Fastify from "fastify";
import { cleanTitle, firstArtist, lyricsFor, parseLrc, pickBest } from "./lyrics";
import { musicRoutes } from "../routes/music";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

const LRC = "[ar:Band]\n[00:01.50] First\n[00:05.00]\n[01:02.5] Second\n[00:09.10][01:30.00] Chorus <00:09.50>word";

test("parseLrc reads stamps, repeats a multi-stamp line, keeps gaps and skips tags", () => {
  expect(parseLrc(LRC)).toEqual([
    { t: 1.5, text: "First" },
    { t: 5, text: "" },
    { t: 9.1, text: "Chorus word" },
    { t: 62.5, text: "Second" },
    { t: 90, text: "Chorus word" },
  ]);
});

test("cleanTitle drops feat. and remaster suffixes, firstArtist the credits", () => {
  expect(cleanTitle("WTF GOIN (feat. 21 Savage)")).toBe("WTF GOIN");
  expect(cleanTitle("Money - 2011 Remaster")).toBe("Money");
  expect(cleanTitle("Song (Remastered 2009)")).toBe("Song");
  expect(cleanTitle("Live Forever")).toBe("Live Forever");
  expect(firstArtist("Belly Gang Kushington, 21 Savage")).toBe("Belly Gang Kushington");
  expect(firstArtist("Drake feat. Future")).toBe("Drake");
});

const row = (id: number, duration: number, extra: Record<string, unknown> = {}) => ({
  id, trackName: "Song", artistName: "Band", duration,
  syncedLyrics: "[00:01.00] a\n[00:02.00] b\n[00:03.00] c", plainLyrics: "a\nb\nc", ...extra,
});

test("pickBest prefers a synced record at the right length and never reuses timestamps of another cut", () => {
  expect(pickBest([row(1, 300), row(2, 201)], "Song", 200)?.id).toBe(2);
  // only a far-off cut exists: plain text yes, timestamps no
  const far = pickBest([row(3, 300)], "Song", 200);
  expect(far?.id).toBe(3);
  expect(far?.synced).toEqual([]);
  expect(far?.plain).toBe("a\nb\nc");
  expect(pickBest([row(4, 300, { trackName: "Other" })], "Song", 200)).toBeNull();
  expect(pickBest([{ id: 5, duration: 200, instrumental: true }], "Song", 200)).toMatchObject({ instrumental: true, synced: [] });
});

function mockLrclib(handler: (path: string, url: URL) => unknown | undefined) {
  const calls: string[] = [];
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    calls.push(`${url.pathname}${url.search}`);
    const body = handler(url.pathname, url);
    return body === undefined ? new Response("nope", { status: 404 }) : Response.json(body);
  }) as typeof fetch;
  return calls;
}

test("an exact /get hit is returned and cached", async () => {
  const calls = mockLrclib((p) => (p === "/api/get" ? row(10, 200) : undefined));
  const first = await lyricsFor("Band", "Exact Hit", "Album", 200);
  expect(first?.synced.length).toBe(3);
  await lyricsFor("Band", "Exact Hit", "Album", 200);
  expect(calls.length).toBe(1);
});

test("a /get miss falls back to /search with the cleaned names, and a miss is remembered", async () => {
  const calls = mockLrclib((p, u) => (p === "/api/search" && u.searchParams.get("track_name") === "Fallback Song" ? [row(11, 201)] : undefined));
  const res = await lyricsFor("Band, Guest", "Fallback Song (feat. Guest)", undefined, 200);
  expect(res?.id).toBe(11);
  expect(calls.some((c) => c.startsWith("/api/search?artist_name=Band&track_name=Fallback+Song"))).toBe(true);

  const none = mockLrclib(() => undefined);
  expect(await lyricsFor("Nobody", "No Such Song", undefined, 123)).toBeNull();
  const before = none.length;
  expect(await lyricsFor("Nobody", "No Such Song", undefined, 123)).toBeNull();
  expect(none.length).toBe(before);
});

test("LRCLIB being down throws and is not cached", async () => {
  globalThis.fetch = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
  await expect(lyricsFor("Band", "Outage Song", undefined, 200)).rejects.toThrow();
  mockLrclib((p) => (p === "/api/get" ? row(12, 200) : undefined));
  expect((await lyricsFor("Band", "Outage Song", undefined, 200))?.id).toBe(12);
});

test("GET /api/music/lyrics: 400 without names, 404 when none, 200 with lines, no internals leaked", async () => {
  const server = Fastify();
  await server.register(musicRoutes);
  expect((await server.inject({ url: "/api/music/lyrics?title=x" })).statusCode).toBe(400);
  mockLrclib(() => undefined);
  const miss = await server.inject({ url: "/api/music/lyrics?artist=Nobody&title=Route%20Miss&duration=100" });
  expect(miss.statusCode).toBe(404);
  mockLrclib((p) => (p === "/api/get" ? row(13, 100) : undefined));
  const ok = await server.inject({ url: "/api/music/lyrics?artist=Band&title=Route%20Hit&duration=100" });
  expect(ok.statusCode).toBe(200);
  expect(ok.json()).toMatchObject({ id: 13, instrumental: false });
  expect(ok.json().synced[0]).toEqual({ t: 1, text: "a" });
  globalThis.fetch = (async () => new Response("down", { status: 503 })) as unknown as typeof fetch;
  const bad = await server.inject({ url: "/api/music/lyrics?artist=Band&title=Route%20Down&duration=100" });
  expect(bad.statusCode).toBe(502);
  expect(bad.body).not.toContain("503");
  await server.close();
});

test("lyricVersions lists distinct timings of one song, closest length first, and skips other songs", async () => {
  const rows = [
    row(30, 216, { albumName: "Album A", syncedLyrics: "[00:01.00] a\n[00:02.00] b\n[00:03.00] c" }),
    row(31, 216, { albumName: "Same timings, other album", syncedLyrics: "[00:01.00] a\n[00:02.00] b\n[00:03.00] c" }),
    row(32, 217, { albumName: "Album B", syncedLyrics: "[00:04.10] a\n[00:05.00] b\n[00:06.00] c" }),
    row(33, 253, { albumName: "Video", syncedLyrics: "[00:36.70] a\n[00:40.00] b\n[00:44.00] c" }),
    row(34, 216, { trackName: "Another Song", syncedLyrics: "[00:01.00] a\n[00:02.00] b\n[00:03.00] c" }),
  ];
  mockLrclib((p) => (p === "/api/search" ? rows : undefined));
  const { lyricVersions } = await import("./lyrics");
  const v = await lyricVersions("Band", "Song", 217);
  expect(v.map((x) => x.id)).toEqual([32, 30]);          // 253s video too far; duplicate timings and other song dropped
  expect(v[0]).toMatchObject({ album: "Album B", duration: 217, start: 4.1 });
});

test("GET /api/music/lyrics?id= returns that record; bad ids are rejected; /versions lists choices", async () => {
  const server = Fastify();
  await server.register(musicRoutes);
  expect((await server.inject({ url: "/api/music/lyrics?id=abc" })).statusCode).toBe(400);
  mockLrclib((p) => (p === "/api/get/4242" ? row(4242, 216) : p === "/api/search" ? [row(4242, 216)] : undefined));
  const one = await server.inject({ url: "/api/music/lyrics?id=4242" });
  expect(one.statusCode).toBe(200);
  expect(one.json()).toMatchObject({ id: 4242 });
  const list = await server.inject({ url: "/api/music/lyrics/versions?artist=Band&title=Song&duration=216" });
  expect(list.statusCode).toBe(200);
  expect(list.json().versions[0]).toMatchObject({ id: 4242, duration: 216 });
  expect((await server.inject({ url: "/api/music/lyrics/versions?title=x" })).statusCode).toBe(400);
  await server.close();
});
