importScripts("/scramjet.config.js");
importScripts("/baremux/index.js");
importScripts("/scram/scramjet.all.js");

const { ScramjetServiceWorker } = $scramjetLoadWorker();
const scramjet = new ScramjetServiceWorker();

// iPad Safari対策: 自前でトランスポートを設定する
const connection = new BareMux.BareMuxConnection("/baremux/worker.js");

async function ensureTransport() {
  const wispUrl = `${self.location.protocol === "https:" ? "wss" : "ws"}://${self.location.host}/wisp/`;
  try {
    // 既に設定済みでも上書きして確実に
    await connection.setTransport("/epoxy/index.mjs", [{ wisp: wispUrl }]);
  } catch (e) {
    // エラーは無視して進む
  }
}

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  const url = event.request.url;
  const prefix = self.__scramjet$config?.prefix || "/scramjet/";

  if (url.includes(prefix)) {
    event.respondWith(
      (async () => {
        try {
          // 設定を強制ロード
          await scramjet.loadConfig();
          
          // iPad向けに通信路を確保
          await ensureTransport();

          if (scramjet.route(event)) {
            return await scramjet.fetch({
              request: event.request,
              clientId: event.clientId || ""
            });
          }
        } catch (err) {
          console.error("SW: Proxy Error", err);
        }
        return fetch(event.request);
      })()
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "ping") event.source.postMessage("pong");
});
