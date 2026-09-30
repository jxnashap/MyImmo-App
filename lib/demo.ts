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
  // der Besucher das Profil "Max Mustermann" und findet den Support.
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

// ---------------------------------------------------------------------------
// Was ein gesperrter Bereich kann — Text fuer den Sperr-Dialog.
//
// WARUM (Review 30.09.2026): Ein Klick auf einen gesperrten Bereich tat
// NICHTS. Der Hinweis stand nur im `title`, und den gibt es auf dem Handy
// nicht. Schlimmer: Die Aufgabenliste des Dashboards („Miete bestaetigen")
// verlinkt ausschliesslich auf gesperrte Bereiche — jeder Klick warf den
// Besucher kommentarlos aufs Dashboard zurueck. Jetzt oeffnet jeder dieser
// Klicks einen Dialog, der sagt, was dort waere.
//
// Schluessel ist der Pfad-ANFANG, damit /mietkonto?monat=… und
// /tenants/<id>/nk denselben Text finden. `tests/demoWege.test.ts` verlangt
// fuer jedes gesperrte Navigationsziel einen Eintrag.
export type DemoBereich = { titel: string; text: string };

export const DEMO_BEREICHE: Record<string, DemoBereich> = {
  "/mietkonto": {
    titel: "Mietkonto",
    text: "Soll und Ist je Mieter und Monat. Offene Mieten fallen auf, bevor du sie suchen musst, und ein Klick verbucht den Eingang in Cashflow und Anlage V.",
  },
  "/anliegen": {
    titel: "Mieterportal",
    text: "Mieter melden Schäden und Zählerstände selbst, mit Foto. Du siehst den Stand je Anliegen und beauftragst Handwerker direkt aus der Meldung.",
  },
  "/verbrauch": {
    titel: "Verbrauch",
    text: "Zählerstände je Einheit, auch von Mietern gemeldet. Sie fließen direkt in die Heiz- und Nebenkostenabrechnung.",
  },
  "/kredite": {
    titel: "Kredite",
    text: "Restschuld, Zinsbindung und Tilgungsplan je Darlehen, mit Warnung, bevor eine Zinsbindung ausläuft.",
  },
  "/steuer": {
    titel: "Steuer",
    text: "Anlage V je Objekt mit AfA, Werbungskosten und ELSTER-Hilfe, dazu der DATEV-Export für deinen Steuerberater.",
  },
  "/jahresbericht": {
    titel: "Jahresbericht",
    text: "Das Jahr je Objekt auf einer Seite: Einnahmen, Kosten, Zinsen, Tilgung und Rendite, als PDF.",
  },
  "/archiv": {
    titel: "Archiv",
    text: "Verträge, Belege und Bescheide je Objekt, auffindbar und mit Ablauffristen.",
  },
  "/bewertung": {
    titel: "Marktwert-Schätzer",
    text: "Schätzt den Verkehrswert nach dem Vergleichs- und Ertragswertverfahren der ImmoWertV.",
  },
  "/afa-assistent": {
    titel: "AfA-Assistent",
    text: "Ermittelt den Gebäudeanteil und die Abschreibung, die in die Anlage V gehört.",
  },
  "/termine": {
    titel: "Termine & Fristen",
    text: "Kündigungsfristen, Mieterhöhungen, Zinsbindungen und Wartungen an einer Stelle, mit Erinnerung.",
  },
  "/karte": {
    titel: "Portfolio-Karte",
    text: "Alle Objekte auf einer Karte, mit Wert und Miete je Standort.",
  },
};

// Unterseiten mit eigenem Text — vor den Praefixen oben gepruefte Muster.
const DEMO_BEREICHE_MUSTER: [RegExp, DemoBereich][] = [
  [/^\/tenants\/[^/]+\/nk(\/|$)/, {
    titel: "Nebenkostenabrechnung",
    text: "Umlage nach BetrKV und HeizkostenV je Mieter, mit Zählerständen und Vorauszahlungen, als fertiges PDF zum Versand.",
  }],
  [/^\/tenants\/[^/]+\/protokoll(\/|$)/, {
    titel: "Übergabeprotokoll",
    text: "Protokoll für Ein- und Auszug mit Zählerständen, Schlüsseln und Mängeln, zum Unterschreiben auf dem Handy.",
  }],
  // Anlegen/Bearbeiten: „+ Immobilie" oben auf dem Dashboard und jede Zeile
  // unter „Letzte Buchungen" (→ /einnahmen/<id>/edit) führen hierher.
  [/\/(new|edit)(\/|$)/, {
    titel: "Anlegen und bearbeiten",
    text: "In der Demo lässt sich nichts anlegen oder ändern, weil alle Besucher denselben Beispielbestand teilen. Mit eigenem Zugang erfasst du hier deine Objekte, Mieter und Buchungen.",
  }],
];

/** Text fuer einen gesperrten Pfad; allgemeiner Satz, wenn keiner hinterlegt ist. */
export function demoBereich(pfad: string): DemoBereich {
  for (const [muster, b] of DEMO_BEREICHE_MUSTER) if (muster.test(pfad)) return b;
  for (const [praefix, b] of Object.entries(DEMO_BEREICHE)) {
    if (pfad === praefix || pfad.startsWith(`${praefix}/`)) return b;
  }
  return {
    titel: "In der Demo gesperrt",
    text: "Dieser Bereich steht nach der Anmeldung mit deinen eigenen Daten bereit.",
  };
}

/**
 * Pfad eines Links, den die Demo sperren wuerde — sonst null.
 *
 * Nur Links auf die EIGENE Seite: Ein externer Link oder ein erlaubter Pfad
 * gibt null. Grundlage fuer den Klick-Abfang in `components/DemoSperre.tsx`.
 */
export function demoSperrZiel(href: string, herkunft: string): string | null {
  let url: URL;
  try {
    url = new URL(href, herkunft);
  } catch {
    return null;
  }
  if (url.origin !== new URL(herkunft).origin) return null;
  return demoDarfRoute(url.pathname) ? null : url.pathname;
}

// Gefuehrte Demo-Einstiege (`/api/demo?weg=…`). WEISSLISTE, kein freier Pfad —
// sonst waere der Parameter eine offene Weiterleitung auf der eigenen Domain.
//
// LEER seit 30.09.2026. Die drei Wege vom 08.09. fuehrten ALLE ins Leere:
// `miete` → /mietkonto und `schaden` → /anliegen waren gesperrt, und `nk`
// landete auf der Mieterliste, waehrend die Abrechnung selbst gesperrt war.
// Der Test damals pruefte nur, OB die Links auf der Startseite stehen, nicht,
// ob sie in der Demo aufgehen. Sie kommen zurueck, sobald ihre Ziele frei
// sind — `tests/demoWege.test.ts` verlangt dann, dass jedes Ziel
// `demoDarfRoute` besteht.
export const DEMO_ZIELE: Record<string, string> = {};
