import { describe, it, expect } from "vitest";
import { parseCsv, autoMap, parseZahl, parseDatum, baueDatensaetze } from "@/lib/importCsv";

describe("parseCsv", () => {
  it("erkennt Semikolon-Trennung (deutscher Excel-Export)", () => {
    const t = parseCsv("Name;Kaltmiete;Mietbeginn\nMustermann;750,50;01.06.2024\n");
    expect(t.delimiter).toBe(";");
    expect(t.headers).toEqual(["Name", "Kaltmiete", "Mietbeginn"]);
    expect(t.rows).toEqual([["Mustermann", "750,50", "01.06.2024"]]);
  });

  it("erkennt Komma-Trennung und behandelt Quotes mit Trennzeichen darin", () => {
    const t = parseCsv('Objekt,Adresse\n"Whg 1","Hauptstr. 5, 50667 Köln"\n');
    expect(t.delimiter).toBe(",");
    expect(t.rows[0][1]).toBe("Hauptstr. 5, 50667 Köln");
  });

  it("behandelt doppelte Anführungszeichen als Escape und BOM", () => {
    const t = parseCsv('﻿Name;Notiz\nA;"Er sagte ""hallo"""\n');
    expect(t.headers[0]).toBe("Name");
    expect(t.rows[0][1]).toBe('Er sagte "hallo"');
  });

  it("überspringt leere Zeilen", () => {
    const t = parseCsv("A;B\n1;2\n\n\n3;4\n");
    expect(t.rows).toHaveLength(2);
  });
});

describe("autoMap", () => {
  it("ordnet typische vermietet.de/Excel-Header automatisch zu (Mieter)", () => {
    const m = autoMap(["Nachname", "Vorname", "Netto-Kaltmiete", "NK-Vorauszahlung", "Einzugsdatum", "Wohnung"], "mieter");
    expect(m.nachname).toBe("Nachname");
    expect(m.vorname).toBe("Vorname");
    expect(m.kaltmiete).toBe("Netto-Kaltmiete");
    expect(m.nk_vorauszahlung).toBe("NK-Vorauszahlung");
    expect(m.mietbeginn).toBe("Einzugsdatum");
    expect(m.objekt).toBe("Wohnung");
  });

  it("ordnet Objekt-Header zu (Umlaute/Sonderzeichen egal)", () => {
    const m = autoMap(["Objektname", "Straße & Hausnummer", "Wohnfläche (m²)", "Kauf-Preis"], "objekte");
    expect(m.bezeichnung).toBe("Objektname");
    expect(m.adresse).toBe("Straße & Hausnummer");
    expect(m.flaeche).toBe("Wohnfläche (m²)");
    expect(m.kaufpreis).toBe("Kauf-Preis");
  });

  it("vergibt einen Header nicht doppelt", () => {
    const m = autoMap(["Miete"], "mieter");
    // "Miete" matcht kaltmiete — und darf dann nicht nochmal woanders landen
    expect(Object.values(m).filter((h) => h === "Miete")).toHaveLength(1);
  });

  it("verwechselt 'Mietende' nicht mit der Kaltmiete", () => {
    const m = autoMap(["Nachname", "Mietende", "Kaltmiete"], "mieter");
    expect(m.kaltmiete).toBe("Kaltmiete");
    expect(m.mietende).toBe("Mietende");
  });
});

describe("parseZahl / parseDatum", () => {
  it("liest deutsche und englische Zahlformate", () => {
    expect(parseZahl("1.234,56")).toBe(1234.56);
    expect(parseZahl("1234.56")).toBe(1234.56);
    expect(parseZahl("750 €")).toBe(750);
    expect(parseZahl("1.200")).toBe(1200);
    expect(parseZahl("abc")).toBeNull();
    expect(parseZahl("")).toBeNull();
  });

  it("liest deutsche und ISO-Daten", () => {
    expect(parseDatum("31.12.2024")).toBe("2024-12-31");
    expect(parseDatum("1.6.24")).toBe("2024-06-01");
    expect(parseDatum("2024-06-01")).toBe("2024-06-01");
    expect(parseDatum("Quatsch")).toBeNull();
    // kalender-ungültige Daten werden abgewiesen, nicht stillschweigend übernommen
    expect(parseDatum("31.02.2024")).toBeNull();
    expect(parseDatum("2024-13-45")).toBeNull();
    expect(parseDatum("29.02.2024")).toBe("2024-02-29"); // Schaltjahr ok
    expect(parseDatum("29.02.2023")).toBeNull(); // kein Schaltjahr
  });
});

describe("baueDatensaetze", () => {
  it("baut typisierte Mieter-Zeilen und meldet Pflichtfeld-Fehler", () => {
    const t = parseCsv("Nachname;Kaltmiete;Einzug\nMustermann;750,50;01.06.2024\n;100;01.01.2024\n");
    const mapping = { nachname: "Nachname", kaltmiete: "Kaltmiete", mietbeginn: "Einzug" };
    const r = baueDatensaetze(t, "mieter", mapping);
    expect(r.zeilen).toHaveLength(1);
    expect(r.zeilen[0].nachname).toBe("Mustermann");
    expect(r.zeilen[0].kaltmiete).toBe(750.5);
    expect(r.zeilen[0].mietbeginn).toBe("2024-06-01");
    expect(r.fehler[0]).toContain("Pflichtfeld");
  });

  it("meldet ungültige Datumswerte mit Zeilennummer", () => {
    const t = parseCsv("Nachname;Einzug\nA;kein-datum\n");
    const r = baueDatensaetze(t, "mieter", { nachname: "Nachname", mietbeginn: "Einzug" });
    expect(r.fehler[0]).toContain("Zeile 2");
    expect(r.zeilen[0].mietbeginn).toBeNull(); // Zeile bleibt, Datum leer
  });
});
