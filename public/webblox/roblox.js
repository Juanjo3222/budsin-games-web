// Reescrituras que Roblox necesita para aceptar el cliente web a través del proxy.

export const isRoblox = (host) => /(^|\.)roblox\.com$|(^|\.)rbxcdn\.com$|(^|\.)robloxlabs\.com$/.test(host);

/** Cabeceras y cuerpo de una petición saliente. `join` = { gameId } para entrar a un servidor concreto. */
export function rewriteRequest(url, method, headers, body, join) {
  const u = new URL(url);
  const h = new Map();
  for (const [k, v] of headers) h.set(k.toLowerCase(), v);
  // Las que pone el navegador y no deben viajar al servidor de Roblox (la cookie la pone el jar).
  for (const k of [...h.keys()]) if (k === "cookie" || k === "origin" || k === "referer" || k.startsWith("sec-") || k === "host") h.delete(k);

  if (u.hostname === "gamejoin.roblox.com") {
    h.set("rbx-user-agent", "Roblox/Darwin");
    if (method === "POST" && u.pathname === "/v1/join-game" && join?.gameId) {
      u.pathname = "/v1/join-game-instance";
      try {
        const text = body instanceof ArrayBuffer ? new TextDecoder().decode(body) : String(body ?? "");
        const obj = JSON.parse(text || "{}");
        obj.gameId = join.gameId;
        body = new TextEncoder().encode(JSON.stringify(obj)).buffer;
        h.set("content-length", String(body.byteLength));
      } catch { /* si no es JSON, se manda tal cual */ }
    }
  } else if (h.has("rbx-user-agent")) {
    // "Roblox/Web … Desktop" -> "Roblox/WinInet", sin la parte "Browser/…"
    h.set("rbx-user-agent", h.get("rbx-user-agent").replace(/Roblox\/Web.*?Desktop/i, "Roblox/WinInet").replace(/\s*Browser\/\S+/gi, "").trim());
  }
  return { url: u.href, headers: [...h], body };
}

const hex = (n) => Number(n).toString(16);
const ipHex = (ip) => String(ip).split(".").map((o) => Number(o).toString(16).padStart(2, "0")).join("");
const nextOctet = (ip) => { const p = String(ip).split(".").map(Number); p[3] = (p[3] + 1) & 255; return p.join("."); };

/** Si la respuesta de join no trae joinScript.gameFqdn, lo construye (formato observado en un despliegue funcional). */
export function fixJoinResponse(url, text) {
  const u = new URL(url);
  if (u.hostname !== "gamejoin.roblox.com" || !/^\/v1\/join-game/.test(u.pathname)) return text;
  let j;
  try { j = JSON.parse(text); } catch { return text; }
  const s = j && j.joinScript;
  if (!s || s.gameFqdn) return text;
  try {
    const key = Object.keys(s).find((k) => /netstack.*token|^token$/i.test(k));
    const tok = key ? s[key] : undefined;
    const addr = s.MachineAddress, port = s.NetStackPort ?? s.ServerPort;
    const ud = (s.UdmuxEndpoints && s.UdmuxEndpoints[0] && s.UdmuxEndpoints[0].Address) || undefined;
    if (tok === undefined || !addr || port === undefined || !ud) throw new Error("faltan campos: " + Object.keys(s).join(","));
    const tokHex = typeof tok === "number" ? hex(tok) : /^[0-9a-f]+$/i.test(String(tok)) ? String(tok) : [...String(tok)].map((c) => c.charCodeAt(0).toString(16)).join("");
    s.gameFqdn = `${tokHex}-${ipHex(addr)}-${hex(port)}.${ipHex(nextOctet(ud))}.qdmux.roblox.com`;
    console.log("[webblox] gameFqdn construido:", s.gameFqdn);
    return JSON.stringify(j);
  } catch (e) {
    console.warn("[webblox] no pude construir gameFqdn:", e.message);
    return text;
  }
}
