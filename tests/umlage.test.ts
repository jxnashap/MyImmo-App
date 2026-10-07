import { describe, it, expect } from "vitest";
import { verteileBetrag } from "@/lib/umlage";

const summe = (ns: number[]) => Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100;

describe("verteileBetrag — cent-genaue Verteilung", () => {
  it("verteilt exakt ohne Rest (Summe = Ausgangsbetrag)", () => {
    const a = verteileBetrag(100, [1, 1, 1]);
    expect(summe(a)).toBe(100);
    // 100/3: ein Cent landet bei der ersten Position
    expect(a).toEqual([33.34, 33.33, 33.33]);
  });

  it("verteilt proportional zu Gewichten", () => {
    expect(verteileBetrag(100, [3, 1])).toEqual([75, 25]);
  });

  it("ignoriert negative/0-Gewichte und gibt bei Gesamtgewicht 0 nur Nullen", () => {
    expect(verteileBetrag(100, [0, 0])).toEqual([0, 0]);
    expect(summe(verteileBetrag(99.99, [2, 0, 1]))).toBe(99.99);
  });

  it("krummer Betrag bleibt cent-genau", () => {
    const a = verteileBetrag(33.33, [1, 1, 1]);
    expect(summe(a)).toBe(33.33);
  });
});
