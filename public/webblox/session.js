// Lee la sesión de Roblox (.ROBLOSECURITY) del navegador integrado (Scramjet) de este mismo origen.
// La sesión no sale de este navegador: Budsin no la recibe ni la guarda.
//
// Dónde guarda Scramjet su jar de cookies (volcado JSON con claves "dominio@ruta@nombre"):
//   · Scramjet 1.x (el que usa /proxy/): base "$scramjet" (v1), almacén "cookies", clave "cookies"
//   · Scramjet 2.x (InvisiProxy):         base "__scramjet_controller", almacén "state", clave "cookies", valor {updatedAt, cookies: "<JSON>"}
const LOCATIONS = [["$scramjet", "cookies", "cookies"], ["__scramjet_controller", "state", "cookies"]];

// IMPORTANTE: nunca debe crearse la base de otro (Scramjet la abre luego en versión 1 y espera sus almacenes: una base vacía
// en versión 1 hace fallar al proxy con «'config' is not a known object store name»). Por eso solo se abre si existe.
function dbExists(name) {
  return indexedDB.databases ? indexedDB.databases().then((l) => l.some((d) => d.name === name)).catch(() => true) : Promise.resolve(true);
}
function readStore(dbName, store, key) {
  return dbExists(dbName).then((exists) => !exists ? null : new Promise((resolve) => {
    let req, created = false;
    try { req = indexedDB.open(dbName); } catch { return resolve(null); }
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onupgradeneeded = () => { created = true; };   // no existía y se acaba de crear vacía: se borra abajo
    req.onsuccess = () => {
      const db = req.result;
      // Una base vacía (recién creada, o dejada así por una versión anterior de esta página) se elimina: Scramjet la creará bien.
      if (created || db.objectStoreNames.length === 0) { db.close(); indexedDB.deleteDatabase(dbName); return resolve(null); }
      try {
        if (!db.objectStoreNames.contains(store)) { db.close(); return resolve(null); }
        const get = db.transaction(store).objectStore(store).get(key);
        get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
        get.onerror = () => { db.close(); resolve(null); };
      } catch { db.close(); resolve(null); }
    };
  }));
}
const valueOf = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? v.value ?? v.val ?? v.cookie ?? "" : "");

// Acepta los dos formatos: el jar directo (Scramjet 1) o {updatedAt, cookies: "<JSON del jar>"} (controlador de Scramjet 2).
export function extractRoblosecurity(raw) {
  let jar = raw;
  if (typeof jar === "string") { try { jar = JSON.parse(jar); } catch { return ""; } }
  if (jar && typeof jar === "object" && "cookies" in jar && typeof jar.updatedAt === "number") {
    jar = jar.cookies;
    if (typeof jar === "string") { try { jar = JSON.parse(jar); } catch { return ""; } }
  }
  if (!jar || typeof jar !== "object") return "";
  for (const [k, v] of Object.entries(jar)) {
    const [domain, , name] = k.split("@");
    if (name === ".ROBLOSECURITY" && /(^|\.)roblox\.com$/.test((domain || "").replace(/^\./, ""))) {
      let val = valueOf(v);
      if (val.startsWith(".ROBLOSECURITY=")) val = val.slice(".ROBLOSECURITY=".length).split(";")[0];
      if (val) return val;
    }
  }
  return "";
}

export async function roblosecurity() {
  for (const [db, store, key] of LOCATIONS) {
    const found = extractRoblosecurity(await readStore(db, store, key));
    if (found) return found;
  }
  return "";
}
