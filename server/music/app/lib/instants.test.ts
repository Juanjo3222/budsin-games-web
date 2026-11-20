import { afterAll, beforeAll, expect, test } from "bun:test";
import { promises as fsp } from "node:fs";
import os from "node:os";
import path from "node:path";

let dir: string;
let srv: ReturnType<typeof Bun.serve>;
let hits = { mp3: 0, search: 0 };
let mod: typeof import("./instants");

const PAGE = (items: string[]) => `<html><body><div id="instants_container"><div class="instants result-page">${items.join("")}</div></div></body></html>`;
const ITEM = (file: string, name: string, color = "#FF0000") => `<div class="instant">
<div class="circle small-button-background" style="background-color:${color};"></div>
<button class="small-button" onclick="play('/media/sounds/${file}', 'loader-1', 'x-1')" title="Play"></button>
<div id="loader-1" class="loader"></div>
<div class="small-button-shadow"></div>
<a href="/en/instant/x-1/" class="instant-link link-secondary">${name}</a></div>`;

beforeAll(async () => {
  dir = await fsp.mkdtemp(path.join(os.tmpdir(), "inst-"));
  srv = Bun.serve({
    port: 0,
    fetch(req) {
      const u = new URL(req.url);
      if (u.pathname === "/en/search/") {
        hits.search++;
        const q = u.searchParams.get("name") ?? "";
        return new Response(PAGE([ITEM("vine-boom.mp3", "VINE BOOM &amp; co"), ITEM("vine-boom.mp3", "dup"), ITEM("a/b.mp3", "malo"), ITEM("ok_2.mp3", `${q} 2`, "#00ff00")]), { headers: { "content-type": "text/html" } });
      }
      if (u.pathname === "/en/index/us/") return new Response(PAGE([ITEM("trend.mp3", "Trend")]), { headers: { "content-type": "text/html" } });
      if (u.pathname === "/media/sounds/vine-boom.mp3") { hits.mp3++; return new Response(new Uint8Array(500).fill(7), { headers: { "content-type": "audio/mpeg" } }); }
      if (u.pathname === "/media/sounds/html.mp3") return new Response("<html>nope</html>".padEnd(400, " "), { headers: { "content-type": "text/html" } });
      if (u.pathname === "/media/sounds/huge.mp3") return new Response(new Uint8Array(4 * 1024 * 1024), { headers: { "content-type": "audio/mpeg" } });
      return new Response("no", { status: 404 });
    },
  });
  process.env.INSTANTS_BASE = `http://127.0.0.1:${srv.port}`;
  process.env.INSTANTS_CACHE_DIR = dir;
  mod = await import("./instants");
});
afterAll(async () => { srv.stop(true); await fsp.rm(dir, { recursive: true, force: true }); });

test("only plain <name>.mp3 names pass: no paths, no traversal, no other extensions", () => {
  for (const ok of ["vine-boom.mp3", "a_b.c-d.mp3", "x%20y.mp3"]) expect(mod.isInstantName(ok)).toBe(true);
  for (const bad of ["../x.mp3", "a/b.mp3", "x.mp4", ".mp3x", "a..b.mp3", "", "x".repeat(130) + ".mp3", "a b.mp3", "a?b.mp3", "http://evil/x.mp3"]) expect(mod.isInstantName(bad)).toBe(false);
});

test("parseInstants reads name, file and colour, decodes entities, drops duplicates and unsafe files", () => {
  const list = mod.parseInstants(PAGE([ITEM("vine-boom.mp3", "VINE &amp; BOOM", "#ABCDEF"), ITEM("vine-boom.mp3", "dup"), ITEM("a/b.mp3", "malo"), ITEM("ok.mp3", "  Ok   sound ")]));
  expect(list).toEqual([{ name: "VINE & BOOM", file: "vine-boom.mp3", color: "#ABCDEF" }, { name: "Ok sound", file: "ok.mp3", color: "#FF0000" }]);
  expect(mod.parseInstants("<html>nothing here</html>")).toEqual([]);
});

test("search: results come from the page, empty query is the trending list, and repeats are cached", async () => {
  const a = await mod.searchInstants("  Vine   BOOM ");
  expect(a.map((x) => x.file)).toEqual(["vine-boom.mp3", "ok_2.mp3"]);
  const before = hits.search;
  await mod.searchInstants("vine boom");
  expect(hits.search).toBe(before);
  expect((await mod.searchInstants("")).map((x) => x.file)).toEqual(["trend.mp3"]);
});

test("a sound is fetched once, stored on disk and then served from there", async () => {
  const f = await mod.instantFile("vine-boom.mp3");
  expect((await fsp.stat(f)).size).toBe(500);
  const n = hits.mp3;
  expect(await mod.instantFile("vine-boom.mp3")).toBe(f);
  expect(hits.mp3).toBe(n);
});

test("concurrent first requests share one upstream fetch", async () => {
  await fsp.rm(mod.instantsCacheDir(), { recursive: true, force: true });
  const n = hits.mp3;
  await Promise.all([1, 2, 3, 4].map(() => mod.instantFile("vine-boom.mp3")));
  expect(hits.mp3).toBe(n + 1);
});

test("refuses what is not a small audio file, and remembers the failure for a while", async () => {
  for (const name of ["html.mp3", "huge.mp3", "missing.mp3"]) await expect(mod.instantFile(name)).rejects.toBeInstanceOf(mod.InstantUnavailableError);
  await expect(mod.instantFile("../etc/passwd")).rejects.toBeInstanceOf(mod.InstantUnavailableError);
});
