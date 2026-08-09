/*
 * Service worker minimal.
 *
 * Parti pris : on ne met **jamais** le HTML en cache. Une page servie depuis
 * le cache afficherait un rang, des LP ou une séance périmés — pire qu'une
 * page absente. Seuls les fichiers immuables sont mis en cache, et une page
 * hors-ligne sert de repli.
 */

const VERSION = "v1";
const CACHE = `la-faille-${VERSION}`;
const HORS_LIGNE = "/hors-ligne.html";

const PRECACHE = [HORS_LIGNE, "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((cles) => Promise.all(cles.filter((c) => c !== CACHE).map((c) => caches.delete(c))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const requete = event.request;
  if (requete.method !== "GET") return;

  const url = new URL(requete.url);
  if (url.origin !== self.location.origin) return;
  // L'authentification et l'export ne doivent jamais transiter par un cache.
  if (url.pathname.startsWith("/api/")) return;

  // Navigation : le réseau fait foi, le hors-ligne sert de repli.
  if (requete.mode === "navigate") {
    event.respondWith(fetch(requete).catch(() => caches.match(HORS_LIGNE)));
    return;
  }

  // Fichiers immuables (build Next, écussons, icônes) : cache d'abord.
  const immuable =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/ranks/") ||
    url.pathname.startsWith("/icon-");

  if (!immuable) return;

  event.respondWith(
    caches.match(requete).then(
      (enCache) =>
        enCache ??
        fetch(requete).then((reponse) => {
          if (reponse.ok) {
            const copie = reponse.clone();
            caches.open(CACHE).then((c) => c.put(requete, copie));
          }
          return reponse;
        }),
    ),
  );
});
