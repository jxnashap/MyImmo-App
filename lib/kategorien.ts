// Buchungskategorien — EINE Liste für alle Formulare (Audit 06.10.2026, Paket A).
// Vorher standen acht Kopien in Formularen und Listen, die nicht übereinstimmten: Der
// Bearbeiten-Dialog der Kostenliste kannte „Schuldzinsen“ nicht. Ein <select>, dessen
// defaultValue in keiner Option steht, zeigt die ERSTE Option — wer eine Zinsbuchung nur
// wegen des Datums öffnete und speicherte, machte sie still zur „Reparatur“ (andere Zeile
// der Anlage V, und im Cashflow doppelt, weil Zinsen dort in der Kreditrate stecken).
// Live gab es außerdem Kategorien aus Importen („Müll“, „Gartenpflege“, „Kaltmiete“ …),
// die in keiner Liste standen — sie gingen beim Bearbeiten genauso verloren.

/** Kategorien für Ausgaben. Jede hat eine Zeile in `KOSTEN_BUCKET` (lib/anlageV.ts). */
export const KOSTEN_KATEGORIEN = [
  "Reparatur",
  "Instandhaltung",
  "Verwaltung",
  "Versicherung",
  "Grundsteuer",
  "Schuldzinsen",
  "Hausgeld / WEG",
  "Makler",
  "Sonstiges",
] as const;

/** Kategorien für Einnahmen. */
export const EINNAHME_KATEGORIEN = ["Miete", "Kaution", "Nebenkostenabrechnung", "Sonstiges"] as const;

/**
 * Optionen für ein Auswahlfeld beim BEARBEITEN: die Liste, und — falls die gespeicherte
 * Kategorie nicht darin steht — diese vorne dazu. So bleibt beim Speichern erhalten, was
 * gespeichert war, statt still durch die erste Option ersetzt zu werden.
 */
export function kategorieOptionen(liste: readonly string[], aktuell: string | null | undefined): string[] {
  const a = (aktuell ?? "").trim();
  return a && !liste.includes(a) ? [a, ...liste] : [...liste];
}
