// Seiten, die ohne Anmeldung erreichbar sind — EINE Liste für Middleware und
// Demo-Klick-Abfang.
//
// WARUM AUSGELAGERT (30.09.2026): Die Liste stand nur in `middleware.ts` (seit Next 16 `proxy.ts`). Der
// Klick-Abfang der Demo (`components/DemoSperre.tsx`) fragte deshalb nur
// `demoDarfRoute` — und hielt Impressum, Datenschutz, AVV und AGB für
// gesperrt. In der Demo öffnete „Datenschutz" in der Seitenleiste den Dialog
// „In der Demo gesperrt", obwohl die Middleware die Seite durchgelassen hätte.
// Zwei Listen für dieselbe Frage laufen auseinander; eine nicht.
//
// `/api/` gehört NICHT hierher: Die API-Routen prüfen ihre Anmeldung selbst
// und gelten in der Middleware nur deshalb als offen. Für die Demo-Sperre
// dürfen sie gerade nicht als offen durchgehen (`/api/nk-ocr` kostet Geld).

export function istOeffentlicheSeite(pathname: string): boolean {
  return (
    pathname === "/" || // eigene Willkommens-Ansicht für Ausgeloggte
    pathname === "/funktionen" || // Landing-Unterseiten (Marketing, öffentlich)
    pathname.startsWith("/funktionen/") || // Funktions-Landingpages je Kernaufgabe
    pathname === "/preise" ||
    pathname === "/vision" ||
    pathname === "/ratgeber" || // SEO-Ratgeber (öffentlich)
    pathname.startsWith("/ratgeber/") ||
    pathname === "/vorlagen" || // Vorlagen-Übersicht (öffentlich)
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/login" ||
    pathname === "/anmelden" || // Rollen-Auswahl vor dem Login
    pathname.startsWith("/auth") ||
    pathname.startsWith("/beleihung/") ||
    pathname.startsWith("/makler-link/") || // Käuferunterlagen für den Makler (05.10.2026)
    pathname.startsWith("/bewerben/") || // öffentliche Bewerber-Selbstauskunft
    pathname.startsWith("/auftrag/") || // öffentlicher Firmen-Link (Terminabsprache)
    pathname.startsWith("/angebot/") || // öffentliche Angebotsanfrage an eine Firma
    pathname === "/impressum" ||
    pathname === "/agb" ||
    pathname === "/avv" || // im Login-Consent verlinkt — muss ohne Login lesbar sein
    pathname === "/datenschutz" ||
    pathname.startsWith("/landing/") || // statische Landingpage-Screenshots (public/)
    pathname.startsWith("/fonts/") || // selbst gehostete Schriften (public/fonts/)
    pathname === "/icon.svg" || // Favicon (app/icon.svg)
    // og:image aller oeffentlichen Seiten und Organization.logo im JSON-LD.
    // Bis 01.10.2026 NICHT gelistet -> GET /og.png lief auf /login (307): jede
    // geteilte Vorschau ohne Bild, in der Demo auf jeder Seite ein kaputtes
    // Logo. `curl -I` taeuscht hier: das Gate prueft nur GET, HEAD gab 200.
    pathname === "/og.png" ||
    pathname === "/myimmo_logo_2048.png"
  );
}
