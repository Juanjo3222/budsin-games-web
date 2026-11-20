// WebBlox de Budsin Games. Basado en webblox/host.js de https://github.com/x8rr/webblox-built (x8rr), adaptado a Budsin:
//  - el cliente Wisp es nuestro epoxy.js (UMD) y el Wisp es el de InvisiProxy, cuya ruta está en proxy.json (la escribe
//    app/scripts/invisiproxy-info.sh en el VPS); sin proxy.json se usa /wisp/ en este host, o ?wisp=wss://…;
//  - textos en español, inglés y portugués;
//  - pegar la cookie .ROBLOSECURITY se mantiene pero va marcado como INSEGURO y exige confirmarlo;
//  - se añaden los avisos de Budsin (no afiliado a Roblox, la sesión no llega a Budsin).
//
// Host page for Roblox's own browser client (binary type WebClientApp, pulled
// into vendor/webblox/engine by scripts/fetch-webblox.mjs).
//
// 1. Answers sw.js: every cross-origin request the engine makes arrives here
//    and goes out over Wisp through epoxy, which runs TLS in this page, so the
//    Wisp server never sees the session. Cookies live in a jar in localStorage.
// 2. Takes the Roblox session (.ROBLOSECURITY) from a Scramjet 2 browser on
//    this origin, if you signed in to roblox.com there, or asks for it.
// 3. Boots WasmPlayer.js the way Roblox's WasmLoader.js does, pointed at the
//    engine on this server.
//
// ?placeId=<id> joins that experience (&gameInstanceId=<job id> one server of
// it); without a place the page is a launcher. With a Scramjet 2 proxy,
// roblox.com's Play button opens this page (integrations/scramjet/plugin.ts).

const ROOT = new URL("./", import.meta.url);
const ENGINE_BASE = new URL("engine", ROOT).href;
const WISP_KEY = "blox.wisp";
const JAR_KEY = "blox.cookies";
const MANUAL_KEY = "blox.manual";
// ?placeId=…&gameInstanceId=…: join that server of the place (roblox.com's
// Join on a server or a friend). The id is a job id, a UUID in practice.
const JOIN_SERVER = (() => {
  const params = new URLSearchParams(location.search);
  const placeId = params.get("placeId");
  const serverId = params.get("gameInstanceId");
  return placeId && serverId && /^[A-Za-z0-9-]{1,64}$/.test(serverId) ? { placeId, serverId } : null;
})();
const SESSION = ".ROBLOSECURITY";
const SESSION_PREFIX = "_|WARNING:-DO-NOT-SHARE-THIS.";
const SESSION_CHECK = "https://users.roblox.com/v1/users/authenticated";
const ROBLOX_HOST = /(^|\.)(roblox\.com|rbxcdn\.com|robloxlabs\.com)$/i;
// Dropped from what the engine sent: the browser's own values describe this
// page, not www.roblox.com, and epoxy sets length and host itself.
const DROP_REQUEST = new Set(["cookie", "content-length", "host", "origin", "referer", "connection"]);
// Dropped from what Roblox sent: epoxy already decoded the body, the cookies
// went into the jar, and the CORS and isolation headers are set by sw.js.
const DROP_RESPONSE = new Set([
  "content-encoding", "content-length", "transfer-encoding", "connection", "keep-alive", "set-cookie",
  "access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-headers",
  "access-control-allow-methods", "access-control-expose-headers", "cross-origin-opener-policy",
  "cross-origin-embedder-policy", "cross-origin-resource-policy", "strict-transport-security",
]);


// ---- Textos (es / en / pt): el idioma del portal si lo hay en este origen, si no el del navegador --------------------

const TEXT = {
  es: {
    connecting: "Conectando…", checking: "Comprobando tu sesión de Roblox…", starting: "Iniciando…",
    needIsolation: "Esta página no tiene aislamiento entre orígenes (COOP/COEP) y el motor no puede usar memoria compartida. Recárgala; si sigue igual, usa un Chrome o Edge actualizado.",
    noSW: "Tu navegador no admite service workers (¿modo privado?).",
    swNoControl: "El service worker no tomó el control de la página. Recarga para intentarlo de nuevo.",
    noAnswer: (host, wisp, s) => `Sin respuesta de ${host} por el servidor Wisp ${wisp} en ${s} s`,
    rateLimit: (wisp) => `Roblox está limitando al servidor Wisp (${wisp}). Espera un minuto e inténtalo otra vez.`,
    httpErr: (n) => `Roblox respondió HTTP ${n}`,
    searchPh: "Busca un juego o pega el enlace de uno", searchAria: "Buscar juegos o pegar un enlace de juego", searchBtn: "Buscar",
    searching: "Buscando…", noGames: "No se encontraron juegos.", searchFail: (m) => `La búsqueda falló: ${m}`, playing: "jugando",
    sessionTitle: "Inicia sesión en Roblox", sessionExpired: "Tu sesión de Roblox caducó",
    sessionHow: "Inicia sesión en roblox.com dentro de Budsin Proxy. Si la contraseña no entra, usa el «código único por correo»; si sale un CAPTCHA, usa el modo audio. Luego vuelve aquí a pulsar «Iniciar sesión».",
    proxyLink: "Abrir Budsin Proxy",
    riskSummary: "⚠️ Opción INSEGURA: pegar tu cookie .ROBLOSECURITY",
    riskText: "Esa cookie es la llave completa de tu cuenta: quien la tenga entra sin contraseña ni código. Se queda en este navegador y solo se envía a Roblox, pero un fallo de esta página o una extensión maliciosa podría robarla. Roblox también puede avisarte o sancionar tu cuenta por usar un cliente modificado. Nunca la compartas con nadie. Úsala solo en tu propio dispositivo y solo si entiendes qué es.",
    riskCheck: "Entiendo el riesgo y quiero pegar mi cookie",
    cookieAria: ".ROBLOSECURITY (opcional)",
    back: "Volver", signIn: "Iniciar sesión",
    needRiskCheck: "Marca la casilla para confirmar que entiendes el riesgo, o borra la cookie pegada.",
    notCookie: "Eso no es un valor de .ROBLOSECURITY.",
    noProxySession: "No hay ninguna sesión de Roblox en Budsin Proxy. Inicia sesión allí primero.",
    cantReach: (m) => `No se pudo conectar con Roblox: ${m}`,
    rejected: "Roblox rechazó esa sesión.", proxyExpired: "La sesión de Budsin Proxy caducó. Inicia sesión allí otra vez.",
    notice: "WebBlox usa el cliente web oficial de Roblox. No está afiliado ni respaldado por Roblox Corporation.",
    privacy: "Tu sesión de Roblox se queda en este navegador: Budsin no la recibe ni la guarda.",
    credit: "Basado en webblox-built de x8rr.",
    title: "WebBlox — Budsin Games",
  },
  en: {
    connecting: "Connecting…", checking: "Checking your Roblox session…", starting: "Starting…",
    needIsolation: "This page is not cross-origin isolated (COOP/COEP), so the engine cannot use shared memory. Reload it; if it persists, use an up-to-date Chrome or Edge.",
    noSW: "This browser has no service worker support (private mode?).",
    swNoControl: "The service worker did not take control of this page. Reload to try again.",
    noAnswer: (host, wisp, s) => `No answer from ${host} through the Wisp server ${wisp} in ${s}s`,
    rateLimit: (wisp) => `Roblox is rate-limiting the Wisp server (${wisp}). Try again in a minute.`,
    httpErr: (n) => `Roblox answered HTTP ${n}`,
    searchPh: "Search games or paste a game link", searchAria: "Search games or paste a game link", searchBtn: "Search",
    searching: "Searching…", noGames: "No games found.", searchFail: (m) => `Search failed: ${m}`, playing: "playing",
    sessionTitle: "Sign in to Roblox", sessionExpired: "Your Roblox session expired",
    sessionHow: "Sign in to roblox.com inside Budsin Proxy. If the password does not go through, use the email one-time code; if you get a CAPTCHA, use audio mode. Then come back here and press “Sign in”.",
    proxyLink: "Open Budsin Proxy",
    riskSummary: "⚠️ INSECURE option: paste your .ROBLOSECURITY cookie",
    riskText: "That cookie is the full key to your account: whoever has it gets in without a password or code. It stays in this browser and is only sent to Roblox, but a bug in this page or a malicious extension could steal it. Roblox may also warn or sanction your account for using a modified client. Never share it with anyone. Use it only on your own device and only if you understand what it is.",
    riskCheck: "I understand the risk and want to paste my cookie",
    cookieAria: ".ROBLOSECURITY (optional)",
    back: "Back", signIn: "Sign in",
    needRiskCheck: "Tick the box to confirm you understand the risk, or clear the pasted cookie.",
    notCookie: "That isn't a .ROBLOSECURITY value.",
    noProxySession: "No Roblox sign-in found in Budsin Proxy. Sign in there first.",
    cantReach: (m) => `Couldn't reach Roblox: ${m}`,
    rejected: "Roblox rejected that session.", proxyExpired: "The Budsin Proxy sign-in has expired. Sign in there again.",
    notice: "WebBlox uses Roblox's official web client. It is not affiliated with or endorsed by Roblox Corporation.",
    privacy: "Your Roblox session stays in this browser: Budsin neither receives nor stores it.",
    credit: "Based on x8rr's webblox-built.",
    title: "WebBlox — Budsin Games",
  },
  pt: {
    connecting: "Conectando…", checking: "Verificando sua sessão do Roblox…", starting: "Iniciando…",
    needIsolation: "Esta página não tem isolamento entre origens (COOP/COEP) e o motor não pode usar memória compartilhada. Recarregue; se persistir, use um Chrome ou Edge atualizado.",
    noSW: "Seu navegador não suporta service workers (modo privado?).",
    swNoControl: "O service worker não assumiu o controle da página. Recarregue para tentar de novo.",
    noAnswer: (host, wisp, s) => `Sem resposta de ${host} pelo servidor Wisp ${wisp} em ${s} s`,
    rateLimit: (wisp) => `O Roblox está limitando o servidor Wisp (${wisp}). Espere um minuto e tente de novo.`,
    httpErr: (n) => `O Roblox respondeu HTTP ${n}`,
    searchPh: "Busque um jogo ou cole o link de um", searchAria: "Buscar jogos ou colar um link de jogo", searchBtn: "Buscar",
    searching: "Buscando…", noGames: "Nenhum jogo encontrado.", searchFail: (m) => `A busca falhou: ${m}`, playing: "jogando",
    sessionTitle: "Entre no Roblox", sessionExpired: "Sua sessão do Roblox expirou",
    sessionHow: "Entre em roblox.com dentro do Budsin Proxy. Se a senha não passar, use o «código único por e-mail»; se aparecer um CAPTCHA, use o modo áudio. Depois volte aqui e toque em «Entrar».",
    proxyLink: "Abrir o Budsin Proxy",
    riskSummary: "⚠️ Opção INSEGURA: colar seu cookie .ROBLOSECURITY",
    riskText: "Esse cookie é a chave completa da sua conta: quem o tiver entra sem senha nem código. Ele fica neste navegador e só é enviado ao Roblox, mas uma falha desta página ou uma extensão maliciosa poderia roubá-lo. O Roblox também pode avisar ou punir sua conta por usar um cliente modificado. Nunca o compartilhe com ninguém. Use só no seu próprio dispositivo e só se entender o que é.",
    riskCheck: "Entendo o risco e quero colar meu cookie",
    cookieAria: ".ROBLOSECURITY (opcional)",
    back: "Voltar", signIn: "Entrar",
    needRiskCheck: "Marque a caixa para confirmar que entende o risco, ou apague o cookie colado.",
    notCookie: "Isso não é um valor de .ROBLOSECURITY.",
    noProxySession: "Não há nenhuma sessão do Roblox no Budsin Proxy. Entre lá primeiro.",
    cantReach: (m) => `Não foi possível conectar ao Roblox: ${m}`,
    rejected: "O Roblox rejeitou essa sessão.", proxyExpired: "A sessão do Budsin Proxy expirou. Entre lá de novo.",
    notice: "O WebBlox usa o cliente web oficial do Roblox. Não é afiliado nem apoiado pela Roblox Corporation.",
    privacy: "Sua sessão do Roblox fica neste navegador: a Budsin não a recebe nem a guarda.",
    credit: "Baseado no webblox-built de x8rr.",
    title: "WebBlox — Budsin Games",
  },
};
const LANG = (() => {
  let l = "";
  try { l = localStorage.getItem("budsin_language") || ""; } catch {}
  l = (l || navigator.language || "en").slice(0, 2).toLowerCase();
  return TEXT[l] ? l : "en";
})();
const t = (key, ...args) => {
  const v = TEXT[LANG][key] ?? TEXT.en[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
};
document.documentElement.lang = LANG;
document.title = t("title");

const status = document.getElementById("status");
const say = (text) => {
  status.textContent = text;
};

// ---- Wisp transport ---------------------------------------------------------

// Budsin: WebBlox vive en el mismo origen que InvisiProxy y usa SU Wisp. InvisiProxy aleatoriza sus rutas en cada build;
// proxy.json ({"wisp": "/ruta/"}, lo escribe app/scripts/invisiproxy-info.sh) dice cuál es. Orden: ?wisp=wss://… (se recuerda),
// lo recordado, proxy.json, y por último /wisp/ en este host.

let WISP = "";
async function resolveWisp() {
  const url = new URL(location.href);
  const given = url.searchParams.get("wisp");
  if (given !== null) {
    if (/^wss?:\/\//i.test(given)) localStorage.setItem(WISP_KEY, given);
    url.searchParams.delete("wisp");
    history.replaceState(history.state, "", url);
  }
  const stored = localStorage.getItem(WISP_KEY);
  if (stored && /^wss?:\/\//i.test(stored)) return stored;
  const scheme = location.protocol === "https:" ? "wss" : "ws";
  try {
    const res = await fetch(new URL("proxy.json", ROOT), { cache: "no-store" });
    if (res.ok) {
      const { wisp } = await res.json();
      if (typeof wisp === "string" && /^wss?:\/\//i.test(wisp)) return wisp;
      if (typeof wisp === "string" && wisp.startsWith("/")) return `${scheme}://${location.host}${wisp}`;
    }
  } catch {}
  return `${scheme}://${location.host}/wisp/`;
}
// Epoxy waits forever on a Wisp server that never answers; give up instead.
const REQUEST_TIMEOUT_MS = 30_000;

function loadEpoxy() {
  if (globalThis.EpoxyTransport) return Promise.resolve(globalThis.EpoxyTransport.default || globalThis.EpoxyTransport);
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = new URL("epoxy.js", ROOT).href;
    script.onload = () => resolve(globalThis.EpoxyTransport.default || globalThis.EpoxyTransport);
    script.onerror = () => reject(new Error("epoxy.js"));
    document.head.append(script);
  });
}

const transport = (async () => {
  WISP = await resolveWisp();
  const EpoxyTransport = await loadEpoxy();
  const epoxy = new EpoxyTransport({ wisp: WISP });
  await epoxy.init();
  return epoxy;
})();

// ---- Cookie jar ---------------------------------------------------------------
// { name, value, domain, hostOnly, path, expires (ms, 0 = session) }

function readJar() {
  try {
    const jar = JSON.parse(localStorage.getItem(JAR_KEY) || "[]");
    return Array.isArray(jar) ? jar.filter((c) => !c.expires || c.expires > Date.now()) : [];
  } catch {
    return [];
  }
}

function writeJar(jar) {
  localStorage.setItem(JAR_KEY, JSON.stringify(jar));
}

function domainMatches(host, cookie) {
  return host === cookie.domain || (!cookie.hostOnly && host.endsWith(`.${cookie.domain}`));
}

function pathMatches(path, cookiePath) {
  return path === cookiePath || path.startsWith(cookiePath.endsWith("/") ? cookiePath : `${cookiePath}/`);
}

function cookieHeader(url) {
  return readJar()
    .filter((c) => domainMatches(url.hostname, c) && pathMatches(url.pathname, c.path))
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

function putCookie(jar, cookie) {
  const kept = jar.filter((c) => !(c.name === cookie.name && c.domain === cookie.domain && c.path === cookie.path));
  if (!cookie.expires || cookie.expires > Date.now()) kept.push(cookie);
  return kept;
}

function parseSetCookie(url, line) {
  const [pair, ...attributes] = line.split(";");
  const eq = pair.indexOf("=");
  if (eq <= 0) return null;
  const cookie = {
    name: pair.slice(0, eq).trim(),
    value: pair.slice(eq + 1).trim(),
    domain: url.hostname,
    hostOnly: true,
    path: "/",
    expires: 0,
  };
  let maxAge = null;
  for (const attribute of attributes) {
    const at = attribute.indexOf("=");
    const key = (at < 0 ? attribute : attribute.slice(0, at)).trim().toLowerCase();
    const value = at < 0 ? "" : attribute.slice(at + 1).trim();
    if (key === "domain" && value) {
      const domain = value.replace(/^\./, "").toLowerCase();
      // A host may only set cookies for itself or a parent domain.
      if (url.hostname !== domain && !url.hostname.endsWith(`.${domain}`)) return null;
      cookie.domain = domain;
      cookie.hostOnly = false;
    } else if (key === "path" && value.startsWith("/")) {
      cookie.path = value;
    } else if (key === "expires") {
      const time = Date.parse(value);
      if (Number.isFinite(time)) cookie.expires = time;
    } else if (key === "max-age" && /^-?\d+$/.test(value)) {
      maxAge = Number(value);
    }
  }
  // Max-Age wins over Expires; zero or less deletes the cookie.
  if (maxAge !== null) cookie.expires = maxAge <= 0 ? 1 : Date.now() + maxAge * 1000;
  return cookie;
}

// `manual`: pasted here rather than taken from the Scramjet browser.
function storeSession(value, manual) {
  let jar = readJar().filter((c) => c.name !== SESSION);
  jar = putCookie(jar, { name: SESSION, value, domain: "roblox.com", hostOnly: false, path: "/", expires: 0 });
  writeJar(jar);
  localStorage.setItem(MANUAL_KEY, manual ? "1" : "0");
}

function forgetSession() {
  writeJar(readJar().filter((c) => c.name !== SESSION));
}

const savedSession = () => readJar().find((c) => c.name === SESSION)?.value ?? null;

// ---- Requests -----------------------------------------------------------------

// Roblox's game servers are reached over WebTransport at *.qdmux.roblox.com.
// gamejoin only returns that name (gameFqdn) to the web client; with a native
// client's user agent it returns the UDMUX relay and a net stack token
// instead, from which the name is derived. Both rules are taken from a working
// deployment of this client, not from Roblox documentation.
function nativeUserAgent(value) {
  return value.replace(/Roblox\/Web\s+\w+\s+Desktop/, "Roblox/WinInet").replace(/\s*Browser\/\S+/, "");
}

function qdmuxFqdn(joinScript) {
  const udmux = joinScript.UdmuxEndpoints?.[0];
  const netStackToken = String(joinScript.NetStackTokenValue || "");
  if (!udmux || !netStackToken || !joinScript.MachineAddress || !joinScript.NetStackPort) return null;
  let token = netStackToken.toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(token)) {
    try {
      token = [...atob(netStackToken)].map((c) => c.charCodeAt(0).toString(16).padStart(2, "0")).join("");
    } catch {
      return null;
    }
  }
  if (token.length !== 32) return null;
  const relay = String(udmux.Address).split(".").map(Number);
  const machine = String(joinScript.MachineAddress).split(".").map(Number);
  const octets = (list) => list.length === 4 && list.every((n) => Number.isInteger(n) && n >= 0 && n <= 255);
  if (!octets(relay) || !octets(machine)) return null;
  relay[3] += 1;
  if (relay[3] > 255) return null;
  const hex = (list) => list.map((n) => n.toString(16).padStart(2, "0")).join("");
  return `${token}-${hex(machine)}-${Number(joinScript.NetStackPort).toString(16)}.${hex(relay)}.qdmux.roblox.com`;
}

function withGameFqdn(body) {
  try {
    const json = JSON.parse(new TextDecoder().decode(body));
    if (!json?.joinScript || json.joinScript.gameFqdn) return body;
    const fqdn = qdmuxFqdn(json.joinScript);
    if (!fqdn) return body;
    json.joinScript.gameFqdn = fqdn;
    return new TextEncoder().encode(JSON.stringify(json)).buffer;
  } catch {
    return body;
  }
}

// roblox.com's Join on a server or a friend names one server (game instance).
// The engine always asks gamejoin for any server of the place; for that
// place's first join (not a teleport), ask for the named one instead.
function joinNamedServer(target, body) {
  if (!JOIN_SERVER || target.pathname !== "/v1/join-game" || !body) return body;
  try {
    const request = JSON.parse(new TextDecoder().decode(body));
    if (String(request.placeId) !== JOIN_SERVER.placeId || request.isTeleport) return body;
    target.pathname = "/v1/join-game-instance";
    return new TextEncoder().encode(JSON.stringify({ ...request, gameId: JOIN_SERVER.serverId })).buffer;
  } catch {
    return body;
  }
}

async function upstream({ url, method, headers, body }) {
  const target = new URL(url);
  const out = new Map();
  for (const [name, value] of headers) {
    const key = name.toLowerCase();
    if (!DROP_REQUEST.has(key) && !key.startsWith("sec-")) out.set(key, value);
  }
  const roblox = ROBLOX_HOST.test(target.hostname);
  const gameJoin = roblox && target.hostname === "gamejoin.roblox.com" && method === "POST";
  out.set("origin", roblox ? "https://www.roblox.com" : target.origin);
  out.set("referer", roblox ? "https://www.roblox.com/" : `${target.origin}/`);
  if (gameJoin) {
    out.set("rbx-user-agent", "Roblox/Darwin");
    body = joinNamedServer(target, body);
  } else if (roblox && out.has("rbx-user-agent")) {
    out.set("rbx-user-agent", nativeUserAgent(out.get("rbx-user-agent")));
  }
  const cookies = cookieHeader(target);
  if (cookies) out.set("cookie", cookies);

  const epoxy = await transport;
  let timer;
  const response = await Promise.race([
    epoxy.request(target, method, body && body.byteLength ? body : null, [...out], undefined),
    new Promise((_, reject) => {
      timer = setTimeout(
        () => reject(new Error(t("noAnswer", target.hostname, WISP, REQUEST_TIMEOUT_MS / 1000))),
        REQUEST_TIMEOUT_MS,
      );
    }),
  ]).finally(() => clearTimeout(timer));
  let data = await new Response(response.body).arrayBuffer();

  let jar = null;
  const kept = [];
  for (const [name, value] of response.headers) {
    const key = name.toLowerCase();
    if (key === "set-cookie") {
      const cookie = parseSetCookie(target, value);
      if (cookie) jar = putCookie(jar ?? readJar(), cookie);
    } else if (key === "location") {
      kept.push([key, new URL(value, target).href]);
    } else if (!DROP_RESPONSE.has(key)) {
      kept.push([key, value]);
    }
  }
  if (jar) writeJar(jar);
  if (gameJoin && response.status === 200) data = withGameFqdn(data);
  return { status: response.status, statusText: response.statusText, headers: kept, body: data };
}

navigator.serviceWorker.addEventListener("message", async (event) => {
  const message = event.data;
  if (message?.type !== "blox-fetch") return;
  const [port] = event.ports;
  try {
    const result = await upstream(message);
    port.postMessage({ ok: true, ...result }, [result.body]);
  } catch (error) {
    console.error("[blox] relay failed:", message.method, message.url, error);
    port.postMessage({ ok: false, error: String(error?.message || error) });
  }
});
navigator.serviceWorker.startMessages();

// ---- Session ------------------------------------------------------------------

async function sessionAccepted() {
  const result = await upstream({ url: SESSION_CHECK, method: "GET", headers: [], body: null });
  return result.status === 200;
}

// A Scramjet 2 browser on this origin (its controller) keeps its cookie jar in
// IndexedDB, so signing in to roblox.com there leaves .ROBLOSECURITY where
// this page can read it. Never creates the database when it is missing.
function proxySession() {
  return new Promise((resolve) => {
    const open = indexedDB.open("__scramjet_controller");
    open.onupgradeneeded = () => open.transaction.abort();
    open.onerror = () => resolve(null);
    open.onsuccess = () => {
      const db = open.result;
      const finish = (value) => {
        db.close();
        resolve(value);
      };
      try {
        const get = db.transaction("state", "readonly").objectStore("state").get("cookies");
        get.onsuccess = () => finish(sessionFromDump(get.result?.cookies));
        get.onerror = () => finish(null);
      } catch {
        finish(null);
      }
    };
  });
}

// The controller stores CookieJar.dump(): JSON of { [key]: { name, value, domain, … } }.
function sessionFromDump(dump) {
  if (typeof dump !== "string") return null;
  let cookies;
  try {
    cookies = JSON.parse(dump);
  } catch {
    return null;
  }
  for (const cookie of Object.values(cookies ?? {})) {
    if (cookie?.name !== SESSION || typeof cookie.value !== "string" || !cookie.value) continue;
    if (/^\.?(?:[^.]+\.)*roblox\.com$/i.test(String(cookie.domain))) return cookie.value;
  }
  return null;
}

// Puts a candidate session in the jar and keeps it only if Roblox accepts it.
async function trySession(value, manual) {
  storeSession(value, manual);
  if (await sessionAccepted()) return true;
  forgetSession();
  return false;
}

// Joining needs a signed-in account (gamejoin answers 524 "Not authorized"
// otherwise), so this runs before the engine starts and only then.
// Budsin: la forma normal es iniciar sesión en Budsin Proxy. Pegar la cookie sigue existiendo, pero va escondida en un bloque
// marcado como INSEGURO y solo se acepta si la persona confirma el riesgo con una casilla.
function askForSession(expired) {
  return new Promise((resolve) => {
    const shade = document.createElement("div");
    shade.className = "session";
    shade.innerHTML = `
      <form novalidate aria-labelledby="session-title">
        <h1 id="session-title"></h1>
        <p class="how"></p>
        <p><a class="proxy-link" href="../"></a></p>
        <details class="insecure">
          <summary></summary>
          <p class="risk"></p>
          <label class="risk-check"><input type="checkbox" name="risk"> <span></span></label>
          <input name="cookie" type="password" autocomplete="off" spellcheck="false" aria-describedby="session-error">
        </details>
        <p class="error" id="session-error" role="alert"></p>
        <div class="actions">
          <button type="button" class="secondary"></button>
          <button type="submit"></button>
        </div>
      </form>`;
    const form = shade.querySelector("form");
    const input = form.querySelector("input[name=cookie]");
    const risk = form.querySelector("input[name=risk]");
    const error = form.querySelector(".error");
    const [back, submit] = form.querySelectorAll(".actions button");
    form.querySelector("h1").textContent = expired ? t("sessionExpired") : t("sessionTitle");
    form.querySelector(".how").textContent = t("sessionHow");
    form.querySelector(".proxy-link").textContent = t("proxyLink");
    form.querySelector("summary").textContent = t("riskSummary");
    form.querySelector(".risk").textContent = t("riskText");
    form.querySelector(".risk-check span").textContent = t("riskCheck");
    input.setAttribute("aria-label", t("cookieAria"));
    back.textContent = t("back");
    submit.textContent = t("signIn");
    const fail = (text) => {
      error.textContent = text;
      input.setAttribute("aria-invalid", "true");
      input.focus();
    };
    input.addEventListener("input", () => {
      error.textContent = "";
      input.removeAttribute("aria-invalid");
    });
    back.addEventListener("click", () => location.assign(ROOT.href));
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pasted = input.value.trim().replace(/^\.ROBLOSECURITY=/, "");
      if (pasted && !risk.checked) return fail(t("needRiskCheck"));
      if (pasted && !pasted.startsWith(SESSION_PREFIX)) return fail(t("notCookie"));
      const value = pasted || (await proxySession());
      if (!value) return fail(t("noProxySession"));
      submit.disabled = true;
      let accepted = false;
      try {
        accepted = await trySession(value, Boolean(pasted));
      } catch (err) {
        forgetSession();
        submit.disabled = false;
        return fail(t("cantReach", err.message || err));
      }
      submit.disabled = false;
      if (!accepted) return fail(pasted ? t("rejected") : t("proxyExpired"));
      shade.remove();
      resolve();
    });
    document.body.append(shade);
    form.querySelector(".proxy-link").focus();
  });
}

// Signing in on roblox.com in the Scramjet browser is the usual way in, so that
// session wins (an account switched there follows here), unless one was
// pasted here on purpose. The other is the fallback.
async function ensureSession() {
  const saved = savedSession();
  const manual = localStorage.getItem(MANUAL_KEY) === "1";
  const proxied = await proxySession();
  const order = manual ? [saved, proxied] : [proxied, saved];
  for (const value of new Set(order.filter(Boolean))) {
    if (await trySession(value, value === saved && manual)) return;
  }
  return askForSession(saved !== null);
}

// ---- Launcher -----------------------------------------------------------------

const GAME_LINK = /roblox\.com\/(?:[a-z]{2}\/)?games\/([1-9]\d{0,18})/i;

function placeFromInput(text) {
  const value = text.trim();
  if (/^[1-9]\d{0,18}$/.test(value)) return value;
  return GAME_LINK.exec(value)?.[1] ?? null;
}

async function robloxJson(url) {
  const result = await upstream({ url, method: "GET", headers: [["accept", "application/json"]], body: null });
  // Roblox limits requests per IP, and the IP it sees is the Wisp server's.
  if (result.status === 429) throw new Error(t("rateLimit", WISP));
  if (result.status !== 200) throw new Error(t("httpErr", result.status));
  return JSON.parse(new TextDecoder().decode(result.body));
}

async function searchGames(query) {
  const search = await robloxJson(
    `https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(query)}&sessionId=${crypto.randomUUID()}&pageType=all`,
  );
  const games = (search.searchResults ?? [])
    .filter((group) => group.contentGroupType === "Game")
    .flatMap((group) => group.contents ?? [])
    .filter((game) => game.rootPlaceId && game.universeId)
    .slice(0, 30);
  if (!games.length) return [];
  const icons = await robloxJson(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${games.map((game) => game.universeId).join(",")}&size=150x150&format=Webp&isCircular=false`,
  ).catch(() => ({ data: [] }));
  const iconOf = new Map((icons.data ?? []).map((icon) => [icon.targetId, icon.imageUrl]));
  return games.map((game) => ({
    placeId: String(game.rootPlaceId),
    name: game.name,
    creator: game.creatorName,
    players: game.playerCount,
    icon: iconOf.get(game.universeId),
  }));
}

function play(placeId) {
  const url = new URL(location.href);
  url.search = `?placeId=${placeId}`;
  location.assign(url);
}

function gameItem(game) {
  const item = document.createElement("li");
  const button = document.createElement("button");
  button.type = "button";
  const icon = document.createElement("img");
  icon.alt = "";
  icon.loading = "lazy";
  if (game.icon) icon.src = game.icon;
  const name = document.createElement("span");
  name.className = "name";
  name.textContent = game.name;
  const meta = document.createElement("span");
  meta.className = "meta";
  meta.textContent = [game.creator, Number.isFinite(game.players) ? `${game.players.toLocaleString()} ${t("playing")}` : ""].filter(Boolean).join(" · ");
  button.append(icon, name, meta);
  button.addEventListener("click", () => play(game.placeId));
  item.append(button);
  return item;
}

function showLauncher() {
  document.getElementById("loading-overlay").hidden = true;
  const launcher = document.createElement("main");
  launcher.className = "launcher";
  launcher.innerHTML = `
    <form role="search">
      <input type="search" autocomplete="off" spellcheck="false">
      <button type="submit"></button>
    </form>
    <p class="launcher-status" role="status"></p>
    <ul class="launcher-games"></ul>
    <footer class="launcher-note"><p class="notice"></p><p class="privacy"></p><p class="credit"></p></footer>`;
  const form = launcher.querySelector("form");
  const input = launcher.querySelector("input");
  const status = launcher.querySelector(".launcher-status");
  const list = launcher.querySelector(".launcher-games");
  input.placeholder = t("searchPh");
  input.setAttribute("aria-label", t("searchAria"));
  form.querySelector("button").textContent = t("searchBtn");
  launcher.querySelector(".notice").textContent = t("notice");
  launcher.querySelector(".privacy").textContent = t("privacy");
  launcher.querySelector(".credit").textContent = t("credit");
  let search = 0;
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const place = placeFromInput(input.value);
    if (place) return play(place);
    const query = input.value.trim();
    if (!query) return;
    const current = ++search;
    status.textContent = t("searching");
    list.replaceChildren();
    try {
      const games = await searchGames(query);
      if (current !== search) return;
      status.textContent = games.length ? "" : t("noGames");
      list.replaceChildren(...games.map(gameItem));
    } catch (error) {
      if (current === search) status.textContent = t("searchFail", error.message || error);
    }
  });
  document.body.append(launcher);
  input.focus();
}

// ---- Boot ---------------------------------------------------------------------

async function controlled() {
  if (!("serviceWorker" in navigator)) throw new Error(t("noSW"));
  await navigator.serviceWorker.register(new URL("sw.js", ROOT), { scope: ROOT.pathname });
  await navigator.serviceWorker.ready;
  if (navigator.serviceWorker.controller) return;
  // First visit: the worker claims this page once it activates.
  await new Promise((resolve) => {
    navigator.serviceWorker.addEventListener("controllerchange", resolve, { once: true });
    setTimeout(resolve, 3000);
  });
  if (!navigator.serviceWorker.controller) throw new Error(t("swNoControl"));
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.body.append(script);
  });
}

async function boot() {
  if (!window.crossOriginIsolated) {
    throw new Error(t("needIsolation"));
  }
  say(t("connecting"));
  await controlled();
  await transport;
  const placeId = new URLSearchParams(location.search).get("placeId");
  // The engine only joins experiences: without a place it logs "no startup
  // place id" and exits, so pick one here first.
  if (!placeId || !/^[1-9]\d{0,18}$/.test(placeId)) return showLauncher();
  say(t("checking"));
  await ensureSession();
  say(t("starting"));
  // What Roblox's WasmLoader.js leaves behind for WasmPlayer.js. channel null
  // keeps the engine on the production flags and channel.
  window.__wasmLoaderContext = { engineBase: ENGINE_BASE, channel: null, server: "prod" };
  await loadScript(`${ENGINE_BASE}/WasmPlayer.js`);
}

boot().catch((error) => {
  console.error("[blox]", error);
  say(error.message || String(error));
});
