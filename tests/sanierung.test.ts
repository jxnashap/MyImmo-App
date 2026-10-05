import { describe, it, expect } from "vitest";
import {
  MASSNAHMEN,
  berechneSanierung,
  flaechen,
  gebindeFuer,
  type Katalog,
  type Material,
  type MaterialId,
  type Raum,
} from "@/lib/sanierung/rechner";
import { KATALOG } from "@/lib/sanierung/katalog";

// Sanierungsrechner Stufe 1 (05.10.2026). Gerechnet wird gegen einen TESTkatalog mit runden
// Werten — die echten Preise altern, die Rechnung nicht. Die Werte sind so gewählt, dass
// min und max verschiedene Gebindezahlen ergeben und „je Raum gerundet“ ein anderes Ergebnis
// liefert als „über alle Räume gerundet“.

const mat = (id: MaterialId, einheit: Material["einheit"], gebinde: number, min: number, max: number, preis: number): Material => ({
  id, name: id, produkt: id, einheit, gebinde, gebindeName: `${gebinde} ${einheit}`,
  verbrauch: { min, max }, preis, quelle: { preis: "Test", verbrauch: "Test", stand: "Test" },
});

const K: Katalog = {
  spachtel: mat("spachtel", "kg", 20, 0.5, 1.2, 30),
  tiefengrund: mat("tiefengrund", "l", 10, 0.1, 0.2, 25),
  wandfarbe: mat("wandfarbe", "l", 10, 0.12, 0.16, 50),
  raufaser: mat("raufaser", "m²", 17.5, 1, 1, 10),
  kleister: mat("kleister", "m²", 100, 1, 1, 8),
  laminat: mat("laminat", "m²", 2, 1, 1, 20),
  vinyl: mat("vinyl", "m²", 2, 1, 1, 40),
  trittschall: mat("trittschall", "m²", 10, 1, 1, 15),
  sockelleiste: mat("sockelleiste", "m", 2.5, 1, 1, 5),
};

// A: 4 × 3 × 2,5 m, 4 m² Fenster/Tür → Umfang 14, Wand 14 × 2,5 − 4 = 31, Decke/Boden 12.
const A = (massnahmen: Raum["massnahmen"] = []): Raum => ({
  id: "a", name: "Wohnen", laenge: 4, breite: 3, hoehe: 2.5, oeffnungen: 4, massnahmen,
});
// B: 5 × 4 × 2,5 m, 3 m² → Umfang 18, Wand 18 × 2,5 − 3 = 42, Decke/Boden 20.
const B = (massnahmen: Raum["massnahmen"] = []): Raum => ({
  id: "b", name: "Schlafen", laenge: 5, breite: 4, hoehe: 2.5, oeffnungen: 3, massnahmen,
});

describe("flaechen", () => {
  it("Wand = Umfang × Höhe − Öffnungen, Decke = Boden = Länge × Breite", () => {
    expect(flaechen(A())).toEqual({ wand: 31, decke: 12, boden: 12, umfang: 14 });
  });

  it("nie negativ: Öffnungen größer als die Wand, negative oder leere Maße", () => {
    expect(flaechen({ laenge: 2, breite: 2, hoehe: 1, oeffnungen: 100 }).wand).toBe(0);
    expect(flaechen({ laenge: -3, breite: Number.NaN, hoehe: 2.5, oeffnungen: -1 })).toEqual({ wand: 0, decke: 0, boden: 0, umfang: 0 });
  });
});

describe("gebindeFuer", () => {
  it("ganze Gebinde, ohne Rundungsrest-Aufschlag", () => {
    expect(gebindeFuer(40, 20)).toBe(2);
    expect(gebindeFuer(0.1 + 0.2, 0.1)).toBe(3); // 3,0000000000000004 → 3, nicht 4
    expect(gebindeFuer(40.5, 20)).toBe(3);
    expect(gebindeFuer(1, 20)).toBe(1);
    expect(gebindeFuer(0, 20)).toBe(0);
  });
});

describe("berechneSanierung", () => {
  it("Farbe für Wand und Decke in zwei Räumen: von–bis, 2 Anstriche, über ALLE Räume gerundet", () => {
    const r = berechneSanierung({ raeume: [A(["wand_streichen", "decke_streichen"]), B(["wand_streichen", "decke_streichen"])] }, K);
    // Fläche 31 + 12 + 42 + 20 = 105 m² · 2 Anstriche
    // min 105 × 0,12 × 2 = 25,2 l → 3 Eimer (je Raum gerundet wären es 2 + 2 = 4)
    // max 105 × 0,16 × 2 = 33,6 l → 4 Eimer
    const farbe = r.material.find((z) => z.material.id === "wandfarbe")!;
    expect(farbe.menge).toEqual({ min: 25.2, max: 33.6 });
    expect(farbe.gebinde).toEqual({ min: 3, max: 4 });
    expect(farbe.kosten).toEqual({ min: 150, max: 200 });
    expect(r.materialKosten).toEqual({ min: 150, max: 200 });
  });

  it("Laminat: Boden, Trittschall und Sockelleiste mit Verschnitt", () => {
    const r = berechneSanierung({ raeume: [A(["laminat"])] }, K);
    const z = (id: MaterialId) => r.material.find((x) => x.material.id === id)!;
    // Boden 12 m² × 1,05 = 12,6 → 7 Pakete à 2 m²; × 1,10 = 13,2 → 7 Pakete
    expect(z("laminat").gebinde).toEqual({ min: 7, max: 7 });
    // Trittschall 12,6 → 2 Rollen à 10 m²; 13,2 → 2
    expect(z("trittschall").gebinde).toEqual({ min: 2, max: 2 });
    // Leisten: Umfang 14 m × 1,05 = 14,7 → 6 Stück à 2,5 m; × 1,10 = 15,4 → 7 Stück
    expect(z("sockelleiste").gebinde).toEqual({ min: 6, max: 7 });
    expect(z("sockelleiste").kosten).toEqual({ min: 30, max: 35 });
  });

  it("Tapezieren: Raufaser UND Kleister, beide mit Verschnitt", () => {
    const r = berechneSanierung({ raeume: [B(["tapezieren"])] }, K);
    // Wand 42 m² × 1,10 = 46,2 → 3 Rollen à 17,5 m²; × 1,15 = 48,3 → 3 Rollen
    expect(r.material.map((x) => x.material.id)).toEqual(["raufaser", "kleister"]);
    expect(r.material[0].gebinde).toEqual({ min: 3, max: 3 });
    expect(r.material[1].gebinde).toEqual({ min: 1, max: 1 });
  });

  it("Grundieren zählt Wand UND Decke", () => {
    const r = berechneSanierung({ raeume: [A(["grundieren"])] }, K);
    // (31 + 12) × 0,1 = 4,3 l; × 0,2 = 8,6 l
    expect(r.material[0].menge).toEqual({ min: 4.3, max: 8.6 });
  });

  it("eigener Preis schlägt den Katalog — auch 0 € (Material schon da), negative nicht", () => {
    const raeume = [A(["wand_streichen"])]; // 31 × 0,24 = 7,44 l → 1 Eimer; 31 × 0,32 = 9,92 → 1
    const eigen = berechneSanierung({ raeume, preise: { wandfarbe: 40 } }, K).material[0];
    expect(eigen).toMatchObject({ preis: 40, eigenerPreis: true, kosten: { min: 40, max: 40 } });
    expect(berechneSanierung({ raeume, preise: { wandfarbe: 0 } }, K).material[0].kosten).toEqual({ min: 0, max: 0 });
    expect(berechneSanierung({ raeume, preise: { wandfarbe: -5 } }, K).material[0]).toMatchObject({ preis: 50, eigenerPreis: false });
  });

  it("Lohn = Stunden × eigener Satz, eigene Posten dazu, alles in der Summe", () => {
    const r = berechneSanierung(
      {
        raeume: [A(["wand_streichen"])], // Material 50–50
        lohn: [{ bezeichnung: "Ich", stunden: 100, satz: 30 }, { bezeichnung: "Helfer", stunden: 10, satz: 45 }],
        eigene: [{ bezeichnung: "Bad komplett", betrag: 8000 }],
      },
      K,
    );
    expect(r.lohn).toBe(3450); // 3.000 + 450
    expect(r.eigene).toBe(8000);
    expect(r.gesamt).toEqual({ min: 11500, max: 11500 });
  });

  it("Normalfall leer: keine Räume → kein Material, Summe nur aus Lohn und eigenen Posten", () => {
    const r = berechneSanierung({ raeume: [], lohn: [{ bezeichnung: "", stunden: 2, satz: 20 }] }, K);
    expect(r.material).toEqual([]);
    expect(r.materialKosten).toEqual({ min: 0, max: 0 });
    expect(r.gesamt).toEqual({ min: 40, max: 40 });
  });

  it("doppelt angehakte Maßnahme zählt einmal, unbekannte (alter Entwurf) wird übergangen", () => {
    const einmal = berechneSanierung({ raeume: [A(["spachteln"])] }, K).material[0].menge;
    const doppelt = berechneSanierung({ raeume: [A(["spachteln", "spachteln", "gibt_es_nicht" as never])] }, K).material[0].menge;
    expect(doppelt).toEqual(einmal);
  });

  it("Materialliste in Katalog-Reihenfolge, unabhängig von der Reihenfolge der Räume", () => {
    const r = berechneSanierung({ raeume: [A(["laminat"]), B(["spachteln"])] }, K);
    expect(r.material.map((x) => x.material.id)).toEqual(["spachtel", "laminat", "trittschall", "sockelleiste"]);
  });

  it("Flächensumme über alle Räume zur Kontrolle", () => {
    expect(berechneSanierung({ raeume: [A(), B()] }, K).flaechen).toEqual({ wand: 73, decke: 32, boden: 32, umfang: 32 });
  });
});

describe("echter Katalog", () => {
  it("jedes Material jeder Maßnahme ist da, mit Preis, Gebinde, Spanne und Quelle mit Stand", () => {
    const benutzt = new Set(MASSNAHMEN.flatMap((m) => m.bedarf.map((b) => b.material)));
    expect(benutzt.size).toBeGreaterThan(5);
    for (const id of benutzt) {
      const m = KATALOG[id];
      expect(m, id).toBeDefined();
      expect(m.id).toBe(id);
      expect(m.preis, id).toBeGreaterThan(0);
      expect(m.gebinde, id).toBeGreaterThan(0);
      expect(m.verbrauch.min, id).toBeGreaterThan(0);
      expect(m.verbrauch.max, id).toBeGreaterThanOrEqual(m.verbrauch.min);
      expect(m.quelle.preis.length, id).toBeGreaterThan(10);
      expect(m.quelle.verbrauch.length, id).toBeGreaterThan(5);
      expect(m.quelle.stand, id).toMatch(/^\d{2}\.\d{2}\.\d{4}$/);
    }
  });
});

describe("Eingabe: Formular → Rechnung, Entwurf aus dem Browser", () => {
  it("liest Komma und Punkt, leere Felder als 0; leerer Preis = Katalog, „0“ ist ein Preis", async () => {
    const { zuEingabe } = await import("@/lib/sanierung/eingabe");
    const e = zuEingabe({
      raeume: [{ id: "a", name: "Küche", laenge: "3,45", breite: "2.8", hoehe: "", oeffnungen: "1,5", massnahmen: ["spachteln"] }],
      lohn: [{ id: "l", bezeichnung: "Ich", stunden: "100", satz: "30,50" }],
      eigene: [{ id: "p", bezeichnung: "Bad", betrag: "8.000" }],
      preise: { wandfarbe: "", spachtel: "0", tiefengrund: "19,99" },
    });
    expect(e.raeume[0]).toMatchObject({ laenge: 3.45, breite: 2.8, hoehe: 0, oeffnungen: 1.5 });
    expect(e.lohn![0]).toMatchObject({ stunden: 100, satz: 30.5 });
    expect(e.eigene![0].betrag).toBe(8000); // deutscher Tausenderpunkt, kein 8-Euro-Bad
    expect(e.preise).toEqual({ spachtel: 0, tiefengrund: 19.99 });
  });

  it("Entwurf: Fremdes wird abgelehnt, unbekannte Maßnahmen fallen weg, Felder bleiben Text", async () => {
    const { entwurfAus } = await import("@/lib/sanierung/eingabe");
    expect(entwurfAus(null)).toBeNull();
    expect(entwurfAus("x")).toBeNull();
    expect(entwurfAus({ raeume: "kaputt" })).toBeNull();
    const e = entwurfAus({
      raeume: [{ id: "a", name: "Bad", laenge: 3, breite: "2", massnahmen: ["spachteln", "alte_massnahme", 7] }],
      lohn: [{ bezeichnung: "Ich", stunden: "10", satz: "25" }],
      preise: { wandfarbe: "45", spachtel: 12 },
    })!;
    expect(e.raeume[0]).toMatchObject({ id: "a", name: "Bad", laenge: "", breite: "2", massnahmen: ["spachteln"] });
    expect(e.lohn[0].id).toBe("l0");
    expect(e.eigene).toEqual([]);
    expect(e.preise).toEqual({ wandfarbe: "45" });
  });
});
