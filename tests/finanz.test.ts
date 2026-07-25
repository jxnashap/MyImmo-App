import { describe, it, expect } from "vitest";
import {
  annuitaetMonat, restschuldNach, szenario, urteilCf,
  renditeTeilwert, cashflowTeilwert, dealScore, scoreUrteil,
} from "@/lib/finanz";

describe("annuitaetMonat", () => {
  it("Darlehen × (Zins + Tilgung) / 1200", () => {
    expect(annuitaetMonat(120000, 3.9, 2)).toBeCloseTo((120000 * 5.9) / 1200, 6);
    expect(annuitaetMonat(0, 3.9, 2)).toBe(0);
  });
});

describe("restschuldNach", () => {
  it("Annuitätsformel über 120 Monate", () => {
    const darlehen = 200000, zins = 3.5, tilgung = 2;
    const rate = annuitaetMonat(darlehen, zins, tilgung);
    const rest = restschuldNach(darlehen, zins, rate);
    // Nach 10 Jahren muss mehr als die lineare Anfangstilgung weg sein (Zinseszins-Effekt).
    expect(rest).toBeLessThan(darlehen - darlehen * 0.02 * 10);
    expect(rest).toBeGreaterThan(darlehen * 0.5);
  });
  it("vollständige Tilgung → 0, nie negativ", () => {
    expect(restschuldNach(1000, 3, 10000, 12)).toBe(0);
  });
});

describe("szenario (Kern-Logik aus dem Handoff)", () => {
  const s = szenario({ kaufpreis: 189000, ekQuote: 20, zins: 3.9, tilgung: 2, miete: 710 });
  it("Gesamtkosten = Kaufpreis × 1,105", () => {
    expect(s.gesamt).toBeCloseTo(189000 * 1.105, 2);
    expect(s.nebenkosten).toBeCloseTo(189000 * 0.105, 2);
  });
  it("EK = Quote × Gesamt, Darlehen = Rest", () => {
    expect(s.eigenkapital).toBeCloseTo(s.gesamt * 0.2, 2);
    expect(s.darlehen).toBeCloseTo(s.gesamt * 0.8, 2);
  });
  it("Cashflow = Miete − Rate − 90", () => {
    expect(s.cashflow).toBeCloseTo(710 - s.rate - 90, 6);
  });
  it("Stresstest: +1,5 pp auf Restschuld, Miete × 11/12", () => {
    expect(s.stress.zins).toBeCloseTo(5.4, 6);
    expect(s.stress.rate).toBeCloseTo((s.rest10 * (5.4 + 2)) / 1200, 6);
    expect(s.stress.cashflow).toBeCloseTo((710 * 11) / 12 - s.stress.rate - 90, 6);
  });
});

describe("urteilCf", () => {
  it("Schwellen 100 / 0", () => {
    expect(urteilCf(150)).toEqual({ label: "Trägt sich", badge: "green" });
    expect(urteilCf(100).badge).toBe("green");
    expect(urteilCf(50).badge).toBe("amber");
    expect(urteilCf(0).badge).toBe("amber");
    expect(urteilCf(-1).badge).toBe("red");
  });
});

describe("dealScore", () => {
  it("Rendite skaliert 0–8 % auf 0–25", () => {
    expect(renditeTeilwert(0)).toBe(0);
    expect(renditeTeilwert(4)).toBe(13); // gerundet
    expect(renditeTeilwert(8)).toBe(25);
    expect(renditeTeilwert(12)).toBe(25); // gedeckelt
  });
  it("Cashflow skaliert −300…+300 auf 0–25", () => {
    expect(cashflowTeilwert(-300)).toBe(0);
    expect(cashflowTeilwert(0)).toBe(13);
    expect(cashflowTeilwert(300)).toBe(25);
  });
  it("Summe aus 4 Teilwerten, Lage/Zustand gedeckelt", () => {
    const d = dealScore(8, 300, 23, 17);
    expect(d.teilwerte).toEqual([25, 25, 23, 17]);
    expect(d.score).toBe(90);
    expect(dealScore(0, -300, 99, -5).teilwerte).toEqual([0, 0, 25, 0]);
  });
  it("Urteile: ≥80 gold, ≥72 teal, sonst amber", () => {
    expect(scoreUrteil(82)).toEqual({ label: "Prüfen lohnt sich", badge: "gold" });
    expect(scoreUrteil(76).badge).toBe("teal");
    expect(scoreUrteil(71).badge).toBe("amber");
  });
});
