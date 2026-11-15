// Lanzador de WebBlox: busca juegos, acepta enlaces de Roblox y abre el reproductor en una pestaña propia.
import { t, apply } from "./i18n.js";
import { proxyFetch, setSession } from "./net.js";
import { roblosecurity } from "./session.js";

apply();
const $ = (s) => document.querySelector(s);
const msg = (m) => { $("#msg").textContent = m || ""; };
const json = async (res) => JSON.parse(await new Response(res.body).text());

async function refreshSession() {
  const c = await roblosecurity();
  setSession(c);
  $("#dot").classList.toggle("on", !!c);
  $("#sess").textContent = c ? t("signedin") : t("signedout");
  $("#signin-btn").hidden = !!c;
  return c;
}

function play(placeId, gameId) {
  const u = new URL("player.html", location.href);
  u.searchParams.set("placeId", String(placeId));
  if (gameId) u.searchParams.set("gameId", gameId);
  window.open(u.href, "_blank");
}

// "https://www.roblox.com/games/920587237/Adopt-Me", "…/games/start?placeId=920587237&gameInstanceId=…", "920587237"
function parseLink(text) {
  text = text.trim();
  if (/^\d{3,}$/.test(text)) return { placeId: Number(text) };
  let u; try { u = new URL(text); } catch { return null; }
  if (!/(^|\.)roblox\.com$/.test(u.hostname)) return null;
  const m = u.pathname.match(/\/games\/(\d+)/);
  const placeId = Number(u.searchParams.get("placeId") || (m && m[1]));
  if (!Number.isSafeInteger(placeId) || placeId <= 0) return null;
  return { placeId, gameId: u.searchParams.get("gameInstanceId") || undefined };
}

const iconCache = new Map();
async function icon(img, universeId) {
  try {
    if (!iconCache.has(universeId)) {
      iconCache.set(universeId, (async () => {
        const r = await proxyFetch(`https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=150x150&format=Png&isCircular=false`);
        const url = (await json(r)).data?.[0]?.imageUrl;
        if (!url) return null;
        const im = await proxyFetch(url);
        return URL.createObjectURL(await new Response(im.body).blob());
      })());
    }
    const src = await iconCache.get(universeId);
    if (src) img.src = src;
  } catch { /* sin icono */ }
}

async function search() {
  const q = $("#q").value.trim();
  if (!q) return;
  msg(t("searching")); $("#grid").textContent = "";
  try {
    const sid = crypto.randomUUID();
    const r = await proxyFetch(`https://apis.roblox.com/search-api/omni-search?searchQuery=${encodeURIComponent(q)}&pageToken=&sessionId=${sid}&pageType=all`);
    if (r.status !== 200) throw new Error("HTTP " + r.status);
    const data = await json(r);
    const games = (data.searchResults || []).flatMap((g) => (g.contentGroupType === "Game" ? g.contents : []));
    msg(games.length ? "" : t("noresults"));
    for (const g of games.slice(0, 24)) {
      const el = document.createElement("div"); el.className = "game";
      const img = document.createElement("img"); img.alt = ""; img.loading = "lazy";
      const nm = document.createElement("div"); nm.className = "nm"; nm.textContent = g.name;
      const meta = document.createElement("div"); meta.className = "meta";
      meta.textContent = g.playerCount != null ? `👥 ${Number(g.playerCount).toLocaleString()}` : "";
      const b = document.createElement("button"); b.className = "btn"; b.type = "button"; b.textContent = t("play");
      b.onclick = () => play(g.rootPlaceId);
      el.append(img, nm, meta, b); $("#grid").appendChild(el);
      icon(img, g.universeId);
    }
  } catch (e) { console.error(e); msg(t("neterr")); }
}

// Llamadas autenticadas (presencia): Roblox pide x-csrf-token, que devuelve en un 403 la primera vez.
let csrf = "";
async function rbxPost(url, body) {
  for (let i = 0; i < 2; i++) {
    const r = await proxyFetch(url, { method: "POST", headers: [["content-type", "application/json"], ["x-csrf-token", csrf]], body: new TextEncoder().encode(JSON.stringify(body)).buffer });
    const tok = r.headers.find(([k]) => k.toLowerCase() === "x-csrf-token");
    if (r.status === 403 && tok) { csrf = tok[1]; continue; }
    return r;
  }
}
async function joinFriend() {
  const name = $("#friend").value.trim();
  if (!name) return;
  msg(t("searching"));
  try {
    const u = await json(await rbxPost("https://users.roblox.com/v1/usernames/users", { usernames: [name], excludeBannedUsers: true }));
    const id = u.data?.[0]?.id;
    if (!id) return msg(t("friendNone"));
    const p = await json(await rbxPost("https://presence.roblox.com/v1/presence/users", { userIds: [id] }));
    const pr = p.userPresences?.[0];
    const place = pr?.placeId || pr?.rootPlaceId;
    if (pr?.userPresenceType === 2 && place) { msg(""); play(place, pr.gameId || undefined); } else msg(t("friendNone"));
  } catch (e) { console.error(e); msg(t("neterr")); }
}

$("#go").onclick = search;
$("#q").addEventListener("keydown", (e) => e.key === "Enter" && search());
$("#open").onclick = () => { const p = parseLink($("#link").value); p ? play(p.placeId, p.gameId) : msg(t("badlink")); };
$("#link").addEventListener("keydown", (e) => e.key === "Enter" && $("#open").click());
$("#friendgo").onclick = joinFriend;
$("#friend").addEventListener("keydown", (e) => e.key === "Enter" && joinFriend());
$("#recheck").onclick = refreshSession;
document.addEventListener("visibilitychange", () => !document.hidden && refreshSession());
refreshSession();
