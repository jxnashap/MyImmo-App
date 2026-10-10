// MyImmo — Service Worker, Stufe 1 (10.10.2026)
// Plan und Datenrecht: docs/zukunft/WEBAPP-INSTALLIERBAR.md · Konstanten: lib/pwa.ts
//
// ER HÄLT GENAU EINE DATEI VOR: die Offline-Seite. Alles andere geht unverändert ans Netz —
// Seiten, /api/*, Supabase, Dateien und auch die Programmdateien (die hält der Browser-Cache
// ohnehin ein Jahr, "immutable"). Damit liegt nie ein Inhalt aus einem Konto im Gerät, und dieser
// Service Worker kann niemanden auf einer alten Version der App festhalten.
//
// VERSION = die ersten 12 Zeichen des SHA-256 von public/pwa/offline.html. Ändert sich die Seite,
// muss VERSION mit (tests/pwa.test.ts prüft es) — nur eine geänderte sw.js wird neu installiert.
const VERSION = "17cf97f2d049";
const CACHE = "myimmo-offline-" + VERSION;
const OFFLINE = "/pwa/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE, { cache: "reload" })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const namen = await caches.keys();
      await Promise.all(namen.filter((n) => n.startsWith("myimmo-") && n !== CACHE).map((n) => caches.delete(n)));
      // Vorab-Laden der Seite parallel zum Start des Workers — sonst kostet jeder Seitenaufruf
      // die Startzeit des Workers zusätzlich.
      if (self.registration.navigationPreload) await self.registration.navigationPreload.enable();
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const anfrage = event.request;
  // Nur Seitenaufrufe bekommen einen Rückfall. Alles andere (Skripte, Bilder, API, Supabase,
  // Formulare) fasst der Worker nicht an — der Browser lädt es wie ohne ihn.
  if (anfrage.mode !== "navigate" || anfrage.method !== "GET") return;
  event.respondWith(
    (async () => {
      try {
        const vorab = await event.preloadResponse;
        if (vorab) return vorab;
        return await fetch(anfrage);
      } catch {
        // Kein Netz: die vorgehaltene Hinweisseite. Die Antwort wird NIE in einen Cache gelegt.
        const offline = await caches.match(OFFLINE, { cacheName: CACHE });
        return offline || Response.error();
      }
    })(),
  );
});
