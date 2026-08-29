import { describe, it, expect } from "vitest";
import { berechneRestschuld, berechneVolltilgungJahr } from "@/lib/kalk";

// Geschlossene Annuitätenformel als unabhängige Referenz:
//   RS(n) = K·(1+i)^n − R·((1+i)^n − 1)/i,  i = Monatszins, n = Monate
function restschuldFormel(K: number, zinsPa: number, R: number, jahre: number): number {
  const i = zinsPa / 12;
  const n = jahre * 12;
  const q = Math.pow(1 + i, n);
  return Math.max(0, K * q - (R * (q - 1)) / i);
}

// Regressionstests zur monatlichen Tilgung. Vorher wurde ein volles Jahr Zinsen
// auf den Jahresanfangsstand gerechnet, obwohl unterjährig 12 Raten fließen —
// die ausgewiesene Restschuld war dadurch systematisch zu hoch (bei 250.000 € /
// 4 % / 2 % nach 20 Jahren 101.110 € statt 97.177 €, rund 4 %).
describe("berechneRestschuld", () => {
  const K = 250000, z = 0.04, R = (K * (0.04 + 0.02)) / 12; // 1.250 €/Monat

  it("stimmt auf den Cent mit der Annuitätenformel überein", () => {
    for (const jahre of [1, 5, 10, 15, 20, 30]) {
      expect(berechneRestschuld(K, z, R, jahre)).toBeCloseTo(restschuldFormel(K, z, R, jahre), 2);
    }
  });

  it("liegt unter der früheren jährlichen Näherung", () => {
    // Die alte Rechnung ergab nach 20 Jahren 101.109,61 €.
    expect(berechneRestschuld(K, z, R, 20)).toBeLessThan(101109);
    expect(berechneRestschuld(K, z, R, 20)).toBeCloseTo(97177.24, 1);
  });

  it("wird nie negativ und endet bei 0", () => {
    expect(berechneRestschuld(K, z, R, 40)).toBe(0);
    expect(berechneRestschuld(K, z, R, 100)).toBe(0);
  });

  it("tilgt nicht, wenn die Rate die Zinsen nicht deckt", () => {
    // 250.000 € bei 4 % kosten ~833 €/Monat allein an Zinsen
    expect(berechneRestschuld(K, z, 500, 10)).toBe(K);
  });

  it("behandelt Randfälle ohne NaN", () => {
    expect(berechneRestschuld(0, z, R, 10)).toBe(0);
    expect(berechneRestschuld(K, 0, R, 10)).toBeCloseTo(K - R * 120, 2); // zinslos
    expect(berechneRestschuld(K, z, R, 0)).toBe(K);
  });
});

describe("berechneVolltilgungJahr", () => {
  const K = 250000, z = 0.04, R = (K * (0.04 + 0.02)) / 12;

  it("liefert das Jahr der letzten Rate", () => {
    expect(berechneVolltilgungJahr(K, z, R, 2026)).toBe(2054);
  });

  it("liefert 0, wenn die Rate die Zinsen nicht deckt (UI zeigt dann > 60 J.)", () => {
    expect(berechneVolltilgungJahr(K, z, 500, 2026)).toBe(0);
  });

  it("liefert 0 ohne Darlehen oder ohne Rate", () => {
    expect(berechneVolltilgungJahr(0, z, R, 2026)).toBe(0);
    expect(berechneVolltilgungJahr(K, z, 0, 2026)).toBe(0);
  });

  it("passt zur Restschuld: im Volltilgungsjahr ist sie 0, ein Jahr davor nicht", () => {
    const jahr = berechneVolltilgungJahr(K, z, R, 2026);
    const laufzeit = jahr - 2026;
    expect(berechneRestschuld(K, z, R, laufzeit)).toBe(0);
    expect(berechneRestschuld(K, z, R, laufzeit - 1)).toBeGreaterThan(0);
  });
});
