import { describe, it, expect } from "vitest";
import { ordneZu, passtZusammen } from "@/lib/nkOcrAbgleich";

// Der Abgleich entscheidet, ob ein ausgelesener Betrag eine VORHANDENE
// Position aktualisiert oder eine Dublette anlegt. Falsche Zuordnung heißt:
// falscher Betrag in einem Dokument, das der Mieter rechtsverbindlich bekommt.

const P = (id: string, bezeichnung: string, betrag: number | null = null) => ({ id, bezeichnung, betrag });
const E = (name: string, gesamt: number | null = null, anteil: number | null = null) => ({ name, gesamt, anteil });

describe("Bezeichnungs-Zuordnung", () => {
  it("findet Synonyme derselben Kostenart", () => {
    expect(passtZusammen("Müll", "Abfallentsorgung")).toBe(true);
    expect(passtZusammen("Müllabfuhr", "Müllgebühren")).toBe(true);
    expect(passtZusammen("Hausmeister", "Hauswart-Kosten")).toBe(true);
    expect(passtZusammen("Versicherung", "Gebäudeversicherung")).toBe(true);
    expect(passtZusammen("Aufzug", "Fahrstuhl/Liftwartung")).toBe(true);
    expect(passtZusammen("Allgemeinstrom", "Treppenhausstrom")).toBe(true);
  });

  it("hält Wasser, Abwasser und Warmwasser auseinander", () => {
    // Klassiker: „wasser" steckt in allen dreien. Eine falsche Zuordnung
    // vertauscht hier vierstellige Beträge.
    expect(passtZusammen("Wasser", "Abwasser")).toBe(false);
    expect(passtZusammen("Wasser", "Warmwasser")).toBe(false);
    expect(passtZusammen("Abwasser", "Warmwasser")).toBe(false);
    expect(passtZusammen("Kaltwasser", "Frischwasser")).toBe(true);
    expect(passtZusammen("Abwasser", "Kanalgebühren")).toBe(true);
  });

  it("ordnet Grundsteuer nie einer anderen Kostenart zu", () => {
    expect(passtZusammen("Grundsteuer", "Grundbesitzabgaben Müll")).toBe(false);
    expect(passtZusammen("Grundsteuer", "Grundsteuer B")).toBe(true);
  });
});

describe("ordneZu", () => {
  const bestehend = [
    P("1", "Grundsteuer", 240),
    P("2", "Müll", 300),
    P("3", "Wasser/Abwasser", 500),
  ];

  it("aktualisiert Vorhandenes, schlägt Neues vor, benennt Fehlendes", () => {
    const erg = ordneZu(bestehend, [
      E("Abfallentsorgung", 1500, 310),
      E("Hausmeister", 2000, 400),
    ]);
    expect(erg.treffer).toHaveLength(1);
    expect(erg.treffer[0].vorhanden.id).toBe("2");
    expect(erg.neu.map((n) => n.name)).toEqual(["Hausmeister"]);
    // Der Kern der Nutzer-Anforderung: Grundsteuer steht nicht im Dokument
    // der Hausverwaltung — sie muss als fehlend benannt werden.
    expect(erg.fehlend.map((f) => f.bezeichnung)).toEqual(["Grundsteuer", "Wasser/Abwasser"]);
  });

  it("vergibt jede vorhandene Position höchstens einmal", () => {
    const erg = ordneZu([P("1", "Wasser", 100)], [E("Wasserversorgung", 800), E("Frischwasser", 900)]);
    expect(erg.treffer).toHaveLength(1);
    expect(erg.neu).toHaveLength(1);
    expect(erg.fehlend).toHaveLength(0);
  });

  it("reicht Zusatzfelder der vorhandenen Positionen unverändert durch", () => {
    const mitAufteilung = [{ ...P("1", "Müll", 300), aufteilung: "flaeche" as string | null }];
    const erg = ordneZu(mitAufteilung, [E("Müllabfuhr", 1500)]);
    expect(erg.treffer[0].vorhanden.aufteilung).toBe("flaeche");
  });
});
