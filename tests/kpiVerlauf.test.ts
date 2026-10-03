// Verläufe unter den Dashboard-Kennzahlen (lib/kpiVerlauf.ts). Kern: Die Linie zeigt
// dieselbe Größe wie die Zahl — der letzte Punkt IST die angezeigte Zahl.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { monatsStichtage, wertAm, kpiReihen, trendVormonat, trendTon } from "@/lib/kpiVerlauf";
import { sollKaltmiete } from "@/lib/sollMiete";
import { kostenSchnittMonat, nkVorauszahlungenMonat } from "@/lib/cashflowKennzahl";

describe("Stichtage", () => {
  it("zwölf Monatsenden, der letzte ist heute", () => {
    const t = monatsStichtage("2026-10-03", 12);
    expect(t).toHaveLength(12);
    expect(t[0]).toBe("2025-11-30");
    expect(t[10]).toBe("2026-09-30");
    expect(t[11]).toBe("2026-10-03");
  });
  it("Februar und Jahreswechsel richtig (kein 31.02., kein Monat 0)", () => {
    expect(monatsStichtage("2026-03-15", 3)).toEqual(["2026-01-31", "2026-02-28", "2026-03-15"]);
    expect(monatsStichtage("2028-03-01", 2)).toEqual(["2028-02-29", "2028-03-01"]);
    expect(monatsStichtage("2027-01-10", 2)).toEqual(["2026-12-31", "2027-01-10"]);
  });
  it("Unsinn → leer", () => {
    expect(monatsStichtage("kein Datum")).toEqual([]);
  });
});

describe("wertAm", () => {
  const reihe = [{ datum: "2024-01-01", marktwert: 100 }, { datum: "2025-06-01", marktwert: 150 }];
  it("letzter Stand bis zum Stichtag, davor 0", () => {
    expect(wertAm(reihe, "2023-12-31")).toBe(0);
    expect(wertAm(reihe, "2024-01-01")).toBe(100);
    expect(wertAm(reihe, "2025-05-31")).toBe(100);
    expect(wertAm(reihe, "2026-01-01")).toBe(150);
  });
});

describe("kpiReihen: dieselbe Rechnung wie die Kachel", () => {
  const objekte = [{ id: "o1", miete: 0 }, { id: "o2", miete: 0 }];
  const mieter = [
    { id: "m1", prop_id: "o1", kaltmiete: 800, nk_vorauszahlung: 150, stellplatz_miete: null, mietbeginn: "2020-01-01", mietende: null },
    // zieht im August 2026 ein — muss erst ab dann zählen
    { id: "m2", prop_id: "o2", kaltmiete: 600, nk_vorauszahlung: 100, stellplatz_miete: null, mietbeginn: "2026-08-01", mietende: null },
    // ohne Objekt: seine NK dürfen nicht in die Warmmiete (Regel aus datenluecken, 30.09.2026)
    { id: "m3", prop_id: null, kaltmiete: 400, nk_vorauszahlung: 999, stellplatz_miete: null, mietbeginn: "2020-01-01", mietende: null },
  ];
  const kosten = [
    { buchungsdatum: "2026-01-15", betrag: 1200 },
    { buchungsdatum: "2026-09-15", betrag: 300 },
  ];
  const einnahmen = [{ buchungsdatum: "2025-11-01", betrag: 950 }];
  const alle = [...einnahmen, ...kosten];
  const eingabe = { objekte, mieter, kosten, alle, kreditraten: 500, wertReihe: [{ datum: "2020-01-01", marktwert: 300000 }] };
  const tage = monatsStichtage("2026-10-03", 12);
  const r = kpiReihen(eingabe, tage);

  it("letzter Punkt = Kachelwerte (Warmmiete, Kosten, Cashflow)", () => {
    const heute = "2026-10-03";
    const warm = objekte.reduce((s, o) => s + sollKaltmiete(o, mieter, heute).betrag, 0) + nkVorauszahlungenMonat(mieter.filter((m) => m.prop_id), heute);
    const kostenKachel = 500 + Math.round(kostenSchnittMonat(kosten, alle, heute).betrag);
    expect(r.warmmiete.at(-1)).toBe(warm);
    expect(r.warmmiete.at(-1)).toBe(800 + 150 + 600 + 100);
    expect(r.kosten.at(-1)).toBe(kostenKachel);
    expect(r.cashflow.at(-1)).toBe(warm - kostenKachel);
  });

  it("Einzug zählt erst ab seinem Monat", () => {
    // Juli-Ende ohne m2, August-Ende mit m2
    const juli = tage.indexOf("2026-07-31");
    const august = tage.indexOf("2026-08-31");
    expect(r.warmmiete[juli]).toBe(950);
    expect(r.warmmiete[august]).toBe(1650);
  });

  it("Kosten rechnen das Ø-Fenster je Stichtag neu (nicht den heutigen Schnitt rückwärts)", () => {
    const dez = tage.indexOf("2025-12-31");
    const feb = tage.indexOf("2026-02-28");
    expect(r.kosten[dez]).toBe(500); // Januarbuchung liegt noch in der Zukunft
    expect(r.kosten[feb]).toBe(500 + Math.round(1200 / 3)); // Fenster Nov–Jan: endet am letzten Monat MIT Buchungen
  });

  it("Wert folgt der Wertreihe", () => {
    expect(r.wert.every((w) => w === 300000)).toBe(true);
  });
});

describe("Trend", () => {
  it("Veränderung ggü. dem vorletzten Punkt", () => {
    expect(trendVormonat([100, 120, 150])).toEqual({ delta: 30, prozent: 25 });
    expect(trendVormonat([5])).toBeNull();
  });
  it("kein Prozent bei Basis ≤ 0 (negativer Cashflow)", () => {
    expect(trendVormonat([-200, 100])?.prozent).toBeNull();
    expect(trendVormonat([0, 100])?.prozent).toBeNull();
  });
  it("steigende Kosten sind schlecht, steigende Miete gut, gleich ist neutral", () => {
    expect(trendTon({ delta: 50, prozent: 5 }, false)).toBe("schlecht");
    expect(trendTon({ delta: 50, prozent: 5 }, true)).toBe("gut");
    expect(trendTon({ delta: -50, prozent: -5 }, false)).toBe("gut");
    expect(trendTon({ delta: 0, prozent: 0 }, true)).toBe("neutral");
    expect(trendTon(null, true)).toBe("neutral");
  });
});

describe("Dashboard benutzt die Verläufe", () => {
  const q = readFileSync("app/(app)/page.tsx", "utf8");
  it("Kosten-Trend ist „steigend = schlecht“, die anderen „steigend = gut“", () => {
    expect(q).toMatch(/<TrendHinweis trend=\{trendVormonat\(kpi\.kosten\)\} steigendIstGut=\{false\} \/>/);
    expect(q).toMatch(/<TrendHinweis trend=\{trendVormonat\(kpi\.cashflow\)\} steigendIstGut \/>/);
  });
  it("Portfoliowert OHNE „ggü. Vormonat“ (Wert ändert sich am Erfassungstag, nicht am Markttag)", () => {
    expect(q).not.toMatch(/trendVormonat\(kpi\.wert\)/);
    expect(q).not.toMatch(/werte=\{kpi\.wert\}/);
  });
  it("die Annahme „Kreditraten von heute“ steht an Kosten und Cashflow", () => {
    expect(q).toContain("Kreditraten zum heutigen Stand");
    expect(q.match(/titel=\{SPARK_TITEL_RATEN\}/g)?.length).toBe(2);
  });
});
