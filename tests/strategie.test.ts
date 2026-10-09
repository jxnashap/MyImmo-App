import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  HORIZONT_JAHRE,
  MAX_KAEUFE,
  OHNE_OBJEKT_ID,
  SZENARIO_VORSICHTIG,
  TAKTIKEN,
  WURZEL_ID,
  bestandAus,
  geldAus,
  kinder,
  leereStrategie,
  moeglicheQuellen,
  neuerKauf,
  prozentAus,
  rechneStrategie,
  strategieAus,
  type BestandObjekt,
  type KaufSchritt,
  type StrategieEntwurf,
} from "@/lib/strategie";

// Strategie (Umbau 06.10.2026). Die Zahlen hier sind VON HAND nachgerechnet (Annuität monatlich wie
// lib/kalk.ts `berechneRestschuld`), nicht aus der Funktion abgeschrieben. Grundannahmen der Fälle:
// Erspartes 50.000 €, Sparrate 1.000 €/Monat, Zins 4 %, Tilgung 2 %, keine Wertsteigerung,
// Bewirtschaftung 20 %, Grunderwerbsteuer 5 % + Notar/Grundbuch 2 %, kein Makler → Nebenkosten 7 %.

const START = 2026;

function plan(kaeufe: KaufSchritt[], teil: Partial<StrategieEntwurf> = {}): StrategieEntwurf {
  return {
    ...leereStrategie(),
    erspartes: "50.000",
    sparrate: "1.000",
    zins: "4",
    tilgung: "2",
    wertentwicklung: "0",
    bewirtschaftung: "20",
    beleihungsgrenze: "80",
    grest: "0.05",
    makler: "0",
    verkaufskosten: "0",
    kaeufe,
    ...teil,
  };
}

const kauf = (id: string, jahr: number, teil: Partial<KaufSchritt>): KaufSchritt => ({ ...neuerKauf(id, jahr), name: id, ...teil });
const A = kauf("A", 2026, { kaufpreis: "200.000", kaltmiete: "800", taktik: "ansparen", ekAnteil: "10" });

describe("ein Kauf aus Erspartem", () => {
  const r = rechneStrategie(plan([A]), [], START);
  const a = r.kaeufe[0];

  it("Eigenkapital = Nebenkosten 14.000 + 10 % = 34.000; Darlehen 180.000; Rate 900", () => {
    expect(a).toMatchObject({ gedeckt: true, ausBeleihung: 0, luecke: 0 });
    expect(a.nebenkosten).toBeCloseTo(14_000, 6);
    expect(a.ekBedarf).toBeCloseTo(34_000, 6);
    expect(a.ausErspartem).toBeCloseTo(34_000, 6);
    expect(a.darlehen).toBeCloseTo(180_000, 6);
    expect(a.rateMo).toBeCloseTo(900, 6);
    // 800 × 80 % − 900
    expect(a.ueberschussMo).toBeCloseTo(-260, 6);
    expect(a.eltern).toBe(WURZEL_ID);
  });

  it("Jahresende 2026: Erspartes 50.000 − 34.000 + 12.000 − 3.120; Restschuld nach 12 Raten", () => {
    expect(r.jahre[0]).toEqual({ jahr: 2026, objekte: 1, wert: 200_000, schulden: 176_333, eigenkapital: 23_667, erspartes: 24_880 });
    expect(r.jahre).toHaveLength(HORIZONT_JAHRE + 1);
    expect(r.jahre.at(-1)!.jahr).toBe(2036);
  });
});

describe("Beleihung: Kapital aus dem ersten Objekt (Stammbaum)", () => {
  const B = kauf("B", 2028, { kaufpreis: "150.000", kaltmiete: "600", taktik: "beleihung", ekAnteil: "10", quelle: "A" });

  it("Grenze 95 %: Spielraum 190.000 − 172.517,15 = 17.482,85 aus Beleihung, Rest aus Erspartem", () => {
    const r = rechneStrategie(plan([A, B], { beleihungsgrenze: "95" }), [], START);
    const b = r.kaeufe.find((k) => k.id === "B")!;
    expect(b.gedeckt).toBe(true);
    expect(b.ekBedarf).toBeCloseTo(25_500, 6);
    expect(b.ausBeleihung).toBeCloseTo(17_482.85, 1);
    expect(b.ausErspartem).toBeCloseTo(8_017.15, 1);
    expect(b.darlehen).toBeCloseTo(135_000, 6);
    // 135.000 × 6 % / 12 + 17.482,85 × 6 % / 12
    expect(b.rateMo).toBeCloseTo(675 + 87.414, 2);
    expect(b.eltern).toBe("A");
    expect(kinder(r.kaeufe, "A").map((k) => k.id)).toEqual(["B"]);
    expect(kinder(r.kaeufe, WURZEL_ID).map((k) => k.id)).toEqual(["A"]);
  });

  it("Grenze 80 %: kein Spielraum (Schulden über 160.000) — ehrlich gesagt, Eigenkapital kommt aus dem Ersparten", () => {
    const r = rechneStrategie(plan([A, B]), [], START);
    const b = r.kaeufe.find((k) => k.id === "B")!;
    expect(b.ausBeleihung).toBe(0);
    expect(b.ausErspartem).toBeCloseTo(25_500, 6);
    expect(b.hinweise.join(" ")).toMatch(/keinen Spielraum/);
  });

  it("das Beleihungs-Darlehen ist eine echte Schuld auf dem ersten Objekt — die Schulden steigen um fast den ganzen Betrag", () => {
    const mit = rechneStrategie(plan([A, B], { beleihungsgrenze: "95" }), [], START);
    const ohne = rechneStrategie(plan([A, B]), [], START);
    const jahr = (r: typeof mit) => r.jahre.find((j) => j.jahr === 2028)!;
    const mehr = jahr(mit).schulden - jahr(ohne).schulden;
    // 17.482,85 € aufgenommen, ein Jahr getilgt (2 % von 17.482,85 ≈ 350 €, plus ersparte Zinsen).
    expect(mehr).toBeGreaterThan(17_000);
    expect(mehr).toBeLessThan(17_482.85);
  });
});

describe("Lücke — und was daran hängt", () => {
  const C = kauf("C", 2026, { kaufpreis: "1.000.000", taktik: "ansparen", ekAnteil: "10" });
  const D = kauf("D", 2028, { kaufpreis: "100.000", taktik: "beleihung", quelle: "C" });

  it("Eigenkapital 170.000 bei 50.000 Erspartem: Lücke 120.000, der Kauf findet nicht statt", () => {
    const r = rechneStrategie(plan([C, D]), [], START);
    const c = r.kaeufe.find((k) => k.id === "C")!;
    expect(c).toMatchObject({ gedeckt: false, darlehen: 0 });
    expect(c.luecke).toBeCloseTo(120_000, 6);
    expect(r.jahre[0].objekte).toBe(0);
    expect(r.jahre[0].erspartes).toBe(62_000); // nichts ausgegeben, ein Jahr gespart
  });

  it("ein Kauf, der auf dem fehlenden Objekt aufbaut, findet seine Quelle nicht", () => {
    const r = rechneStrategie(plan([C, D]), [], START);
    const d = r.kaeufe.find((k) => k.id === "D")!;
    expect(d.gedeckt).toBe(false);
    expect(d.grund).toMatch(/nicht \(mehr\) da/);
    expect(d.luecke).toBeCloseTo(d.ekBedarf, 6);
  });

  it("ohne Kaufpreis wird nichts gerechnet", () => {
    const r = rechneStrategie(plan([kauf("X", 2026, { kaufpreis: "" })]), [], START);
    expect(r.kaeufe[0]).toMatchObject({ gedeckt: false, grund: "Kaufpreis fehlt" });
  });
});

describe("Verkauf und Bestand", () => {
  const bestand: BestandObjekt[] = [{ id: "X", name: "Wohnung Lübeck", wert: 300_000, kaufJahr: 2020, kredite: [{ restschuld: 100_000, monatsrate: 500, zinsProzent: 3 }] }];

  it("Raten des Bestands stecken in der Sparrate — ohne Kauf wächst das Ersparte genau um sie", () => {
    const r = rechneStrategie(plan([]), bestand, START);
    expect(r.jahre[0].erspartes).toBe(62_000);
    // Restschuld nach 12 Raten zu 500 € bei 3 %: 100.000 × 1,030416 − 500 × 12,1664
    expect(r.jahre[0].schulden).toBe(96_958);
    expect(r.jahre[0].objekte).toBe(1);
  });

  it("Verkauf 2027 (Kosten 3 %): Erlös 291.000 − 96.958,4 fließt ins Ersparte; Hinweis § 23 EStG (7 Jahre gehalten)", () => {
    const E = kauf("E", 2027, { kaufpreis: "250.000", taktik: "verkauf", ekAnteil: "0", quelle: "X" });
    const r = rechneStrategie(plan([E], { verkaufskosten: "3" }), bestand, START);
    const e = r.kaeufe[0];
    expect(e.erloes).toBeCloseTo(194_041.6, 0);
    expect(e.verfuegbar).toBeCloseTo(62_000 + 194_041.6, 0);
    expect(e.ekBedarf).toBeCloseTo(17_500, 6);
    expect(e.gedeckt).toBe(true);
    expect(e.hinweise.join(" ")).toMatch(/§ 23 EStG/);
    expect(r.jahre[1].objekte).toBe(1); // X verkauft, E gekauft
  });

  it("nach zehn Jahren kein Hinweis auf die Frist", () => {
    const E = kauf("E", 2031, { kaufpreis: "250.000", taktik: "verkauf", ekAnteil: "0", quelle: "X" });
    const r = rechneStrategie(plan([E]), bestand, START);
    expect(r.kaeufe[0].hinweise.join(" ")).not.toMatch(/§ 23/);
  });
});

describe("weitere Taktiken und Szenarien", () => {
  it("Vollfinanzierung: kein Eigenkapital, Darlehen = Kaufpreis + Nebenkosten — auch ohne Erspartes", () => {
    const F = kauf("F", 2026, { kaufpreis: "100.000", taktik: "vollfinanzierung", ekAnteil: "30" });
    const r = rechneStrategie(plan([F], { erspartes: "" }), [], START);
    expect(r.kaeufe[0]).toMatchObject({ gedeckt: true, ekBedarf: 0 });
    expect(r.kaeufe[0].darlehen).toBeCloseTo(107_000, 6);
  });

  it("nur Nebenkosten: der Anteil zählt nicht", () => {
    const N = kauf("N", 2026, { kaufpreis: "100.000", taktik: "nebenkosten", ekAnteil: "30" });
    expect(rechneStrategie(plan([N]), [], START).kaeufe[0].ekBedarf).toBeCloseTo(7_000, 6);
  });

  it("vorsichtig: Zins +1 Prozentpunkt, keine Wertsteigerung — auch wenn der Nutzer 3 % annimmt", () => {
    const p = plan([A], { wertentwicklung: "3" });
    const normal = rechneStrategie(p, [], START);
    const vorsichtig = rechneStrategie(p, [], START, SZENARIO_VORSICHTIG);
    expect(normal.jahre[0].wert).toBe(206_000);
    expect(vorsichtig.jahre[0].wert).toBe(200_000);
    expect(vorsichtig.kaeufe[0].rateMo).toBeCloseTo(1_050, 6); // 180.000 × 7 % / 12
  });
});

describe("Quellen, Bestand und Lesen", () => {
  it("Quelle nur aus dem Bestand oder früher — nie der Kauf selbst, nie ein späterer, nie der Sammelposten", () => {
    const k1 = kauf("k1", 2027, {});
    const k2 = kauf("k2", 2026, {});
    const k3 = kauf("k3", 2027, {});
    const bestand = [{ id: "P", name: "Haus" }, { id: OHNE_OBJEKT_ID, name: "Kredite ohne Objekt" }];
    expect(moeglicheQuellen([k1, k2, k3], k1, bestand).map((q) => q.id)).toEqual(["P", "k2"]);
    expect(moeglicheQuellen([k1, k2, k3], k3, bestand).map((q) => q.id)).toEqual(["P", "k2", "k1"]);
    expect(moeglicheQuellen([k1, k2, k3], k2, bestand).map((q) => q.id)).toEqual(["P"]);
  });

  it("Bestand aus MyImmo: Kredite je Objekt, Kredite ohne Objekt im Sammelposten, Kaufjahr aus dem Datum", () => {
    const b = bestandAus(
      [{ id: "p1", bezeichnung: "ETW", wert: 250_000, kaufdatum: "2019-05-01" }, { id: "p2", bezeichnung: "", wert: null, kaufdatum: null }],
      [
        { prop_id: "p1", restschuld: 120_000, monatsrate: 700, zinssatz: 2.5 },
        { prop_id: null, restschuld: 10_000, monatsrate: 200, zinssatz: 5 },
        { prop_id: "weg", restschuld: 5_000, monatsrate: null, zinssatz: null },
      ],
    );
    expect(b.map((x) => x.id)).toEqual(["p1", "p2", OHNE_OBJEKT_ID]);
    expect(b[0]).toEqual({ id: "p1", name: "ETW", wert: 250_000, kaufJahr: 2019, kredite: [{ restschuld: 120_000, monatsrate: 700, zinsProzent: 2.5 }] });
    expect(b[1]).toMatchObject({ name: "Objekt", wert: 0, kaufJahr: null, kredite: [] });
    expect(b[2].kredite).toHaveLength(2);
    expect(bestandAus([], [])).toEqual([]);
  });

  it("Plan aus dem Speicher: nur Version 1, nur bekannte Taktiken, Grunderwerbsteuer nur als Satz bis 10 %", () => {
    expect(strategieAus(null)).toBeNull();
    expect(strategieAus({ version: 2, kaeufe: [] })).toBeNull();
    const roh = {
      ...plan([]),
      grest: "35",
      kaeufe: [{ id: "a", taktik: "lottogewinn", jahr: "2027" }, ...Array.from({ length: 20 }, (_, i) => ({ id: `x${i}` }))],
    };
    const e = strategieAus(JSON.parse(JSON.stringify(roh)))!;
    expect(e.kaeufe).toHaveLength(MAX_KAEUFE);
    expect(e.kaeufe[0].taktik).toBe("ansparen");
    expect(e.grest).toBe("BW"); // Voreinstellung: Länderkürzel (B32)
    expect(strategieAus({ ...plan([]), grest: "0.065" })!.grest).toBe("0.065"); // älterer Plan: Satz bleibt lesbar
    expect(strategieAus({ ...plan([]), grest: "NI" })!.grest).toBe("NI");
  });

  it("Zahlen lesen: deutscher Tausenderpunkt bei Geld, Komma bei Prozent, Unsinn = 0", () => {
    expect(geldAus("1.250.000")).toBe(1_250_000);
    expect(geldAus("12,5")).toBe(12.5);
    expect(geldAus("-5")).toBe(0);
    expect(geldAus("abc")).toBe(0);
    expect(prozentAus("3,8")).toBe(3.8);
    expect(prozentAus("")).toBe(0);
    expect(prozentAus("1.2.3")).toBe(0);
    expect(prozentAus("500")).toBe(100);
  });
});

describe("keine Empfehlung", () => {
  it("Taktiken nennen Risiken, keine rät — und die Seite auch nicht", () => {
    const VERBOTEN = /empfehl|solltest|kannst dir .* leisten|du kannst kaufen|lohnt sich|jetzt kaufen|beste taktik|ideal/i;
    expect(VERBOTEN.test("die beste Taktik")).toBe(true);
    for (const t of TAKTIKEN) expect(t.risiken.length, t.id).toBeGreaterThan(0);
    const texte = TAKTIKEN.flatMap((t) => [t.titel, t.rechnung, ...t.risiken]);
    expect(texte.filter((t) => VERBOTEN.test(t))).toEqual([]);
    const ohneKommentare = (datei: string) => readFileSync(datei, "utf8").split("\n").filter((z) => !/^\s*(\/\/|\*|\{\/\*)/.test(z)).join("\n");
    expect(ohneKommentare("components/strategie/StrategiePlaner.tsx")).not.toMatch(VERBOTEN);
    expect(ohneKommentare("app/(app)/strategie/page.tsx")).not.toMatch(VERBOTEN);
    expect(readFileSync("components/strategie/StrategiePlaner.tsx", "utf8")).toContain("keine Anlage- oder Finanzierungsberatung");
  });
});
