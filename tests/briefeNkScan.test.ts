// Design-Scan 06.10.2026, Gruppe „pdf-briefe-nk“: Brief-Vorlagen, Datumsform, Umbruch, Seitenumbruch.
import { describe, it, expect } from "vitest";
import { PDFDocument, StandardFonts } from "pdf-lib";
import {
  ART_ZEIGT_KONTO,
  DATUM_LABEL,
  BETRAG_LABEL,
  DEFAULT_VORLAGEN,
  briefDatum,
  fehlendePlatzhalter,
  satzanfangGross,
} from "@/lib/dokumentVorlagen";
import { bindeLeerzeichen, brichUm } from "@/lib/pdf/zeilenumbruch";
import { protokollDatum } from "@/lib/protokollDatum";
import { buildDocPdf } from "@/lib/pdf/docPdf";

describe("Brief-Vorlagen", () => {
  it("Zahlungskasten nur bei Zahlungsaufforderungen, nie bei Quittung/Mieterhöhung", () => {
    expect(ART_ZEIGT_KONTO).toEqual(["zahlungserinnerung", "mahnung"]);
  });
  it("Quittung beschriftet Betrag und Datum als erhalten", () => {
    expect(BETRAG_LABEL.mietquittung).toBe("Erhaltener Betrag (€)");
    expect(DATUM_LABEL.mietquittung).toBe("Zahlung erhalten am");
    expect(DATUM_LABEL.allgemein).toBeUndefined();
  });
  it("Bescheinigungen beginnen groß", () => {
    expect(DEFAULT_VORLAGEN.mietbescheinigung.startsWith("Hiermit")).toBe(true);
    expect(DEFAULT_VORLAGEN.mietquittung.startsWith("Hiermit")).toBe(true);
    expect(satzanfangGross(["hiermit wird …", "b"])).toEqual(["Hiermit wird …", "b"]);
  });
  it("Datum ausgeschrieben ohne führende Null, ohne Zeitzone", () => {
    expect(briefDatum("2026-10-06")).toBe("6. Oktober 2026");
    expect(briefDatum("2021-04-01")).toBe("1. April 2021");
    expect(briefDatum("")).toBe("");
    expect(protokollDatum("2026-03-01")).toBe("01.03.2026");
  });
  it("leere Platzhalter werden gemeldet, {{grund}} ist optional", () => {
    const t = DEFAULT_VORLAGEN.mahnung;
    expect(fehlendePlatzhalter(t, { betrag: "100,00 €", datum: "", grund: "" })).toEqual(["datum"]);
    expect(fehlendePlatzhalter(t, { betrag: "100,00 €", datum: "6. Oktober 2026", grund: "" })).toEqual([]);
    expect(fehlendePlatzhalter("seit dem {{mietbeginn}}", { mietbeginn: "–" })).toEqual(["mietbeginn"]);
  });
});

describe("Zeilenumbruch", () => {
  it("bindet §, Absatz, Gesetz, Datum und Betrag", () => {
    const b = bindeLeerzeichen("gemäß § 556b BGB zum 13. Oktober 2026 nach Abs. 6 BMG über 1.539,50 € und 20 %");
    expect(b).not.toMatch(/§ /);
    expect(b).not.toMatch(/556b BGB/);
    expect(b).not.toMatch(/13\. Oktober 2026/);
    expect(b).not.toMatch(/Abs\. 6/);
    expect(b).not.toMatch(/50 €/);
    expect(b).not.toMatch(/20 %/);
    expect(b).toMatch(/gemäß /); // gewöhnliche Wörter bleiben trennbar
  });
  it("trennt nie zwischen § und Nummer", async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    for (let w = 120; w < 400; w += 7) {
      const zeilen = brichUm("Die Miete ist nach § 556b BGB bis zum 13. Oktober 2026 fällig, siehe Abs. 6 BMG.", 10.5, w, font);
      for (const z of zeilen) {
        expect(z.endsWith("§")).toBe(false);
        expect(z.endsWith(" 13.")).toBe(false);
        expect(z.endsWith("Abs.")).toBe(false);
      }
    }
  });
});

describe("Brief-PDF", () => {
  it("erzeugt kurze und mehrseitige Briefe mit Namen außerhalb von Latin-1 ohne Fehler", async () => {
    const absaetze = Array.from({ length: 40 }, (_, i) => `Absatz ${i + 1}: ` + "Text ".repeat(18));
    for (let n = 20; n <= 40; n++) {
      const pdf = await buildDocPdf({
        titel: "Schreiben",
        absender: { name: "Jonas Beispiel" },
        empfaengerName: "Fatma Yılmaz",
        objekt: "Haus",
        absaetze: absaetze.slice(0, n),
      });
      const doc = await PDFDocument.load(pdf);
      expect(doc.getTitle()).toContain("Yılmaz");
      expect(doc.getPageCount()).toBeGreaterThan(0);
    }
  });
});
