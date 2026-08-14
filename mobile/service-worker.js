// service-worker.js — minimal cache-first strategy so the sheet still opens
// (with last-seen data) if there's no signal, and so browsers treat this as
// an installable PWA. Bump CACHE_NAME whenever the mobile page set changes
// so old cached pages don't stick around.
//
// Paths below are relative to this file's own location -- put this file in
// the same /mobile/ folder as the real generated pages, with icons living
// one level up in /Logos/ (real structure confirmed 8/13/26, not the
// original /mobile/icons/ assumption).

const CACHE_NAME = "nfl-sheet-v2";
const PRECACHE_URLS = [
  "./slate.html",
  "./props_passing.html",
  "./props_rushing.html",
  "./props_receiving.html",
  "./injuries.html",
  "./manifest.json",
  "../Logos/icon-192.png",
  "../Logos/icon-512.png",
];
// NOTE: per-game pages (game_xxx_yyy.html) aren't precached here -- the list
// changes every week and can't be hardcoded. They get cached organically
// the first time each one is actually visited, via the fetch handler below.

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // addAll fails entirely if ANY one URL 404s -- use allSettled via
      // individual adds instead, so one missing page (e.g. injuries.html
      // not built yet this week) doesn't break precaching for everything else
      Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(url)))
    )
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  // network-first for HTML (so you get fresh weekly data when online),
  // falling back to cache when offline
  if (event.request.mode === "navigate" || event.request.headers.get("accept")?.includes("text/html")) {
    event.respondWith(
      fetch(event.request)
        .then((resp) => {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return resp;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }
  // cache-first for everything else (icons, manifest)
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
