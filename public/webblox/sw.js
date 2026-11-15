// Service worker de WebBlox: las peticiones del motor (página y workers) a Roblox son de otro origen y el navegador las
// bloquearía por CORS. Aquí se interceptan y se mandan a la página (puente en net.js), que las saca por Wisp.
const HOST = /(^|\.)roblox\.com$|(^|\.)rbxcdn\.com$|(^|\.)robloxlabs\.com$/;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

// Solo la página del reproductor tiene el puente (el lanzador llama a proxyFetch directamente y no escucha mensajes).
const isPlayer = (c) => /\/webblox\/player\.html/.test(c.url);
async function bridgeClient(clientId) {
  if (clientId) { const c = await self.clients.get(clientId); if (c && isPlayer(c)) return c; }   // petición de la propia página
  return (await self.clients.matchAll({ type: "window", includeUncontrolled: true })).find(isPlayer);  // petición de un worker
}

async function forward(request, clientId) {
  const client = await bridgeClient(clientId);
  if (!client) return new Response("WebBlox: no hay página puente", { status: 503 });
  const body = ["GET", "HEAD"].includes(request.method) ? null : await request.arrayBuffer();
  const headers = [...request.headers];
  const ch = new MessageChannel();
  const origin = request.headers.get("origin") || new URL(request.referrer || self.location.href).origin || "*";
  let expose = [];
  const reply = new Promise((resolve, reject) => {
    let controller;
    const stream = new ReadableStream({ start(c) { controller = c; }, cancel() { ch.port1.close(); } });
    ch.port1.onmessage = (ev) => {
      const m = ev.data;
      if (m.type === "head") {
        const h = new Headers();
        for (const [k, v] of m.headers) {
          const lk = k.toLowerCase();
          if (["content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive"].includes(lk)) continue;
          try { h.append(k, v); expose.push(k); } catch {}
        }
        h.set("Cross-Origin-Resource-Policy", "cross-origin");
        h.set("Access-Control-Allow-Origin", origin);
        h.set("Access-Control-Allow-Credentials", "true");
        h.set("Access-Control-Expose-Headers", [...new Set(expose.map((x) => x.toLowerCase()))].join(", "));
        const nullBody = [101, 204, 205, 304].includes(m.status) || request.method === "HEAD";
        resolve(new Response(nullBody ? null : stream, { status: m.status, statusText: m.statusText, headers: h }));
        if (nullBody) controller.close();
      } else if (m.type === "chunk") controller.enqueue(new Uint8Array(m.buf));
      else if (m.type === "end") { try { controller.close(); } catch {} }
      else if (m.type === "error") { try { controller.error(new Error(m.message)); } catch {} reject(new TypeError(m.message)); }
    };
  });
  client.postMessage({ type: "net-request", url: request.url, method: request.method, headers, body, redirect: request.redirect === "manual" ? "manual" : "follow" }, body ? [ch.port2, body] : [ch.port2]);
  return reply;
}

self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (u.origin === self.location.origin || !HOST.test(u.hostname)) return;   // lo demás, sin tocar (WebTransport no pasa por aquí)
  e.respondWith(forward(e.request, e.clientId).catch((err) => new Response(String(err), { status: 502 })));
});
