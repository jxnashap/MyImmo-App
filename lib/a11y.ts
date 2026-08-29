import type { KeyboardEvent } from "react";

// Macht ein klickbares Nicht-Button-Element (div/span als Aufklapper oder Auswahl)
// per Tastatur bedienbar: Enter und Leertaste lösen dieselbe Aktion aus wie der
// Klick. Immer zusammen mit role="button" und tabIndex={0} verwenden, damit das
// Element auch fokussierbar ist und Screenreader es korrekt ansagen.
export function tastaturAktion(fn: () => void) {
  return (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      fn();
    }
  };
}
