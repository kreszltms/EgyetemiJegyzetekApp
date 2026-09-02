// ============================================================================
// EGYETEMI JEGYZETEK — Service Worker (alap offline-cache)
//
// Az app 100%-ban kliensoldali (localStorage + opcionális Firebase-szinkron),
// ezért egy egyszerű "hálózat elsőként, cache-be esve" stratégia elég:
// minden sikeres, saját-eredetű GET-kérést eltárolunk, és ha a hálózat nem
// elérhető, a legutóbb cache-elt választ adjuk vissza. Így ha valaki már
// egyszer online használta az appot ezen az eszközön, óra közben internet
// nélkül is megnyithatja, olvashatja a jegyzeteit (a MENTÉS/szinkron
// természetesen csak online működik).
//
// Külső (más eredetű) kérések — pl. Firestore/Firebase Auth hívások —
// szándékosan NEM kerülnek ide, azokat a böngésző saját hálózati/hiba-
// kezelése intézi.
// ============================================================================

const CACHE_NAME = "egyetemi-jegyzetek-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        const response = await fetch(request);
        if (response && response.status === 200) {
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        const cached = await cache.match(request);
        if (cached) return cached;
        if (request.mode === "navigate") {
          const shell = await cache.match("/");
          if (shell) return shell;
        }
        return Response.error();
      }
    })
  );
});
