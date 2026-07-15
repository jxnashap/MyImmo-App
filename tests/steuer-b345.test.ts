import { describe, it, expect } from "vitest";
import { berechneSpekulation } from "@/lib/steuer/spekulation";
import { berechneVerbilligt } from "@/lib/steuer/verbilligt";

describe("berechneSpekulation (§ 23 EStG)", () => {
  it("setzt die Steuerfrei-Grenze auf Kauf + 10 Jahre", () => {
    const r = berechneSpekulation("2020-06-15", new Date("2025-06-15T00:00:00Z"));
    expect(r.aktiv).toBe(true);
    expect(r.steuerfreiAb).toBe("2030-06-15");
    expect(r.steuerfrei).toBe(false);
    expect(r.jahreVerbleibend).toBe(5);
  });

  it("meldet Steuerfreiheit nach Ablauf", () => {
    const r = berechneSpekulation("2010-01-01", new Date("2025-01-01T00:00:00Z"));
    expect(r.steuerfrei).toBe(true);
    expect(r.tageVerbleibend).toBe(0);
  });

  it("ist am letzten Tag der Frist noch nicht steuerfrei, am Folgetag ja", () => {
    expect(berechneSpekulation("2015-03-10", new Date("2025-03-10T00:00:00Z")).steuerfrei).toBe(true);
    expect(berechneSpekulation("2015-03-10", new Date("2025-03-09T00:00:00Z")).steuerfrei).toBe(false);
  });

  it("ist inaktiv ohne Kaufdatum", () => {
    expect(berechneSpekulation(null).aktiv).toBe(false);
  });
});

describe("berechneVerbilligt (§ 21 Abs. 2 EStG)", () => {
  const basis = { kaltmiete: 600, nkVorauszahlung: 150, vergleichKaltProM2: 10, flaeche: 80 };
  // Vergleichskalt = 800; Warm-Ist = 750; Warm-Vergleich = 950 → ~78,9 %

  it("grün ab 66 %", () => {
    const r = berechneVerbilligt(basis);
    expect(r.status).toBe("gruen");
    expect(r.prozent).toBeGreaterThanOrEqual(66);
  });

  it("gelb zwischen 50 und 66 %", () => {
    // Ist-Kalt 500 → Warm 650 / 950 = 68 %? nein. Setze Vergleich höher.
    const r = berechneVerbilligt({ ...basis, kaltmiete: 450, vergleichKaltProM2: 14 });
    // Vergleichskalt 1120, Warm-Ist 600, Warm-Vgl 1270 → 47 % → rot; justiere:
    const r2 = berechneVerbilligt({ kaltmiete: 560, nkVorauszahlung: 0, vergleichKaltProM2: 10, flaeche: 100 });
    // Warm-Ist 560 / Warm-Vgl 1000 = 56 %
    expect(r2.status).toBe("gelb");
  });

  it("rot unter 50 %", () => {
    const r = berechneVerbilligt({ kaltmiete: 400, nkVorauszahlung: 0, vergleichKaltProM2: 12, flaeche: 100 });
    // 400 / 1200 = 33 %
    expect(r.status).toBe("rot");
    expect(r.prozent).toBeLessThan(50);
  });

  it("bezieht Stellplatzmiete in die Ist-Warmmiete ein", () => {
    const ohne = berechneVerbilligt(basis).istWarm;
    const mit = berechneVerbilligt({ ...basis, stellplatzMiete: 50 }).istWarm;
    expect(mit).toBe(ohne + 50);
  });

  it("ist inaktiv ohne Vergleichsmiete oder Kaltmiete", () => {
    expect(berechneVerbilligt({ ...basis, vergleichKaltProM2: null }).status).toBe("inaktiv");
    expect(berechneVerbilligt({ ...basis, kaltmiete: null }).status).toBe("inaktiv");
  });
});
