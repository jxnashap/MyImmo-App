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

type Buchung = { prop_id: string | null; buchungsdatum: string | null; betrag: number | null; kategorie?: string | null };
type Darlehen = { prop_id: string | null; restschuld: number | null; zinssatz: number | null; monatsrate: number | null };

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
};

/**
 * @param monate Monate, für die Raten anfallen (vergangenes Jahr 12,
 *               laufendes Jahr die verstrichenen).
 */
export function jahresZeile(
  propId: string,
  jahr: number,
  monate: number,
  daten: { einnahmen: Buchung[]; kosten: Buchung[]; kredite: Darlehen[] },
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

  const propKredite = daten.kredite.filter((x) => x.prop_id === propId);
  // Die Näherung „aktuelle Restschuld × Zinssatz" beschreibt HEUTE, nicht das
  // Berichtsjahr — nur ein Rückfall, wenn nichts gebucht ist.
  const geschaetzterZins = propKredite.reduce(
    (s, kr) => s + (((kr.restschuld ?? 0) * (kr.zinssatz ?? 0)) / 100 / 12) * monate,
    0,
  );
  const zins = gebuchteZinsen > 0 ? gebuchteZinsen : geschaetzterZins;
  const zinsGeschaetzt = gebuchteZinsen <= 0 && geschaetzterZins > 0;
  const rate = propKredite.reduce((s, kr) => s + (kr.monatsrate ?? 0) * monate, 0);
  return { e, k, zins, zinsGeschaetzt, tilgung: Math.max(0, rate - zins), cashflow: e - k - rate };
}
