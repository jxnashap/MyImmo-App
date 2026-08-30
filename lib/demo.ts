// Regeln fuer das oeffentliche Demo-Konto.
//
// Die Demo ist ein SCHAUSTUECK, kein Sandkasten (Vorgabe Betreiber 30.08.2026):
// Dashboard, Immobilien, Mieter, Ein- & Ausgaben und die Kauf-/Verkauf-Rechner
// sind zu sehen, aber nichts ist bearbeitbar. Alles andere bleibt in der
// Navigation SICHTBAR und gesperrt — ein Interessent soll sehen, was er
// bekommt, wenn er sich anmeldet.
//
// Einzige Ausnahme: das Mieterhoehungs-Dokument samt PDF. Es ist das Beispiel
// zum Selbstzusammenstellen — gespeichert wird dabei nichts.
//
// DREI Ebenen, und alle drei werden gebraucht:
//   1. Datenbank — restriktive RLS-Policies verweigern dem Demo-Konto jedes
//      INSERT/UPDATE/DELETE (Migration 20260830150000). Das ist die einzige
//      Ebene, die auch dann haelt, wenn jemand die naechste Server-Action
//      vergisst oder direkt gegen PostgREST spricht.
//   2. Route — `demoDarfRoute` unten, durchgesetzt in `middleware.ts`.
//   3. Oberflaeche — `components/DemoNurLesen.tsx` macht Felder schreibgeschuetzt
//      und Speichern-Knoepfe inaktiv. NOETIG, obwohl (1) schon sperrt: Ein per
//      RLS blockiertes UPDATE wirft KEINEN Fehler, es trifft null Zeilen. Ohne
//      Ebene 3 klickt der Besucher auf Speichern, bekommt keine Meldung und
//      glaubt, es sei gespeichert.
//
// `components/Sidebar.tsx` graut gesperrte Eintraege aus (Schloss),
// `middleware.ts` weist gesperrte Adressen serverseitig ab. Das Ausgrauen
// allein waere reine Optik: Wer die Adresse kennt, tippt sie ein.

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
  // Einstellungen bewusst sichtbar (Vorgabe Betreiber 29.08.2026): Dort sieht
  // der Besucher das Profil "Max Mustermann" und findet Hilfe & Support.
  // Aenderungen sind seit dem 30.08.2026 nicht mehr moeglich — der Bereich ist
  // wie alles andere nur noch zu lesen.
  "/einstellungen",
];

// Technisch noetig, unabhaengig von der Demo-Auswahl.
//
// `/api/` stand hier frueher PAUSCHAL — und war damit das groesste Loch:
// `/api/nk-ocr` und `/api/import-url` rufen Anthropic auf und kosten pro
// Aufruf Geld. Beide sind POST-Routen, und die Demo-Sperre in der Middleware
// griff nur bei GET. Jetzt steht hier nur noch der Einstieg selbst.
const IMMER_ERLAUBT = [
  "/api/demo",
  "/auth/",
  "/landing/",
  "/fonts/",
];

// Ausnahmen INNERHALB der erlaubten Praefixe. Ohne sie waere z. B. der
// NK-Rechner unter `/tenants/<id>/nk` mitfreigegeben, weil `/tenants` erlaubt
// ist. Reihenfolge zaehlt: erst freigegeben, dann gesperrt.
const GESPERRT_TROTZ_PRAEFIX: RegExp[] = [
  /^\/tenants\/[^/]+\/nk(\/|$)/,          // Nebenkostenabrechnung (Rechner + PDF)
  /^\/tenants\/[^/]+\/protokoll(\/|$)/,   // Uebergabeprotokoll
  /^\/tenants\/[^/]+\/edit(\/|$)/,        // Bearbeiten-Formulare: nichts zu speichern
  /^\/tenants\/new$/,
  /^\/properties\/[^/]+\/edit(\/|$)/,
  /^\/properties\/new$/,
];

// Das Mieterhoehungs-Dokument ist die eine erlaubte Ausnahme — inklusive der
// PDF-Erzeugung, weil der fertige Brief im Briefkopf der eigentliche
// Aha-Moment ist. `speichereBrief` und `saveDokumentVorlage` schreiben und
// laufen ohnehin gegen die RLS-Sperre.
const DOKUMENT_ERLAUBT = /^\/tenants\/[^/]+\/dokument(\/pdf)?$/;

export function demoDarfRoute(pathname: string): boolean {
  if (pathname === "/") return true; // Dashboard
  if (DOKUMENT_ERLAUBT.test(pathname)) return true;
  if (IMMER_ERLAUBT.some((p) => pathname === p || pathname.startsWith(`${p}/`) || (p.endsWith("/") && pathname.startsWith(p)))) return true;
  if (GESPERRT_TROTZ_PRAEFIX.some((r) => r.test(pathname))) return false;
  return ERLAUBTE_PRAEFIXE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

// Die Kalkulatoren, die in der Demo NICHT rechnen sollen. Sie stehen hier
// getrennt, weil sie in der Seitenleiste zwar gesperrt, aber unter einer
// eigenen Ueberschrift gefuehrt werden.
export const DEMO_GESPERRTE_KALKULATOREN = ["/bewertung", "/afa-assistent"];
