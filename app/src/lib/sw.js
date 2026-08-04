export function swController() {
  try {
    if ("serviceWorker" in navigator && navigator.serviceWorker.controller) {
      return navigator.serviceWorker.controller;
    }
  } catch (e) {}
  return null;
}

export function notifyProStatus(isPro) {
  const sw = swController();
  if (sw) {
    try {
      sw.postMessage({ type: "PRO_STATUS", isPro: Boolean(isPro) });
    } catch (e) {}
  }
}

export function cacheGameForOffline(href) {
  const sw = swController();
  if (sw) {
    try {
      sw.postMessage({ type: "CACHE_GAME", url: href });
    } catch (e) {}
  }
}
