// Anhänge, die durch eine Server-Action oder API-Route gehen (21.10.2026).
//
// GEMESSEN 21.10.2026: Vercel nimmt je Anfrage höchstens 4,5 MB an — ein POST mit 5 MB
// an die Live-Seite kam mit 413 „FUNCTION_PAYLOAD_TOO_LARGE“ zurück, die Funktion lief gar
// nicht erst. Das Mieterportal erlaubte „3 Dateien à 4 MB“ in EINER Anfrage: Schon zwei
// gewöhnliche Handyfotos scheiterten, und weil die Action dann nicht antwortete, landete der
// Mieter auf der Fehlerseite und verlor seine Eingaben.
//
// Deshalb: (1) Fotos werden im Browser verkleinert (lib/bildVerkleinern.ts), (2) die Summe
// aller Anhänge einer Anfrage wird VOR dem Senden geprüft, (3) der Server prüft dieselbe Grenze.

/** Höchstens so viel an Dateien je Anfrage — mit Luft unter Vercels 4,5 MB für die übrigen Felder. */
export const ANFRAGE_MAX_BYTES = 4 * 1024 * 1024;

/** Was Mieter anhängen dürfen (Anliegen). Zählerfotos: nur Bilder. */
export const FOTO_ODER_PDF = ["image/jpeg", "image/png", "image/webp", "image/heic", "application/pdf"] as const;
export const NUR_FOTO = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;

export const MB = (bytes: number) => `${(bytes / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;

type DateiInfo = { name: string; size: number; type: string };

/**
 * Prüft eine Auswahl von Anhängen. `null` = in Ordnung, sonst ein Satz für den Nutzer.
 * Reine Funktion — dieselbe Regel im Browser (vor dem Senden) und auf dem Server.
 */
export function pruefeAnhaenge(
  dateien: DateiInfo[],
  opts: { maxAnzahl: number; erlaubt: readonly string[]; maxGesamt?: number },
): string | null {
  const maxGesamt = opts.maxGesamt ?? ANFRAGE_MAX_BYTES;
  if (dateien.length > opts.maxAnzahl) {
    return opts.maxAnzahl === 1 ? "Bitte nur eine Datei anhängen." : `Höchstens ${opts.maxAnzahl} Dateien.`;
  }
  for (const d of dateien) {
    if (!opts.erlaubt.includes(d.type)) return `„${d.name}“: nur Fotos (JPG, PNG, WebP, HEIC) oder PDF.`;
  }
  const summe = dateien.reduce((s, d) => s + d.size, 0);
  if (summe > maxGesamt) {
    return dateien.length > 1
      ? `Die Anhänge sind zusammen ${MB(summe)} groß — höchstens ${MB(maxGesamt)} gehen. Lass eins weg oder nimm ein Bildschirmfoto davon.`
      : `„${dateien[0].name}“ ist ${MB(summe)} groß — höchstens ${MB(maxGesamt)} gehen. Ein Bildschirmfoto davon reicht meist.`;
  }
  return null;
}
