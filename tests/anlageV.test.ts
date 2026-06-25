import { describe, it, expect } from "vitest";
import { berechneAnlageV, AFA_DEFAULT } from "@/lib/anlageV";
import type { Einnahme, Kosten, Kredit, Property } from "@/lib/types";

// Minimal-Objekte: nur die Felder, die die Berechnung liest.
const prop = (id: string, kaufpreis: number): Property =>
  ({ id, bezeichnung: id, adresse: null, kaufpreis } as unknown as Property);
const ein = (prop_id: string, kategorie: string, betrag: number, datum = "2025-06-01"): Einnahme =>
  ({ prop_id, kategorie, betrag, buchungsdatum: datum } as unknown as Einnahme);
const kos = (prop_id: string, kategorie: string, betrag: number, datum = "2025-06-01"): Kosten =>
  ({ prop_id, kategorie, betrag, buchungsdatum: datum } as unknown as Kosten);
const kred = (prop_id: string, restschuld: number, zinssatz: number): Kredit =>
  ({ prop_id, restschuld, zinssatz } as unknown as Kredit);

describe("berechneAnlageV — AfA & Schuldzinsen", () => {
  it("AfA = Kaufpreis × Gebäudeanteil × Satz (Default 80% / 2%)", () => {
    const r = berechneAnlageV(2025, [prop("P1", 200000)], [], [], [], AFA_DEFAULT);
    // sichtbar nur mit Bewegung — AfA zählt als Werbungskosten → Objekt sichtbar
    const o = r.objekte.find((x) => x.propId === "P1")!;
    expect(o.afaBasis).toBe(160000);
    expect(o.werbungskosten.afa).toBe(3200);
  });

  it("Schuldzinsen = Restschuld × Zinssatz / 100", () => {
    const r = berechneAnlageV(2025, [prop("P1", 0)], [], [], [kred("P1", 100000, 3)], AFA_DEFAULT);
    const o = r.objekte.find((x) => x.propId === "P1")!;
    expect(o.werbungskosten.schuldzinsen).toBe(3000);
  });
});

describe("berechneAnlageV — Einnahmen-Kategorisierung", () => {
  it("ordnet Miete/Umlagen/Sonstiges korrekt zu und ignoriert Kaution", () => {
    const r = berechneAnlageV(
      2025,
      [prop("P1", 0)],
      [
        ein("P1", "Miete", 12000),
        ein("P1", "Nebenkostenabrechnung", 1500),
        ein("P1", "Kaution", 2000),
        ein("P1", "Sonstiges", 300),
      ],
      [],
      [],
      AFA_DEFAULT,
    );
    const o = r.objekte.find((x) => x.propId === "P1")!;
    expect(o.einnahmen.miete).toBe(12000);
    expect(o.einnahmen.umlagen).toBe(1500);
    expect(o.einnahmen.sonstige).toBe(300);
    expect(o.einnahmen.summe).toBe(13800); // Kaution NICHT enthalten
  });
});

describe("berechneAnlageV — Kosten-Buckets & Jahr-Filter", () => {
  it("ordnet Kostenarten den richtigen Werbungskosten zu", () => {
    const r = berechneAnlageV(
      2025,
      [prop("P1", 0)],
      [],
      [
        kos("P1", "Grundsteuer", 400),
        kos("P1", "Reparatur", 1000),
        kos("P1", "Verwaltung", 250),
        kos("P1", "Versicherung", 300),
        kos("P1", "Unbekannt", 99), // Fallback → hausgeldSonstige
      ],
      [],
      AFA_DEFAULT,
    );
    const w = r.objekte.find((x) => x.propId === "P1")!.werbungskosten;
    expect(w.grundsteuer).toBe(400);
    expect(w.erhaltung).toBe(1000);
    expect(w.verwaltung).toBe(250);
    expect(w.versicherung).toBe(300);
    expect(w.hausgeldSonstige).toBe(99);
  });

  it("ignoriert Buchungen aus anderen Jahren", () => {
    const r = berechneAnlageV(
      2025,
      [prop("P1", 0)],
      [ein("P1", "Miete", 12000, "2024-12-31")],
      [],
      [],
      AFA_DEFAULT,
    );
    // Keine 2025-Bewegung → Objekt ausgeblendet
    expect(r.objekte.find((x) => x.propId === "P1")).toBeUndefined();
  });
});

describe("berechneAnlageV — Überschuss & Gesamtsumme", () => {
  it("Überschuss = Einnahmen − Werbungskosten, Gesamt summiert Objekte", () => {
    const r = berechneAnlageV(
      2025,
      [prop("P1", 100000), prop("P2", 100000)],
      [ein("P1", "Miete", 10000), ein("P2", "Miete", 8000)],
      [kos("P1", "Grundsteuer", 500)],
      [],
      AFA_DEFAULT,
    );
    const o1 = r.objekte.find((x) => x.propId === "P1")!;
    // AfA P1 = 100000*0.8*0.02 = 1600; WK = 1600 + 500 = 2100; Überschuss = 10000 - 2100
    expect(o1.werbungskosten.afa).toBe(1600);
    expect(o1.werbungskosten.summe).toBe(2100);
    expect(o1.ueberschuss).toBe(7900);
    // Gesamt-Einnahmen 18000, Gesamt-AfA 3200, +500 Grundsteuer
    expect(r.gesamt.einnahmen.summe).toBe(18000);
    expect(r.gesamt.werbungskosten.summe).toBe(3700);
    expect(r.gesamt.ueberschuss).toBe(14300);
  });
});
