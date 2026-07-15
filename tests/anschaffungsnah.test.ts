import { describe, it, expect } from "vitest";
import { berechneAnschaffungsnah, type AnschaffungsnahKosten } from "@/lib/steuer/anschaffungsnah";

const objekt = { kaufpreis: 300000, gebaeudeanteilProzent: 80, kaufdatum: "2024-06-01" };
// Gebäude-AK = 240.000; Grenze 15 % = 36.000
const heute = new Date("2025-06-01T00:00:00Z");

const k = (buchungsdatum: string, betrag: number, kategorie = "Reparatur"): AnschaffungsnahKosten => ({
  buchungsdatum, betrag, kategorie,
});

describe("berechneAnschaffungsnah", () => {
  it("rechnet Gebäude-AK und 15 %-Grenze korrekt", () => {
    const r = berechneAnschaffungsnah(objekt, [], heute);
    expect(r.gebaeudeAK).toBe(240000);
    expect(r.grenze).toBe(36000);
    expect(r.fensterVon).toBe("2024-06-01");
    // § 187/188 BGB: Jahrestag gehört noch ins Fenster.
    expect(r.fensterBis).toBe("2027-06-01");
    expect(r.status).toBe("ok");
  });

  it("nutzt 80 % als Standard-Gebäudeanteil", () => {
    const r = berechneAnschaffungsnah({ ...objekt, gebaeudeanteilProzent: null }, [], heute);
    expect(r.gebaeudeAK).toBe(240000);
  });

  it("summiert nur relevante Kategorien im Fenster", () => {
    const kosten = [
      k("2024-07-01", 10000, "Reparatur"),
      k("2024-08-01", 5000, "Instandhaltung"),
      k("2024-09-01", 9000, "Modernisierung"),
      k("2024-10-01", 20000, "Verwaltung"), // zählt NICHT
      k("2023-01-01", 8000, "Reparatur"),   // vor dem Kauf → außerhalb
      k("2027-08-01", 8000, "Reparatur"),   // nach dem Fenster → außerhalb
    ];
    const r = berechneAnschaffungsnah(objekt, kosten, heute);
    expect(r.kostenImFenster).toBe(24000);
    expect(r.ausgeschoepftProzent).toBe(Math.round((24000 / 36000) * 10000) / 100);
    expect(r.status).toBe("ok");
  });

  it("warnt ab 80 % Ausschöpfung", () => {
    const r = berechneAnschaffungsnah(objekt, [k("2024-07-01", 30000)], heute);
    expect(r.status).toBe("warnung"); // 30.000 / 36.000 = 83,3 %
  });

  it("meldet Überschreitung über 100 %", () => {
    const r = berechneAnschaffungsnah(objekt, [k("2024-07-01", 40000)], heute);
    expect(r.status).toBe("ueberschritten");
    expect(r.ausgeschoepftProzent).toBeGreaterThan(100);
  });

  it("meldet abgelaufenes Fenster als Entwarnung", () => {
    const spaeter = new Date("2027-07-01T00:00:00Z"); // nach 2027-06-01
    const r = berechneAnschaffungsnah(objekt, [k("2024-07-01", 5000)], spaeter);
    expect(r.status).toBe("abgelaufen");
    expect(r.monateVerbleibend).toBe(0);
  });

  it("ist inaktiv ohne Kaufdatum oder Kaufpreis", () => {
    expect(berechneAnschaffungsnah({ ...objekt, kaufdatum: null }, [], heute).status).toBe("inaktiv");
    expect(berechneAnschaffungsnah({ ...objekt, kaufpreis: null }, [], heute).status).toBe("inaktiv");
  });

  it("berechnet verbleibende Monate bis Fensterende", () => {
    const r = berechneAnschaffungsnah(objekt, [], heute); // heute 2025-06-01, Ende 2027-06-01
    expect(r.monateVerbleibend).toBe(24);
  });
});
