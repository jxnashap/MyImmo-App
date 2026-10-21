import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ANFRAGE_MAX_BYTES, FOTO_ODER_PDF, NUR_FOTO, pruefeAnhaenge } from "@/lib/anhaenge";

// Anhänge im Mieterportal (21.10.2026). Gemessen: Vercel weist Anfragen über 4,5 MB mit 413 ab.
const MBb = 1024 * 1024;
const d = (name: string, size: number, type = "image/jpeg") => ({ name, size, type });

describe("pruefeAnhaenge()", () => {
  it("die Grenze liegt unter Vercels 4,5 MB je Anfrage", () => {
    expect(ANFRAGE_MAX_BYTES).toBeLessThan(4.5 * 1000 * 1000);
  });

  it("verkleinerte Fotos gehen durch", () => {
    expect(pruefeAnhaenge([d("a.jpg", 600 * 1024), d("b.jpg", 700 * 1024), d("c.pdf", 1 * MBb, "application/pdf")], { maxAnzahl: 3, erlaubt: FOTO_ODER_PDF })).toBeNull();
  });

  it("die SUMME zählt, nicht nur jede einzelne Datei", () => {
    const f = pruefeAnhaenge([d("a.jpg", 2.5 * MBb), d("b.jpg", 2.5 * MBb)], { maxAnzahl: 3, erlaubt: FOTO_ODER_PDF });
    expect(f).toContain("zusammen");
    expect(f).toContain("höchstens 4 MB");
  });

  it("eine einzelne zu große Datei bekommt einen Rat", () => {
    expect(pruefeAnhaenge([d("scan.pdf", 6 * MBb, "application/pdf")], { maxAnzahl: 3, erlaubt: FOTO_ODER_PDF })).toContain("Bildschirmfoto");
  });

  it("Anzahl und Typ", () => {
    expect(pruefeAnhaenge([d("a", 1), d("b", 1), d("c", 1), d("e", 1)], { maxAnzahl: 3, erlaubt: FOTO_ODER_PDF })).toBe("Höchstens 3 Dateien.");
    expect(pruefeAnhaenge([d("a", 1), d("b", 1)], { maxAnzahl: 1, erlaubt: NUR_FOTO })).toBe("Bitte nur eine Datei anhängen.");
    expect(pruefeAnhaenge([d("x.pdf", 1, "application/pdf")], { maxAnzahl: 1, erlaubt: NUR_FOTO })).toContain("nur Fotos");
    expect(pruefeAnhaenge([d("x.svg", 1, "image/svg+xml")], { maxAnzahl: 3, erlaubt: FOTO_ODER_PDF })).toContain("nur Fotos");
  });
});

describe("Mieter-Formulare senden die verkleinerten Dateien und behalten Eingaben", () => {
  for (const p of ["components/SchadenAssistent.tsx", "components/AnliegenPortal.tsx", "components/ZaehlerPortal.tsx"]) {
    it(p, () => {
      const s = readFileSync(p, "utf8");
      expect(s).toContain("useAnhaenge(");
      expect(s).toMatch(/try \{[\s\S]*?await (erstelleAnliegen|meldeZaehlerstand)\(fd\)/);
      expect(s).not.toMatch(/max\. 3 Dateien à 4 MB/);
    });
  }

  it("Zähler-Ablesedatum ist das Berliner Datum, nicht UTC", () => {
    const s = readFileSync("components/ZaehlerPortal.tsx", "utf8");
    expect(s).toContain("defaultValue={heuteBerlin()}");
    expect(s).not.toContain("toISOString().slice(0, 10)");
  });
});
