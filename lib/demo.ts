// Regeln fuer das oeffentliche Demo-Konto.
//
// Die Demo zeigt einen Ausschnitt: Dashboard, Immobilien, Mieter und
// Ein- & Ausgaben sind benutzbar, dazu Kauf- und Verkauf-Assistent mit festem
// Beispiel. Alles andere bleibt in der Navigation SICHTBAR, aber gesperrt —
// ein Interessent soll sehen, was er bekommt, wenn er sich anmeldet.
//
// Zwei Stellen muessen zusammenpassen und tun das ueber diese Datei:
//   - `components/Sidebar.tsx` graut gesperrte Eintraege aus (Schloss),
//   - `middleware.ts` weist gesperrte Adressen serverseitig ab.
// Das Ausgrauen allein waere reine Optik: Wer die Adresse kennt, tippt sie ein.

export const DEMO_EMAIL = "demo.vermieter@myimmo.test";

export function istDemoKonto(email?: string | null): boolean {
  return !!email && email === DEMO_EMAIL;
}

// Benutzbare Bereiche. Praefixe, damit Detailseiten (/properties/<id>) und
// Unterseiten (/tenants/new) mitgelten.
const ERLAUBTE_PRAEFIXE = [
  "/properties",
  "/tenants",
  "/cashflow",
  "/kauf",
  "/verkauf",
  "/hilfe", // Support muss immer erreichbar sein, auch in der Demo
];

// Technisch noetig, unabhaengig von der Demo-Auswahl.
const IMMER_ERLAUBT = [
  "/api/",
  "/auth/",
  "/landing/",
  "/fonts/",
];

export function demoDarfRoute(pathname: string): boolean {
  if (pathname === "/") return true; // Dashboard
  if (IMMER_ERLAUBT.some((p) => pathname.startsWith(p))) return true;
  return ERLAUBTE_PRAEFIXE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Die Kalkulatoren, die in der Demo NICHT rechnen sollen. Sie stehen hier
// getrennt, weil sie in der Seitenleiste zwar gesperrt, aber unter einer
// eigenen Ueberschrift gefuehrt werden.
export const DEMO_GESPERRTE_KALKULATOREN = ["/bewertung", "/afa-assistent"];
