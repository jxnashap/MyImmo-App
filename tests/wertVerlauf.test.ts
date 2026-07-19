import { describe, it, expect } from "vitest";
import {
  objektWertReihe,
  portfolioWertReihe,
  veraenderungProzent,
  type ObjektEingabe,
} from "@/lib/wert/verlauf";

const HEUTE = "2026-07-19";

describe("objektWertReihe", () => {
  it("baut Kaufpreis → Historie → aktueller Wert, aufsteigend sortiert", () => {
    const r = objektWertReihe({
      kaufpreis: 200000,
      kaufdatum: "2020-01-15",
      aktuellerWert: 260000,
      standDatum: "2026-06-01",
      historie: [{ datum: "2023-03-10T09:00:00Z", marktwert: 240000 }],
      heute: HEUTE,
    });
    expect(r.map((p) => p.marktwert)).toEqual([200000, 240000, 260000]);
    expect(r.map((p) => p.datum)).toEqual(["2020-01-15", "2023-03-10", "2026-06-01"]);
  });

  it("kürzt Timestamps auf den Tag und dünnt gleiche Folgewerte aus", () => {
    const r = objektWertReihe({
      kaufpreis: 100000,
      kaufdatum: "2021-01-01",
      historie: [
        { datum: "2022-01-01T10:00:00Z", marktwert: 100000 }, // = Kaufpreis → raus
        { datum: "2023-01-01T10:00:00Z", marktwert: 120000 },
      ],
      aktuellerWert: 120000, // = letzter → raus
      standDatum: "2024-01-01",
      heute: HEUTE,
    });
    expect(r).toEqual([
      { datum: "2021-01-01", marktwert: 100000 },
      { datum: "2023-01-01", marktwert: 120000 },
    ]);
  });

  it("höhere Quelle gewinnt am selben Tag (aktuell > Kauf)", () => {
    const r = objektWertReihe({
      kaufpreis: 150000,
      kaufdatum: "2026-07-19",
      aktuellerWert: 170000,
      standDatum: null,
      heute: HEUTE, // gleicher Tag wie Kaufdatum
    });
    expect(r).toEqual([{ datum: "2026-07-19", marktwert: 170000 }]);
  });

  it("ignoriert fehlende/ungültige Werte", () => {
    const r = objektWertReihe({
      kaufpreis: null,
      kaufdatum: "2020-01-01",
      aktuellerWert: 0,
      historie: [{ datum: "2021-01-01", marktwert: null }],
      heute: HEUTE,
    });
    expect(r).toEqual([]);
  });
});

describe("portfolioWertReihe", () => {
  it("summiert je Datum die zuletzt bekannten Objektwerte", () => {
    const objekte: ObjektEingabe[] = [
      { kaufpreis: 100000, kaufdatum: "2020-01-01", aktuellerWert: 130000, standDatum: "2026-01-01", heute: HEUTE },
      { kaufpreis: 200000, kaufdatum: "2022-01-01", aktuellerWert: 220000, standDatum: "2026-01-01", heute: HEUTE },
    ];
    const r = portfolioWertReihe(objekte);
    // 2020: nur Obj1 (100k); 2022: 100k+200k=300k; 2026-01: 130k+220k=350k
    expect(r).toEqual([
      { datum: "2020-01-01", marktwert: 100000 },
      { datum: "2022-01-01", marktwert: 300000 },
      { datum: "2026-01-01", marktwert: 350000 },
    ]);
  });

  it("liefert leere Reihe ohne verwertbare Objekte", () => {
    expect(portfolioWertReihe([{ heute: HEUTE }])).toEqual([]);
  });
});

describe("veraenderungProzent", () => {
  it("rechnet vom ersten zum letzten Punkt", () => {
    expect(veraenderungProzent([
      { datum: "2020-01-01", marktwert: 200000 },
      { datum: "2026-01-01", marktwert: 260000 },
    ])).toBe(30);
  });
  it("null bei zu wenig Punkten", () => {
    expect(veraenderungProzent([{ datum: "2020-01-01", marktwert: 1 }])).toBeNull();
  });
});
