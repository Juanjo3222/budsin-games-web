// Lee la sesión de Roblox (.ROBLOSECURITY) del navegador integrado (Scramjet) de este mismo origen.
// La sesión no sale de este navegador: Budsin no la recibe ni la guarda.
//
// Dónde guarda Scramjet su jar de cookies (volcado JSON con claves "dominio@ruta@nombre"):
//   · Scramjet 1.x (el que usa /proxy/): base "$scramjet" (v1), almacén "cookies", clave "cookies"
//   · Scramjet 2.x:                       base "__scramjet_controller", almacén "state", clave "cookies"
const LOCATIONS = [["$scramjet", "cookies", "cookies"], ["__scramjet_controller", "state", "cookies"]];

function readStore(dbName, store, key) {
  return new Promise((resolve) => {
    let req;
    try { req = indexedDB.open(dbName); } catch { return resolve(null); }
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onupgradeneeded = () => { try { req.transaction.abort(); } catch {} resolve(null); };   // la base no existía: no se crea
    req.onsuccess = () => {
      const db = req.result;
      try {
        if (!db.objectStoreNames.contains(store)) { db.close(); return resolve(null); }
        const get = db.transaction(store).objectStore(store).get(key);
        get.onsuccess = () => { db.close(); resolve(get.result ?? null); };
        get.onerror = () => { db.close(); resolve(null); };
      } catch { db.close(); resolve(null); }
    };
  });
}
const valueOf = (v) => (typeof v === "string" ? v : v && typeof v === "object" ? v.value ?? v.val ?? v.cookie ?? "" : "");

export async function roblosecurity() {
  for (const [db, store, key] of LOCATIONS) {
    let jar = await readStore(db, store, key);
    if (typeof jar === "string") { try { jar = JSON.parse(jar); } catch { jar = null; } }
    if (!jar || typeof jar !== "object") continue;
    for (const [k, v] of Object.entries(jar)) {
      const [domain, , name] = k.split("@");
      if (name === ".ROBLOSECURITY" && /(^|\.)roblox\.com$/.test((domain || "").replace(/^\./, ""))) {
        let val = valueOf(v);
        if (val.startsWith(".ROBLOSECURITY=")) val = val.slice(".ROBLOSECURITY=".length).split(";")[0];
        if (val) return val;
      }
    }
  }
  return "";
}
