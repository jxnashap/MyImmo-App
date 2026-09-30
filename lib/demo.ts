// Regeln fuer das oeffentliche Demo-Konto.
//
// Die Demo ist ein SCHAUSTUECK, kein Sandkasten (Vorgabe Betreiber 30.08.2026):
// Man sieht alles, bearbeitet nichts.
//
// Seit 30.09.2026 (Phase 2 nach dem externen Review) sind auch die
// KAUFGRUENDE frei — Steuer/Anlage V, Nebenkostenabrechnung, Mietkonto,
// Kredite, Jahresbericht. Vorher waren genau die Funktionen gesperrt, mit
// denen die Startseite wirbt; wer „Demo ansehen" klickte, fand sie nicht.
// Gesperrt bleiben nur Bereiche OHNE Beispieldaten (Mieterportal, Archiv) —
// eine leere Seite wirbt schlechter als der Sperr-Dialog — sowie Anlegen und
// Bearbeiten.
//
// Einzige Ausnahme: das Mieterhoehungs-Dokument samt PDF. Es ist das Beispiel
// zum Selbstzusammenstellen — gespeichert wird dabei nichts.
//
// DREI Ebenen, und alle drei werden gebraucht:
//   1. Datenbank — ein Anweisungs-Trigger wirft fuer das Demo-Konto bei jedem
//      INSERT/UPDATE/DELETE einen FEHLER (Migration 20260930150643); die
//      restriktiven RLS-Policies (20260830150000) bleiben als zweite Linie.
//      Das ist die einzige Ebene, die auch dann haelt, wenn jemand die
//      naechste Server-Action vergisst oder direkt gegen PostgREST spricht.
//      Der Trigger ist noetig, weil die Policies UPDATE/DELETE nur STILL
//      wegfiltern — die Action meldete „gespeichert", obwohl nichts geschah.
//   2. Route — `demoDarfRoute` unten, durchgesetzt in `middleware.ts`.
//   3. Oberflaeche — `components/DemoNurLesen.tsx` macht Felder schreibgeschuetzt
//      und Speichern-Knoepfe inaktiv. Seit dem Trigger in (1) ist sie keine
//      Sicherung mehr, sondern Hoeflichkeit: Wer gar nicht erst tippen kann,
//      muss sich keine Fehlermeldung durchlesen.
//
// `components/Sidebar.tsx` graut gesperrte Eintraege aus (Schloss),
// `middleware.ts` weist gesperrte Adressen serverseitig ab. Das Ausgrauen
// allein waere reine Optik: Wer die Adresse kennt, tippt sie ein.

import { istOeffentlicheSeite } from "@/lib/oeffentlich";

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
  // Die Kaufgruende (seit 30.09.2026). Alle haben Beispieldaten; `/termine`
  // leitet Fristen aus Mietern, Krediten und Objekten ab.
  "/mietkonto",
  "/verbrauch",
  "/kredite",
  "/steuer",
  "/jahresbericht",
  "/termine",
  "/karte", // Koordinaten fest im Schnappschuss (Migration 20260930150903)
  "/bewertung",
  "/afa-assistent",
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
  // LESENDE API-Routen der freigegebenen Bereiche: PDF/CSV aus vorhandenen
  // Daten, kein Schreibvorgang, kein KI-Aufruf, keine „frische Anmeldung".
  // Ohne sie liefen „Anlage V als PDF", „DATEV-Export" und der CSV-Export auf
  // /cashflow stumm aufs Dashboard zurueck.
  // NICHT hierher: /api/nk-ocr, /api/import-url (kosten Geld je Aufruf),
  // /api/import (schreibt), /api/export/alles (verlangt frische Anmeldung).
  "/api/berichte/anlage-v",
  "/api/berichte/jahresbericht",
  "/api/export/datev",
  "/api/export/buchungen",
  "/api/kauf/kreditantrag", // POST, aber nur ein PDF aus der Selbstauskunft
  // Hochgeladene Dateien ANSEHEN (GET, eigene Daten, ueber `dateiKopf()`):
  // Zaehlerfoto auf /verbrauch, Anhang eines Anliegens.
  "/api/zaehler-foto",
  "/api/anliegen-datei",
];

// Einzelne lesende Routen ausserhalb der freien Praefixe.
const LESEND_ERLAUBT: RegExp[] = [
  // Beleg einer Buchung — verlinkt aus der Buchungsliste auf /cashflow. Nur
  // `rechnung`: `/kosten/<id>/edit` ist ein Formular und bleibt gesperrt.
  /^\/kosten\/[^/]+\/rechnung$/,
];

// Ausnahmen INNERHALB der erlaubten Praefixe: Anlegen und Bearbeiten.
// NK-Rechner und Uebergabeprotokoll standen bis 30.09.2026 auch hier — sie
// sind Kaufgruende und jetzt frei; was sie speichern wollen, scheitert laut
// am Datenbank-Trigger. Reihenfolge zaehlt: erst freigegeben, dann gesperrt.
const GESPERRT_TROTZ_PRAEFIX: RegExp[] = [
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
  if (LESEND_ERLAUBT.some((r) => r.test(pathname))) return true;
  if (IMMER_ERLAUBT.some((p) => pathname === p || pathname.startsWith(`${p}/`) || (p.endsWith("/") && pathname.startsWith(p)))) return true;
  if (GESPERRT_TROTZ_PRAEFIX.some((r) => r.test(pathname))) return false;
  return ERLAUBTE_PRAEFIXE.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

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
  // Beide ohne Beispieldaten — kommen frei, sobald der Schnappschuss Anliegen
  // bzw. Archiv-Eintraege enthaelt (Phase 3).
  "/anliegen": {
    titel: "Mieterportal",
    text: "Mieter melden Schäden und Zählerstände selbst, mit Foto. Du siehst den Stand je Anliegen und beauftragst Handwerker direkt aus der Meldung.",
  },
  "/archiv": {
    titel: "Archiv",
    text: "Verträge, Belege und Bescheide je Objekt, auffindbar und mit Ablauffristen.",
  },
  // Verlinkt aus dem Kauf-Assistenten.
  "/makler": {
    titel: "Makler-Unterlagen",
    text: "Exposé, Grundbuchauszug, Teilungserklärung und Protokolle je Kaufobjekt an einer Stelle, mit Prüfliste, was noch fehlt.",
  },
};

// Unterseiten mit eigenem Text — vor den Praefixen oben gepruefte Muster.
const DEMO_BEREICHE_MUSTER: [RegExp, DemoBereich][] = [
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
  // Oeffentliche Seiten (Impressum, Datenschutz …) laesst die Middleware
  // auch der Demo durch — der Abfang darf sie nicht fuer gesperrt halten.
  if (istOeffentlicheSeite(url.pathname) || demoDarfRoute(url.pathname)) return null;
  return url.pathname;
}

// Gefuehrte Demo-Einstiege (`/api/demo?weg=…`). WEISSLISTE, kein freier Pfad —
// sonst waere der Parameter eine offene Weiterleitung auf der eigenen Domain.
//
// Die ersten drei Wege (08.09.2026) fuehrten ALLE ins Leere: Ihre Ziele waren
// in der Demo gesperrt. Der Test pruefte nur, OB die Links auf der Startseite
// stehen. Jetzt verlangt `tests/demoWege.test.ts`, dass jedes Ziel
// `demoDarfRoute` besteht. „Schaden verfolgen" (/anliegen) fehlt deshalb, bis
// das Mieterportal Beispieldaten hat.
export const DEMO_ZIELE: Record<string, string> = {
  miete: "/mietkonto",
  nk: "/tenants", // je Mieter der Knopf „NK" — die Abrechnung braucht eine Mieter-ID
  steuer: "/steuer",
};
