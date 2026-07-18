import { describe, it, expect } from "vitest";
import { konfiguriereDarlehen, beispielZins, type DarlehenWunsch } from "@/lib/kauf/darlehen";

const basis: DarlehenWunsch = {
  darlehen: 300000, prioritaet: "gleiche_rate", zinsbindung: 15, sollzins: 3.8, sondertilgung: true,
};

describe("Darlehen-Wizard", () => {
  it("Beispielzins steigt mit der Zinsbindung", () => {
    expect(beispielZins(10)).toBeLessThan(beispielZins(20));
  });

  it("gleiche_rate → 2 % Anfangstilgung, plausible Rate", () => {
    const k = konfiguriereDarlehen(basis, 2026);
    expect(k.anfangstilgung).toBe(2);
    // 300000*(0.038+0.02)/12 = 1450
    expect(Math.round(k.monatsrate)).toBe(1450);
    expect(k.restschuldNachBindung).toBeGreaterThan(0);
    expect(k.restschuldNachBindung).toBeLessThan(300000);
  });

  it("schnell_schuldenfrei tilgt schneller als niedrige_rate", () => {
    const schnell = konfiguriereDarlehen({ ...basis, prioritaet: "schnell_schuldenfrei" }, 2026);
    const niedrig = konfiguriereDarlehen({ ...basis, prioritaet: "niedrige_rate" }, 2026);
    expect(schnell.monatsrate).toBeGreaterThan(niedrig.monatsrate);
    expect(schnell.restschuldNachBindung).toBeLessThan(niedrig.restschuldNachBindung);
    expect(schnell.laufzeitJahre).toBeLessThan(niedrig.laufzeitJahre);
  });

  it("Restschuld 0 bei Darlehen 0", () => {
    const k = konfiguriereDarlehen({ ...basis, darlehen: 0 }, 2026);
    expect(k.monatsrate).toBe(0);
    expect(k.restschuldNachBindung).toBe(0);
  });
});
