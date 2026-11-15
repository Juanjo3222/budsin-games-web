// Arranque del reproductor: comprueba el entorno, registra el service worker, abre el puente de red y carga el motor.
import { t, apply } from "./i18n.js";
import { startBridge, connect, setJoin, setSession } from "./net.js";
import { roblosecurity } from "./session.js";

apply();
const $ = (s) => document.querySelector(s);
const params = new URLSearchParams(location.search);
const placeId = Number(params.get("placeId"));
const gameId = (params.get("gameId") || "").trim();

function gate(title, msg, linkKey = "back") {
  $("#loading-overlay").hidden = true;
  $("#gate-title").textContent = title;
  $("#gate-msg").textContent = msg;
  $("#gate-link").textContent = t(linkKey);
  $("#gate").classList.add("show");
}

async function main() {
  if (!Number.isSafeInteger(placeId) || placeId <= 0) return location.replace("./");
  if (!window.crossOriginIsolated || typeof SharedArrayBuffer === "undefined") return gate(t("unsupported"), t("needIso"));
  if (!("serviceWorker" in navigator)) return gate(t("unsupported"), t("needSW"));
  if (typeof WebTransport === "undefined") return gate(t("unsupported"), t("needWT"));

  // Sin sesión de Roblox el servidor responde 524 "No autorizado": se avisa antes de cargar 100 MB de motor.
  const cookie = await roblosecurity();
  if (!cookie) {
    $("#loading-overlay").hidden = true;
    $("#gate-title").textContent = t("needSession");
    $("#gate-msg").textContent = t("privacy");
    const a = $("#gate-link"); a.href = "./#signin"; a.textContent = t("needSessionBtn");
    return $("#gate").classList.add("show");
  }
  setSession(cookie);
  if (gameId) setJoin({ gameId });

  await navigator.serviceWorker.register("sw.js", { scope: "./" });
  await navigator.serviceWorker.ready;
  if (!navigator.serviceWorker.controller) {          // primera visita: la página aún no está controlada por el SW
    if (sessionStorage.getItem("webblox-sw-reload")) return gate(t("unsupported"), t("needSW"));
    sessionStorage.setItem("webblox-sw-reload", "1");
    return location.reload();
  }
  sessionStorage.removeItem("webblox-sw-reload");
  startBridge();
  $("#status").textContent = t("connecting");
  await connect();

  window.__wasmLoaderContext = { engineBase: new URL("engine", location.href).href.replace(/\/$/, ""), channel: null, server: "prod" };
  // Opciones que lee WasmPlayer.js (lo mismo que ofrece Roblox en sus páginas de desarrollo): la cookie de sesión y poco más.
  let auth = cookie;
  window.__wasmDevSettings = {
    get authCookie() { return auth; },
    baseUrl: "www.roblox.com",
    apiProxy: undefined,
    isCookieFromPool: () => false,
    allocateCookieFromPool: async () => null,
    setAuthCookie: (c) => { auth = c; },
    getFlagOverrides: () => ({}),
  };
  const s = document.createElement("script");
  s.src = "engine/WasmPlayer.js";
  s.onerror = () => $("#status").textContent = "No se pudo cargar el motor (¿falta ejecutar scripts/webblox-fetch.mjs?)";
  document.body.appendChild(s);
}
main().catch((e) => { console.error("[webblox]", e); gate(t("unsupported"), String(e && e.message || e)); });
