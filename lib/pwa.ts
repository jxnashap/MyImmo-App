// Installierbare Web-App, Stufe 1 (10.10.2026). Plan und Datenrecht: docs/zukunft/WEBAPP-INSTALLIERBAR.md
//
// Was die App auf dem Gerät ablegt, legt MyImmo fest — deshalb steht es hier an EINER Stelle:
// - ein Service Worker (`public/sw.js`), der GENAU EINE Datei vorhält: die Offline-Seite;
// - sonst nichts. Seiten, /api/*, Supabase-Antworten und Dateien gehen immer ans Netz.
// Programmdateien (`/_next/static/…`) hält schon der Browser-Cache ein Jahr (`immutable`); ein
// zweiter Cache im Service Worker brächte nichts außer dem Risiko, Nutzer auf einer alten
// Version festzuhalten.
//
// Registriert wird nur im ANGEMELDETEN App-Bereich (app/(app)/layout.tsx, PwaAnmeldung) — nicht
// auf Startseite, Ratgebern oder den öffentlichen Links. § 25 Abs. 2 Nr. 2 TDDDG: Wer die App
// nutzt, wünscht sie ausdrücklich; die Offline-Seite gehört zu diesem Dienst.

/** NOTSCHALTER. `false` + Deployment → jede geöffnete App meldet den Service Worker ab und leert
 *  dessen Cache. Wirkt, weil die Seiten selbst nie aus dem Cache kommen: Der nächste Aufruf lädt
 *  frischen Code vom Server, und der räumt auf. */
export const SW_AN = true;

export const SW_PFAD = "/sw.js";
export const OFFLINE_PFAD = "/pwa/offline.html";
/** Alle Caches des Service Workers beginnen so (public/sw.js). */
export const CACHE_PRAEFIX = "myimmo-";

/** Farbe von Splash, Titelleiste und Statusleiste — die helle Arbeitsfläche (`--bg`). */
export const APP_FARBE_HELL = "#f5f5f5";
export const APP_FARBE_DUNKEL = "#0f0f0f";

/** Ereignis an `window`, sobald der Browser eine Installation anbietet oder sie erledigt ist. */
export const INSTALL_EREIGNIS = "myimmo:install";

type Registrierung = { unregister(): Promise<boolean> };
type DienstContainer = {
  register(pfad: string, optionen: { scope: string; updateViaCache: "none" }): Promise<unknown>;
  getRegistrations(): Promise<readonly Registrierung[]>;
};
type CacheSpeicher = { keys(): Promise<string[]>; delete(name: string): Promise<boolean> };

/**
 * Meldet den Service Worker an — oder, mit ausgeschaltetem Notschalter, ab und leert dessen Cache.
 * `updateViaCache: "none"`: Der Browser fragt bei jeder Prüfung den Server nach einer neuen
 * `sw.js`, nicht seinen eigenen Cache.
 */
export async function starteDienst(
  sw: DienstContainer | undefined,
  caches: CacheSpeicher | undefined,
  an: boolean = SW_AN,
): Promise<"angemeldet" | "abgemeldet" | "ohne"> {
  if (!sw) return "ohne";
  if (an) {
    await sw.register(SW_PFAD, { scope: "/", updateViaCache: "none" });
    return "angemeldet";
  }
  const registrierungen = await sw.getRegistrations();
  await Promise.all(registrierungen.map((r) => r.unregister()));
  if (caches) {
    const namen = await caches.keys();
    await Promise.all(namen.filter((n) => n.startsWith(CACHE_PRAEFIX)).map((n) => caches.delete(n)));
  }
  return "abgemeldet";
}

export type InstallWeg = "installiert" | "knopf" | "ios" | "mac-safari" | "menue" | "nicht";

/**
 * Wie installiert DIESER Browser? Rein, damit testbar.
 * - `installiert`: läuft schon im eigenen Fenster;
 * - `knopf`: Chrome/Edge/Samsung haben eine Installation angeboten (`beforeinstallprompt`);
 * - `ios`: iPhone/iPad (auch iPadOS, das sich als Mac ausgibt) — Teilen → „Zum Home-Bildschirm“;
 * - `mac-safari`: Safari ab macOS Sonoma — Ablage → „Zum Dock hinzufügen“;
 * - `menue`: andere Android-Browser und Chromium ohne Angebot (schon installiert, oder es kommt noch);
 * - `nicht`: Firefox auf dem Computer kann Web-Apps nicht installieren.
 */
export function installWeg(u: { ua: string; standalone: boolean; hatAngebot: boolean; touchPunkte: number }): InstallWeg {
  if (u.standalone) return "installiert";
  if (u.hatAngebot) return "knopf";
  if (/iPhone|iPad|iPod/.test(u.ua) || (/Macintosh/.test(u.ua) && u.touchPunkte > 1)) return "ios";
  if (/Android/.test(u.ua)) return "menue";
  if (/Firefox\//.test(u.ua)) return "nicht";
  if (/Macintosh/.test(u.ua) && /Safari\//.test(u.ua) && !/Chrome|Chromium|CriOS|Edg\//.test(u.ua)) return "mac-safari";
  return "menue";
}
