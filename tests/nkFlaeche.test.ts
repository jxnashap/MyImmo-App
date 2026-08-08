import { describe, it, expect } from "vitest";
import { berechneNk, type NkTenant, type NkRawPosition } from "@/lib/nk";

// Flächen-Aufteilung (§ 556a Abs. 1 BGB): Gebäude-Gesamtkosten × Mieterfläche
// ÷ Gesamtfläche. Referenz ist das Rechenbeispiel aus dem Ratgeber-Artikel
// „Nebenkostenabrechnung erstellen": 6.400 € kalte Betriebskosten, Wohnung
// 80 von 400 m² → 1.280,00 €.

const mieter: NkTenant = {
  vorname: "Test",
  nachname: "Mieter",
  mieter_adresse: null,
  einheit: null,
  flaeche: 80,
  mietbeginn: "2020-01-01",
  mietende: null,
  nk_vorauszahlung: 200,
};

const flaechenPos = (over: Partial<NkRawPosition> = {}): NkRawPosition => ({
  bezeichnung: "Kalte Betriebskosten",
  betrag: 6400,
  umlageschluessel: "Fläche",
  umlagefaehig: true,
  jahr: 2025,
  aufteilung: "flaeche",
  flaeche_gesamt: 400,
  ...over,
});

describe("NK-Aufteilung nach Fläche", () => {
  it("rechnet das Ratgeber-Beispiel: 6.400 € × 80/400 m² = 1.280 €", () => {
    const a = berechneNk(2025, mieter, null, [flaechenPos()]);
    expect(a.positionen).toHaveLength(1);
    const p = a.positionen[0];
    expect(p.betrag).toBe(1280);
    // Die BGH-Pflichtangaben brauchen Gesamtkosten und Rechenweg in der Zeile.
    expect(p.basis).toBe(6400);
    expect(p.faktorText).toBe("80/400 m²");
  });

  it("kürzt bei unterjähriger Belegung zusätzlich tagegenau", () => {
    // Einzug 2.7.2025 → 183 von 365 Tagen. Beide Faktoren müssen im
    // Rechenweg stehen, sonst ist die Anteilsberechnung nicht nachvollziehbar.
    const a = berechneNk(
      2025,
      { ...mieter, mietbeginn: "2025-07-02" },
      null,
      [flaechenPos()],
    );
    const p = a.positionen[0];
    expect(p.betrag).toBeCloseTo(6400 * (80 / 400) * (183 / 365), 2);
    expect(p.faktorText).toContain("80/400 m²");
    expect(p.faktorText).toContain("183/365 Tage");
  });

  it("fällt ohne Gesamtfläche sichtbar auf zeitanteilig zurück statt still falsch zu rechnen", () => {
    const a = berechneNk(2025, mieter, null, [flaechenPos({ flaeche_gesamt: null })]);
    const p = a.positionen[0];
    // Ganzjahresbelegung: Fallback = voller Betrag, aber der Hinweis steht dran —
    // der Vermieter sieht VOR dem Verschicken, dass die Fläche fehlt.
    expect(p.betrag).toBe(6400);
    expect(p.faktorText).toContain("Flächenangaben fehlen");
  });

  it("fällt ohne Mieterfläche ebenfalls sichtbar zurück", () => {
    const a = berechneNk(2025, { ...mieter, flaeche: null }, null, [flaechenPos()]);
    expect(a.positionen[0].faktorText).toContain("Flächenangaben fehlen");
  });

  it("skaliert den § 35a-Lohnanteil im selben Verhältnis wie den Betrag", () => {
    // Hausmeister: 2.000 € Gesamtkosten, davon 1.500 € Lohn. Mieteranteil
    // 80/400 = 20 % → absetzbarer Lohnanteil 300 €, nicht 1.500 €.
    const a = berechneNk(2025, mieter, null, [
      flaechenPos({ bezeichnung: "Hausmeister", betrag: 2000, lohnanteil: 1500, art_35a: "haushaltsnah" }),
    ]);
    const p = a.positionen[0];
    expect(p.betrag).toBe(400);
    expect(p.lohnanteil).toBe(300);
  });

  it("Summe mehrerer Wohnungen ergibt genau die Gesamtkosten", () => {
    // 400 m² auf 80 + 120 + 200 verteilt: Rundungsfehler dürfen sich nicht
    // zu einem Cent-Überschuss addieren, der niemandem gehört.
    const anteile = [80, 120, 200].map((qm) => {
      const a = berechneNk(2025, { ...mieter, flaeche: qm }, null, [flaechenPos()]);
      return a.positionen[0].betrag;
    });
    const summe = anteile.reduce((s, x) => s + x, 0);
    expect(summe).toBeCloseTo(6400, 2);
  });
});
