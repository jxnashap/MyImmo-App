// Vorgänge mit Verlauf (02.10.2026) — Fundament 2, docs/zukunft/MIETERPORTAL-AUSBAU.md § 9.
//
// Ein Anliegen hat eine Ereignisliste (Tabelle `anliegen_ereignisse`, Migration
// 20261002160000): Nachrichten schreiben Mieter und Vermieter selbst, Statuswechsel,
// Termine und Aufträge schreibt die Datenbank per Trigger mit. Mieter und Vermieter
// sehen DENSELBEN Verlauf — deshalb hier EIN Lader und EINE Beschriftung.
// Reine Funktionen bis auf den Lader; ohne React.

export type Ereignis = {
  id: string;
  anliegen_id: string;
  autor_rolle: "mieter" | "vermieter" | "system";
  art: "nachricht" | "status" | "termin" | "auftrag";
  text: string | null;
  status_neu: string | null;
  created_at: string;
};

export const EREIGNIS_SPALTEN = "id,anliegen_id,autor_rolle,art,text,status_neu,created_at";
export const NACHRICHT_MAX = 4000;

const STATUS_TEXT: Record<string, string> = {
  offen: "wieder geöffnet",
  in_arbeit: "in Arbeit",
  erledigt: "erledigt",
};

/** Wer hat es geschrieben — aus Sicht des Lesers. Das Portal duzt, wie überall in der App. */
export function autorLabel(rolle: Ereignis["autor_rolle"], sicht: "mieter" | "vermieter"): string {
  if (rolle === "system") return "MyImmo";
  if (rolle === sicht) return "Du";
  return rolle === "vermieter" ? "Dein Vermieter" : "Mieter";
}

/** Die Zeile, die im Verlauf steht. */
export function ereignisText(e: Ereignis): string {
  if (e.art === "status") return `Status: ${STATUS_TEXT[e.status_neu ?? ""] ?? e.status_neu ?? "geändert"}`;
  return e.text ?? "";
}

/** Nach Anliegen gruppiert, je Gruppe chronologisch (älteste oben). */
export function gruppiereEreignisse(liste: Ereignis[]): Map<string, Ereignis[]> {
  const m = new Map<string, Ereignis[]>();
  for (const e of [...liste].sort((a, b) => a.created_at.localeCompare(b.created_at))) {
    m.set(e.anliegen_id, [...(m.get(e.anliegen_id) ?? []), e]);
  }
  return m;
}

/** Eine Nachricht prüfen, bevor sie in die Datenbank geht (die prüft dasselbe noch einmal). */
export function pruefeNachricht(text: unknown): { ok: true; text: string } | { ok: false; fehler: string } {
  const t = String(text ?? "").trim();
  if (!t) return { ok: false, fehler: "Bitte eine Nachricht eingeben." };
  if (t.length > NACHRICHT_MAX) return { ok: false, fehler: `Höchstens ${NACHRICHT_MAX} Zeichen.` };
  return { ok: true, text: t };
}

type Db = { from: (t: string) => any }; // eslint-disable-line @typescript-eslint/no-explicit-any

/**
 * Verlauf zu einer Reihe von Anliegen. Beim Mieter filtert die Datenbank (Leseregel über
 * `anliegen`), beim Vermieter sind es ohnehin nur eigene Anliegen-IDs.
 */
export async function ladeEreignisse(db: Db, anliegenIds: string[]): Promise<Map<string, Ereignis[]>> {
  if (anliegenIds.length === 0) return new Map();
  const { data } = await db
    .from("anliegen_ereignisse")
    .select(EREIGNIS_SPALTEN)
    .in("anliegen_id", anliegenIds)
    .order("created_at", { ascending: true })
    .limit(2000);
  return gruppiereEreignisse((data ?? []) as Ereignis[]);
}
