// Kopfzeilen für die Auslieferung hochgeladener Dateien.
//
// WARUM ES DIESE DATEI GIBT (08.09.2026)
// Fünf Routen liefern Dateien aus, die ein Nutzer hochgeladen hat, und nahmen
// dabei den gespeicherten `Content-Type` unverändert — standardmäßig `inline`.
// Vier der Upload-Pfade haben KEINE MIME-Weißliste (`beleihung`, `makler`,
// `buchungen`, `archiv`); dort kam an, was jemand geschickt hat.
//
// Warum die CSP das nicht allein auffängt: Sie ist streng
// (`script-src 'self' 'nonce-…'`), ein Inline-Skript in einer hochgeladenen
// HTML-Datei würde also blockiert. **`'self'` erlaubt aber Skripte von JEDEM
// Pfad der eigenen Domain** — auch von einer hochgeladenen `.js`-Datei, die
// über ihre eigene Route ausgeliefert wird. Wer den `Content-Type` bestimmt,
// bestimmt damit auch, ob `nosniff` sie als Skript durchgehen lässt.
//
// Praktisch braucht das Mitwirkung des Opfers: Der Angreifer ist ein
// registrierter Vermieter und muss jemanden dazu bringen, seinen Freigabe-Link
// zu öffnen (`/beleihung/<token>/datei/<key>` ist die einzige dieser Routen
// ohne Login). Kein Selbstläufer — aber der Schaden träfe eine fremde Sitzung
// auf der eigenen Domain, und die Gegenmaßnahme kostet nichts.
//
// GELÖST WIRD ES AN DER AUSLIEFERUNG, NICHT AM UPLOAD. Eine Weißliste beim
// Hochladen würde nur künftige Dateien erfassen; hier greift die Regel auch
// für alles, was bereits in der Datenbank liegt.

/**
 * Typen, die im Browser gefahrlos angezeigt werden dürfen.
 *
 * Bewusst NICHT dabei: `image/svg+xml` — SVG ist ein Dokument und darf Skript
 * enthalten. Ebenso nichts aus der `text/*`- oder `application/xhtml`-Familie.
 */
const INLINE_ERLAUBT = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/**
 * Kopfzeilen für eine gespeicherte Datei.
 *
 * Alles außerhalb der Weißliste wird als `application/octet-stream` zum
 * Herunterladen ausgeliefert: Der Browser rendert es dann nicht und führt es
 * auch nicht als Skript aus (zusammen mit `nosniff`).
 *
 * @param roherTyp  gespeicherter MIME-Typ (Nutzereingabe, nicht vertrauenswürdig)
 * @param roherName gespeicherter Dateiname (Nutzereingabe)
 * @param download  true = ausdrücklich als Download angefordert
 */
export function dateiKopf(
  roherTyp: string | null | undefined,
  roherName: string | null | undefined,
  download: boolean,
): Record<string, string> {
  const typ = String(roherTyp ?? "").split(";")[0].trim().toLowerCase();
  const sicher = INLINE_ERLAUBT.has(typ);
  // Dateiname auf harmlose Zeichen reduzieren — sonst ließen sich über
  // Anführungszeichen weitere Header-Parameter unterschieben.
  const name = String(roherName || "Dokument").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);

  return {
    "Content-Type": sicher ? typ : "application/octet-stream",
    "Content-Disposition": `${download || !sicher ? "attachment" : "inline"}; filename="${name}"`,
    "X-Content-Type-Options": "nosniff",
    "Cache-Control": "private, no-store",
  };
}

/** Nur für Tests/Doku: die Weißliste als Array. */
export const INLINE_TYPEN = [...INLINE_ERLAUBT];
