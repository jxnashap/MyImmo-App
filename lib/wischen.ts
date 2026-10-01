// Reiter per Wischen wechseln (01.10.2026, Wunsch des Betreibers): Im
// Mieterportal und im Vermieter-Mieterportal soll man nicht oben auf die
// Glas-Leiste tippen müssen, sondern über den Inhalt wischen können.
//
// Reine Entscheidung ohne DOM — damit prüfbar. Die Schwellen sind bewusst
// streng: Ein Wisch, der keiner war, wechselt den Reiter und verliert die
// Stelle, an der man gelesen hat. Ein verpasster Wisch kostet nur einen Tipp.

/** Mindestweg in px, damit ein Wisch zählt. */
export const WISCH_MIN_PX = 70;
/** Waagerecht muss deutlich überwiegen — sonst war es Scrollen. */
export const WISCH_VERHAELTNIS = 1.8;
/** Länger als das ist kein Wisch, sondern ein Ziehen/Lesen. */
export const WISCH_MAX_MS = 700;
/** Am Bildschirmrand gehört die Geste dem System (Zurück bei iOS/Android). */
export const RAND_PX = 28;

export type Wisch = { dx: number; dy: number; ms: number; startX: number; breite: number };

/** -1 = voriger Reiter (Wisch nach rechts), 1 = nächster (nach links), 0 = nichts. */
export function wischRichtung({ dx, dy, ms, startX, breite }: Wisch): -1 | 0 | 1 {
  if (startX < RAND_PX || startX > breite - RAND_PX) return 0;
  if (ms > WISCH_MAX_MS) return 0;
  if (Math.abs(dx) < WISCH_MIN_PX) return 0;
  if (Math.abs(dx) < Math.abs(dy) * WISCH_VERHAELTNIS) return 0;
  return dx < 0 ? 1 : -1;
}

/** Ziel-Reiter oder null am Rand der Liste (kein Umlauf — das irritiert mehr, als es nützt). */
export function zielReiter(reiter: readonly string[], aktuell: number, richtung: -1 | 0 | 1): string | null {
  if (richtung === 0 || aktuell < 0) return null;
  const i = aktuell + richtung;
  return i >= 0 && i < reiter.length ? reiter[i] : null;
}
