import { describe, it, expect } from "vitest";
import { sortiereObjekte, SORT_OPTIONEN, type SortObjekt } from "@/lib/objektSortierung";

const o = (bezeichnung: string, extra: Partial<SortObjekt> = {}): SortObjekt => ({ bezeichnung, ...extra });

describe("sortiereObjekte", () => {
  it("Standard ist Name A–Z (auch bei unbekanntem Wert)", () => {
    const l = [o("Zeppelinweg 3"), o("Ahornallee 1"), o("Marktstraße 9")];
    expect(sortiereObjekte(l).map((x) => x.bezeichnung)).toEqual(["Ahornallee 1", "Marktstraße 9", "Zeppelinweg 3"]);
    expect(sortiereObjekte(l, "quatsch").map((x) => x.bezeichnung)).toEqual(["Ahornallee 1", "Marktstraße 9", "Zeppelinweg 3"]);
  });

  it("Name Z–A dreht um", () => {
    const l = [o("Ahorn"), o("Zeppelin")];
    expect(sortiereObjekte(l, "name_desc").map((x) => x.bezeichnung)).toEqual(["Zeppelin", "Ahorn"]);
  });

  it("sortiert natürlich: Haus 2 vor Haus 10", () => {
    const l = [o("Haus 10"), o("Haus 2")];
    expect(sortiereObjekte(l, "name").map((x) => x.bezeichnung)).toEqual(["Haus 2", "Haus 10"]);
  });

  it("Wert absteigend, Kaufpreis als Ersatzwert", () => {
    const l = [o("A", { wert: 100000 }), o("B", { kaufpreis: 300000 }), o("C", { wert: 200000 })];
    expect(sortiereObjekte(l, "wert_desc").map((x) => x.bezeichnung)).toEqual(["B", "C", "A"]);
    expect(sortiereObjekte(l, "wert").map((x) => x.bezeichnung)).toEqual(["A", "C", "B"]);
  });

  it("Objekte ohne Angabe stehen hinten — auch bei aufsteigender Sortierung", () => {
    const l = [o("Ohne"), o("Mit", { miete: 700 })];
    expect(sortiereObjekte(l, "miete").map((x) => x.bezeichnung)).toEqual(["Mit", "Ohne"]);
    expect(sortiereObjekte(l, "miete_desc").map((x) => x.bezeichnung)).toEqual(["Mit", "Ohne"]);
  });

  it("Rendite aus Miete und Wert", () => {
    const l = [
      o("Schwach", { wert: 300000, miete: 700 }), // 2,8 %
      o("Stark", { wert: 150000, miete: 700 }), // 5,6 %
    ];
    expect(sortiereObjekte(l, "rendite_desc").map((x) => x.bezeichnung)).toEqual(["Stark", "Schwach"]);
  });

  it("Baujahr in beide Richtungen", () => {
    const l = [o("Alt", { baujahr: 1912 }), o("Neu", { baujahr: 2019 })];
    expect(sortiereObjekte(l, "baujahr_desc").map((x) => x.bezeichnung)).toEqual(["Neu", "Alt"]);
    expect(sortiereObjekte(l, "baujahr").map((x) => x.bezeichnung)).toEqual(["Alt", "Neu"]);
  });

  it("gleicher Wert → Name entscheidet", () => {
    const l = [o("Zeta", { wert: 100 }), o("Alpha", { wert: 100 })];
    expect(sortiereObjekte(l, "wert_desc").map((x) => x.bezeichnung)).toEqual(["Alpha", "Zeta"]);
  });

  it("verändert die Ursprungsliste nicht", () => {
    const l = [o("B"), o("A")];
    sortiereObjekte(l, "name");
    expect(l.map((x) => x.bezeichnung)).toEqual(["B", "A"]);
  });

  it("jede angebotene Option ist auch umgesetzt", () => {
    const l = [o("B", { wert: 2, miete: 2, flaeche: 2, baujahr: 2000, typ: "B" }), o("A", { wert: 1, miete: 1, flaeche: 1, baujahr: 1990, typ: "A" })];
    for (const opt of SORT_OPTIONEN) {
      expect(sortiereObjekte(l, opt.value)).toHaveLength(2);
    }
  });
});
