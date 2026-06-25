import { describe, it, expect } from "vitest";
import {
  verteileBetrag,
  berechneUmlage,
  schluesselLabel,
  type UmlageZeile,
  type UmlageMieter,
} from "@/lib/umlage";

const summe = (ns: number[]) => Math.round(ns.reduce((a, b) => a + b, 0) * 100) / 100;

describe("verteileBetrag — cent-genaue Verteilung", () => {
  it("verteilt exakt ohne Rest (Summe = Ausgangsbetrag)", () => {
    const a = verteileBetrag(100, [1, 1, 1]);
    expect(summe(a)).toBe(100);
    // 100/3: ein Cent landet bei der ersten Position
    expect(a).toEqual([33.34, 33.33, 33.33]);
  });

  it("verteilt proportional zu Gewichten", () => {
    expect(verteileBetrag(100, [3, 1])).toEqual([75, 25]);
  });

  it("ignoriert negative/0-Gewichte und gibt bei Gesamtgewicht 0 nur Nullen", () => {
    expect(verteileBetrag(100, [0, 0])).toEqual([0, 0]);
    expect(summe(verteileBetrag(99.99, [2, 0, 1]))).toBe(99.99);
  });

  it("krummer Betrag bleibt cent-genau", () => {
    const a = verteileBetrag(33.33, [1, 1, 1]);
    expect(summe(a)).toBe(33.33);
  });
});

describe("schluesselLabel", () => {
  it("mappt Schlüssel auf gespeicherte Bezeichnung", () => {
    expect(schluesselLabel("flaeche")).toBe("Fläche");
    expect(schluesselLabel("gleich")).toBe("Einheit");
  });
});

const mieter = (id: string, flaeche: number, monate?: number): UmlageMieter => ({
  id,
  name: id,
  flaeche,
  ...(monate != null ? { monate } : {}),
});

describe("berechneUmlage — ohne Zeitanteil", () => {
  it("verteilt nach Fläche (m²)", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "Grundsteuer", betrag: 100, schluessel: "flaeche" }];
    const r = berechneUmlage(zeilen, [mieter("A", 60), mieter("B", 40)]);
    expect(r.perMieter[0].summe).toBe(60);
    expect(r.perMieter[1].summe).toBe(40);
    expect(r.gesamt).toBe(100);
    expect(r.nichtUmgelegt).toBe(0);
  });

  it("verteilt gleichmäßig je Einheit", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "Müll", betrag: 100, schluessel: "gleich" }];
    const r = berechneUmlage(zeilen, [mieter("A", 60), mieter("B", 40)]);
    expect(r.perMieter[0].summe).toBe(50);
    expect(r.perMieter[1].summe).toBe(50);
    expect(r.gesamt).toBe(100);
  });

  it("bleibt bei 3 gleichen Mietern cent-genau (Summe = Betrag)", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "X", betrag: 100, schluessel: "flaeche" }];
    const r = berechneUmlage(zeilen, [mieter("A", 1), mieter("B", 1), mieter("C", 1)]);
    expect(summe(r.perMieter.map((m) => m.summe))).toBe(100);
  });

  it("Flächen-Schlüssel ohne hinterlegte Flächen → Betrag gilt als nicht umgelegt (verschwindet nicht)", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "Grundsteuer", betrag: 100, schluessel: "flaeche" }];
    const r = berechneUmlage(zeilen, [mieter("A", 0), mieter("B", 0)]);
    expect(r.gesamt).toBe(0);
    expect(r.nichtUmgelegt).toBe(100);
    expect(r.zeilenNichtUmgelegt[0]).toBe(100);
  });
});

describe("berechneUmlage — zeitanteilig (belegte Monate)", () => {
  it("voll belegt (12 Mon.) → voller Betrag, nichts Leerstand", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "G", betrag: 120, schluessel: "flaeche" }];
    const r = berechneUmlage(zeilen, [mieter("A", 100, 12)], { zeitanteilig: true, referenzFlaeche: 100 });
    expect(r.perMieter[0].summe).toBe(120);
    expect(r.nichtUmgelegt).toBe(0);
  });

  it("halb belegt (6 Mon.) → halber Anteil, Rest als Leerstand nicht umgelegt", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "G", betrag: 120, schluessel: "flaeche" }];
    const r = berechneUmlage(zeilen, [mieter("A", 100, 6)], { zeitanteilig: true, referenzFlaeche: 100 });
    expect(r.perMieter[0].summe).toBe(60);
    expect(r.nichtUmgelegt).toBe(60);
  });

  it("Mieterwechsel in derselben Einheit (je 6 Mon.) → voll umgelegt, korrekt geteilt", () => {
    // Gebäude = eine Einheit mit 50 m². A Jan–Jun, B Jul–Dez. referenzFlaeche = 50.
    const zeilen: UmlageZeile[] = [{ bezeichnung: "G", betrag: 120, schluessel: "flaeche" }];
    const r = berechneUmlage(zeilen, [mieter("A", 50, 6), mieter("B", 50, 6)], {
      zeitanteilig: true,
      referenzFlaeche: 50,
    });
    expect(r.perMieter[0].summe).toBe(60);
    expect(r.perMieter[1].summe).toBe(60);
    expect(r.nichtUmgelegt).toBe(0);
  });

  it("gleichmäßig je Einheit + zeitanteilig → Anteil nach Monaten, Rest Leerstand", () => {
    const zeilen: UmlageZeile[] = [{ bezeichnung: "M", betrag: 100, schluessel: "gleich" }];
    const r = berechneUmlage(zeilen, [mieter("A", 50, 12), mieter("B", 50, 6)], {
      zeitanteilig: true,
      referenzFlaeche: 100,
    });
    // Referenz = 2 Einheiten × 12 = 24; Gewichte 12 + 6 = 18 → allocated 75, Rest 25
    expect(r.perMieter[0].summe).toBe(50);
    expect(r.perMieter[1].summe).toBe(25);
    expect(r.nichtUmgelegt).toBe(25);
  });
});
