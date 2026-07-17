import { describe, it, expect } from "vitest";
import { berechneVerkauf } from "@/lib/verkauf";

const heute = new Date("2026-07-18T00:00:00Z");

describe("berechneVerkauf (§ 23 EStG + Netto-Erlös)", () => {
  it("spekulationsfrei nach 10 Jahren → keine Steuer, voller Netto-Erlös", () => {
    const r = berechneVerkauf({
      verkaufspreis: 400000,
      kaufdatum: "2010-01-01",
      kaufpreis: 250000,
      restschuld: 100000,
      verkaufskosten: 10000,
      heute,
    });
    expect(r.spekulationsfrei).toBe(true);
    expect(r.veraeusserungsgewinn).toBe(0);
    expect(r.spekulationssteuer).toBe(0);
    // 400.000 − 100.000 Restschuld − 10.000 Kosten − 0 Steuer
    expect(r.nettoErloes).toBe(290000);
  });

  it("innerhalb der Frist → Gewinn + Steuer, AfA erhöht den Gewinn", () => {
    const r = berechneVerkauf({
      verkaufspreis: 400000,
      kaufdatum: "2020-01-01", // < 10 Jahre vor heute
      kaufpreis: 250000,
      kaufnebenkosten: 25000,
      afaKumuliert: 30000,
      verkaufskosten: 10000,
      restschuld: 200000,
      steuersatz: 42,
      heute,
    });
    expect(r.spekulationsfrei).toBe(false);
    // Gewinn = 400.000 − 10.000 − (275.000 − 30.000) = 145.000
    expect(r.veraeusserungsgewinn).toBe(145000);
    expect(r.spekulationssteuer).toBe(60900); // 42 %
    // Netto = 400.000 − 200.000 − 0 − 10.000 − 60.900
    expect(r.nettoErloes).toBe(129100);
  });

  it("negativer Gewinn wird nicht negativ besteuert", () => {
    const r = berechneVerkauf({
      verkaufspreis: 200000,
      kaufdatum: "2022-01-01",
      kaufpreis: 250000,
      verkaufskosten: 5000,
      heute,
    });
    expect(r.veraeusserungsgewinn).toBe(0);
    expect(r.spekulationssteuer).toBe(0);
  });

  it("ohne Kaufdatum: vorsichtshalber steuerpflichtig behandelt", () => {
    const r = berechneVerkauf({ verkaufspreis: 300000, kaufdatum: null, kaufpreis: 200000, heute });
    expect(r.spekulationsfrei).toBe(false);
  });
});
