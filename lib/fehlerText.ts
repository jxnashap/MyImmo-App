// Text eines gefangenen Fehlers für die Oberfläche (21.10.2026).
//
// WARUM: Wirft eine Server-Action, schwärzt Next den Text in Produktion. Im Browser kommt
// nur „An error occurred in the Server Components render. The specific message is omitted
// in production builds …“ an (mit `digest`). Wer `e.message` in einen Toast steckte, zeigte
// Nutzern diesen englischen Absatz — gefunden in Makler-Ordner, Beleihungsordner und beim
// Löschen. Dazu kamen rohe Browser-Meldungen wie „Failed to fetch“ oder
// „Unexpected token '<'“.
//
// REGEL: Den Text eines Fehlers zeigen wir nur, wenn wir ihn im BROWSER selbst geworfen
// haben (`new Error("…")`, ohne `digest`). Alles andere — Server-Fehler, TypeError,
// SyntaxError — bekommt den festen deutschen Satz des Aufrufers. Erwartbare Gründe
// (Datei zu groß, nichts ausgewählt) prüft die Oberfläche vorher selbst.
// `tests/fehlerText.test.ts` sucht jede Stelle, die `e.message` direkt anzeigt.

export function fehlerText(e: unknown, ersatz: string): string {
  if (!(e instanceof Error) || e.constructor !== Error) return ersatz;
  if ("digest" in e) return ersatz;
  const text = e.message.trim();
  return text || ersatz;
}
