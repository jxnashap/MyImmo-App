// Server-Actions in dieser App melden Fehler als RÜCKGABEWERT (`{ error: "…" }`),
// nicht per Ausnahme. Wer nur `await action()` schreibt, verwirft die Meldung —
// und zeigt anschließend „Gelöscht." an, obwohl nichts gelöscht wurde. Genau
// das war am 08.09.2026 an allen DeleteButton-Stellen der Fall.
//
// Diese Funktion ist bewusst winzig und ohne React: Sie lässt sich ohne DOM
// testen, und die Entscheidung „Fehler oder nicht" liegt damit an EINER Stelle
// statt in jedem Aufrufer neu.

/** Die Fehlermeldung aus dem Rückgabewert einer Server-Action — oder `null`. */
export function actionFehler(erg: unknown): string | null {
  if (!erg || typeof erg !== "object") return null;
  const wert = (erg as { error?: unknown }).error;
  if (wert == null || wert === false) return null;
  // Auch eine leere Zeichenkette ist kein Fehler, sondern ein leeres Feld.
  const text = typeof wert === "string" ? wert.trim() : String((wert as { message?: string })?.message ?? wert);
  return text === "" ? null : text;
}
