// Schulden-Uhr (04.10.2026, Wunsch des Betreibers): EINE Zeile über den Krediten — wie viel
// ist noch offen, wie viel ist schon abbezahlt, wie viel kommt jeden Monat dazu.
//
// GRUNDLAGE sind die gespeicherten Felder: `restschuld` ist der Stand, den der Nutzer
// eingetragen hat — MyImmo schreibt ihn NICHT selbst fort. Deshalb tickt die „Uhr“ bewusst
// nicht im Sekundentakt: Ein laufender Zähler würde eine Genauigkeit vortäuschen, die die
// Daten nicht haben. Die Tilgung je Monat ist eine Näherung (Rate − Restschuld × Zins / 12),
// dieselbe wie im Kredit-Dialog.

export type KreditFuerStand = {
  betrag: number | null;
  restschuld: number | null;
  monatsrate: number | null;
  zinssatz: number | null;
};

export type SchuldenStand = {
  /** Summe der Restschulden. */
  offen: number;
  /** Summe der ursprünglichen Darlehen (nur Kredite mit Betrag). */
  ursprung: number;
  /** Bereits abbezahlt = ursprünglich − offen (nie negativ). */
  getilgt: number;
  /** Anteil getilgt in Prozent (0–100), null ohne Ursprungsbetrag. */
  prozent: number | null;
  /** Geschätzte Tilgung je Monat über alle Kredite. */
  tilgungMonat: number;
  anzahl: number;
};

const n = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function schuldenStand(kredite: KreditFuerStand[]): SchuldenStand {
  let offen = 0;
  let ursprung = 0;
  let tilgungMonat = 0;
  for (const k of kredite) {
    const rest = Math.max(0, n(k.restschuld));
    offen += rest;
    // Ohne Ursprungsbetrag zählt der Kredit als „noch nichts getilgt“ — sonst stiege der
    // Prozentwert, nur weil ein Feld leer ist.
    ursprung += n(k.betrag) > 0 ? Math.max(n(k.betrag), rest) : rest;
    const zins = (rest * n(k.zinssatz)) / 100 / 12;
    tilgungMonat += Math.max(0, n(k.monatsrate) - zins);
  }
  const getilgt = Math.max(0, ursprung - offen);
  return {
    offen,
    ursprung,
    getilgt,
    prozent: ursprung > 0 ? Math.round((getilgt / ursprung) * 1000) / 10 : null,
    tilgungMonat: Math.round(tilgungMonat),
    anzahl: kredite.length,
  };
}
