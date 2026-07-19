// Index-Fortschreibung des Objektwerts (Masterplan §12, Stufe 1):
//   indexierter Wert = Kaufpreis × (Index_aktuell / Index_Kaufquartal)
// mit dem amtlichen Häuserpreisindex (Destatis 61262, via Eurostat gespiegelt).
// Reine Rechenfunktionen — die Indexreihe kommt aus lib/wert/hpi.ts.
// Ergebnis ist eine "indexierte Schätzung", KEIN Marktwert/Gutachten.

export type IndexReihe = Record<string, number>; // "2020-Q1" → Indexwert

// "2021-05-17" → "2021-Q2"
export function quartalVonDatum(datum: string | null | undefined): string | null {
  if (!datum || !/^\d{4}-\d{2}/.test(datum)) return null;
  const jahr = datum.slice(0, 4);
  const monat = parseInt(datum.slice(5, 7), 10);
  if (!Number.isFinite(monat) || monat < 1 || monat > 12) return null;
  return `${jahr}-Q${Math.ceil(monat / 3)}`;
}

export function letztesQuartal(reihe: IndexReihe): string | null {
  const keys = Object.keys(reihe).filter((k) => /^\d{4}-Q[1-4]$/.test(k)).sort();
  return keys.length ? keys[keys.length - 1] : null;
}

export type Fortschreibung = {
  wert: number;             // fortgeschriebener Kaufpreis
  faktor: number;           // Indexverhältnis
  basisQuartal: string;     // Kaufquartal (bzw. frühestes verfügbares)
  standQuartal: string;     // letztes Quartal der Reihe
  basisIndex: number;
  standIndex: number;
  veraenderungProzent: number; // seit Kauf, gerundet auf 1 Nachkommastelle
};

// Fortschreibung ab Kaufquartal. Liegt das Kaufdatum vor dem Reihenbeginn,
// wird ehrlich null geliefert (keine Extrapolation in die Vergangenheit).
export function fortschreibeKaufpreis(
  kaufpreis: number | null | undefined,
  kaufdatum: string | null | undefined,
  reihe: IndexReihe,
): Fortschreibung | null {
  if (!kaufpreis || kaufpreis <= 0) return null;
  const basisQuartal = quartalVonDatum(kaufdatum);
  if (!basisQuartal) return null;
  const standQuartal = letztesQuartal(reihe);
  if (!standQuartal || basisQuartal >= standQuartal) return null;

  const basisIndex = reihe[basisQuartal];
  const standIndex = reihe[standQuartal];
  if (!basisIndex || !standIndex || basisIndex <= 0) return null;

  const faktor = standIndex / basisIndex;
  const wert = Math.round(kaufpreis * faktor);
  return {
    wert,
    faktor,
    basisQuartal,
    standQuartal,
    basisIndex,
    standIndex,
    veraenderungProzent: Math.round((faktor - 1) * 1000) / 10,
  };
}
