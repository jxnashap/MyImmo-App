// Reiter per Wischen wechseln (01.10.2026, Wunsch des Betreibers): Im
// Mieterportal und im Vermieter-Mieterportal soll man nicht oben auf die
// Glas-Leiste tippen müssen, sondern über den Inhalt wischen können.
//
// Zweite Fassung (gleicher Tag, „muss viel flüssiger sein"): Der Inhalt folgt
// dem Finger, der Nachbar-Reiter gleitet mit herein; beim Loslassen entscheidet
// diese Funktion, ob der Wisch vollendet wird. Reine Entscheidung ohne DOM —
// damit prüfbar.
//
// Zwei Wege zum Wechsel: WEIT (ein Viertel der Breite) oder SCHNELL (ein
// Schnipsen, auch kurz). Ein kurzer, langsamer Zug schnappt zurück — der
// Inhalt ist dabei nur mitgezogen worden, nichts geht verloren.

/** Weit: ab diesem Anteil der Breite gilt der Wisch, egal wie langsam. */
export const WISCH_ANTEIL = 0.25;
/** Schnell: ab dieser Geschwindigkeit (px je ms) reicht ein kurzer Schnipser … */
export const WISCH_SCHNELL_PX_MS = 0.5;
/** … der aber mindestens so weit sein muss, sonst war es ein Tipp mit Zittern. */
export const WISCH_SCHNELL_MIN_PX = 40;
/** Waagerecht muss deutlich überwiegen — sonst war es Scrollen. */
export const WISCH_VERHAELTNIS = 1.8;
/** Am Bildschirmrand gehört die Geste dem System (Zurück bei iOS/Android). */
export const RAND_PX = 28;
/** Ab hier gilt der Finger als „zieht waagerecht" — vorher wird nichts bewegt. */
export const RICHTUNG_AB_PX = 10;
/** Am Listenende folgt der Inhalt nur gebremst (Gummiband). */
export const GUMMIBAND = 0.3;

export type Wisch = { dx: number; dy: number; ms: number; startX: number; breite: number };

/** -1 = voriger Reiter (Wisch nach rechts), 1 = nächster (nach links), 0 = nichts. */
export function wischRichtung({ dx, dy, ms, startX, breite }: Wisch): -1 | 0 | 1 {
  if (startX < RAND_PX || startX > breite - RAND_PX) return 0;
  const weg = Math.abs(dx);
  if (weg < Math.abs(dy) * WISCH_VERHAELTNIS) return 0;
  const weit = weg >= breite * WISCH_ANTEIL;
  const schnell = ms > 0 && weg / ms >= WISCH_SCHNELL_PX_MS && weg >= WISCH_SCHNELL_MIN_PX;
  if (!weit && !schnell) return 0;
  return dx < 0 ? 1 : -1;
}

/** Ziel-Reiter oder null am Rand der Liste (kein Umlauf — das irritiert mehr, als es nützt). */
export function zielReiter<T>(reiter: readonly T[], aktuell: number, richtung: -1 | 0 | 1): T | null {
  if (richtung === 0 || aktuell < 0) return null;
  const i = aktuell + richtung;
  return i >= 0 && i < reiter.length ? reiter[i] : null;
}

/** Hat der Finger sich schon entschieden? "x" = wir ziehen, "y" = der Browser scrollt. */
export function wischAchse(dx: number, dy: number): "x" | "y" | null {
  if (Math.abs(dx) < RICHTUNG_AB_PX && Math.abs(dy) < RICHTUNG_AB_PX) return null;
  return Math.abs(dx) > Math.abs(dy) ? "x" : "y";
}

/** Versatz des Inhalts beim Ziehen — am Listenende nur ein Drittel (Gummiband). */
export function wischVersatz(dx: number, hatNachbar: boolean): number {
  return hatNachbar ? dx : dx * GUMMIBAND;
}
