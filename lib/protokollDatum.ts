/** „2026-10-06“ → „06.10.2026“ aus den Zahlen des ISO-Textes — ohne Date-Objekt (kein Zeitzonenversatz).
 *  EINE Schreibweise für die Vorschau des Übergabeprotokolls UND das PDF. */
export function protokollDatum(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}.${m[2]}.${m[1]}` : "—";
}
