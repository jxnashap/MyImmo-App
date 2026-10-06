// Sanierungsrechner → Kauf-Assistent (05.10.2026): Die geschätzten Sanierungskosten wandern als
// Zahl in der Adresse (`/kauf?sanierung=12345`) in die Kaufprüfung und dort in die
// Gesamtinvestition. Kein Speichern, keine Datenbank — der Kauf-Assistent speichert das Feld mit
// der Kaufprüfung, wenn der Nutzer sie speichert.
//
// Die Adresse ist eine Nutzereingabe: Nur ganze, positive Euro bis zu einer Obergrenze werden
// angenommen, alles andere ignoriert (kein Fehler, das Feld bleibt einfach leer).

export const SANIERUNG_PARAM = "sanierung";
/** Obergrenze gegen Unsinn in der Adresse — eine Sanierung über 10 Mio. € rechnet hier niemand. */
export const SANIERUNG_MAX = 10_000_000;

/** Link in den Kauf-Assistenten mit dem Betrag (ganze Euro, aufgerundet). */
export function kaufLinkMitSanierung(betrag: number): string {
  const euro = Number.isFinite(betrag) && betrag > 0 ? Math.min(Math.ceil(betrag), SANIERUNG_MAX) : 0;
  return euro > 0 ? `/kauf?${SANIERUNG_PARAM}=${euro}` : "/kauf";
}

/**
 * Gespeicherte Kaufprüfung laden, während noch ein Betrag aus dem Sanierungsrechner offen ist: Der
 * übergebene Betrag gewinnt (der Nutzer kam gerade mit ihm), danach ist er verbraucht. Ohne offenen
 * Betrag bleibt der gespeicherte Wert. Review 05.10.2026: vorher überschrieb „Bearbeiten“ ihn still.
 */
export function sanierungBeimLaden(gespeichert: string, offeneUebergabe: number | null): { wert: string; verbraucht: boolean } {
  if (offeneUebergabe != null && Number.isFinite(offeneUebergabe) && offeneUebergabe > 0) {
    return { wert: String(offeneUebergabe), verbraucht: true };
  }
  return { wert: gespeichert, verbraucht: false };
}

/** Betrag aus der Adresse lesen — nur Ziffern, 1 bis SANIERUNG_MAX; sonst null. */
export function sanierungAusParam(wert: string | string[] | undefined): number | null {
  const roh = Array.isArray(wert) ? wert[0] : wert;
  if (typeof roh !== "string" || !/^\d{1,9}$/.test(roh)) return null;
  const n = Number(roh);
  return n >= 1 && n <= SANIERUNG_MAX ? n : null;
}
