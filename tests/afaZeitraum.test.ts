import { describe, it, expect } from "vitest";
import { afaZeitanteil, monatVon } from "@/lib/steuer/afaZeitraum";

// Regressionstests zur AfA-Zeitabgrenzung. Vorher wurde für JEDES ausgewertete
// Jahr die volle Jahres-AfA angesetzt — auch vor der Anschaffung, ohne
// Monatsanteil im Kaufjahr (§ 7 Abs. 1 S. 4 EStG) und ohne Ende nach der
// Nutzungsdauer. Die Zahl ist zum Abtippen in ELSTER gedacht.
describe("afaZeitanteil", () => {
  it("gibt keine AfA für Jahre vor der Anschaffung", () => {
    const z = afaZeitanteil(2024, 2026, 3, 50);
    expect(z.faktor).toBe(0);
    expect(z.hinweis).toMatch(/erst 2026 angeschafft/);
  });

  it("kürzt das Anschaffungsjahr monatsgenau — der Kaufmonat zählt voll", () => {
    // Kauf im November → 2 von 12 Monaten (November + Dezember)
    expect(afaZeitanteil(2025, 2025, 11, 50).faktor).toBeCloseTo(2 / 12, 10);
    // Kauf im Januar → volles Jahr, kein Hinweis
    const jan = afaZeitanteil(2025, 2025, 1, 50);
    expect(jan.faktor).toBe(1);
    expect(jan.hinweis).toBeUndefined();
    // Kauf im Juli → 6/12
    expect(afaZeitanteil(2025, 2025, 7, 50).faktor).toBeCloseTo(0.5, 10);
  });

  it("rechnet Folgejahre voll", () => {
    const z = afaZeitanteil(2026, 2025, 11, 50);
    expect(z.faktor).toBe(1);
    expect(z.index).toBe(1);
  });

  it("beendet die AfA nach Ablauf der Nutzungsdauer", () => {
    // Kauf 01/2000, 50 Jahre → letztes volles Jahr 2049
    expect(afaZeitanteil(2049, 2000, 1, 50).faktor).toBe(1);
    const nach = afaZeitanteil(2050, 2000, 1, 50);
    expect(nach.faktor).toBe(0);
    expect(nach.hinweis).toMatch(/endete 2049/);
  });

  it("schiebt bei unterjährigem Kauf den Rest ins Schlussjahr", () => {
    // Kauf 11/2000: im 1. Jahr nur 2/12 → im Jahr 2050 bleiben 10/12 übrig
    expect(afaZeitanteil(2050, 2000, 11, 50).faktor).toBeCloseTo(10 / 12, 10);
    expect(afaZeitanteil(2051, 2000, 11, 50).faktor).toBe(0);
  });

  it("rechnet ohne Startjahr wie bisher voll (fehlende Stammdaten)", () => {
    const z = afaZeitanteil(2020, null, null, 50);
    expect(z.faktor).toBe(1);
    expect(z.hinweis).toBeUndefined();
  });

  it("rechnet ohne bekannten Monat das ganze Anschaffungsjahr", () => {
    expect(afaZeitanteil(2025, 2025, null, 50).faktor).toBe(1);
  });

  it("kennt für die degressive AfA kein Ende (dauer = null)", () => {
    expect(afaZeitanteil(2099, 2025, 1, null).faktor).toBe(1);
  });
});

describe("monatVon", () => {
  it("liest den Monat aus einem ISO-Datum", () => {
    expect(monatVon("2025-11-14")).toBe(11);
    expect(monatVon("2025-01-01")).toBe(1);
  });
  it("liefert null bei fehlendem oder unbrauchbarem Datum", () => {
    expect(monatVon(null)).toBeNull();
    expect(monatVon("")).toBeNull();
    expect(monatVon("kaputt")).toBeNull();
    expect(monatVon("2025-13-01")).toBeNull();
  });
});
