// Kauf-Flow: das im Cockpit-Vergleich gewählte "beste" Objekt wird für die
// folgenden Schritte (Finanzierung, Kreditantrag) mitgenommen. Reines
// Client-Handoff über localStorage — keine sensiblen Personendaten hier,
// nur die schon berechneten Objekt-Kennzahlen.

export const KAUF_AUSWAHL_KEY = "myimmo_kauf_auswahl";

export type KaufAuswahl = {
  kalkId: string | null;
  name: string;
  adresse: string;
  kp: number;
  gesamtInvest: number;
  /**
   * Davon Sanierung (seit 05.10.2026, aus dem Sanierungsrechner). Nebenkosten = Gesamt − Kaufpreis
   * − Sanierung — ohne das Feld galt die Sanierung überall als Nebenkosten. Ältere Auswahlen: fehlt → 0.
   */
  sanierung?: number;
  eigenkapital: number;
  darlehen: number;
  rate: number;        // Monatsrate gesamt
  kaltmiete: number;
  cfNetto: number;
  nutzung: "eigennutzen" | "vermieten"; // gemappt aus ObjektRechner (für KfW-Matching)
  gewaehltAm: string;  // ISO-Datum (nur zur Anzeige)
};

/** Gespeicherte Kaufprüfung → Auswahl für Finanzierung und Kreditantrag (summary = Snapshot des Rechners). */
export function auswahlAus(
  k: { id: string; name: string; data?: Record<string, string> | null; summary?: Record<string, number> | null },
  heute: string,
): KaufAuswahl {
  const s = k.summary ?? {};
  return {
    kalkId: k.id, name: k.name, adresse: k.data?.adresse ?? "",
    kp: s.kp ?? 0, gesamtInvest: s.gesamtInvest ?? 0,
    // Ohne dieses Feld galt die Sanierung in Finanzierung, Ampel und Kreditantrag als Nebenkosten.
    sanierung: s.sanierung ?? 0,
    eigenkapital: 0, darlehen: 0, rate: 0, kaltmiete: s.kaltmiete ?? 0, cfNetto: 0,
    // summarySnapshot: nutzung = vermietung ? 1 : 0
    nutzung: s.nutzung === 1 ? "vermieten" : "eigennutzen",
    gewaehltAm: heute,
  };
}

// ===== Objekt-Scoring für den Vergleich =====
// Punkt je Kennzahl, in der ein Objekt (unter den verglichenen) am besten ist.
// Bei Gleichstand aller Objekte in einer Kennzahl vergibt niemand einen Punkt.

export type VglObjekt = { id: string; summary?: Record<string, number> | null };
export type VglMetrik = { key: string; better: "high" | "low" | "none" };

export function objektPunkte(objekte: VglObjekt[], metriken: VglMetrik[]): Record<string, number> {
  const punkte: Record<string, number> = {};
  for (const o of objekte) punkte[o.id] = 0;
  if (objekte.length < 2) return punkte;

  for (const m of metriken) {
    if (m.better === "none") continue;
    const vals = objekte
      .map((o) => o.summary?.[m.key])
      .filter((v): v is number => typeof v === "number");
    if (vals.length < 2) continue;
    const best = m.better === "high" ? Math.max(...vals) : Math.min(...vals);
    if (vals.every((v) => v === best)) continue; // alle gleich → kein Punkt
    for (const o of objekte) {
      const v = o.summary?.[m.key];
      if (typeof v === "number" && v === best) punkte[o.id] += 1;
    }
  }
  return punkte;
}

// Liefert das Objekt mit den meisten Punkten + ob es ein eindeutiger Sieger ist.
export function bestesObjekt(
  objekte: VglObjekt[],
  metriken: VglMetrik[],
): { id: string | null; punkte: Record<string, number>; eindeutig: boolean } {
  const punkte = objektPunkte(objekte, metriken);
  let bestId: string | null = null;
  let bestScore = -1;
  let eindeutig = true;
  for (const o of objekte) {
    const s = punkte[o.id] ?? 0;
    if (s > bestScore) { bestScore = s; bestId = o.id; eindeutig = true; }
    else if (s === bestScore) { eindeutig = false; }
  }
  return { id: bestId, punkte, eindeutig };
}
