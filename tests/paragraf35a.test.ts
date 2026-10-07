import { describe, it, expect } from "vitest";
import { berechneNk, type NkRawPosition, type NkTenant } from "@/lib/nk";


describe("berechneNk: § 35a-Ausweis aggregieren", () => {
  const tenant: NkTenant = {
    vorname: "Max", nachname: "M", mieter_adresse: null, einheit: null,
    flaeche: 60, mietbeginn: "2024-01-01", mietende: null, nk_vorauszahlung: 0,
  };
  const pos = (bezeichnung: string, betrag: number, lohnanteil: number, art_35a: string): NkRawPosition => ({
    bezeichnung, betrag, umlageschluessel: "Fläche", umlagefaehig: true, jahr: 2024, lohnanteil, art_35a,
  });

  it("summiert nach haushaltsnah und Handwerker", () => {
    const positionen = [
      pos("Hausmeister", 360, 200, "haushaltsnah"),
      pos("Gartenpflege", 120, 90, "haushaltsnah"),
      pos("Aufzugswartung", 200, 80, "handwerker"),
      pos("Grundsteuer", 300, 0, ""), // kein Lohn
    ];
    const a = berechneNk(2024, tenant, null, positionen);
    expect(a.paragraf35a).not.toBeNull();
    expect(a.paragraf35a!.haushaltsnah).toBe(290);
    expect(a.paragraf35a!.handwerker).toBe(80);
    expect(a.paragraf35a!.positionen).toHaveLength(3);
  });

  it("liefert null, wenn keine Lohnanteile erfasst sind", () => {
    const a = berechneNk(2024, tenant, null, [pos("Grundsteuer", 300, 0, "")]);
    expect(a.paragraf35a).toBeNull();
  });

  it("skaliert den Lohnanteil bei zeitanteiliger Position", () => {
    // Mieter nur ein halbes Jahr da → zeit-Position halbiert Betrag und Lohn.
    const halbjahr: NkTenant = { ...tenant, mietbeginn: "2024-01-01", mietende: "2024-06-30" };
    const p: NkRawPosition = {
      bezeichnung: "Hausmeister", betrag: 1200, umlageschluessel: "Fläche", umlagefaehig: true,
      jahr: 2024, aufteilung: "zeit", lohnanteil: 600, art_35a: "haushaltsnah",
    };
    const a = berechneNk(2024, halbjahr, null, [p]);
    // 182/366 Tage ≈ 0,497 → Lohn ~298
    expect(a.paragraf35a!.haushaltsnah).toBeGreaterThan(290);
    expect(a.paragraf35a!.haushaltsnah).toBeLessThan(305);
  });
});
