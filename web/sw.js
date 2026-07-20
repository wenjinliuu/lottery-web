const CACHE_VERSION = "lottery-pocket-v2.0.0";
const APP_CACHE = `${CACHE_VERSION}-app`;
const DATA_CACHE = `${CACHE_VERSION}-data`;
const APP_FILES = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./rules.js",
  "./ocr.js",
  "./pwa.js",
  "./manifest.webmanifest",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(APP_CACHE).then((cache) => cache.addAll(APP_FILES)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith("lottery-pocket-") && ![APP_CACHE, DATA_CACHE].includes(key)).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

async function notifyOfflineData() {
  const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
  clients.forEach((client) => client.postMessage({ type: "OFFLINE_DATA_USED" }));
}

async function networkFirst(request, cacheName, fallbackUrl = "") {
  const cache = await caches.open(cacheName);
  const requestUrl = new URL(request.url);
  const cacheKey = cacheName === DATA_CACHE
    ? new Request(`${requestUrl.origin}${requestUrl.pathname}`, { mode: "cors" })
    : request;
  try {
    const response = await fetch(request);
    if (response && response.ok) cache.put(cacheKey, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(cacheKey, { ignoreSearch: true });
    if (cached) {
      if (cacheName === DATA_CACHE) notifyOfflineData();
      return cached;
    }
    if (fallbackUrl) return caches.match(fallbackUrl);
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (request.mode === "navigate") {
    event.respondWith(networkFirst(request, APP_CACHE, new URL("./index.html", self.registration.scope).href));
    return;
  }

  if (url.hostname === "raw.githubusercontent.com" && url.pathname.includes("/lottery-data-repo/")) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  if (url.origin === self.location.origin) {
    event.respondWith((async () => {
      const cache = await caches.open(APP_CACHE);
      const cached = await cache.match(request, { ignoreSearch: true });
      const fresh = fetch(request).then((response) => {
        if (response && response.ok) cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })());
  }
});
