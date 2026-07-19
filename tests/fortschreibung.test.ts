import { describe, it, expect } from "vitest";
import { quartalVonDatum, letztesQuartal, fortschreibeKaufpreis, type IndexReihe } from "@/lib/wert/fortschreibung";

const REIHE: IndexReihe = {
  "2020-Q1": 100, "2020-Q2": 102, "2020-Q3": 104, "2020-Q4": 106,
  "2021-Q1": 110, "2021-Q2": 114, "2021-Q3": 118, "2021-Q4": 122,
  "2022-Q1": 125, "2022-Q2": 127,
};

describe("Index-Fortschreibung", () => {
  it("Datum → Quartal", () => {
    expect(quartalVonDatum("2021-05-17")).toBe("2021-Q2");
    expect(quartalVonDatum("2021-12-31")).toBe("2021-Q4");
    expect(quartalVonDatum("2021-01-01")).toBe("2021-Q1");
    expect(quartalVonDatum(null)).toBeNull();
    expect(quartalVonDatum("quatsch")).toBeNull();
  });

  it("letztes Quartal der Reihe", () => {
    expect(letztesQuartal(REIHE)).toBe("2022-Q2");
    expect(letztesQuartal({})).toBeNull();
  });

  it("schreibt den Kaufpreis mit dem Indexverhältnis fort", () => {
    const f = fortschreibeKaufpreis(200000, "2020-01-15", REIHE);
    expect(f).not.toBeNull();
    // 200000 × 127/100 = 254000
    expect(f!.wert).toBe(254000);
    expect(f!.basisQuartal).toBe("2020-Q1");
    expect(f!.standQuartal).toBe("2022-Q2");
    expect(f!.veraenderungProzent).toBe(27);
  });

  it("kein Ergebnis vor Reihenbeginn oder ohne Kaufpreis/Datum", () => {
    expect(fortschreibeKaufpreis(200000, "2010-06-01", REIHE)).toBeNull(); // Quartal fehlt in Reihe
    expect(fortschreibeKaufpreis(0, "2020-06-01", REIHE)).toBeNull();
    expect(fortschreibeKaufpreis(200000, null, REIHE)).toBeNull();
  });

  it("Kauf im aktuellsten Quartal → keine Fortschreibung (nichts zu rechnen)", () => {
    expect(fortschreibeKaufpreis(200000, "2022-06-01", REIHE)).toBeNull();
  });
});

import { parseEurostat, HPI_SNAPSHOT } from "@/lib/wert/hpi";

describe("HPI-Datenquelle", () => {
  it("parst das Eurostat-JSON-stat-Format", () => {
    const json = {
      dimension: { time: { category: { index: { "2024-Q4": 0, "2025-Q1": 1 } } } },
      value: { "0": 149.2, "1": 151.3 },
    };
    // < 4 Quartale → null (Schutz gegen kaputte Antworten)
    expect(parseEurostat(json)).toBeNull();
    const json4 = {
      dimension: { time: { category: { index: { "2024-Q3": 0, "2024-Q4": 1, "2025-Q1": 2, "2025-Q2": 3 } } } },
      value: { "0": 149.0, "1": 149.2, "2": 151.3, "3": 152.6 },
    };
    expect(parseEurostat(json4)).toEqual({ "2024-Q3": 149, "2024-Q4": 149.2, "2025-Q1": 151.3, "2025-Q2": 152.6 });
  });

  it("Snapshot: durchgängige Quartale 2005-Q1 bis 2026-Q1, plausible Werte", () => {
    const keys = Object.keys(HPI_SNAPSHOT);
    expect(keys[0]).toBe("2005-Q1");
    expect(keys[keys.length - 1]).toBe("2026-Q1");
    expect(keys).toHaveLength(85); // 21 Jahre × 4 + 1
    for (const v of Object.values(HPI_SNAPSHOT)) { expect(v).toBeGreaterThan(50); expect(v).toBeLessThan(250); }
    expect(HPI_SNAPSHOT["2015-Q2"]).toBeCloseTo(99.9); // Basisjahr 2015 ≈ 100
  });

  it("reale Fortschreibung mit dem Snapshot (Kauf 2020-Q1 → 2026-Q1)", () => {
    const f = fortschreibeKaufpreis(300000, "2020-02-01", HPI_SNAPSHOT);
    // 300000 × 153.4/133.8 ≈ 343946
    expect(f!.wert).toBe(Math.round(300000 * (153.4 / 133.8)));
    expect(f!.veraenderungProzent).toBeCloseTo(14.6, 1);
  });
});
