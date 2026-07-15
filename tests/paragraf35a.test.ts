import { describe, it, expect } from "vitest";
import { berechneUmlage, type UmlageZeile, type UmlageMieter } from "@/lib/umlage";
import { berechneNk, type NkRawPosition, type NkTenant } from "@/lib/nk";

describe("Umlage: § 35a-Lohnanteil proportional verteilen", () => {
  const mieter: UmlageMieter[] = [
    { id: "a", name: "A", flaeche: 60 },
    { id: "b", name: "B", flaeche: 40 },
  ];

  it("verteilt den Lohnanteil im selben Verhältnis wie den Betrag", () => {
    const zeilen: UmlageZeile[] = [
      { bezeichnung: "Hausmeister", betrag: 1000, schluessel: "flaeche", lohnanteil: 600, art35a: "haushaltsnah" },
    ];
    const r = berechneUmlage(zeilen, mieter);
    const a = r.perMieter.find((m) => m.id === "a")!.positionen[0];
    const b = r.perMieter.find((m) => m.id === "b")!.positionen[0];
    expect(a.betrag).toBe(600); // 60 %
    expect(b.betrag).toBe(400); // 40 %
    expect(a.lohnanteil).toBe(360); // 60 % von 600
    expect(b.lohnanteil).toBe(240); // 40 % von 600
    expect(a.art35a).toBe("haushaltsnah");
  });

  it("cappt den Lohnanteil auf den Positionsbetrag", () => {
    const zeilen: UmlageZeile[] = [
      { bezeichnung: "X", betrag: 100, schluessel: "gleich", lohnanteil: 999, art35a: "handwerker" },
    ];
    const r = berechneUmlage(zeilen, mieter);
    const summeLohn = r.perMieter.reduce((s, m) => s + (m.positionen[0].lohnanteil ?? 0), 0);
    expect(summeLohn).toBe(100);
  });

  it("ohne art35a wird kein Lohnanteil ausgewiesen", () => {
    const zeilen: UmlageZeile[] = [
      { bezeichnung: "X", betrag: 100, schluessel: "gleich", lohnanteil: 50, art35a: "" },
    ];
    const r = berechneUmlage(zeilen, mieter);
    expect(r.perMieter[0].positionen[0].art35a).toBeUndefined();
  });
});

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
