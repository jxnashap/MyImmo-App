import { describe, it, expect } from "vitest";
import { hkvoAnteil, berechneNk, type NkRawPosition, type NkTenant } from "@/lib/nk";

describe("hkvoAnteil (§ 7 HeizkostenV)", () => {
  it("teilt in Grundkosten (Fläche) und Verbrauchskosten (Zähler)", () => {
    // 2.000 € gesamt, 50 % Grund. Mieter 60/100 m², Verbrauch 700/1000.
    const r = hkvoAnteil({
      gesamtkosten: 2000, grundkostenProzent: 50,
      flaecheMieter: 60, flaecheGesamt: 100, verbrauchMieter: 700, verbrauchGesamt: 1000,
    });
    // Grundtopf 1000 × 0,6 = 600; Verbrauchstopf 1000 × 0,7 = 700
    expect(r.grundkosten).toBe(600);
    expect(r.verbrauchskosten).toBe(700);
    expect(r.gesamt).toBe(1300);
  });

  it("begrenzt den Grundkosten-Anteil auf 30–50 %", () => {
    expect(hkvoAnteil({ gesamtkosten: 1000, grundkostenProzent: 10, flaecheMieter: 50, flaecheGesamt: 100, verbrauchMieter: 50, verbrauchGesamt: 100 }).grundProzent).toBe(30);
    expect(hkvoAnteil({ gesamtkosten: 1000, grundkostenProzent: 70, flaecheMieter: 50, flaecheGesamt: 100, verbrauchMieter: 50, verbrauchGesamt: 100 }).grundProzent).toBe(50);
  });

  it("liefert 0 für fehlende Bezugsgrößen", () => {
    const r = hkvoAnteil({ gesamtkosten: 1000, grundkostenProzent: 50, flaecheMieter: 50, flaecheGesamt: 0, verbrauchMieter: 50, verbrauchGesamt: 0 });
    expect(r.gesamt).toBe(0);
  });
});

describe("berechneNk mit aufteilung 'hkvo'", () => {
  const tenant: NkTenant = {
    vorname: "A", nachname: "B", mieter_adresse: null, einheit: null,
    flaeche: 60, mietbeginn: "2024-01-01", mietende: null, nk_vorauszahlung: 0,
  };
  const pos = (over: Partial<NkRawPosition>): NkRawPosition => ({
    bezeichnung: "Heizung", betrag: 2000, umlageschluessel: "HKVO", umlagefaehig: true, jahr: 2024,
    aufteilung: "hkvo", grundkosten_prozent: 50, flaeche_gesamt: 100,
    verbrauch_mieter: 700, verbrauch_gesamt: 1000, ...over,
  });

  it("berechnet den HKVO-Anteil des Mieters", () => {
    const a = berechneNk(2024, tenant, null, [pos({})]);
    expect(a.positionen[0].betrag).toBe(1300);
    expect(a.positionen[0].faktorText).toContain("§ 7 HeizkostenV");
  });

  it("fällt bei fehlenden HKVO-Daten auf tagegenau zurück (kein Absturz)", () => {
    const a = berechneNk(2024, tenant, null, [pos({ flaeche_gesamt: null, verbrauch_gesamt: null })]);
    expect(a.positionen[0].betrag).toBe(2000); // ganzjährig → voller Betrag
    expect(a.positionen[0].faktorText).toContain("HKVO-Daten fehlen");
  });
});
