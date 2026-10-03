// Verläufe für die Dashboard-Kennzahlen (03.10.2026, „Kennzahlen lebendiger").
//
// GRUNDSATZ: Die kleine Linie unter einer Zahl zeigt DIESELBE Größe zu früheren
// Stichtagen — gerechnet mit denselben Funktionen wie die Zahl selbst
// (sollKaltmiete, nkVorauszahlungenMonat, kostenSchnittMonat, Wertreihe). Eine
// Linie aus einer anderen Größe (z. B. gebuchte Kosten unter einer Ø-Zahl) wäre
// nicht nachrechenbar — genau das haben die Reviews vom 30.09.2026 bemängelt.
//
// EINE Annahme, die die Oberfläche nennen muss: Kreditraten haben keine
// Historie in der Datenbank. Kosten- und Cashflow-Verlauf rechnen deshalb mit
// den HEUTIGEN Raten; nur Miete und laufende Kosten ändern sich über die Zeit.
//
// Datumsrechnung auf den Zahlen des ISO-Datums (Date.UTC), nie Ortszeit.

import { sollKaltmiete, type SollObjekt, type SollMieter } from "@/lib/sollMiete";
import { kostenSchnittMonat, nkVorauszahlungenMonat, type Buchung, type MieterNk } from "@/lib/cashflowKennzahl";
import type { WertPunkt } from "@/lib/wert/verlauf";

/** Letzter Tag eines Monats als "YYYY-MM-DD" (monat 1–12). */
function monatsende(jahr: number, monat: number): string {
  const tag = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

/**
 * Stichtage für einen Verlauf über `n` Monate, aufsteigend: die Monatsenden der
 * `n − 1` Vormonate und als letzter Punkt `heute` selbst (damit der letzte
 * Punkt exakt die angezeigte Zahl ist).
 */
export function monatsStichtage(heuteIso: string, n = 12): string[] {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(heuteIso);
  if (!m || n < 1) return [];
  const jahr = Number(m[1]);
  const monat = Number(m[2]);
  const tage: string[] = [];
  for (let i = n - 1; i >= 1; i--) {
    const idx = jahr * 12 + (monat - 1) - i;
    tage.push(monatsende(Math.floor(idx / 12), (idx % 12) + 1));
  }
  tage.push(m[0]);
  return tage;
}

/** Wert einer Stufenreihe an einem Stichtag (letzter Punkt ≤ Stichtag, sonst 0). */
export function wertAm(reihe: WertPunkt[], iso: string): number {
  let v = 0;
  for (const p of reihe) {
    if (p.datum <= iso) v = p.marktwert;
    else break;
  }
  return v;
}

export type KpiEingabe = {
  objekte: SollObjekt[];
  mieter: (SollMieter & MieterNk & { prop_id: string | null })[];
  /** Laufende Kosten (ohne Schuldzinsen — `laufendeKosten()`). */
  kosten: Buchung[];
  /** Alle Buchungen (Einnahmen + Kosten) — bestimmen das Kostenfenster. */
  alle: Buchung[];
  /** Summe der Kreditraten HEUTE (keine Historie vorhanden). */
  kreditraten: number;
  /** Portfolio-Wertreihe (`portfolioWertReihe`). */
  wertReihe: WertPunkt[];
};

// `wert` wird berechnet, aber auf dem Dashboard NICHT als Verlauf gezeigt: Objektwerte
// ändern sich am Erfassungstag (marktwert_stand), nicht am Markttag — ein „ggü. Vormonat“
// wäre dort eine Behauptung ohne Grundlage (in der Demo: „▲ 11,9 %“ an einem Tag).
export type KpiReihen = { wert: number[]; warmmiete: number[]; kosten: number[]; cashflow: number[] };

/** Je Kennzahl ein Wert pro Stichtag — dieselbe Rechnung wie auf dem Dashboard. */
export function kpiReihen(e: KpiEingabe, stichtage: string[]): KpiReihen {
  const objektIds = new Set(e.objekte.map((o) => o.id));
  const mitObjekt = e.mieter.filter((m) => m.prop_id && objektIds.has(m.prop_id));
  const r: KpiReihen = { wert: [], warmmiete: [], kosten: [], cashflow: [] };
  for (const tag of stichtage) {
    const kalt = e.objekte.reduce((s, o) => s + sollKaltmiete(o, e.mieter, tag).betrag, 0);
    const warm = kalt + nkVorauszahlungenMonat(mitObjekt, tag);
    const kosten = e.kreditraten + Math.round(kostenSchnittMonat(e.kosten, e.alle, tag).betrag);
    r.wert.push(wertAm(e.wertReihe, tag));
    r.warmmiete.push(warm);
    r.kosten.push(kosten);
    r.cashflow.push(warm - kosten);
  }
  return r;
}

export type Trend = { delta: number; prozent: number | null };

/** Veränderung des letzten gegenüber dem vorletzten Punkt (= Vormonat). */
export function trendVormonat(reihe: number[]): Trend | null {
  if (reihe.length < 2) return null;
  const jetzt = reihe[reihe.length - 1];
  const vorher = reihe[reihe.length - 2];
  const delta = jetzt - vorher;
  // Prozent nur bei positiver Basis — bei 0 oder negativem Cashflow wäre er sinnlos.
  const prozent = vorher > 0 ? (delta / vorher) * 100 : null;
  return { delta, prozent };
}

/** Ob ein Anstieg gut ist — bei Kosten ist er es nicht. */
export function trendTon(t: Trend | null, steigendIstGut: boolean): "gut" | "schlecht" | "neutral" {
  if (!t || Math.abs(t.delta) < 0.5) return "neutral";
  return (t.delta > 0) === steigendIstGut ? "gut" : "schlecht";
}
