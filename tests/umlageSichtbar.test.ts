import { describe, it, expect } from "vitest";
import { zeigeVerteiler } from "@/lib/umlage";

describe("zeigeVerteiler", () => {
  it("zeigt den Verteiler bei Mehrparteien-Typen", () => {
    expect(zeigeVerteiler({ typ: "Mehrfamilienhaus" })).toBe(true);
    expect(zeigeVerteiler({ typ: "Garagenkomplex" })).toBe(true);
  });

  it("blendet ihn bei Ein-Einheit-Objekten aus", () => {
    expect(zeigeVerteiler({ typ: "Eigentumswohnung" })).toBe(false);
    expect(zeigeVerteiler({ typ: "Einfamilienhaus" })).toBe(false);
    expect(zeigeVerteiler({ typ: "Garage / Stellplatz" })).toBe(false);
    expect(zeigeVerteiler({ typ: "Grundstück" })).toBe(false);
  });

  it("auch eine ETW mit genau einem Mieter bleibt ohne Verteiler", () => {
    expect(zeigeVerteiler({ typ: "Eigentumswohnung", einheiten_anzahl: 1, mieter: [{ mietbeginn: "2024-01-01", mietende: null }] })).toBe(false);
  });

  it("mehrere Einheiten schalten ihn frei (z. B. Gewerbeobjekt)", () => {
    expect(zeigeVerteiler({ typ: "Gewerbeimmobilie", einheiten_anzahl: 3 })).toBe(true);
  });

  it("mehrere GLEICHZEITIGE Mieter schalten ihn frei, auch ohne gepflegte Einheitenzahl", () => {
    expect(zeigeVerteiler({ typ: "Gewerbeimmobilie", mieter: [
      { mietbeginn: "2024-01-01", mietende: null },
      { mietbeginn: "2025-03-01", mietende: null },
    ] })).toBe(true);
  });

  it("kommt mit fehlenden Angaben klar", () => {
    expect(zeigeVerteiler({})).toBe(false);
    expect(zeigeVerteiler({ typ: null, einheiten_anzahl: null })).toBe(false);
    expect(zeigeVerteiler({ typ: "Eigentumswohnung", einheiten_anzahl: 0, mieter: [] })).toBe(false);
  });
});
