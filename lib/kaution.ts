// Kaution über drei Nettokaltmieten (§ 551 Abs. 1 BGB) — Gesamtprüfung P7, C42.
// Vorher speicherte MyImmo 3.500 € bei 700 € Kaltmiete ohne jeden Hinweis. Kein Verbot im Formular
// (Altverträge, Stellplatz-Kaution …), nur ein Hinweis auf der Mieterseite.

/** Höchstbetrag nach § 551 Abs. 1 BGB: drei Monatsmieten ohne Nebenkosten. */
export const kautionHoechstbetrag = (kaltmiete: number | null | undefined) =>
  Math.round((Number(kaltmiete) || 0) * 3 * 100) / 100;

/** Übersteigt die Kaution drei Nettokaltmieten? (Ohne Kaltmiete keine Aussage.) */
export function kautionZuHoch(kaution: number | null | undefined, kaltmiete: number | null | undefined): boolean {
  const max = kautionHoechstbetrag(kaltmiete);
  return max > 0 && (Number(kaution) || 0) > max + 0.005;
}
