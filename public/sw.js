importScripts("/scram/scramjet.all.js");

const CACHE = "budsin-v1";
const STATIC = [
  "/",
  "/index.html",
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
  "/images.ico",
  "/site-theme.js",
  "/lines-bg.js",
  "/classroom-hotkey.js",
  "/classes.js",
  "/fonts/",
  "/stylesheets/",
  "/scripts/",
];

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
      caches.keys().then((keys) =>
        Promise.all(keys.map((k) => k !== CACHE && caches.delete(k)))
      ),
    ])
  );
});

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

self.addEventListener("fetch", (event) => {
  if (scramjet.route(event)) {
    event.respondWith(scramjet.fetch(event));
    return;
  }

  if (event.request.method !== "GET") return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => {
            try { c.put(event.request, clone); } catch {}
          });
        }
        return res;
      }).catch(() => caches.match("/index.html"));
    })
  );
});
