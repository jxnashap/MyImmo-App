// Seiten, die ohne Anmeldung erreichbar sind — EINE Liste für Middleware und
// Demo-Klick-Abfang.
//
// WARUM AUSGELAGERT (30.09.2026): Die Liste stand nur in `middleware.ts`. Der
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
    pathname.startsWith("/bewerben/") || // öffentliche Bewerber-Selbstauskunft
    pathname.startsWith("/auftrag/") || // öffentlicher Firmen-Link (Terminabsprache)
    pathname === "/impressum" ||
    pathname === "/agb" ||
    pathname === "/avv" || // im Login-Consent verlinkt — muss ohne Login lesbar sein
    pathname === "/datenschutz" ||
    pathname.startsWith("/landing/") || // statische Landingpage-Screenshots (public/)
    pathname.startsWith("/fonts/") || // selbst gehostete Schriften (public/fonts/)
    pathname === "/icon.svg" // Favicon (app/icon.svg)
  );
}
