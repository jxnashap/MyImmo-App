// Schulden-Uhr (lib/schuldenStand.ts): Summe offen, abbezahlt, Tilgung je Monat.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { schuldenStand } from "@/lib/schuldenStand";

const k = (betrag: number | null, restschuld: number | null, monatsrate: number | null = null, zinssatz: number | null = null) =>
  ({ betrag, restschuld, monatsrate, zinssatz });

describe("schuldenStand", () => {
  it("summiert offen, ursprünglich und abbezahlt", () => {
    const s = schuldenStand([k(200000, 178000), k(214000, 198000)]);
    expect(s.offen).toBe(376000);
    expect(s.ursprung).toBe(414000);
    expect(s.getilgt).toBe(38000);
    expect(s.prozent).toBe(9.2); // 38.000 / 414.000 = 9,18 %
    expect(s.anzahl).toBe(2);
  });

  it("Tilgung je Monat = Rate minus Zinsanteil der Restschuld", () => {
    // 120.000 × 3 % / 12 = 300 Zins → 800 − 300 = 500 Tilgung
    expect(schuldenStand([k(150000, 120000, 800, 3)]).tilgungMonat).toBe(500);
  });

  it("fehlender Ursprungsbetrag zählt als „nichts getilgt“, nicht als 100 %", () => {
    const s = schuldenStand([k(null, 50000)]);
    expect(s.ursprung).toBe(50000);
    expect(s.getilgt).toBe(0);
    expect(s.prozent).toBe(0);
  });

  it("Restschuld über dem Ursprung (Nachfinanzierung) ergibt kein negatives Getilgt", () => {
    const s = schuldenStand([k(100000, 110000)]);
    expect(s.getilgt).toBe(0);
    expect(s.ursprung).toBe(110000);
  });

  it("Rate kleiner als Zinsen → keine negative Tilgung", () => {
    expect(schuldenStand([k(100000, 100000, 100, 5)]).tilgungMonat).toBe(0);
  });

  it("keine Kredite → alles 0, Prozent unbekannt", () => {
    expect(schuldenStand([])).toEqual({ offen: 0, ursprung: 0, getilgt: 0, prozent: null, tilgungMonat: 0, anzahl: 0 });
  });
});

describe("Schulden-Uhr steht über den Krediten — auf /kredite und im Dashboard", () => {
  it("/kredite zeigt sie statt der vier Kacheln", () => {
    const q = readFileSync("app/(app)/kredite/page.tsx", "utf8");
    expect(q).toContain("<SchuldenUhr");
    expect(q).toContain("stand={schuldenStand(list)}");
    expect(q).not.toContain('className="staffel grid-4 mb-20"');
  });
  it("das Dashboard zeigt sie im Kredit-Block, vor den Darlehen", () => {
    const q = readFileSync("app/(app)/page.tsx", "utf8");
    const uhr = q.indexOf("<SchuldenUhr stand={schuldenStand(kredite)} />");
    const zeilen = q.indexOf("kredite.slice(0, 3).map");
    expect(uhr).toBeGreaterThan(0);
    expect(uhr).toBeLessThan(zeilen);
  });
});
