// Deutsche Zahleneingaben robust lesen — für die Rechner mit Freitextfeldern
// (Marktwert-Schätzer, Verkauf, AfA, Umlage). Der naive `parseFloat` machte
// aus der natürlich getippten "8.520" die Zahl 8,52 und damit aus einer
// Jahresmiete einen Cent-Betrag; entsprechend kam beim Ertragswert 0 heraus.
//
// Regeln:
//   "8.520"      → 8520     (Punkt vor 3er-Gruppe = Tausenderpunkt)
//   "8.520,50"   → 8520.5   (Komma-Dezimale → Punkte sind Tausender)
//   "1.234.567"  → 1234567
//   "3,5"        → 3.5
//   "1.9"        → 1.9      (Punkt vor 1 Ziffer = englische Dezimale)
//   "0.035"      → 0.035    (führende Null: Dezimalpunkt, NIE Tausenderpunkt)
//   "€ 415.000"  → 415000
//   ""/Unsinn    → null

/**
 * Ein Punkt direkt hinter einer führenden Null ist niemals ein Tausenderpunkt —
 * eine deutsche Tausendergruppierung beginnt frühestens bei 1.000.
 *
 * Ohne diese Ausnahme las die Regel unten "0.035" als "0" plus 3er-Gruppe "035"
 * und lieferte 35 statt 0,035. Betroffen war jeder maschinenlesbare Dezimalwert
 * mit genau drei Nachkommastellen — im Kauf-Rechner der Grunderwerbsteuersatz
 * aus der Bundesland-Auswahl, wodurch die Nebenkosten um den Faktor 1000 zu
 * hoch ausfielen (Bayern 3,5 % wurde zu 3500 %). Die Länder mit glattem Satz
 * (5,0 / 6,0 %) rechneten zufällig richtig, weshalb es beim Testen nicht auffiel.
 */
const FUEHRENDE_NULL = /^[+-]?0\./;

export function zahlDe(eingabe: string | null | undefined): number | null {
  const roh = (eingabe ?? "").trim().replace(/[€\s ]/g, "");
  if (!roh) return null;

  const normalisiert = /,\d{1,2}$/.test(roh)
    ? roh.replace(/\./g, "").replace(",", ".") // Komma entscheidet: Punkte sind Tausender
    : FUEHRENDE_NULL.test(roh)
      ? roh.replace(",", ".") // "0.035" → Dezimalpunkt, Punkt bleibt stehen
      : roh.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."); // sonst nur echte 3er-Gruppen

  const n = Number(normalisiert);
  return Number.isFinite(n) ? n : null;
}

/** Wie zahlDe, liefert aber 0 statt null — für Rechner, die mit 0 weiterrechnen. */
export function zahlDe0(eingabe: string | null | undefined): number {
  return zahlDe(eingabe) ?? 0;
}
