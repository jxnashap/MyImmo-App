"use client";

import { useRef } from "react";

/**
 * Vorgangskennung für ein Formular (Ablauf F, Prüfstand 11.10.2026): EIN Schlüssel je Absicht.
 * Wiederholt der Nutzer nach einem Zeitüberlauf oder Doppelklick, geht derselbe Schlüssel mit — der
 * Server findet die erste Zeile statt eine zweite anzulegen (`notizen.vorgang`, `auftraege.vorgang`).
 * Erst nach einem ERFOLG gibt es einen neuen (dann ist ein weiteres Absenden eine neue Absicht).
 */
export function useVorgang() {
  const ref = useRef<string | null>(null);
  return {
    aktuell: (): string => (ref.current ??= crypto.randomUUID()),
    abgeschlossen: (): void => { ref.current = null; },
  };
}
