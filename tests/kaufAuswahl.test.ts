import { describe, it, expect } from "vitest";
import { objektPunkte, bestesObjekt, type VglObjekt, type VglMetrik } from "@/lib/kauf/auswahl";

const METRIKEN: VglMetrik[] = [
  { key: "kp", better: "low" },
  { key: "cfNetto", better: "high" },
  { key: "ekRendite", better: "high" },
  { key: "eigenkapital", better: "none" },
];

describe("objektPunkte / bestesObjekt", () => {
  it("vergibt Punkte je gewonnener Kennzahl, none zählt nicht", () => {
    const objekte: VglObjekt[] = [
      { id: "a", summary: { kp: 200000, cfNetto: 50, ekRendite: 8, eigenkapital: 40000 } },
      { id: "b", summary: { kp: 250000, cfNetto: 120, ekRendite: 12, eigenkapital: 60000 } },
    ];
    const p = objektPunkte(objekte, METRIKEN);
    expect(p.a).toBe(1); // günstigster Kaufpreis
    expect(p.b).toBe(2); // bester Cashflow + EK-Rendite
    const best = bestesObjekt(objekte, METRIKEN);
    expect(best.id).toBe("b");
    expect(best.eindeutig).toBe(true);
  });

  it("erkennt Gleichstand", () => {
    const objekte: VglObjekt[] = [
      { id: "a", summary: { kp: 200000, cfNetto: 120, ekRendite: 8 } }, // 1 (kp) + ... cfNetto b, ekRendite a
      { id: "b", summary: { kp: 250000, cfNetto: 150, ekRendite: 8 } },
    ];
    // a: kp(low) gewinnt → 1; ekRendite gleich → kein Punkt; cfNetto b → 0 ⇒ a=1
    // b: cfNetto(high) → 1 ⇒ b=1  → Gleichstand
    const best = bestesObjekt(objekte, METRIKEN);
    expect(best.eindeutig).toBe(false);
  });

  it("einzelnes Objekt bekommt keine Punkte", () => {
    const objekte: VglObjekt[] = [{ id: "a", summary: { kp: 200000, cfNetto: 50 } }];
    const p = objektPunkte(objekte, METRIKEN);
    expect(p.a).toBe(0);
  });

  it("ignoriert fehlende Kennzahlen", () => {
    const objekte: VglObjekt[] = [
      { id: "a", summary: { kp: 200000 } },
      { id: "b", summary: { cfNetto: 100 } },
    ];
    const p = objektPunkte(objekte, METRIKEN);
    // je Kennzahl nur ein Wert vorhanden → kein Vergleich möglich
    expect(p.a).toBe(0);
    expect(p.b).toBe(0);
  });
});
