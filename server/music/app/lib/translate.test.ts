import { afterEach, expect, test } from "bun:test";
import { cleanLines, parseGtx, translateLyrics } from "./translate";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("parseGtx joins the segments and reads the detected language", () => {
  expect(parseGtx([[["Hola\n", "Hello\n"], ["mundo", "world"]], null, "en"])).toEqual({ text: "Hola\nmundo", src: "en" });
  expect(parseGtx(null)).toBeNull();
  expect(parseGtx([[]])).toBeNull();
});

test("cleanLines enforces count and size limits and flattens newlines", () => {
  expect(cleanLines(["a", "b\nc"])).toEqual(["a", "b c"]);
  expect(cleanLines([])).toBeNull();
  expect(cleanLines("x")).toBeNull();
  expect(cleanLines([1, 2])).toBeNull();
  expect(cleanLines(Array(300).fill("x"))).toBeNull();
  expect(cleanLines(["", ""])).toBeNull();
  expect(cleanLines(["x".repeat(400)])![0].length).toBe(300);
});

const reply = (text: string, src = "en") => new Response(JSON.stringify([[[text, ""]], null, src]), { status: 200 });

test("translateLyrics keeps line order and blanks, and caches the answer", async () => {
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return reply("uno\n\ndos");
  }) as never;
  const lines = ["one", "", "two"];
  const a = await translateLyrics(lines, "es");
  expect(a).toEqual({ to: "es", src: "en", lines: ["uno", "", "dos"] });
  await translateLyrics(lines, "es");
  expect(calls).toBe(1);
});

test("when the service changes the line count, each line is translated alone", async () => {
  const sent: string[] = [];
  globalThis.fetch = (async (_u: unknown, init: { body: string }) => {
    const q = decodeURIComponent(init.body.slice(2));
    sent.push(q);
    return q.includes("\n") ? reply("todo junto") : reply(`T(${q})`);
  }) as never;
  const out = await translateLyrics(["red", "", "blue"], "pt");
  expect(out.lines).toEqual(["T(red)", "", "T(blue)"]);
  expect(sent.length).toBe(3);
});

test("a service failure rejects and is not cached", async () => {
  let ok = false;
  globalThis.fetch = (async () => (ok ? reply("bien") : new Response("no", { status: 429 }))) as never;
  await expect(translateLyrics(["fail me"], "en")).rejects.toThrow();
  ok = true;
  expect((await translateLyrics(["fail me"], "en")).lines).toEqual(["bien"]);
});
