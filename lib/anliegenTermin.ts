// Vom Mieter bestätigte Anliegen-Termine im Kalender (21.10.2026, Durchsicht Paket 4).
//
// Vorher brauchte es nach der Bestätigung den Knopf „In den Kalender“: Ohne Klick stand der Termin
// weder in /termine noch auf dem Dashboard, und ein zweiter Klick legte einen zweiten Eintrag an
// (`terminInKalender` prüfte nicht auf Doppel). Jetzt wird nichts mehr geschrieben — der Termin
// ergibt sich aus dem Anliegen, wie die Fristen aus den Stammdaten. Kein Eintrag kann doppelt
// entstehen, und ein neuer Terminvorschlag ersetzt den alten ohne Aufräumen.
//
// Rein, ohne Datenbank — prüfbar.

export type AnliegenMitTermin = {
  id: string;
  titel: string;
  termin_bestaetigt: string | null;
  status: string;
  mieter_id?: string | null;
  prop_id?: string | null;
};

/** `anliegen` hat keine Spalte für den Namen — den liefern die Mieter-Zeilen des Aufrufers. */
export const ANLIEGEN_TERMIN_SPALTEN = "id,titel,termin_bestaetigt,status,mieter_id,prop_id";

export type AnliegenTermin = {
  anliegenId: string;
  datum: string;
  uhr: string;
  label: string;
  mieterId: string | null;
  propId: string | null;
};

const SLOT = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/;

/** So hieß der Eintrag, den der alte Knopf anlegte (`Termin: <Titel>`). */
export const alterKalenderTitel = (titel: string) => `Termin: ${titel}`.slice(0, 200);

/**
 * Bestätigte, noch offene Anliegen-Termine. Ein Termin, den der alte Knopf schon als eigenen
 * Eintrag angelegt hat (gleicher Tag, gleicher Titel), erscheint nicht ein zweites Mal.
 */
export function anliegenTermine(
  anliegen: AnliegenMitTermin[],
  eigeneTermine: { titel: string | null; datum: string | null }[] = [],
): AnliegenTermin[] {
  const schon = new Set(eigeneTermine.map((t) => `${t.datum ?? ""}|${t.titel ?? ""}`));
  const out: AnliegenTermin[] = [];
  for (const a of anliegen) {
    if (a.status === "erledigt") continue;
    const m = SLOT.exec(a.termin_bestaetigt ?? "");
    if (!m) continue;
    const [, datum, uhr] = m;
    if (schon.has(`${datum}|${alterKalenderTitel(a.titel)}`)) continue;
    out.push({
      anliegenId: a.id,
      datum,
      uhr,
      label: `Termin ${uhr} Uhr · ${a.titel}`.slice(0, 200),
      mieterId: a.mieter_id ?? null,
      propId: a.prop_id ?? null,
    });
  }
  return out.sort((x, y) => `${x.datum}${x.uhr}`.localeCompare(`${y.datum}${y.uhr}`));
}
