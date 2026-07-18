import { describe, it, expect } from "vitest";
import { pruefeMachbarkeit, lebenshaltung, type MachbarkeitInput } from "@/lib/kauf/machbarkeit";

const basis: MachbarkeitInput = {
  darlehen: 250000, rate: 1200, kaufpreis: 300000, gesamtInvest: 330000, kaltmieteNeu: 0,
  haushaltsNetto: 4500, mieteinnahmenBestehend: 0, ausgabenFix: 300, anzahlPersonen: 2, eigenkapital: 80000,
};

describe("Machbarkeit", () => {
  it("Lebenshaltungspauschale skaliert mit der Haushaltsgröße", () => {
    expect(lebenshaltung(1)).toBe(700);
    expect(lebenshaltung(3)).toBe(700 + 2 * 225);
    expect(lebenshaltung(0)).toBe(700);
  });

  it("solide Finanzierung → überwiegend grün", () => {
    const r = pruefeMachbarkeit(basis);
    expect(r.hatDaten).toBe(true);
    // Quote 1200/4500 = 26,7 % → grün
    expect(r.checks.find((c) => c.key === "quote")?.ampel).toBe("gruen");
    // Auslauf 250/300 = 83 % → gelb (≤ 85 %, nicht abschreckend rot)
    expect(r.checks.find((c) => c.key === "ltv")?.ampel).toBe("gelb");
    // EK 80k ≥ benötigt 80k → grün
    expect(r.checks.find((c) => c.key === "ek")?.ampel).toBe("gruen");
    // Gesamt = schlechteste = gelb (wegen Auslauf)
    expect(r.gesamt).toBe("gelb");
  });

  it("sehr hoher Auslauf (> 85 %) bleibt rot", () => {
    const r = pruefeMachbarkeit({ ...basis, darlehen: 280000 });
    expect(r.checks.find((c) => c.key === "ltv")?.ampel).toBe("rot");
  });

  it("zu hohe Rate → Quote rot", () => {
    const r = pruefeMachbarkeit({ ...basis, rate: 2200 });
    expect(r.checks.find((c) => c.key === "quote")?.ampel).toBe("rot");
  });

  it("ohne Einkommensdaten → grau", () => {
    const r = pruefeMachbarkeit({ ...basis, haushaltsNetto: 0 });
    expect(r.hatDaten).toBe(false);
    expect(r.gesamt).toBe("grau");
  });

  it("Mieteinnahmen werden zu 75 % angerechnet", () => {
    const ohne = pruefeMachbarkeit({ ...basis, kaltmieteNeu: 0 });
    const mit = pruefeMachbarkeit({ ...basis, kaltmieteNeu: 1000 });
    // 750 € mehr anrechenbar → Überschuss steigt um 750
    expect(Math.round(mit.frei - ohne.frei)).toBe(750);
  });
});
