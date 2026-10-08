// Demo: Fehler, die die Schreibsperre auslöst, sagen das auch (Gesamtprüfung P5, B54).
//
// Die Datenbank wirft für das Demo-Konto bei jedem Schreibzugriff einen Fehler mit `code 42501`
// und `hint 'demo_nur_lesen'` (Trigger `demo_schreibsperre`, `demo_eingang_sperre`). Die Actions
// übersetzten ihn in ihren allgemeinen Satz („Anliegen konnte nicht gespeichert werden.“), und der
// Besucher hielt die App für kaputt. Reine Funktionen ohne React und ohne Datenbank.

export const DEMO_NICHT_GESPEICHERT = "In der Demo wird nichts gespeichert. Mit eigenem Zugang steht die Funktion bereit.";

type DbFehler = { code?: string | null; hint?: string | null; message?: string | null } | null | undefined;

/**
 * Stammt der Fehler von der Demo-Schreibsperre? NICHT jeder 42501 — dieselbe Nummer meldet auch
 * eine verletzte RLS-Policy bei einem echten Konto; dort wäre der Demo-Satz eine Falschaussage.
 */
export function istDemoSperre(e: DbFehler): boolean {
  if (!e || e.code !== "42501") return false;
  return e.hint === "demo_nur_lesen" || (e.message ?? "").startsWith("In der Demo wird nichts gespeichert");
}

/** Text für den Nutzer: der Demo-Satz, wenn die Sperre zuschlug, sonst der eigene der Action. */
export function dbFehlerText(e: DbFehler, sonst: string): string {
  return istDemoSperre(e) ? DEMO_NICHT_GESPEICHERT : sonst;
}

/** Merkmal am <html>, das `DemoNurLesen` im Demo-Konto setzt — gelesen vom Toast. */
export const DEMO_MERKMAL = "demo";

/**
 * Fehler-Toast in der Demo: der eigene Satz der Stelle PLUS die Erklärung. Fängt alle Schreibwege
 * ab, die nicht eigens markiert sind (Knopf ruft eine Zwischenfunktion, die eine Action ruft).
 * Nur bei Fehlern, und nicht doppelt, wenn der Satz die Demo schon nennt.
 */
export function mitDemoHinweis(msg: string, typ: "success" | "error" | "info", demo: boolean): string {
  if (!demo || typ !== "error" || /\bDemo\b/.test(msg)) return msg;
  return `${msg.trim().replace(/[.!]?$/, ".")} In der Demo wird nichts gespeichert.`;
}
