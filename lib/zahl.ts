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
//   "€ 415.000"  → 415000
//   ""/Unsinn    → null

export function zahlDe(eingabe: string | null | undefined): number | null {
  const roh = (eingabe ?? "").trim().replace(/[€\s ]/g, "");
  if (!roh) return null;

  const normalisiert = /,\d{1,2}$/.test(roh)
    ? roh.replace(/\./g, "").replace(",", ".") // Komma entscheidet: Punkte sind Tausender
    : roh.replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", "."); // sonst nur echte 3er-Gruppen

  const n = Number(normalisiert);
  return Number.isFinite(n) ? n : null;
}

/** Wie zahlDe, liefert aber 0 statt null — für Rechner, die mit 0 weiterrechnen. */
export function zahlDe0(eingabe: string | null | undefined): number {
  return zahlDe(eingabe) ?? 0;
}
