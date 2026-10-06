// Buchungskategorien — EINE Liste für alle Formulare (Audit 06.10.2026, Paket A).
// Vorher standen acht Kopien in Formularen und Listen, die nicht übereinstimmten: Der
// Bearbeiten-Dialog der Kostenliste kannte „Schuldzinsen“ nicht. Ein <select>, dessen
// defaultValue in keiner Option steht, zeigt die ERSTE Option — wer eine Zinsbuchung nur
// wegen des Datums öffnete und speicherte, machte sie still zur „Reparatur“ (andere Zeile
// der Anlage V, und im Cashflow doppelt, weil Zinsen dort in der Kreditrate stecken).
// Live gab es außerdem Kategorien aus Importen („Müll“, „Gartenpflege“, „Kaltmiete“ …),
// die in keiner Liste standen — sie gingen beim Bearbeiten genauso verloren.

/**
 * Umlagefähige Betriebskosten (§ 2 BetrKV), die man als eigene Kategorie bucht (Paket C,
 * 06.10.2026). Vorher kannte keine Liste sie — wer Müll oder Hausmeister buchte, wählte
 * „Sonstiges“, und die NK-Abrechnung konnte die Buchung nicht als umlagefähig erkennen.
 * Die Namen „Müll“, „Gartenpflege“, „Straßenreinigung“ stehen so schon im Bestand (Importe).
 */
export const BETRIEBSKOSTEN_KATEGORIEN = [
  "Müll",
  "Wasser / Abwasser",
  "Allgemeinstrom",
  "Heizung",
  "Hausmeister",
  "Gartenpflege",
  "Straßenreinigung",
  "Schornsteinfeger",
  "Aufzug",
] as const;

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
  ...BETRIEBSKOSTEN_KATEGORIEN,
  "Sonstiges",
] as const;

/**
 * Kategorien, in die ein erledigter Handwerker-/Hausmeister-Auftrag als Kosten übernommen
 * werden darf. Seit Paket C (06.10.2026) auch umlagefähige Betriebskosten (Hausmeister,
 * Gartenpflege …) — vorher landete ein solcher Auftrag zwangsläufig unter „Reparatur“ und
 * erreichte die NK-Abrechnung nie.
 */
export const UEBERNAHME_KATEGORIEN = [
  "Reparatur",
  "Instandhaltung",
  "Modernisierung",
  "Verwaltung",
  ...BETRIEBSKOSTEN_KATEGORIEN,
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
