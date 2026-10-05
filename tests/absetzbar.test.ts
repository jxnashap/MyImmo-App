import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { ABSETZBAR_TITEL, ABSETZBAR_VORBEHALT, absetzbarText, nettoNachSteuer, preisAusText } from "@/lib/absetzbar";
import { PLAENE } from "@/components/landing/data";

// „Als Werbungskosten absetzbar" (05.10.2026). Der Betreiber wollte „quasi
// kostenlos" — abgelehnt, weil falsch (gespart wird der Grenzsteuersatz, nicht
// der Betrag) und irreführend (§ 5 UWG). Dieser Test hält beides fest.

describe("Rechnung", () => {
  it("liest Preise aus der Tariftabelle", () => {
    expect(preisAusText("7,99 €")).toBe(7.99);
    expect(preisAusText("0 €")).toBe(0);
    expect(preisAusText("auf Anfrage")).toBeNull();
  });
  it("netto = brutto × (1 − Grenzsteuersatz), auf Cent", () => {
    expect(nettoNachSteuer(7.99, 0.3)).toBe(5.59);
    expect(nettoNachSteuer(7.99, 0.42)).toBe(4.63);
  });
});

describe("Wortlaut", () => {
  const alles = [ABSETZBAR_TITEL, ABSETZBAR_VORBEHALT, ...absetzbarText("MyImmo Privat", 7.99)].join(" ");

  it("verspricht nie „kostenlos“ oder „gratis“", () => {
    expect(alles).not.toMatch(/kostenlos|gratis|umsonst|kostet dich nichts/i);
  });
  it("nennt die Grenze nach unten und den Vorbehalt", () => {
    expect(alles).toContain("Grundfreibetrag");
    expect(alles).toContain("keine Steuerberatung");
    expect(alles).toContain("5,59 €");
  });
  it("rechnet mit dem hervorgehobenen Tarif der Preistabelle", () => {
    const tarif = PLAENE.find((p) => p.highlight)!;
    expect(preisAusText(tarif.preis)).not.toBeNull();
  });
  it("steht nur bei sichtbaren Preisen (im PREISE_SICHTBAR-Zweig)", () => {
    for (const p of ["app/(pub)/preise/page.tsx", "components/LandingPage.tsx"]) {
      const s = readFileSync(p, "utf8");
      const i = s.indexOf("<AbsetzbarHinweis />");
      expect(i, p).toBeGreaterThan(-1);
      // Der Hinweis steht vor dem ") : (" des Schalters, also im sichtbaren Zweig.
      const schalter = s.lastIndexOf("PREISE_SICHTBAR ? (", i);
      const sonst = s.indexOf(") : (", schalter);
      expect(schalter, p).toBeGreaterThan(-1);
      expect(i, p).toBeLessThan(sonst);
    }
  });
});
