// Datums-Arithmetik für Fristen und Staffelmieten — konsequent in UTC.
//
// Vorher rechneten lib/fristen.ts und lib/staffel.ts mit LOKALEN Gettern/Settern
// (getDate/setMonth) und formatierten danach mit toISOString() in UTC. Beim
// Wechsel von Winter- auf Sommerzeit verschob sich das Ergebnis dadurch um
// einen Tag:
//
//   Start 2026-01-15, +6 Monate  →  "2026-07-14"   (richtig: 2026-07-15)
//
// Betroffen war jedes abgeleitete Datum zwischen April und Oktober:
// Kündigungsfristen, nächste Mieterhöhung, Staffelstufen, Indexmiete,
// Zinsbindung, Sondertilgungstermine, Energieausweis-Ablauf.
//
// „YYYY-MM-DD" wird von `new Date(...)` als UTC-Mitternacht gelesen — wer damit
// weiterrechnet, muss auch in UTC bleiben. Genau das tun diese Helfer; sie sind
// dadurch zusätzlich unabhängig von der Zeitzone des Nutzers.

/** ISO-Datum (YYYY-MM-DD) aus einem Date — in UTC, passend zu addMonate. */
export const iso = (d: Date): string => d.toISOString().split("T")[0];

/**
 * Monate addieren OHNE Tag-Rollover: 31.03. − 1 Monat → 28./29.02. (nicht 03.03.).
 * Rechnet in UTC, damit die Sommerzeit das Ergebnis nicht verschiebt.
 */
export function addMonate(d: Date, monate: number): Date {
  const r = new Date(d);
  const tag = r.getUTCDate();
  r.setUTCDate(1);
  r.setUTCMonth(r.getUTCMonth() + monate);
  // Tag 0 des Folgemonats = letzter Tag des Zielmonats.
  const letzterTag = new Date(Date.UTC(r.getUTCFullYear(), r.getUTCMonth() + 1, 0)).getUTCDate();
  r.setUTCDate(Math.min(tag, letzterTag));
  return r;
}

/** Tage addieren (UTC, DST-fest). */
export function addTage(d: Date, tage: number): Date {
  const r = new Date(d);
  r.setUTCDate(r.getUTCDate() + tage);
  return r;
}
