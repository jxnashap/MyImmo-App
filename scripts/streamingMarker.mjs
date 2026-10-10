// Streaming-Marker auswerten (Gesamtprüfung 07.10.2026, C52 / Paket P13).
//
// Wegen `app/(app)/loading.tsx` streamt die App. `notFound()` und `redirect()` in einer Seite kommen
// dann NICHT als HTTP 404 bzw. 307, sondern als HTTP 200 — der eigentliche Ausgang steht nur im HTML:
//   notFound()  → `NEXT_HTTP_ERROR_FALLBACK;404`
//   redirect()  → `NEXT_REDIRECT;replace;/ziel;307;` (bzw. `push`)
// Für Nutzer ist das folgenlos (der Browser zeigt die Fehlerseite bzw. leitet um), aber jedes Werkzeug,
// das nur den Statuscode liest, hält eine fremde ID für eine gute Seite. Rauchtest und Crawler werten
// deshalb diese Marker aus. Die Muster sind aus echten Live-Antworten übernommen (Audit I1, 07.10.2026),
// nicht formuliert — siehe tests/paketP13.test.ts.

/**
 * @param {string} html
 * @returns {{ status: number | null, weiter: string | null }}
 *   status: Fehlerstatus aus `notFound()`/`forbidden()` (z. B. 404), sonst null
 *   weiter: Ziel aus `redirect()`, sonst null
 */
export function streamingMarker(html) {
  if (!html) return { status: null, weiter: null };
  const fehler = /NEXT_HTTP_ERROR_FALLBACK;(\d{3})/.exec(html);
  // `&amp;` zuerst: Im Attribut steht ein `&` des Ziels als `&amp;` — dessen `;` ist kein Trennzeichen.
  const umleitung = /NEXT_REDIRECT;(?:replace|push);((?:&amp;|[^;"\\])+);(\d{3});/.exec(html);
  return {
    status: fehler ? Number(fehler[1]) : null,
    weiter: umleitung ? umleitung[1].replace(/&amp;/g, "&") : null,
  };
}
