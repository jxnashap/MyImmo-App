// Paket P2 der Gesamtprüfung 07.10.2026 (docs/AUDIT-2026-10-07-gesamt.md): Nebenkosten richtig.
// Jede Zahl ist dort mit Rechenweg und Quelle belegt; die Testwerte sind so gewählt, dass falsche
// und richtige Rechnung verschiedene Ergebnisse liefern.
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { verteileObjektKosten, co2FuerMieter, type NkObjektKosten, type NkObjektMieter } from "@/lib/nkObjekt";
import { berechneNk, vorauszahlungZusatz, co2Gutschrift } from "@/lib/nk";
import { nkCo2Argumente } from "@/lib/nkPositionen";
import { spezAusstoss, findeStufe } from "@/lib/co2";

const lies = (p: string) => readFileSync(p, "utf8");
const k = (x: Partial<NkObjektKosten>): NkObjektKosten => ({
  id: x.id ?? "k", bezeichnung: x.bezeichnung ?? "Müll", betrag: x.betrag ?? 300, schluessel: x.schluessel ?? "flaeche", umlagefaehig: x.umlagefaehig ?? true, ...x,
});
const m = (id: string, flaeche: number | null, von = "2020-01-01", bis: string | null = null): NkObjektMieter =>
  ({ id, name: id.toUpperCase(), flaeche, mietbeginn: von, mietende: bis });
const euro = (n: number) => `${n.toFixed(2).replace(".", ",")} €`;
const t = (over: Record<string, unknown> = {}) => ({
  vorname: "A", nachname: null, mieter_adresse: null, einheit: null, flaeche: 60, mietbeginn: "2020-01-01", mietende: null, nk_vorauszahlung: 100, ...over,
});

describe("A5 — Personenschlüssel: fehlende Personenzahl bleibt beim Vermieter", () => {
  it("K mit 2 Personen, B ohne Angabe: K zahlt 200 €, nicht 300 €", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 2, mea_gesamt: null, mieter: { k: { personen: 2 } } },
      [k({ schluessel: "personen", betrag: 300 })], [m("k", null), m("b", null)]);
    const p = e.positionen[0];
    expect(p.anteile.k.betrag).toBe(200);
    expect(p.anteile.b.betrag).toBe(0);
    expect(p.vermieter).toBe(100);
    expect(p.warnung).toMatch(/Anteil bleibt beim Vermieter/);
  });
});

describe("A4 — CO₂ im Mehrfamilienhaus einmal für das Gebäude", () => {
  const basis = { flaeche_gesamt: 130, einheiten: 2, mea_gesamt: null, co2_kg: 4000, co2_kosten: 220, co2_gewerbe: false };
  const heiz = k({ id: "h", bezeichnung: "Heizung / Warmwasser", betrag: 1400, schluessel: "direkt", werte: { k: 640, b: 760 } });
  const e = verteileObjektKosten(2025, basis, [heiz], [m("k", 60), m("b", 70)]);

  it("Stufe aus Gebäude-kg je m² GESAMTfläche: 4.000/130 = 30,8 → 40 % → 88 € für das Haus", () => {
    expect(e.co2?.gebaeude.spez).toBe(30.8);
    expect(e.co2?.gebaeude.vermieterProzent).toBe(40);
    expect(e.co2?.gebaeude.vermieterAnteil).toBe(88);
  });
  it("verteilt nach Heizkostenanteil: 88 × 640/1.400 = 40,23 €, 88 × 760/1.400 = 47,77 € — zusammen 88 €", () => {
    expect(e.co2?.gutschrift).toEqual({ k: 40.23, b: 47.77 });
    expect(e.co2?.grundlage).toBe("heizkosten");
  });
  it("die Abrechnung des Mieters zieht nur SEINE Gutschrift ab", () => {
    const c = co2FuerMieter(e, "k")!;
    expect(co2Gutschrift(c)).toBe(40.23);
    const a = berechneNk(2025, t(), null, [{ bezeichnung: "Heizung", betrag: 1400, umlageschluessel: null, umlagefaehig: true, jahr: 2025, aufteilung: "objekt", anteil: 640 }], null, null, { co2: c });
    expect(a.kostenNachCo2).toBe(599.77);
  });
  it("Leerstand: der Teil leerer Wohnungen wird niemandem gutgeschrieben", () => {
    const e2 = verteileObjektKosten(2025, basis, [k({ bezeichnung: "Heizkosten", betrag: 1400, schluessel: "flaeche" })], [m("k", 60)]);
    // Heizung nach Fläche: K 1400 × 60/130 = 646,15; Leerstand 753,85 → Gutschrift 88 × 646,15/1.400
    expect(e2.co2?.gutschrift.k).toBe(40.62);
    expect(e2.co2?.leerstand).toBe(47.38);
  });
  it("ohne Heizkosten am Objekt: nach Wohnfläche, mit Hinweis", () => {
    const e3 = verteileObjektKosten(2025, basis, [k({ bezeichnung: "Grundsteuer" })], [m("k", 60), m("b", 70)]);
    expect(e3.co2?.grundlage).toBe("flaeche");
    expect((e3.co2?.gutschrift.k ?? 0) + (e3.co2?.gutschrift.b ?? 0)).toBeCloseTo(88, 2);
    expect(e3.warnungen.join(" ")).toMatch(/keine Heizkosten/);
  });
  it("ohne Gesamtfläche keine Stufe — Warnung statt einer Gutschrift aus der Wohnfläche", () => {
    const e4 = verteileObjektKosten(2025, { ...basis, flaeche_gesamt: null }, [heiz], [m("k", 60), m("b", 70)]);
    expect(e4.co2).toBeNull();
    expect(e4.warnungen.join(" ")).toMatch(/Gesamtwohnfläche fehlt/);
  });
  it("EINE Regel für alle Abrechnungswege: im MFH zählt der Mieter-Block nicht mehr", () => {
    const zeile = { co2_kg: 4000, co2_kosten: 220, flaeche: 60, gewerbe: false };
    const mfh = nkCo2Argumente({ co2AmObjekt: true, co2: null, hinweise: [] }, zeile);
    expect(mfh.co2Input).toBeNull();
    expect(mfh.opts.co2).toBeNull();
    expect(mfh.opts.hinweise.join(" ")).toMatch(/zählen nicht mehr/);
    const efh = nkCo2Argumente({ co2AmObjekt: false, co2: null, hinweise: [] }, zeile);
    expect(efh.co2Input).toBe(zeile);
    expect(efh.opts.co2).toBeUndefined();
  });
  it("NK-Seite, PDF, Beleihungs-Mappe und Objektseite nehmen nkCo2Argumente", () => {
    for (const f of ["app/(app)/tenants/[id]/nk/page.tsx", "lib/pdf/erzeugen.ts", "lib/actions/beleihung.ts", "app/(app)/properties/[id]/nebenkosten/page.tsx"]) {
      expect(lies(f), f).toMatch(/nkCo2Argumente\(/);
    }
    expect(lies("app/(app)/tenants/[id]/nk/page.tsx")).toMatch(/nkPos\.co2AmObjekt \? \(/);
    expect(lies("lib/actions/nkco2.ts")).toMatch(/if \(await nkAmObjekt\(supabase, tenant\.prop_id/);
  });
});

describe("A6 — Heizkosten-Grundkosten bei Einzug im Jahr zeitanteilig (§ 9b HeizkostenV)", () => {
  it("Einzug 01.10.2025: 4.000 × 30 % × 60/120 × 92/365 + 4.000 × 70 % × 1.000/20.000 = 291,23 €", () => {
    const a = berechneNk(2025, t({ mietbeginn: "2025-10-01" }), null, [{
      bezeichnung: "Heizung", betrag: 4000, umlageschluessel: "HKVO", umlagefaehig: true, jahr: 2025, aufteilung: "hkvo",
      grundkosten_prozent: 30, flaeche_gesamt: 120, verbrauch_mieter: 1000, verbrauch_gesamt: 20000,
    }]);
    expect(a.positionen[0].betrag).toBe(291.23);
    expect(a.positionen[0].faktorText).toMatch(/92\/365 Tage/);
  });
});

describe("C22 — CO₂-Ausstoß auf eine Nachkommastelle gerundet (§ 5 Abs. 1 S. 3 CO2KostAufG)", () => {
  it("1.196 kg / 100 m² = 11,96 → 12,0 → Stufe 12 bis < 17 (10 % Vermieter)", () => {
    expect(spezAusstoss(1196, 100)).toBe(12);
    expect(findeStufe(spezAusstoss(1196, 100)).vermieter).toBe(10);
  });
});

describe("C25 — Verbrauch ohne Hauptzähler warnt", () => {
  it("die Warnung nennt den fehlenden Gesamtverbrauch", () => {
    const e = verteileObjektKosten(2025, { flaeche_gesamt: null, einheiten: 2, mea_gesamt: null },
      [k({ schluessel: "verbrauch", betrag: 100, werte: { k: 30, b: 70 } })], [m("k", null), m("b", null)]);
    expect(e.positionen[0].warnung).toMatch(/Hauptzähler fehlt/);
  });
});

describe("B6 — Vorauszahlung: „m × Rate“ nur, wenn es den Betrag ergibt", () => {
  it("Mietbeginn 16.04.2025, 150 €: 1.275 € heißt „anteilig“, nicht „9 × 150 €“", () => {
    const a = berechneNk(2025, t({ mietbeginn: "2025-04-16", nk_vorauszahlung: 150 }), null, []);
    expect(a.vorauszahlungGeleistet).toBe(1275);
    expect(vorauszahlungZusatz(a, euro)).toBe("vereinbart, anteilig für 9 Monate");
  });
  it("volles Jahr bleibt „12 × 150,00 €“", () => {
    const a = berechneNk(2025, t({ nk_vorauszahlung: 150 }), null, []);
    expect(vorauszahlungZusatz(a, euro)).toBe("12 × 150,00 €");
  });
  it("Seite und PDF nehmen den Zusatz aus EINER Funktion", () => {
    expect(lies("lib/pdf/nkPdf.ts")).toMatch(/vorauszahlungZusatz\(a, euro\)/);
    expect(lies("app/(app)/tenants/[id]/nk/page.tsx")).toMatch(/vorauszahlungZusatz\(a, eur2\)/);
  });
});

describe("B5 — Demo-Reset behält die Nebenkosten am Objekt", () => {
  const sql = lies("supabase/migrations/20261007193000_demo_reset_nk_objekt.sql");
  it("beide Tabellen stehen in der Reset-Liste NACH properties/mieter", () => {
    expect(sql).toMatch(/'properties', 'mieter', 'einnahmen', 'kosten', 'mieter_positionen',\s*'nk_objekt_jahr', 'nk_objekt_kosten',/);
  });
  it("der Schnappschuss enthält das Beispiel samt CO₂", () => {
    expect(sql).toMatch(/insert into demo_seed\.nk_objekt_kosten/);
    expect(sql).toMatch(/4000, 220, false/);
  });
});
