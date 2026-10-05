// Abruf-Protokoll für Bank- und Makler-Links (05.10.2026, Migration 20261005160000).
// Die Datenbank schreibt je Datei-Abruf über einen Freigabe-Link eine Zeile (Zeitpunkt, Dokument,
// keine IP); gleicher Link + gleiches Dokument innerhalb von 60 s zählt einmal. Hier nur die
// Darstellung — rein, ohne Datenbank, deshalb prüfbar.

export type Abruf = { token: string; item_key: string; abgerufen_am: string };

export const ABRUF_SPALTEN = "token,item_key,abgerufen_am";

/** Abrufe je Link, neueste zuerst. */
export function abrufeJeLink(abrufe: Abruf[]): Map<string, Abruf[]> {
  const m = new Map<string, Abruf[]>();
  for (const a of [...abrufe].sort((x, y) => y.abgerufen_am.localeCompare(x.abgerufen_am))) {
    const l = m.get(a.token) ?? [];
    l.push(a);
    m.set(a.token, l);
  }
  return m;
}

/** „Noch nicht abgerufen“ / „3× abgerufen · zuletzt 05.10.2026, 14:03“. */
export function abrufZusammenfassung(liste: Abruf[] | undefined): string {
  if (!liste?.length) return "Noch nicht abgerufen";
  const z = new Date(liste[0].abgerufen_am).toLocaleString("de-DE", {
    timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });
  return `${liste.length}× abgerufen · zuletzt ${z}`;
}
