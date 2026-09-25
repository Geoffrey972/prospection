/* Service worker — fonctionnement hors-ligne de l'application */
const SHELL = "shell-v1.3.0";
const TILES = "tiles-v1";
const ASSETS = ["./","index.html","manifest.webmanifest","icon-180.png","icon-192.png","icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css",
  "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(SHELL).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== SHELL && k !== TILES).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Les API (entreprises, adresses) ne sont jamais mises en cache : données toujours fraîches
  if (url.hostname.includes("api.gouv.fr") || url.hostname.includes("geopf.fr")) return;
  // Tuiles de carte : cache d'abord, réseau sinon (consultation hors-ligne des zones déjà vues)
  if (url.hostname.endsWith("tile.openstreetmap.org")) {
    e.respondWith(caches.open(TILES).then(async c => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      try {
        const r = await fetch(e.request);
        if (r.ok) { c.put(e.request, r.clone()); trim(c, 1500); }
        return r;
      } catch (err) { return new Response("", { status: 504 }); }
    }));
    return;
  }
  // Application : réseau d'abord (mises à jour), cache si hors-ligne
  e.respondWith(fetch(e.request).then(r => {
    if (r.ok && (url.origin === location.origin || url.hostname === "cdnjs.cloudflare.com")) {
      const copy = r.clone(); caches.open(SHELL).then(c => c.put(e.request, copy));
    }
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true }).then(r => r || caches.match("index.html"))));
});
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}
