import type { KeyboardEvent } from "react";

// Macht ein klickbares Nicht-Button-Element (div/span als Aufklapper oder Auswahl)
// per Tastatur bedienbar: Enter und Leertaste lösen dieselbe Aktion aus wie der
// Klick. Immer zusammen mit role="button" und tabIndex={0} verwenden, damit das
// Element auch fokussierbar ist und Screenreader es korrekt ansagen.
export function tastaturAktion(fn: () => void) {
  return (e: KeyboardEvent) => {
    // Nur reagieren, wenn die Taste WIRKLICH auf dem Container liegt. Ohne
    // diese Prüfung würde ein Leerzeichen in einem Feld INNERHALB des
    // Containers zum Container hochblubbern, hier abgefangen und per
    // preventDefault verschluckt — man könnte dort nicht mehr tippen.
    if (e.target !== e.currentTarget) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}
