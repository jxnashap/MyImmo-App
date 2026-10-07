// EINE Lesart eines Darlehens (Gesamtprüfung 07.10.2026, Paket P6: B17, B18, C7, Zusammenführung 6/12).
//
// Vorher las jede Stelle die Felder selbst — und auf vier Arten:
// - leere Restschuld: `?? 0` (Kreditliste, Schulden-Uhr, Auslauf → „100 % getilgt, Auslauf 0 %“),
//   `?? betrag` (Beleihungsordner, Verkauf), „nicht erfasst“ (Objektseite). Gespeichert wurde sie
//   leer, weil `updateKredit` den Rückfall von `createKredit` nicht kannte.
// - abbezahlt (Restschuld 0): die Rate zählte weiter als Tilgung und im Monats-Cashflow.
// - Zins/Tilgung im Dialog: Tilgung aus dem UNgerundeten Zins → 312 + 579 bei Rate 890.
//
// Regeln:
// 1. Restschuld unbekannt (leer) = Darlehenssumme — dieselbe Begründung wie in `createKredit`:
//    Ein Darlehen ohne eingetragenen Stand ist nicht „getilgt“.
// 2. Restschuld ≤ 0 = getilgt: keine Rate, keine Tilgung, kein Zins.
// 3. Zins je Monat auf ganze Euro gerundet, Tilgung = Rate − dieser Zins → beide ergeben die Rate.
//
// `restschuld` ist der vom Nutzer eingetragene Stand — MyImmo schreibt ihn NICHT fort.

export type KreditFelder = {
  betrag?: number | null;
  restschuld?: number | null;
  monatsrate?: number | null;
  zinssatz?: number | null;
};

const zahl = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Offene Restschuld: eingetragener Stand, leer → Darlehenssumme, nie negativ. */
export function restschuldVon(k: KreditFelder): number {
  const r = zahl(k.restschuld);
  if (r != null) return Math.max(0, r);
  return Math.max(0, zahl(k.betrag) ?? 0);
}

/** Abbezahlt: Restschuld ausdrücklich 0 (oder darunter). Leer ist NICHT getilgt. */
export function istGetilgt(k: KreditFelder): boolean {
  const r = zahl(k.restschuld);
  return r != null && r <= 0;
}

/** Monatsrate, die heute anfällt: 0 bei getilgtem Darlehen. */
export function rateVon(k: KreditFelder): number {
  if (istGetilgt(k)) return 0;
  return Math.max(0, zahl(k.monatsrate) ?? 0);
}

/** Zins- und Tilgungsanteil der heutigen Rate (Näherung aus Restschuld × Zins), Summe = Rate. */
export function zinsUndTilgung(k: KreditFelder): { zins: number; tilgung: number } {
  const rate = rateVon(k);
  if (rate <= 0) return { zins: 0, tilgung: 0 };
  const zins = Math.min(rate, Math.round((restschuldVon(k) * (zahl(k.zinssatz) ?? 0)) / 100 / 12));
  return { zins, tilgung: Math.max(0, rate - zins) };
}

/** Getilgt in Prozent (0–100, ganze Zahl); null ohne Darlehenssumme. */
export function getilgtProzent(k: KreditFelder): number | null {
  const betrag = zahl(k.betrag);
  if (betrag == null || betrag <= 0) return null;
  const rest = restschuldVon(k);
  return Math.max(0, Math.min(100, Math.round((1 - rest / Math.max(betrag, rest)) * 100)));
}

/** Summe der Restschulden einer Liste. */
export const summeRestschuld = (kredite: KreditFelder[]) => kredite.reduce((s, k) => s + restschuldVon(k), 0);

/** Summe der heutigen Raten einer Liste (getilgte zählen nicht). */
export const summeRaten = (kredite: KreditFelder[]) => kredite.reduce((s, k) => s + rateVon(k), 0);
