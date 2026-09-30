import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { kostenSchnittMonat, monatsCashflow, cashflowFormel, type Buchung } from "@/lib/cashflowKennzahl";

// Der Kostenschnitt des Monats-Cashflows (Phase 4 nach dem externen Review).
// Die alte Rechnung — Kosten der letzten 12 Monate / 12 — steht in jedem Fall
// als Vergleich daneben, damit sichtbar ist, wen sie getäuscht hat.

/** Buchungen von `von` bis `bis` (je "YYYY-MM"), jeweils am 1., gleicher Betrag. */
function monatlich(von: string, bis: string, betrag: number): Buchung[] {
  const [vj, vm] = von.split("-").map(Number);
  const [bj, bm] = bis.split("-").map(Number);
  const out: Buchung[] = [];
  for (let i = vj * 12 + vm - 1; i <= bj * 12 + bm - 1; i++) {
    const j = Math.floor(i / 12);
    const m = (i % 12) + 1;
    out.push({ buchungsdatum: `${j}-${String(m).padStart(2, "0")}-01`, betrag });
  }
  return out;
}

/** Die frühere Formel, nachgebaut: Kosten mit Datum im letzten Jahr, durch 12. */
function alteFormel(kosten: Buchung[], heuteIso: string): number {
  const heute = new Date(`${heuteIso}T12:00:00Z`);
  const vor = new Date(heute);
  vor.setUTCFullYear(vor.getUTCFullYear() - 1);
  return (
    kosten
      .filter((k) => {
        const d = k.buchungsdatum ? new Date(`${k.buchungsdatum}T12:00:00Z`) : null;
        return d && d >= vor && d <= heute;
      })
      .reduce((s, k) => s + (k.betrag ?? 0), 0) / 12
  );
}

const HEUTE = "2026-09-30";

describe("kostenSchnittMonat", () => {
  it("lange Historie: die letzten 12 Monate, durch 12", () => {
    const kosten = monatlich("2024-10", "2026-09", 100);
    const r = kostenSchnittMonat(kosten, kosten, HEUTE);
    expect(r).toEqual({ betrag: 100, monate: 12 });
  });

  it("NEUER NUTZER: drei Monate gebucht → durch 3, nicht durch 12", () => {
    const kosten = monatlich("2026-07", "2026-09", 100);
    const r = kostenSchnittMonat(kosten, kosten, HEUTE);
    expect(r).toEqual({ betrag: 100, monate: 3 });
    // Die alte Formel zeigte ein Viertel der Kosten — und einen Cashflow,
    // der um 75 € im Monat zu gut war.
    expect(alteFormel(kosten, HEUTE)).toBe(25);
  });

  it("Lücke am ENDE: seit drei Monaten nichts gebucht → Fenster endet am letzten gebuchten Monat", () => {
    const kosten = monatlich("2025-07", "2026-06", 100);
    const r = kostenSchnittMonat(kosten, kosten, HEUTE);
    expect(r).toEqual({ betrag: 100, monate: 12 });
    // So sank in der Demo der Schnitt jeden Monat weiter (gemessen 1.006 → 629 €).
    expect(alteFormel(kosten, HEUTE)).toBe(75);
  });

  it("nur Mieten gebucht: Der Zeitraum zählt trotzdem — Monate ohne Kosten sind 0 €, nicht ‚unbekannt'", () => {
    const mieten = monatlich("2026-04", "2026-09", 900);
    const kosten: Buchung[] = [{ buchungsdatum: "2026-05-15", betrag: 600 }];
    const r = kostenSchnittMonat(kosten, [...mieten, ...kosten], HEUTE);
    expect(r).toEqual({ betrag: 100, monate: 6 });
  });

  it("saisonale Kosten werden NICHT überschätzt: Grundsteuer nur in 4 Monaten zählt über 12", () => {
    // Deshalb teilt die Rechnung durch den ZEITRAUM und nicht durch die Monate
    // mit Kostenbuchung — sonst wären es hier 300 € statt 100 €.
    const mieten = monatlich("2025-10", "2026-09", 900);
    const grundsteuer = ["2025-11-15", "2026-02-15", "2026-05-15", "2026-08-15"].map((d) => ({ buchungsdatum: d, betrag: 300 }));
    const r = kostenSchnittMonat(grundsteuer, [...mieten, ...grundsteuer], HEUTE);
    expect(r).toEqual({ betrag: 100, monate: 12 });
  });

  it("Buchungen in der Zukunft zählen nicht und verschieben das Fenster nicht", () => {
    const kosten = [...monatlich("2026-07", "2026-09", 100), { buchungsdatum: "2026-12-01", betrag: 5000 }];
    expect(kostenSchnittMonat(kosten, kosten, HEUTE)).toEqual({ betrag: 100, monate: 3 });
  });

  it("die Fenstergrenze liegt genau bei 12 Monaten", () => {
    // 13 Monate: Der älteste (2025-09, 1.300 €) fällt heraus.
    const kosten = [{ buchungsdatum: "2025-09-01", betrag: 1300 }, ...monatlich("2025-10", "2026-09", 100)];
    expect(kostenSchnittMonat(kosten, kosten, HEUTE)).toEqual({ betrag: 100, monate: 12 });
  });

  it("über den Jahreswechsel", () => {
    const kosten = monatlich("2026-11", "2027-02", 100);
    expect(kostenSchnittMonat(kosten, kosten, "2027-02-10")).toEqual({ betrag: 100, monate: 4 });
  });

  it("nichts gebucht, kaputte Daten, kaputtes Heute → 0 statt NaN", () => {
    expect(kostenSchnittMonat([], [], HEUTE)).toEqual({ betrag: 0, monate: 0 });
    const kaputt: Buchung[] = [{ buchungsdatum: null, betrag: 50 }, { buchungsdatum: "2026-13-01", betrag: 50 }, { buchungsdatum: "gestern", betrag: 50 }];
    expect(kostenSchnittMonat(kaputt, kaputt, HEUTE)).toEqual({ betrag: 0, monate: 0 });
    expect(kostenSchnittMonat(monatlich("2026-07", "2026-09", 100), [], "")).toEqual({ betrag: 0, monate: 0 });
  });

  it("rechnet ohne Date/Ortszeit — sonst hängt das Ergebnis an der Zeitzone des Servers", () => {
    const quelle = readFileSync("lib/cashflowKennzahl.ts", "utf8").replace(/\/\/.*$/gm, "");
    expect(quelle).not.toMatch(/new Date|getMonth|getFullYear|setFullYear/);
  });
});

describe("monatsCashflow und Formel", () => {
  it("Kaltmiete − Kreditraten − Ø Kosten", () => {
    expect(monatsCashflow({ miete: 5930, kreditraten: 4490, kostenSchnitt: 922 })).toBe(518);
  });

  it("die Formel nennt das Fenster — und den Fall ohne Kosten", () => {
    expect(cashflowFormel({ betrag: 100, monate: 12 })).toBe("Kaltmiete − Kreditraten − Ø Kosten (12 Monate)");
    expect(cashflowFormel({ betrag: 100, monate: 1 })).toBe("Kaltmiete − Kreditraten − Ø Kosten (1 Monat)");
    expect(cashflowFormel({ betrag: 0, monate: 0 })).toMatch(/noch keine Kosten gebucht/);
  });
});

describe("Dashboard und Objektseite rechnen dieselbe Zahl", () => {
  const dashboard = readFileSync("app/(app)/page.tsx", "utf8");
  const objekt = readFileSync("app/(app)/properties/[id]/page.tsx", "utf8");

  it("beide benutzen die gemeinsame Rechnung, keine eigene „/ 12“ mehr", () => {
    for (const [name, q] of [["Dashboard", dashboard], ["Objektseite", objekt]] as const) {
      expect(q, name).toMatch(/kostenSchnittMonat\(/);
      expect(q, name).toMatch(/monatsCashflow\(/);
      expect(q, name).not.toMatch(/(koLetzte12M|kosten12M)\s*\/\s*12/);
    }
  });

  it("die Objektseite zieht die laufenden Kosten ab (vorher: nur Miete − Kreditrate)", () => {
    expect(objekt).toMatch(/cashflowMo = monatsCashflow\(\{ miete, kreditraten: totalKreditRate, kostenSchnitt: monatsKosten \}\)/);
    expect(objekt).not.toMatch(/cashflowMo = miete - totalKreditRate/);
  });

  it("jede Cashflow-Anzeige nennt ihre Formel", () => {
    expect(dashboard).toMatch(/\{cashflowFormel\(kostenSchnitt\)\}/);
    expect((objekt.match(/cashflowFormel\(kostenSchnitt\)/g) ?? []).length).toBe(2);
  });

  it("der Buchungssaldo heißt nicht mehr „Cashflow“", () => {
    expect(dashboard).toContain("<h3>Buchungssaldo</h3>");
    expect(dashboard).not.toMatch(/caption="Kumulierter Cashflow/);
    expect(readFileSync("app/(app)/cashflow/page.tsx", "utf8")).toMatch(/kpi-label">Buchungssaldo/);
  });
});
