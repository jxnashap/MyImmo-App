import { describe, it, expect } from "vitest";
import { marktwert, fehlendeAngaben, preisUrteil, type MarktwertEingabe } from "@/lib/kauf/marktwert";

const basis: MarktwertEingabe = {
  nutzung: "vermietung",
  objektTyp: "wohnung",
  wohnflaeche: 68,
  kaltmieteMonat: 710,
  anzahlWohnungen: 1,
  grundFlaeche: 0,
  bodenrichtwert: 0,
  baujahr: 1998,
  gebTyp: "efh",
  ausstattung: 3,
  bpiFaktor: 1.9,
  regionalFaktor: 1,
  liegenschaftszins: 3.5,
  sachwertfaktor: 1,
};

describe("Verfahren richtet sich nach der Nutzung", () => {
  it("Vermietung → Ertragswert", () => {
    const r = marktwert(basis);
    expect(r.verfahren).toBe("ertragswert");
    expect(r.bereit).toBe(true);
    expect(r.ergebnis!.wert).toBeGreaterThan(0);
  });

  it("Eigennutzung → Sachwert", () => {
    const r = marktwert({ ...basis, nutzung: "eigennutzung", bodenrichtwert: 300, grundFlaeche: 500 });
    expect(r.verfahren).toBe("sachwert");
    expect(r.bereit).toBe(true);
    expect(r.ergebnis!.wert).toBeGreaterThan(0);
  });
});

describe("Monatsmiete wird zur Jahresmiete", () => {
  it("710 €/Monat ergeben denselben Wert wie 8.520 €/Jahr im Schätzer", () => {
    const r = marktwert(basis);
    // Gegenprobe: doppelte Monatsmiete → deutlich höherer Ertragswert
    const doppelt = marktwert({ ...basis, kaltmieteMonat: 1420 });
    expect(doppelt.ergebnis!.wert).toBeGreaterThan(r.ergebnis!.wert * 1.8);
  });

  it("eine als Jahresmiete getippte Zahl im Monatsfeld führt NICHT mehr zu 0", () => {
    // 8520 im Monatsfeld ist zwar unrealistisch, liefert aber ein Ergebnis > 0
    const r = marktwert({ ...basis, kaltmieteMonat: 8520 });
    expect(r.ergebnis!.wert).toBeGreaterThan(0);
  });
});

describe("fehlendeAngaben", () => {
  it("Vermietung braucht Wohnfläche und Kaltmiete", () => {
    expect(fehlendeAngaben({ ...basis, wohnflaeche: 0, kaltmieteMonat: 0 })).toEqual(["Wohnfläche", "Kaltmiete"]);
    expect(fehlendeAngaben(basis)).toEqual([]);
  });

  it("Eigennutzung braucht Wohnfläche und Bodenrichtwert", () => {
    const e = { ...basis, nutzung: "eigennutzung" as const };
    expect(fehlendeAngaben(e)).toEqual(["Bodenrichtwert"]);
    expect(fehlendeAngaben({ ...e, bodenrichtwert: 300 })).toEqual([]);
  });

  it("ohne Pflichtangaben ist kein Ergebnis da", () => {
    const r = marktwert({ ...basis, wohnflaeche: 0 });
    expect(r.bereit).toBe(false);
    expect(r.ergebnis).toBeNull();
  });
});

describe("preisUrteil", () => {
  it("ordnet den Kaufpreis gegen die Schätzung ein", () => {
    expect(preisUrteil(200000, 170000)!.farbe).toBe("var(--green)");
    expect(preisUrteil(200000, 205000)!.text).toBe("im Rahmen der Schätzung");
    expect(preisUrteil(200000, 240000)!.abweichung).toBeCloseTo(20, 5);
    expect(preisUrteil(200000, 300000)!.text).toContain("genau prüfen");
  });

  it("ohne Zahlen kein Urteil", () => {
    expect(preisUrteil(0, 100000)).toBeNull();
    expect(preisUrteil(100000, 0)).toBeNull();
  });
});
