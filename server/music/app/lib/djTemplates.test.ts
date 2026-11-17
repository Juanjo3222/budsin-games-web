import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The DJ templates exist twice: in Budsin Music's page and in bm-dj.js (the DJ that follows the listener into Budsin Games).
// This keeps the two copies identical.
const root = join(import.meta.dir, "../../../../public");
function djt(file: string): string {
  const src = readFileSync(join(root, file), "utf8");
  const a = src.indexOf("var DJT = {");
  expect(a).toBeGreaterThan(-1);
  const close = /\n\s*\};/g;
  close.lastIndex = a;
  const m = close.exec(src);
  expect(m).not.toBeNull();
  return src.slice(a, m!.index + m![0].length).split("\n").map((l) => l.trim()).join("\n");
}

test("bm-dj.js carries the same DJ templates as the Budsin Music page", () => {
  expect(djt("bm-dj.js")).toBe(djt("musica/index.html"));
});

test("every template language has all six reasons and uses only known placeholders", () => {
  const block = djt("musica/index.html");
  for (const reason of ["first", "same_artist", "favorite", "similar", "discover", "request"]) {
    expect(block.split(`${reason}:`).length - 1).toBeGreaterThanOrEqual(3);
  }
  const used = new Set([...block.matchAll(/\{(\w+)\}/g)].map((m) => m[1]));
  for (const name of used) expect(["to", "toArtist", "from", "fromArtist"]).toContain(name);
});
