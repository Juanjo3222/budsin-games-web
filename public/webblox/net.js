// Red de WebBlox: las peticiones del motor a *.roblox.com / *.rbxcdn.com salen por Wisp con epoxy (el TLS termina en el navegador).
import { rewriteRequest, fixJoinResponse } from "./roblox.js";

export const WISP = "wss://budsin-wisp.onrender.com/wisp/";
const JAR_KEY = "webblox-jar";
let transport = null, ready = null, join = null, session = "";

export const setJoin = (j) => { join = j; };
export const setSession = (cookie) => { session = cookie || ""; };

function loadEpoxy() {
  if (globalThis.EpoxyTransport) return Promise.resolve(globalThis.EpoxyTransport.default || globalThis.EpoxyTransport);
  return new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "/epoxy/index.js";
    s.onload = () => res(globalThis.EpoxyTransport.default || globalThis.EpoxyTransport);
    s.onerror = () => rej(new Error("no se pudo cargar epoxy"));
    document.head.appendChild(s);
  });
}
export function connect() {
  ready ||= (async () => {
    const T = await loadEpoxy();
    const t = new T({ wisp: WISP });
    await t.init();
    transport = t;
  })().catch((e) => { ready = null; throw e; });
  return ready;
}

// ---- jar de cookies (localStorage, sin la sesión: esa se lee del navegador integrado y vive solo en memoria) ----
let jar = [];
try { jar = JSON.parse(localStorage.getItem(JAR_KEY) || "[]"); } catch {}
const saveJar = () => { try { localStorage.setItem(JAR_KEY, JSON.stringify(jar.filter((c) => c.name !== ".ROBLOSECURITY"))); } catch {} };
const domainMatch = (host, d) => host === d || host.endsWith("." + d);
function cookieHeader(u) {
  const now = Date.now();
  jar = jar.filter((c) => !c.exp || c.exp > now);
  const parts = jar.filter((c) => domainMatch(u.hostname, c.domain) && u.pathname.startsWith(c.path) && (!c.secure || u.protocol === "https:")).map((c) => `${c.name}=${c.value}`);
  if (session && domainMatch(u.hostname, "roblox.com") && !jar.some((c) => c.name === ".ROBLOSECURITY")) parts.push(".ROBLOSECURITY=" + session);
  return parts.join("; ");
}
function storeCookies(u, setCookies) {
  for (const line of setCookies) {
    const [pair, ...attrs] = line.split(";").map((s) => s.trim());
    const eq = pair.indexOf("=");
    if (eq < 1) continue;
    const c = { name: pair.slice(0, eq), value: pair.slice(eq + 1), domain: u.hostname, path: "/", exp: 0, secure: false };
    for (const a of attrs) {
      const [k, v = ""] = a.split("=");
      const key = k.toLowerCase();
      if (key === "domain" && v) c.domain = v.replace(/^\./, "").toLowerCase();
      else if (key === "path" && v) c.path = v;
      else if (key === "secure") c.secure = true;
      else if (key === "max-age") c.exp = Date.now() + Number(v) * 1000;
      else if (key === "expires" && !c.exp) { const t = Date.parse(v); if (t) c.exp = t; }
    }
    if (!domainMatch(u.hostname, c.domain)) continue;       // un host no puede poner cookies de otro dominio
    jar = jar.filter((x) => !(x.name === c.name && x.domain === c.domain && x.path === c.path));
    if (!c.exp || c.exp > Date.now()) jar.push(c);
  }
  saveJar();
}

/** fetch a través de Wisp. Devuelve { status, statusText, headers: [[k,v]], body: ReadableStream|null }. */
export async function proxyFetch(url, { method = "GET", headers = [], body = null, signal, redirect = "follow" } = {}) {
  // Las flags van fijadas junto a la versión del motor (flags.json): una actualización de flags de Roblox no rompe un motor más antiguo.
  const pu = new URL(url);
  if (pu.hostname === "clientsettingscdn.roblox.com" && pu.pathname === "/v2/settings/application/WebClientApp" && method === "GET") {
    const r = await fetch(new URL("flags.json", import.meta.url));
    return { status: r.status, statusText: "", headers: [["content-type", "application/json"], ["cache-control", "no-store"]], body: r.body, url };
  }
  await connect();
  let cur = { url, method, headers: [...headers], body };
  for (let hop = 0; hop < 10; hop++) {
    const rw = rewriteRequest(cur.url, cur.method, cur.headers, cur.body, join);
    const u = new URL(rw.url);
    const hdrs = new Map(rw.headers);
    const ck = cookieHeader(u);
    if (ck) hdrs.set("cookie", ck);
    const res = await transport.request(u, cur.method, rw.body ?? undefined, [...hdrs], signal);
    const setCookies = res.headers.filter(([k]) => k.toLowerCase() === "set-cookie").map(([, v]) => v);
    if (setCookies.length) storeCookies(u, setCookies);
    const loc = res.headers.find(([k]) => k.toLowerCase() === "location");
    if (redirect === "follow" && loc && [301, 302, 303, 307, 308].includes(res.status)) {
      const next = new URL(loc[1], u).href;
      const keep = res.status === 307 || res.status === 308;
      cur = { url: next, method: keep ? cur.method : "GET", headers: cur.headers, body: keep ? cur.body : null };
      try { await res.body?.cancel(); } catch {}
      continue;
    }
    const headersOut = res.headers.filter(([k]) => k.toLowerCase() !== "set-cookie");
    let bodyOut = res.body;
    const ct = (headersOut.find(([k]) => k.toLowerCase() === "content-type") || [, ""])[1];
    if (u.hostname === "gamejoin.roblox.com" && /json/i.test(ct) && res.body) {
      const text = await new Response(res.body).text();
      bodyOut = new Response(fixJoinResponse(u.href, text)).body;
    }
    return { status: res.status, statusText: res.statusText || "", headers: headersOut, body: bodyOut, url: u.href };
  }
  throw new Error("demasiadas redirecciones");
}

// ---- puente con el service worker: el SW intercepta las peticiones del motor y las manda aquí ----
export function startBridge() {
  navigator.serviceWorker.addEventListener("message", async (ev) => {
    const m = ev.data;
    if (!m || m.type !== "net-request" || !ev.ports[0]) return;
    const port = ev.ports[0];
    try {
      const res = await proxyFetch(m.url, { method: m.method, headers: m.headers, body: m.body, redirect: m.redirect || "follow" });
      port.postMessage({ type: "head", status: res.status, statusText: res.statusText, headers: res.headers });
      if (res.body) {
        const reader = res.body.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          const buf = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
          port.postMessage({ type: "chunk", buf }, [buf]);
        }
      }
      port.postMessage({ type: "end" });
    } catch (e) {
      port.postMessage({ type: "error", message: String(e && e.message || e) });
    }
  });
  navigator.serviceWorker.controller?.postMessage({ type: "bridge-ready" });
}
