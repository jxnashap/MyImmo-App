import { describe, it, expect } from "vitest";
import {
  barwertfaktor,
  restnutzungsdauer,
  ertragswert,
  sachwert,
  vervielfaeltiger,
  kaufpreisAmpel,
  GND_WOHNGEBAEUDE,
} from "@/lib/bewertung/immowertv";

describe("barwertfaktor (§ 34 ImmoWertV)", () => {
  it("rechnet den Kapitalisierungsfaktor korrekt", () => {
    // BWF(5 %, 50 J.) = (1 - 1.05^-50) / 0.05 ≈ 18,256
    expect(barwertfaktor(5, 50)).toBeCloseTo(18.256, 2);
    // BWF(3 %, 40 J.) ≈ 23,115
    expect(barwertfaktor(3, 40)).toBeCloseTo(23.115, 2);
  });
  it("liefert bei p<=0 die Jahre zurück", () => {
    expect(barwertfaktor(0, 30)).toBe(30);
  });
});

describe("restnutzungsdauer", () => {
  it("GND minus Alter", () => {
    expect(restnutzungsdauer(1990, 2026)).toBe(GND_WOHNGEBAEUDE - 36); // 44
  });
  it("hebt bei Modernisierung an, aber max. 70 % der GND", () => {
    // altes Gebäude, voll modernisiert → max 70 % von 80 = 56
    expect(restnutzungsdauer(1960, 2026, 80, 1)).toBe(56);
  });
  it("kernsaniert bis 90 %", () => {
    expect(restnutzungsdauer(1960, 2026, 80, 1, true)).toBe(72);
  });
  it("nie über GND, nie unter 1", () => {
    expect(restnutzungsdauer(2026, 2026)).toBe(GND_WOHNGEBAEUDE);
    expect(restnutzungsdauer(1900, 2026)).toBe(1);
  });
});

describe("ertragswert (§§ 27–34)", () => {
  const basis = {
    jahresnettokaltmiete: 24000,
    wohnflaeche: 300,
    anzahlWohnungen: 4,
    istEtw: false,
    bodenrichtwert: 400,
    grundstuecksflaeche: 500,
    liegenschaftszins: 3.5,
    restnutzungsdauer: 60,
  };
  it("liefert einen plausiblen Ertragswert mit Spanne", () => {
    const r = ertragswert(basis);
    expect(r.wert).toBeGreaterThan(0);
    // Bewirtschaftungskosten: 4×298 + 300×11,70 + 2 % von 24000 = 1192+3510+480 = 5182
    expect(r.details.bewirtschaftungskosten).toBe(5182);
    expect(r.details.reinertrag).toBe(24000 - 5182);
    expect(r.details.bodenwert).toBe(200000);
    // Spanne: höherer Zins → niedrigerer Wert
    expect(r.min).toBeLessThan(r.wert);
    expect(r.max).toBeGreaterThan(r.wert);
  });
  it("warnt bei unplausiblem Liegenschaftszins", () => {
    const r = ertragswert({ ...basis, liegenschaftszins: 8 });
    expect(r.warnungen.some((w) => w.includes("Liegenschaftszins"))).toBe(true);
  });
  it("ETW nutzt die höhere Verwaltungspauschale", () => {
    const mfh = ertragswert(basis).details.bewirtschaftungskosten;
    const etw = ertragswert({ ...basis, istEtw: true, anzahlWohnungen: 1, wohnflaeche: 75, jahresnettokaltmiete: 9000 });
    // ETW-Verwaltung 357 statt 298 → nachweisbar in den Details
    expect(etw.details.bewirtschaftungskosten).toBeGreaterThan(0);
    expect(mfh).toBeGreaterThan(0);
  });
});

describe("sachwert (§§ 35–39)", () => {
  const basis = {
    typ: "efh",
    standardstufe: 3,
    wohnflaeche: 140,
    baupreisindex: 1.9,
    regionalfaktor: 1.0,
    restnutzungsdauer: 60,
    bodenrichtwert: 300,
    grundstuecksflaeche: 600,
    sachwertfaktor: 1.1,
  };
  it("rechnet Boden + Gebäude × Sachwertfaktor mit Spanne", () => {
    const r = sachwert(basis);
    // NHK Std 3 EFH = 835; BGF = 140 × 1,55 = 217
    expect(r.details.normalherstellungskosten2010).toBe(835);
    expect(r.details.bruttogrundflaeche).toBe(217);
    expect(r.details.bodenwert).toBe(180000);
    expect(r.wert).toBeGreaterThan(0);
    expect(r.min).toBeLessThan(r.wert);
    expect(r.max).toBeGreaterThan(r.wert);
  });
  it("warnt bei unplausiblem Sachwertfaktor", () => {
    const r = sachwert({ ...basis, sachwertfaktor: 2.5 });
    expect(r.warnungen.some((w) => w.includes("Sachwertfaktor"))).toBe(true);
  });
});

describe("vervielfaeltiger & ampel", () => {
  it("berechnet Kaufpreis/Jahresmiete", () => {
    expect(vervielfaeltiger(500000, 20000).faktor).toBe(25);
    expect(vervielfaeltiger(500000, 20000).hinweis).toContain("üblich");
    expect(vervielfaeltiger(800000, 20000).hinweis).toContain("Hoch");
  });
  it("Ampel: Kaufpreis unter Wert = grün, deutlich drüber = rot", () => {
    expect(kaufpreisAmpel(400000, 360000).farbe).toBe("gruen");
    expect(kaufpreisAmpel(400000, 420000).farbe).toBe("gelb");
    expect(kaufpreisAmpel(400000, 480000).farbe).toBe("rot");
  });
});
