// CSV-Ausgabe für alle Exporte an einer Stelle.
//
// Zwei getrennte Probleme, die oft verwechselt werden:
//
// 1. CSV-SYNTAX — Anführungszeichen, Trennzeichen und Zeilenumbrüche müssen
//    gequotet werden, sonst zerfällt die Zeile beim Einlesen.
//
// 2. FORMEL-EINSCHLEUSUNG (CSV Injection) — Excel und LibreOffice werten eine
//    Zelle als Formel aus, sobald ihr Inhalt mit `=`, `+`, `-`, `@`, Tab oder
//    Wagenrücklauf beginnt. Quoten hilft dagegen NICHT: Die Tabellen-
//    kalkulation entfernt die Anführungszeichen beim Import und wertet den
//    Rest anschließend aus. Nur ein vorangestelltes Apostroph erzwingt
//    Textbehandlung.
//
// Warum das hier konkret zählt: Über die ÖFFENTLICHE Bewerbungsseite kann ein
// Fremder Freitext in `bewerbungen.nachricht`, `beruf` oder `arbeitgeber`
// schreiben (lib/actions/bewerbenPublic.ts). Der Vermieter lädt später seinen
// eigenen Export herunter und öffnet ihn — und führt damit fremden Inhalt in
// seiner eigenen Tabellenkalkulation aus. Der Angreifer muss dafür weder ein
// Konto haben noch angemeldet sein.

const FORMEL_START = /^[=+\-@\t\r]/;

/** Führende Formelzeichen entschärfen (siehe Kopfkommentar). */
export function entschaerfeFormel(s: string): string {
  return FORMEL_START.test(s) ? `'${s}` : s;
}

/**
 * Eine CSV-Zelle maskieren: erst entschärfen, dann quoten.
 * `trenner` muss das tatsächlich verwendete Trennzeichen sein (Default `;`).
 */
export function csvZelle(v: unknown, trenner = ";"): string {
  if (v == null) return "";
  const roh = typeof v === "object" ? JSON.stringify(v) : String(v);
  const s = entschaerfeFormel(roh);
  const brauchtQuotes = s.includes('"') || s.includes(trenner) || /[\n\r]/.test(s);
  return brauchtQuotes ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Wie csvZelle, aber immer gequotet (für Formate, die das erwarten). */
export function csvZelleGequotet(v: unknown): string {
  return `"${entschaerfeFormel(String(v ?? "")).replace(/"/g, '""')}"`;
}
