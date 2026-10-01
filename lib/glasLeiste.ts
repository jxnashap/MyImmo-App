// Glas-Leiste: Der offene Reiter steht in der Mitte (01.10.2026, Vorgabe des
// Betreibers). Unter 860 px scrollt die Leiste waagerecht — ohne Nachführen
// lag der aktive Reiter nach einem Wisch oder beim Laden oft halb außerhalb.
// Reine Rechnung ohne DOM, damit prüfbar.

export type LeistenMasse = {
  /** Gesamte Breite des Leisteninhalts (`scrollWidth`). */
  scrollBreite: number;
  /** Sichtbare Breite der Leiste (`clientWidth`). */
  sichtBreite: number;
  /** Linke Kante des Reiters innerhalb der Leiste (`offsetLeft`). */
  reiterLinks: number;
  reiterBreite: number;
};

/** Scrollposition, bei der der Reiter mittig steht — an den Enden begrenzt, dort geht Mitte nicht;
 *  passt die Leiste ganz hinein (Desktop), ergibt die Begrenzung 0. */
export function zentrierVersatz({ scrollBreite, sichtBreite, reiterLinks, reiterBreite }: LeistenMasse): number {
  const maximal = Math.max(0, scrollBreite - sichtBreite);
  const mitte = reiterLinks - (sichtBreite - reiterBreite) / 2;
  return Math.min(maximal, Math.max(0, Math.round(mitte)));
}
