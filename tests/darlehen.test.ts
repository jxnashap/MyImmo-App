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

describe("B13 (Prüfstand 11.10.2026): Zinsen nur bis zur Volltilgung", () => {
  it("100.000 € · 4 % Zins · 4 % Tilgung: ≈ 38.860,59 € Zinsen, Volltilgung in Monat 209, letzte Rate 193,92 €", async () => {
    const { tilgungsVerlauf } = await import("@/lib/kalk");
    const v = tilgungsVerlauf(100000, 0.04, (100000 * 0.08) / 12, 240);
    expect(Math.round(v.zinsen * 100) / 100).toBe(38860.59);
    expect(v.volltilgungMonat).toBe(209);
    expect(Math.round(v.letzteRate! * 100) / 100).toBe(193.92);
    expect(v.restschuld).toBe(0);
    expect(v.tilgung).toBe(100000);
    // Summe der gezahlten Raten = Darlehen + Zinsen — nicht Rate × 240.
    expect(Math.round(((100000 * 0.08) / 12 * 208 + v.letzteRate!) * 100) / 100).toBe(Math.round((100000 + v.zinsen) * 100) / 100);
  });

  it("der Wizard zeigt diese Zinsen, nicht 60.000 €", async () => {
    const { konfiguriereDarlehen } = await import("@/lib/kauf/darlehen");
    const k = konfiguriereDarlehen({ darlehen: 100000, prioritaet: "schnell_schuldenfrei", zinsbindung: 20, sollzins: 4, sondertilgung: false }, 2026);
    expect(Math.round(k.zinskostenBindung * 100) / 100).toBe(38860.59);
    expect(Math.round(k.letzteRateInBindung! * 100) / 100).toBe(193.92);
    expect(k.restschuldNachBindung).toBe(0);
  });

  it("läuft die Bindung VOR der Volltilgung ab, zählt jeder Monat der Bindung — ohne letzte Rate", async () => {
    const { tilgungsVerlauf } = await import("@/lib/kalk");
    const { konfiguriereDarlehen } = await import("@/lib/kauf/darlehen");
    const k = konfiguriereDarlehen({ darlehen: 250000, prioritaet: "gleiche_rate", zinsbindung: 10, sollzins: 4, sondertilgung: false }, 2026);
    const v = tilgungsVerlauf(250000, 0.04, (250000 * 0.06) / 12, 120);
    expect(k.zinskostenBindung).toBeCloseTo(v.zinsen, 6);
    // Rate × Monate = Zinsen + Tilgung (nur hier, weil keine Rate gekappt ist)
    expect(k.zinskostenBindung + (250000 - k.restschuldNachBindung)).toBeCloseTo(((250000 * 0.06) / 12) * 120, 4);
    expect(k.letzteRateInBindung).toBeNull();
  });

  it("deckt die Rate die Zinsen nicht, wächst nichts weg: Zinsen laufen, Restschuld bleibt", async () => {
    const { tilgungsVerlauf } = await import("@/lib/kalk");
    const v = tilgungsVerlauf(100000, 0.06, 400, 12);
    expect(v.deckungFehlt).toBe(true);
    expect(v.restschuld).toBe(100000);
    expect(v.zinsen).toBeCloseTo(6000, 6);
  });
});
