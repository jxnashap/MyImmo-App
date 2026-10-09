// Jahresbericht: EINE Rechnung je Objekt für Seite UND PDF.
//
// WARUM (30.09.2026): Die Seite (`app/(app)/jahresbericht/page.tsx`) zog
// gebuchte Schuldzinsen aus den laufenden Kosten heraus und nahm sie als
// Zinsanteil; die PDF-Route (`app/api/berichte/jahresbericht/route.ts`)
// behauptete im Kopfkommentar „Berechnung identisch", zog die Zinsen aber
// ZWEIMAL ab (als Kostenbuchung und als Teil der Rate) und schätzte den
// Zinsanteil immer aus der heutigen Restschuld. Seite und Download zeigten
// damit verschiedene Cashflows für dasselbe Jahr.

import { laufendeKosten } from "@/lib/cashflowKennzahl";
import { kreditMonateImJahr } from "@/lib/kreditZeit";
import { restschuldVon } from "@/lib/kredit";

type Buchung = { prop_id: string | null; buchungsdatum: string | null; betrag: number | null; kategorie?: string | null };
type Darlehen = {
  prop_id: string | null; restschuld: number | null; betrag?: number | null; zinssatz: number | null; monatsrate: number | null;
  auszahlung_datum?: string | null; laufzeit?: number | null;
};

export type JahresZeile = {
  /** Einnahmen des Jahres. */
  e: number;
  /** Laufende Kosten des Jahres OHNE gebuchte Schuldzinsen (die stecken in der Rate). */
  k: number;
  /** Zinsanteil: gebucht schlägt geschätzt. */
  zins: number;
  zinsGeschaetzt: boolean;
  tilgung: number;
  /** Einnahmen − laufende Kosten − Kreditraten. */
  cashflow: number;
  /** Mindestens ein Darlehen ohne Auszahlungs- und Kaufdatum — ganzjährig angenommen. */
  kreditOhneStart: boolean;
};

/**
 * @param monate Monate, für die Raten anfallen (vergangenes Jahr 12,
 *               laufendes Jahr die verstrichenen).
 * @param daten.kaufdatum Ersatzstart für Darlehen ohne Auszahlungsdatum.
 *
 * Raten und Zinsschätzung zählen NUR für Monate, in denen das Darlehen lief (Audit 07.10.2026,
 * B3): vorher standen für 2021 Raten von vier Darlehen, obwohl das Objekt erst 2023 gekauft wurde.
 * Dieselbe Regel wie die Anlage V — `kreditMonateImJahr()` in lib/kreditZeit.ts.
 */
export function jahresZeile(
  propId: string,
  jahr: number,
  monate: number,
  daten: { einnahmen: Buchung[]; kosten: Buchung[]; kredite: Darlehen[]; kaufdatum?: string | null },
): JahresZeile {
  const imJahr = (d: string | null) => !!d && d.startsWith(String(jahr));
  // Kaution zählt nicht (06.10.2026): Sie gehört dem Mieter und geht zurück — die Anlage V
  // schließt sie ebenso aus (lib/anlageV.ts). Vorher stand sie hier als Einnahme.
  const e = daten.einnahmen
    .filter((x) => x.prop_id === propId && imJahr(x.buchungsdatum) && x.kategorie !== "Kaution")
    .reduce((s, x) => s + (x.betrag ?? 0), 0);
  const propKosten = daten.kosten.filter((x) => x.prop_id === propId && imJahr(x.buchungsdatum));
  const laufend = laufendeKosten(propKosten);
  const k = laufend.reduce((s, x) => s + (x.betrag ?? 0), 0);
  const gebuchteZinsen = propKosten.reduce((s, x) => s + (x.betrag ?? 0), 0) - k;

  const propKredite = daten.kredite
    .filter((x) => x.prop_id === propId)
    .map((kr) => ({ kr, zeit: kreditMonateImJahr(kr, jahr, daten.kaufdatum, monate) }));
  // Die Näherung „aktuelle Restschuld × Zinssatz" beschreibt HEUTE, nicht das
  // Berichtsjahr — nur ein Rückfall, wenn nichts gebucht ist. Getilgte Darlehen
  // (Restschuld 0) bekommen bewusst KEINE Sonderregel: Wann sie abbezahlt wurden,
  // weiß MyImmo nicht — für frühere Jahre liefen ihre Raten noch.
  const geschaetzterZins = propKredite.reduce(
    (s, { kr, zeit }) => s + ((restschuldVon(kr) * (kr.zinssatz ?? 0)) / 100 / 12) * zeit.monate,
    0,
  );
  const zins = gebuchteZinsen > 0 ? gebuchteZinsen : geschaetzterZins;
  const zinsGeschaetzt = gebuchteZinsen <= 0 && geschaetzterZins > 0;
  const rate = propKredite.reduce((s, { kr, zeit }) => s + (kr.monatsrate ?? 0) * zeit.monate, 0);
  const kreditOhneStart = propKredite.some(({ zeit }) => zeit.ohneStart);
  return { e, k, zins, zinsGeschaetzt, tilgung: Math.max(0, rate - zins), cashflow: e - k - rate, kreditOhneStart };
}

// ZEITRAUM DES BERICHTS (Gesamtprüfung P8, 09.10.2026, B28 + C15).
//
// Die Seite schrieb beim laufenden Jahr „Stand Jan–Okt · unterjährig“, das PDF nicht — ein
// Bericht mit zehn Monaten Einnahmen stand dort als „Jahresbericht 2026“ da. Beide nehmen jetzt
// dieselbe Monatszahl und denselben Text; der Stichtag ist Berliner Datum (vorher UTC/Ortszeit
// des Servers: in der Silvesternacht wäre das alte Jahr schon „vergangen“ gewesen).

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** Monate, für die Raten anfallen: vergangene und künftige Jahre 12, das laufende die begonnenen. */
export function berichtMonate(jahr: number, heuteIso: string): number {
  const aktuell = Number(heuteIso.slice(0, 4));
  return jahr === aktuell ? Number(heuteIso.slice(5, 7)) : 12;
}

/** „Januar–Oktober 2026 · unterjährig …“ — oder null, wenn das Jahr voll ist. */
export function unterjaehrigText(jahr: number, monate: number): string | null {
  if (monate >= 12) return null;
  const bis = MONATE[Math.max(1, monate) - 1];
  return `Zeitraum ${monate === 1 ? "" : "Januar–"}${bis} ${jahr} · unterjährig, Zins und Tilgung anteilig`;
}
