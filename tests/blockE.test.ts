// Regressionen aus der zweiten Prüfrunde: Werte/Texte, die falsch waren, ohne
// dass der Nutzer es hätte merken können.
import { describe, it, expect } from "vitest";
import { baueDatevExtf, type DatevBuchung } from "@/lib/datev";
import { sicheresZiel } from "@/lib/flash";
import { berechneAnlageV, elsterZeilen } from "@/lib/anlageV";
import type { Property, Einnahme, Kosten, Kredit } from "@/lib/types";

describe("DATEV-Export: Formel-Injektion", () => {
  const b = (text: string): DatevBuchung => ({
    buchungsdatum: "2024-03-01",
    betrag: 100,
    konto: 8100,
    gegenkonto: 1200,
    sollHaben: "H",
    belegfeld: text,
    buchungstext: text,
  });
  const meta = { jahr: 2024, zeitstempel: "20240301120000000" };

  it("entschärft führende Formelzeichen mit einem Apostroph", () => {
    // Anführungszeichen allein schützen NICHT — Excel wertet den Inhalt trotzdem aus.
    const csv = baueDatevExtf([b("=1+1")], meta);
    expect(csv).toContain(`"'=1+1"`);
    expect(csv).not.toContain(`"=1+1"`);
  });

  it("betrifft auch + - @ (nicht nur =)", () => {
    for (const start of ["+", "-", "@"]) {
      const csv = baueDatevExtf([b(`${start}cmd`)], meta);
      expect(csv).toContain(`"'${start}cmd"`);
    }
  });

  it("harmlose Texte bleiben unverändert", () => {
    const csv = baueDatevExtf([b("Miete Haus Nord")], meta);
    expect(csv).toContain(`"Miete Haus Nord"`);
    expect(csv).not.toContain("'Miete");
  });
});

describe("Redirect-Ziel aus dem back-Feld", () => {
  it("lässt interne Pfade durch", () => {
    expect(sicheresZiel("/properties/abc", "/tenants")).toBe("/properties/abc");
  });

  it("blockt protokoll-relative URLs (Open Redirect)", () => {
    expect(sicheresZiel("//evil.example", "/tenants")).toBe("/tenants");
    expect(sicheresZiel("/\\evil.example", "/tenants")).toBe("/tenants");
  });

  it("blockt absolute URLs und leere Werte", () => {
    expect(sicheresZiel("https://evil.example", "/tenants")).toBe("/tenants");
    expect(sicheresZiel("", "/tenants")).toBe("/tenants");
    expect(sicheresZiel(null, "/tenants")).toBe("/tenants");
  });
});

describe("Anlage V: Schuldzinsen zwischen Schätzung und Buchung", () => {
  const prop = {
    id: "p1",
    bezeichnung: "Haus",
    adresse: null,
    kaufpreis: 300000,
    kaufdatum: "2020-01-01",
    baujahr: 1990,
    afa_methode: "auto",
    afa_start_jahr: null,
    afa_betrag: null,
    afa_gebaeudeanteil: null,
  } as unknown as Property;
  const kredit = { id: "k1", prop_id: "p1", restschuld: 200000, zinssatz: 4 } as unknown as Kredit;
  const miete = [
    { prop_id: "p1", betrag: 12000, kategorie: "Miete", buchungsdatum: "2024-06-01" },
  ] as unknown as Einnahme[];
  const AFA = { satz: null, gebaeudeAnteil: 80 };
  const kostenMit = (betrag: number) =>
    [
      { prop_id: "p1", betrag, kategorie: "Schuldzinsen", buchungsdatum: "2024-01-05" },
    ] as unknown as Kosten[];

  it("Summenzeilen sind nicht übertragbar, solange die Zinsen geschätzt sind", () => {
    const erg = berechneAnlageV(2024, [prop], miete, [] as unknown as Kosten[], [kredit], AFA);
    const o = erg.objekte.find((x) => x.propId === "p1")!;
    expect(o.schuldzinsenGeschaetzt).toBe(true);

    // Der Widerspruch war: Zeile 37 als „nicht übertragen" markiert, die Summe
    // daneben aber übertragbar — inklusive genau dieser Schätzung.
    const zeilen = elsterZeilen(o);
    const summe = zeilen.find((z) => z.zeile === "51")!;
    expect(summe.uebertragbar).toBe(false);
    expect(summe.warnung).toBeTruthy();
    expect(zeilen.find((z) => z.zeile === "23/24")!.uebertragbar).toBe(false);
  });

  it("eine auffällig niedrige gebuchte Zinssumme wird angesprochen", () => {
    // 1 von 12 Monaten gebucht: 660 € statt rund 8.000 €.
    const erg = berechneAnlageV(2024, [prop], miete, kostenMit(660), [kredit], AFA);
    const o = erg.objekte.find((x) => x.propId === "p1")!;
    expect(o.schuldzinsenGeschaetzt).toBe(false);
    expect(o.hinweise.join(" ")).toContain("alle Zinszahlungen des Jahres");
    // Gebucht → Summen sind wieder übertragbar.
    expect(elsterZeilen(o).find((z) => z.zeile === "51")!.uebertragbar).toBe(true);
  });

  it("plausibel vollständige Buchungen erzeugen keinen Hinweis", () => {
    const erg = berechneAnlageV(2024, [prop], miete, kostenMit(7800), [kredit], AFA);
    const o = erg.objekte.find((x) => x.propId === "p1")!;
    expect(o.hinweise.join(" ")).not.toContain("alle Zinszahlungen des Jahres");
  });
});
