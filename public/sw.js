importScripts("/scram/scramjet.all.js");

const CACHE = "budsin-v2";
const PRO_CACHE = "budsin-pro-v2";
const STATIC = [
  "/",
  "/index.html",
  "/settings.html",
  "/admin.html",
  "/about.html",
  "/contacto.html",
  "/privacidad.html",
  "/comentarios.html",
  "/404.html",
  "/manifest.json",
  "/react-assets/",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
  "/images.ico",
  "/images.jpeg",
  "/site-theme.js",
  "/lines-bg.js",
  "/classroom-hotkey.js",
  "/save-system.js",
  "/game-save.js",
  "/classes.js",
  "/fonts/",
  "/stylesheets/",
  "/scripts/",
];

let isPro = false;

function openDB() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open("BudsinSW", 1);
    r.onupgradeneeded = () => {
      const d = r.result;
      if (!d.objectStoreNames.contains("meta"))
        d.createObjectStore("meta", { keyPath: "key" });
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

function loadProStatus() {
  return openDB()
    .then((db) => {
      return new Promise((res) => {
        const tx = db.transaction("meta", "readonly");
        const s = tx.objectStore("meta");
        const r = s.get("pro_active");
        r.onsuccess = () => {
          isPro = r.result ? r.result.value === "1" : false;
          db.close();
          res();
        };
        r.onerror = () => {
          db.close();
          res();
        };
      });
    })
    .catch(() => {});
}

function saveProStatus(v) {
  isPro = v;
  return openDB()
    .then((db) => {
      return new Promise((res) => {
        const tx = db.transaction("meta", "readwrite");
        tx.objectStore("meta").put({ key: "pro_active", value: v ? "1" : "0" });
        tx.oncomplete = () => {
          db.close();
          res();
        };
        tx.onerror = () => {
          db.close();
          res();
        };
      });
    })
    .catch(() => {});
}

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(STATIC).catch(() => {}))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    Promise.all([
      self.clients.claim(),
      loadProStatus(),
      caches.keys().then((keys) =>
        Promise.all(
          keys.map(
            (k) => k !== CACHE && k !== PRO_CACHE && caches.delete(k)
          )
        )
      ),
    ])
  );
});

self.addEventListener("message", (e) => {
  if (e.data && e.data.type === "PRO_STATUS") {
    saveProStatus(e.data.isPro === true);
    if (!e.data.isPro) {
      caches.open(PRO_CACHE).then((c) =>
        c.keys().then((keys) => keys.forEach((k) => c.delete(k)))
      );
    }
  }
  if (e.data && e.data.type === "CACHE_GAME") {
    const url = e.data.url;
    if (url && isPro) {
      fetch(url)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(PRO_CACHE).then((c) => {
              try { c.put(url, clone); } catch {}
            });
          }
        })
        .catch(() => {});
    }
  }
  if (e.data && e.data.type === "CLEAR_PRO_CACHE") {
    caches.open(PRO_CACHE).then((c) =>
      c.keys().then((keys) => keys.forEach((k) => c.delete(k)))
    );
  }
});

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("fetch", (event) => {
  if (scramjet.route(event)) {
    event.respondWith(scramjet.fetch(event));
    return;
  }
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Always cache static assets
  if (STATIC.some((s) => url.pathname.startsWith(s) || url.pathname === s)) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((res) => {
            if (res.ok) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => {
                try { c.put(event.request, clone); } catch {}
              });
            }
            return res;
          })
          .catch(() => caches.match("/index.html"));
      })
    );
    return;
  }

  // For game pages: Pro gets full offline, Free gets network-only
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && isPro) {
          const clone = res.clone();
          caches.open(PRO_CACHE).then((c) => {
            try { c.put(event.request, clone); } catch {}
          });
        }
        return res;
      })
      .catch(() => {
        if (isPro) {
          return caches.match(event.request).then(
            (cached) => cached || caches.match("/index.html")
          );
        }
        return new Response(
          JSON.stringify({
            offline: true,
            message: "Juega sin internet con Budsin Pro.",
          }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      })
  );
});
