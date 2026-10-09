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
//
// EINE Regel für die grüne Zelle (`bestwertDerZeile`) und die Krone (`objektPunkte`) — Gesamtprüfung
// 07.10.2026, B30: Die Zelle zählte nur Werte > 0, die Krone auch 0 (Punkt für eine Zelle mit „–“). Und
// der höchste absolute Marktwert galt als Bestwert, obwohl verschieden große Objekte so nicht vergleichbar
// sind; vergleichbar ist der Kaufpreis gegenüber der eigenen Schätzung. Vorläufige Schätzungen (fehlender
// Bodenrichtwert, Baujahr …) zählen dabei nicht.

export type VglObjekt = { id: string; summary?: Record<string, number> | null };
export type VglMetrik = { key: string; better: "high" | "low" | "none" };

/** Abgeleitete Zeile: Kaufpreis gegenüber dem geschätzten Marktwert in Prozent (negativ = darunter). */
export const KP_ZU_SCHAETZUNG = "kpZuSchaetzung";

/**
 * Ist die gespeicherte Schätzung vorläufig? Kaufprüfungen vor dem 09.10.2026 tragen das Merkmal nicht —
 * ob ihre Schätzung vollständig war, ist unbekannt; sie gelten deshalb als vorläufig (zählen nicht).
 */
export function istMarktwertVorlaeufig(s: Record<string, number> | null | undefined): boolean {
  return s?.marktwertVorlaeufig !== 0;
}

/** Anzeigewert einer Zeile — null, wenn es nichts zu zeigen gibt („–“). */
export function vergleichsWert(s: Record<string, number> | null | undefined, key: string): number | null {
  if (!s) return null;
  if (key === KP_ZU_SCHAETZUNG) {
    const kp = s.kp, mw = s.marktwert;
    return typeof kp === "number" && typeof mw === "number" && kp > 0 && mw > 0 ? ((kp - mw) / mw) * 100 : null;
  }
  const v = s[key];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : null;
}

/** Wert, der für Bestwert und Krone zählt — ohne vorläufige Schätzungen. */
export function zaehlenderWert(s: Record<string, number> | null | undefined, key: string): number | null {
  if ((key === KP_ZU_SCHAETZUNG || key === "marktwert") && istMarktwertVorlaeufig(s)) return null;
  return vergleichsWert(s, key);
}

/** Bester Wert einer Zeile unter den verglichenen — null, wenn es keinen eindeutigen gibt. */
export function bestwertDerZeile(objekte: VglObjekt[], key: string, better: VglMetrik["better"]): number | null {
  if (better === "none" || objekte.length < 2) return null;
  const vals = objekte.map((o) => zaehlenderWert(o.summary, key)).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const best = better === "high" ? Math.max(...vals) : Math.min(...vals);
  return vals.every((v) => v === best) ? null : best;
}

export function objektPunkte(objekte: VglObjekt[], metriken: VglMetrik[]): Record<string, number> {
  const punkte: Record<string, number> = {};
  for (const o of objekte) punkte[o.id] = 0;
  for (const m of metriken) {
    const best = bestwertDerZeile(objekte, m.key, m.better);
    if (best == null) continue;
    for (const o of objekte) if (zaehlenderWert(o.summary, m.key) === best) punkte[o.id] += 1;
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
