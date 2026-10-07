// Paket P1 der Gesamtprüfung 07.10.2026 (docs/AUDIT-2026-10-07-gesamt.md): Anlage V richtig.
// Referenzfälle mit Rechenweg aus dem Bericht (Quellen: § 6 Abs. 1 Nr. 1a, § 7 Abs. 1 S. 4,
// § 7 Abs. 5a, § 21 EStG — gesetze-im-internet.de, Abruf 07.10.2026).
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { berechneAnlageV, elsterZeilen, summenWarnung, afaSatzAusBaujahr, AFA_DEFAULT } from "@/lib/anlageV";
import { afaSatzNachFertigstellung, degressivImJahr } from "@/lib/steuer/afa";
import { kreditMonateImJahr } from "@/lib/kreditZeit";
import type { Einnahme, Kosten, Kredit, Property } from "@/lib/types";

const objekt = (x: Partial<Property>): Property => ({
  id: "p1", bezeichnung: "ETW Muster", adresse: null, typ: "Eigentumswohnung", kaufpreis: 100000, kaufdatum: "2025-01-15",
  baujahr: 1990, obj_status: "Vermietet", afa_gebaeudeanteil: 80, afa_methode: "auto", afa_start_jahr: null, afa_betrag: null, ...x,
} as unknown as Property);
const kost = (datum: string, betrag: number, kategorie = "Modernisierung", prop_id = "p1"): Kosten =>
  ({ id: `${datum}-${betrag}`, prop_id, buchungsdatum: datum, kategorie, betrag } as unknown as Kosten);
const miete = (datum: string, betrag: number, prop_id = "p1"): Einnahme =>
  ({ id: datum + prop_id, prop_id, buchungsdatum: datum, kategorie: "Miete", betrag, nk_anteil: 0 } as unknown as Einnahme);
const kredit = (x: Partial<Kredit>): Kredit => ({ id: "k1", prop_id: "p1", restschuld: 200000, zinssatz: 3.5, auszahlung_datum: null, laufzeit: null, ...x } as unknown as Kredit);
const av = (jahr: number, props: Property[], ein: Einnahme[] = [], kos: Kosten[] = [], kre: Kredit[] = []) =>
  berechneAnlageV(jahr, props, ein, kos, kre, AFA_DEFAULT);

describe("A1 — 15-%-Grenze: Erhaltung wird gekennzeichnet, nicht still abgezogen", () => {
  // Gebäude-AK 100.000 × 80 % = 80.000 → Grenze 12.000; Modernisierung 20.000 am 01.06.2025.
  const e = av(2025, [objekt({})], [], [kost("2025-06-01", 20000)]);
  const o = e.objekte[0];
  it("markiert die Erhaltung als anschaffungsnah, mit Hinweis — umgebucht wird nicht", () => {
    expect(o.werbungskosten.erhaltung).toBe(20000);
    expect(o.erhaltungAnschaffungsnah).toBe(true);
    expect(o.hinweise.join(" ")).toMatch(/15 % der Gebäude-Anschaffungskosten/);
  });
  it("Erhaltungszeile, Summe und Ergebnis gelten als nicht übertragbar — auch in der Gesamtsumme", () => {
    const z = elsterZeilen(o);
    expect(z.find((x) => x.zeile === "40")?.uebertragbar).toBe(false);
    expect(z.find((x) => x.bezeichnung === "Summe der Werbungskosten")?.uebertragbar).toBe(false);
    expect(summenWarnung(e.gesamt)).toMatch(/15-%-Grenze/);
  });
  it("unter der Grenze: keine Kennzeichnung", () => {
    const o2 = av(2025, [objekt({})], [], [kost("2025-06-01", 11000)]).objekte[0];
    expect(o2.erhaltungAnschaffungsnah).toBeFalsy();
    expect(elsterZeilen(o2).find((x) => x.zeile === "40")?.uebertragbar).not.toBe(false);
  });
  it("Kosten späterer Jahre im Fenster machen auch das frühere Jahr anschaffungsnah", () => {
    const o3 = av(2025, [objekt({})], [], [kost("2025-06-01", 8000), kost("2026-05-01", 8000)]).objekte[0];
    expect(o3.erhaltungAnschaffungsnah).toBe(true);
  });
  it("nach Ablauf der drei Jahre ist neue Erhaltung wieder unkritisch", () => {
    const o4 = av(2029, [objekt({})], [], [kost("2025-06-01", 20000), kost("2029-03-01", 5000)]).objekte[0];
    expect(o4.erhaltungAnschaffungsnah).toBeFalsy();
  });
});

describe("A2 — selbst bewohnte Objekte stehen nicht in der Anlage V", () => {
  const selbst = objekt({ id: "s1", bezeichnung: "Eigenheim", obj_status: "Selbst bewohnt", kaufpreis: 300000, kaufdatum: "2020-01-01" });
  const vermietet = objekt({ id: "v1", bezeichnung: "Vermietet", kaufdatum: "2020-01-01" });
  const e = av(2025, [selbst, vermietet], [miete("2025-03-01", 800, "v1")], [kost("2025-02-01", 500, "Grundsteuer", "s1")]);
  it("keine AfA, keine Kosten, nicht in der Summe", () => {
    expect(e.objekte.map((o) => o.propId)).toEqual(["v1"]);
    expect(e.gesamt.werbungskosten.afa).toBe(1600); // nur v1: 100.000 × 80 % × 2 %
    expect(e.gesamt.werbungskosten.grundsteuer).toBe(0);
  });
  it("die Gesamtübersicht sagt, welches Objekt fehlt und warum", () => {
    expect(e.gesamt.hinweise.join(" ")).toMatch(/Selbst bewohnt und deshalb nicht in der Anlage V: Eigenheim/);
  });
});

describe("A3 — degressive AfA vom tatsächlichen Restwert (§ 7 Abs. 5a)", () => {
  // Basis 125.000 × 80 % = 100.000, Kauf 01.11.2025: 2025 = 100.000 × 5 % × 2/12.
  const p = objekt({ kaufpreis: 125000, kaufdatum: "2025-11-01", afa_methode: "degressiv", afa_start_jahr: 2025 });
  it.each([[2025, 833.33], [2026, 4958.33], [2027, 4710.42]])("%i → %f €", (jahr, soll) => {
    expect(av(jahr, [p], [miete(`${jahr}-12-01`, 1)]).objekte[0].werbungskosten.afa).toBe(soll);
  });
  it("Kauf im Januar: 5.000 / 4.750 (volles erstes Jahr)", () => {
    expect(degressivImJahr(100000, 2025, 2025, 1)).toBe(5000);
    expect(degressivImJahr(100000, 2025, 2026, 1)).toBe(4750);
  });
});

describe("B2 — AfA-Startjahr ≠ Kaufjahr: Kaufmonat gilt nicht für ein anderes Jahr", () => {
  it("Kauf 15.11.2024, Startjahr 2025, 2 % auf 240.000 → 2025 voll 4.800 € mit Hinweis", () => {
    const o = av(2025, [objekt({ kaufpreis: 300000, kaufdatum: "2024-11-15", afa_start_jahr: 2025 })]).objekte[0];
    expect(o.werbungskosten.afa).toBe(4800);
    expect(o.hinweise.join(" ")).toMatch(/weicht vom Kaufjahr 2024 ab/);
  });
  it("das Formular sagt, dass das Feld für beide Methoden gilt", () => {
    const f = readFileSync("components/PropertyForm.tsx", "utf8");
    expect(f).toMatch(/AfA-Startjahr \(Jahr der Anschaffung\)/);
    expect(f).not.toMatch(/Startjahr \(nur degressiv\)/);
  });
});

describe("B3 — Zinsschätzung nur für Monate, in denen das Darlehen lief", () => {
  const p = objekt({ kaufdatum: "2026-03-01" });
  const k = kredit({ auszahlung_datum: "2026-03-01" });
  it.each([[2024, 0], [2025, 0], [2026, 5833.33]])("%i → %f €", (jahr, soll) => {
    const o = av(jahr, [p], [miete(`${jahr}-12-01`, 1)], [], [k]).objekte[0];
    expect(o.werbungskosten.schuldzinsen).toBe(soll);
  });
  it("Monate: Auszahlung Oktober → 3; Laufzeit 10 Jahre ab 10/2023 endet im September 2033", () => {
    expect(kreditMonateImJahr({ auszahlung_datum: "2023-10-01" }, 2023).monate).toBe(3);
    expect(kreditMonateImJahr({ auszahlung_datum: "2023-10-01", laufzeit: 10 }, 2033).monate).toBe(9);
    expect(kreditMonateImJahr({ auszahlung_datum: "2023-10-01", laufzeit: 10 }, 2034).monate).toBe(0);
    expect(kreditMonateImJahr({ laufzeit: 2030 }, 2031, "2020-05-01").monate).toBe(0);
  });
  it("ohne Datum: ganzjährig, mit Hinweis", () => {
    const o = av(2025, [objekt({ kaufdatum: null })], [miete("2025-12-01", 1)], [], [kredit({})]).objekte[0];
    expect(o.werbungskosten.schuldzinsen).toBe(7000);
    expect(o.hinweise.join(" ")).toMatch(/ganze Jahr an/);
  });
  it("die Steuerseite lädt Auszahlung und Laufzeit", () => {
    expect(readFileSync("app/(app)/steuer/page.tsx", "utf8")).toMatch(/select\("id,prop_id,betrag,restschuld,zinssatz,auszahlung_datum,laufzeit"\)/);
  });
});

describe("B4 — PDF kennzeichnet Summe und Ergebnis wie die ELSTER-Hilfe", () => {
  it("dieselbe Regel summenWarnung()", () => {
    const pdf = readFileSync("lib/pdf/berichtPdf.ts", "utf8");
    expect(pdf).toMatch(/const vorlaeufig = summenWarnung\(o\)/);
    expect(pdf).toMatch(/Summe Werbungskosten \(Zeile 51\)\$\{vorlaeufig\}/);
    expect(pdf).toMatch(/Verlust \(Zeile 23\/24\)"\}\$\{vorlaeufig\}/);
  });
});

describe("Doppelberechnung 9 — ein AfA-Satz", () => {
  it("Anlage V und AfA-Assistent nutzen dieselbe Funktion", () => {
    expect(afaSatzAusBaujahr).toBe(afaSatzNachFertigstellung);
  });
});
