import { describe, it, expect } from "vitest";
import { buildKreditantragPdf } from "@/lib/pdf/kreditantragPdf";
import { LEERE_SELBSTAUSKUNFT } from "@/lib/kauf/selbstauskunft";

describe("Kreditantrag-PDF", () => {
  it("erzeugt ein nicht-leeres PDF mit vollständigen Daten", async () => {
    const sa = {
      ...LEERE_SELBSTAUSKUNFT,
      familienstand: "verheiratet", kinder: 2, anzahlPersonen: 4,
      beschaeftigung: "angestellt" as const, beruf: "Ingenieur", arbeitgeber: "ACME",
      einkommen: 3500, einkommenPartner: 2000, bankguthaben: 60000, wertpapiere: 20000,
      ratenKredite: 250, versicherungen: 180,
    };
    const objekt = { name: "ETW München", adresse: "Musterstr. 1", kaufpreis: 400000, gesamtInvest: 440000, eigenkapital: 90000, darlehen: 350000, kaltmiete: 1400 };
    const wunsch = { darlehen: 350000, zinsbindung: 15, anfangstilgung: 2, sollzins: 3.8, monatsrate: 1691, sondertilgung: true, prioritaet: "gleiche_rate" };
    const pdf = await buildKreditantragPdf({ name: "Max Mustermann", adresse: "Musterstr. 1, 80331 München", email: "max@example.com" }, sa, objekt, wunsch);
    expect(pdf).toBeInstanceOf(Uint8Array);
    expect(pdf.length).toBeGreaterThan(1500);
    // gültiger PDF-Header "%PDF"
    expect(String.fromCharCode(pdf[0], pdf[1], pdf[2], pdf[3])).toBe("%PDF");
  });

  it("funktioniert auch ohne Objekt/Wunsch (nur Selbstauskunft)", async () => {
    const pdf = await buildKreditantragPdf({ name: "Erika" }, LEERE_SELBSTAUSKUNFT, null, null);
    expect(pdf.length).toBeGreaterThan(1000);
  });
});
