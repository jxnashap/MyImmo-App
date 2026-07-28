// Reine Helfer für die Marktwert-Einschätzungen (testbar, ohne Supabase).

export const QUELLE_VERKAUF = "Verkauf-Assistent";

export type EinschaetzungRow = {
  id: string;
  immobilie_id: string;
  datum: string; // ISO-Zeitstempel
  marktwert: number | null;
  verfahren: string | null;
  quelle: string | null;
};

/** Trennt die Notiz von der Quelle: "Verkauf-Assistent · Text" → "Text". */
export function notizAusQuelle(quelle: string | null): string | null {
  if (!quelle) return null;
  const i = quelle.indexOf(" · ");
  if (i < 0) return null;
  const rest = quelle.slice(i + 3).trim();
  return rest || null;
}

/** Anzeige-Etikett der Herkunft (ohne die Notiz). */
export function herkunftLabel(verfahren: string | null, quelle: string | null): string {
  if (verfahren === "einschaetzung") return "Eigene Einschätzung";
  if (verfahren === "index") return "Index-Fortschreibung";
  if (verfahren === "sachwert" || verfahren === "immowertv") return "ImmoWertV-Schätzung";
  if (verfahren === "manuell") return "Manuell erfasst";
  const q = (quelle ?? "").split(" · ")[0].trim();
  return q || "Wert-Stand";
}

/** Veränderung zum nächstälteren Stand in Prozent (null, wenn nicht bestimmbar). */
export function veraenderungProzent(aktuell: number | null, vorher: number | null): number | null {
  if (aktuell == null || vorher == null || vorher <= 0) return null;
  return Math.round(((aktuell - vorher) / vorher) * 1000) / 10;
}

/**
 * Bereitet die Liste für die Anzeige auf: nach Datum absteigend sortiert, je
 * Eintrag die Veränderung gegenüber dem nächstälteren Stand DESSELBEN Objekts.
 */
export function bereiteListeAuf(rows: EinschaetzungRow[]): (EinschaetzungRow & {
  notiz: string | null;
  herkunft: string;
  deltaProzent: number | null;
})[] {
  const sortiert = [...rows].sort((a, b) => b.datum.localeCompare(a.datum));
  // Pro Objekt aufsteigend, um den jeweils vorherigen Stand zu kennen.
  const vorherJeEintrag = new Map<string, number | null>();
  const jeObjekt = new Map<string, EinschaetzungRow[]>();
  for (const r of sortiert) {
    const arr = jeObjekt.get(r.immobilie_id) ?? [];
    arr.push(r);
    jeObjekt.set(r.immobilie_id, arr);
  }
  for (const arr of jeObjekt.values()) {
    // arr ist absteigend → der nächste Eintrag ist der ältere.
    for (let i = 0; i < arr.length; i++) {
      vorherJeEintrag.set(arr[i].id, i + 1 < arr.length ? Number(arr[i + 1].marktwert ?? 0) || null : null);
    }
  }
  return sortiert.map((r) => ({
    ...r,
    notiz: notizAusQuelle(r.quelle),
    herkunft: herkunftLabel(r.verfahren, r.quelle),
    deltaProzent: veraenderungProzent(r.marktwert == null ? null : Number(r.marktwert), vorherJeEintrag.get(r.id) ?? null),
  }));
}
