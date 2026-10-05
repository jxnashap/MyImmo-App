// Verlauf eines Service-Auftrags (05.10.2026) — Typ und Spalten. Eigene Datei, weil Server-Lader
// die Spalten brauchen: Ein Wert aus einer "use client"-Datei käme dort nur als Verweis an.

export type AuftragNotiz = {
  id: string;
  auftrag_id: string;
  autor_rolle: "vermieter" | "service";
  art: "notiz" | "foto" | "fachbetrieb";
  text: string | null;
  datei_name: string | null;
  datei_type: string | null;
  created_at: string;
  /** Rückfrage des Vermieters bei der Freigabe (Migration 20261005120000). */
  rueckfrage?: boolean;
};

/** Spalten für die Liste — bewusst OHNE `datei_data` (das Foto kommt über die Route). */
export const AUFTRAG_NOTIZ_SPALTEN = "id,auftrag_id,autor_rolle,art,text,datei_name,datei_type,created_at,rueckfrage";

/** Notizen je Auftrag gruppieren (Reihenfolge der Abfrage bleibt). */
export function notizenJeAuftrag(rows: AuftragNotiz[]): Map<string, AuftragNotiz[]> {
  const m = new Map<string, AuftragNotiz[]>();
  for (const n of rows) {
    const l = m.get(n.auftrag_id);
    if (l) l.push(n);
    else m.set(n.auftrag_id, [n]);
  }
  return m;
}

/**
 * Wartet eine Rückfrage des Vermieters noch auf den Hausmeister? Ja, wenn die letzte Rückfrage
 * nach dem letzten Eintrag des Partners kam. Erwartet die Notizen in zeitlicher Reihenfolge.
 */
export function rueckfrageOffen(notizen: AuftragNotiz[]): AuftragNotiz | null {
  let offen: AuftragNotiz | null = null;
  for (const n of notizen) {
    if (n.autor_rolle === "vermieter" && n.rueckfrage) offen = n;
    else if (n.autor_rolle === "service") offen = null;
  }
  return offen;
}
