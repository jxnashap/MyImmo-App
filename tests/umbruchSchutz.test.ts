import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { schuetzeUmbrueche } from "@/lib/umbruchSchutz";

// Design-Scan 06.10.2026: Am Handy rutschten Einheiten allein in die nächste Zeile
// („240“ / „€ oder …“, „(§“ / „25 TDDDG)“) und „50–70-%-Regel“ brach am Bindestrich.
describe("schuetzeUmbrueche", () => {
  const NB = " ";
  it("verbindet Zahl und Einheit", () => {
    expect(schuetzeUmbrueche("240 € oder 400 €")).toBe(`240${NB}€ oder 400${NB}€`);
    expect(schuetzeUmbrueche("70 % von 4.800 €")).toBe(`70${NB}% von 4.800${NB}€`);
    expect(schuetzeUmbrueche("nach 4 Wochen")).toBe(`nach 4${NB}Wochen`);
  });
  it("lässt Wörter, die nur mit der Einheit beginnen, in Ruhe", () => {
    expect(schuetzeUmbrueche("bis 2026 Jahresende")).toBe("bis 2026 Jahresende");
  });
  it("verbindet Paragraf, Artikel und Absatz mit der Zahl", () => {
    expect(schuetzeUmbrueche("(§ 25 TDDDG), Art. 6 Abs. 1 Nr. 2")).toBe(`(§${NB}25 TDDDG), Art.${NB}6 Abs.${NB}1 Nr.${NB}2`);
  });
  it("hält „Anlage V“ und „50–70-%-Regel“ zusammen", () => {
    expect(schuetzeUmbrueche("die Anlage V")).toBe(`die Anlage${NB}V`);
    const r = schuetzeUmbrueche("die 50–70-%-Regel");
    expect(r).not.toMatch(/-%-/);
    expect(r).toContain("‑%‑Regel");
    expect(r).toContain("50⁠–⁠70");
  });
  it("ändert den Wortlaut nicht (nur Leer- und Trennzeichen)", () => {
    const s = "Seit dem 01.01.2025: 909,60 € nach § 556 Abs. 3 BGB, Anlage V, 50–70-%-Regel.";
    const normal = (t: string) => t.replace(/[ ]/g, " ").replace(/‑/g, "-").replace(/⁠/g, "");
    expect(normal(schuetzeUmbrueche(s))).toBe(s);
  });
});

describe("Rechtsseiten: keine halb geraden Anführungszeichen", () => {
  // Der Lint-Umbau vom 03.10.2026 schrieb „…&quot; — öffnend deutsch, schließend gerade.
  for (const p of ["app/(pub)/datenschutz/page.tsx", "app/(pub)/agb/page.tsx"]) {
    it(p, () => {
      expect(readFileSync(p, "utf8")).not.toMatch(/„[^“"]*&quot;/);
    });
  }
});
