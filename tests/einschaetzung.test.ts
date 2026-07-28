import { describe, it, expect } from "vitest";
import { notizAusQuelle, herkunftLabel, veraenderungProzent, bereiteListeAuf, type EinschaetzungRow } from "@/lib/einschaetzung";

describe("notizAusQuelle", () => {
  it("trennt die Notiz von der Quelle", () => {
    expect(notizAusQuelle("Verkauf-Assistent · Maklergespräch")).toBe("Maklergespräch");
    expect(notizAusQuelle("Verkauf-Assistent")).toBeNull();
    expect(notizAusQuelle(null)).toBeNull();
    expect(notizAusQuelle("Verkauf-Assistent ·   ")).toBeNull();
  });
});

describe("herkunftLabel", () => {
  it("benennt die Verfahren", () => {
    expect(herkunftLabel("einschaetzung", "Verkauf-Assistent · X")).toBe("Eigene Einschätzung");
    expect(herkunftLabel("index", "HPI-Fortschreibung")).toBe("Index-Fortschreibung");
    expect(herkunftLabel("sachwert", null)).toBe("ImmoWertV-Schätzung");
    expect(herkunftLabel("manuell", "Objekt-Formular")).toBe("Manuell erfasst");
  });
  it("fällt auf die Quelle zurück", () => {
    expect(herkunftLabel(null, "Irgendwas · Notiz")).toBe("Irgendwas");
    expect(herkunftLabel(null, null)).toBe("Wert-Stand");
  });
});

describe("veraenderungProzent", () => {
  it("rechnet auf eine Nachkommastelle", () => {
    expect(veraenderungProzent(110000, 100000)).toBe(10);
    expect(veraenderungProzent(95000, 100000)).toBe(-5);
    expect(veraenderungProzent(103333, 100000)).toBe(3.3);
  });
  it("null bei fehlenden/ungültigen Werten", () => {
    expect(veraenderungProzent(null, 100)).toBeNull();
    expect(veraenderungProzent(100, null)).toBeNull();
    expect(veraenderungProzent(100, 0)).toBeNull();
  });
});

describe("bereiteListeAuf", () => {
  const rows: EinschaetzungRow[] = [
    { id: "a1", immobilie_id: "A", datum: "2026-01-15T12:00:00Z", marktwert: 100000, verfahren: "einschaetzung", quelle: "Verkauf-Assistent · alt" },
    { id: "a2", immobilie_id: "A", datum: "2026-06-15T12:00:00Z", marktwert: 110000, verfahren: "einschaetzung", quelle: "Verkauf-Assistent · neu" },
    { id: "b1", immobilie_id: "B", datum: "2026-03-15T12:00:00Z", marktwert: 200000, verfahren: "index", quelle: "HPI-Fortschreibung" },
  ];

  it("sortiert nach Datum absteigend", () => {
    const l = bereiteListeAuf(rows);
    expect(l.map((e) => e.id)).toEqual(["a2", "b1", "a1"]);
  });

  it("rechnet Δ nur gegen den Vorstand DESSELBEN Objekts", () => {
    const l = bereiteListeAuf(rows);
    const a2 = l.find((e) => e.id === "a2")!;
    const a1 = l.find((e) => e.id === "a1")!;
    const b1 = l.find((e) => e.id === "b1")!;
    expect(a2.deltaProzent).toBe(10); // 100k → 110k
    expect(a1.deltaProzent).toBeNull(); // ältester Stand von A
    expect(b1.deltaProzent).toBeNull(); // einziger Stand von B — nicht gegen A rechnen
  });

  it("reicht Notiz und Herkunft mit durch", () => {
    const l = bereiteListeAuf(rows);
    expect(l.find((e) => e.id === "a2")!.notiz).toBe("neu");
    expect(l.find((e) => e.id === "b1")!.herkunft).toBe("Index-Fortschreibung");
    expect(l.find((e) => e.id === "b1")!.notiz).toBeNull();
  });

  it("leere Liste bleibt leer", () => {
    expect(bereiteListeAuf([])).toEqual([]);
  });
});
