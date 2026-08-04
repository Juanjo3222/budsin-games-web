import { readFileSync, writeFileSync, readdirSync, rmSync } from "node:fs";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const APP_ROOT = join(__dirname, "..");
const PUBLIC = join(__dirname, "..", "..", "public");
const indexHtml = readFileSync(join(PUBLIC, "index.html"), "utf8");

const kept = new Set();
for (const m of indexHtml.matchAll(/react-assets\/[A-Za-z0-9._-]+/g)) kept.add(m[0]);

const assetsDir = join(PUBLIC, "react-assets");
for (const f of readdirSync(assetsDir)) {
  const ref = "react-assets/" + f;
  if (!kept.has(ref)) {
    rmSync(join(assetsDir, f), { force: true });
    console.log("removed stale", ref);
  }
}

function prerender() {
  const bundle = join("/tmp/opencode", "prerender.js");
  execSync(
    `node_modules/.bin/esbuild scripts/prerender-entry.jsx --bundle --platform=node --format=cjs --jsx=automatic --outfile=${bundle} --log-level=error`,
    { cwd: APP_ROOT, stdio: "inherit" }
  );
  const html = execSync(`node ${bundle}`, { cwd: APP_ROOT, encoding: "utf8" });

  if (!html || html.length < 1000) {
    console.error("prerender produced suspicious output, skipping injection");
    return;
  }
  if (!/game-card/.test(html)) {
    console.error("prerender output has no game cards, skipping injection");
    return;
  }

  const current = readFileSync(join(PUBLIC, "index.html"), "utf8");
  if (!current.includes('<div id="root"></div>')) {
    console.error('index.html missing empty #root div, skipping injection');
    return;
  }
  const injected = current.replace('<div id="root"></div>', `<div id="root">${html}</div>`);
  writeFileSync(join(PUBLIC, "index.html"), injected);
  console.log(`prerendered home injected (${html.length} chars)`);
}

prerender();
console.log("postbuild ok");
