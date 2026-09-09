// service-worker.js — minimal cache-first strategy so the sheet still opens
// (with last-seen data) if there's no signal, and so browsers treat this as
// an installable PWA. Bump CACHE_NAME whenever the mobile page set changes
// so old cached pages don't stick around.
//
// Paths below are relative to this file's own location -- put this file in
// the same /mobile/ folder as the real generated pages, with icons living
// one level up in /Logos/ (real structure confirmed 8/13/26, not the
// original /mobile/icons/ assumption).
//
// Real fix 9/9/26 per direct report ("download/install app doesn't work,
// and then a lot of individual html files"): this precache list was built
// against an OLDER real page set and never updated when the mobile
// architecture changed. Two confirmed real problems:
//   1. "./slate.html" -- this page's own generation was REMOVED from
//      main() back on 8/22/26 (replaced by market_lines_props.html), but
//      this file's reference to it was never updated -- caching.add() on a
//      real dead/stale page.
//   2. market_lines_props.html itself -- the REAL current entry point
//      (matches manifest.json's own start_url) -- was NEVER in this list
//      at all, and neither were games.html/parlays.html/results.html,
//      three of the five real tabs in the mobile bottom nav. An installed
//      app relying on this precache for its very first offline-capable
//      load had no real guarantee its own entry point, or most of its
//      real tabs, were ever actually cached.
// CACHE_NAME bumped (v3 -> v4) so any already-installed copy is forced to
// fully clear its old cache and re-fetch fresh under this corrected list,
// rather than silently keeping whatever it cached under the old, wrong one.
const CACHE_NAME = "nfl-sheet-v4";
const PRECACHE_URLS = [
  "./market_lines_props.html",
  "./games.html",
  "./parlays.html",
  "./results.html",
  "./injuries.html",
  "./props_passing_yds.html",
  "./props_rushing_yds.html",
  "./props_receiving_yds.html",
  "./props_receptions.html",
  "./manifest.json",
  "../Logos/icon-192.png",
  "../Logos/icon-512.png",
];
// NOTE: per-game pages (game{N}.html) aren't precached here -- the list
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
