import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { leereStrategie, rechneStrategie, restMonateImStartjahr, strategieAus, type StrategieEntwurf } from "@/lib/strategie";
import { berechneRestschuld, grestSatzAus, kaufnebenkostenSatz, landAus, BUNDESLAENDER } from "@/lib/kalk";
import { KP_ZU_SCHAETZUNG, bestwertDerZeile, objektPunkte, vergleichsWert, zaehlenderWert } from "@/lib/kauf/auswahl";
import { pruefeMachbarkeit, type MachbarkeitInput } from "@/lib/kauf/machbarkeit";
import { BEWIRTSCHAFTUNG_JE_JAHR, bewirtschaftungFuer, ertragswert } from "@/lib/bewertung/immowertv";
import { marktwert } from "@/lib/kauf/marktwert";
import { kennzahlenSummary, objektKennzahlen, type ObjektEingaben } from "@/lib/kauf/objektKennzahlen";
import { mitKomma } from "@/lib/zahl";
import { berechneFoerderung, grenzeHeizung, type FoerderEingabe, type FoerderPosten } from "@/lib/sanierung/foerderung";
import { leererEntwurf, massDe, mengeAus, neuerRaum, wohnflaecheAus, zuFoerderEingabe, type Entwurf, type RaumFeld } from "@/lib/sanierung/eingabe";
import { auswerten } from "@/lib/sanierung/auswertung";
import { ZUSTAND_GEWERKE } from "@/lib/sanierung/zustand";
import { KATALOG } from "@/lib/sanierung/katalog";
import BundeslandWahl from "@/components/BundeslandWahl";
import type { Kalkulation } from "@/lib/types";

// Gesamtprüfung 07.10.2026, Paket P9 (BuyImmo und Sanierung): B29–B37, C10, C28–C33, Zusammenführung 11.
// Jeder Block hält einen Referenzfall aus dem Bericht fest (docs/AUDIT-2026-10-07-gesamt.md).

vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));

const lies = (p: string) => readFileSync(p, "utf8");

// ---------------------------------------------------------------------------------------------
describe("B29 · Strategie: das Startjahr zählt nur die restlichen Monate", () => {
  const plan = (teil: Partial<StrategieEntwurf> = {}): StrategieEntwurf => ({
    ...leereStrategie(),
    erspartes: "79.000",
    sparrate: "1.250,50",
    kaeufe: [
      { id: "a", name: "Beispiel: erste Wohnung", jahr: "2026", kaufpreis: "180000", kaltmiete: "650", taktik: "ansparen", ekAnteil: "20", quelle: "" },
    ],
    ...teil,
  });

  it("Monate im Startjahr: Oktober → 3, Januar → 12, Dezember → 1, Unsinn → 12", () => {
    expect(restMonateImStartjahr(10)).toBe(3);
    expect(restMonateImStartjahr(1)).toBe(12);
    expect(restMonateImStartjahr(12)).toBe(1);
    expect(restMonateImStartjahr(0)).toBe(12);
    expect(restMonateImStartjahr(13)).toBe(12);
  });

  it("Stichtag Oktober: Erspartes − Eigenkapital + 3 × (Sparrate + Überschuss) — Audit ≈ 27.198 €", () => {
    const r = rechneStrategie(plan(), [], 2026, undefined, 10);
    const k = r.kaeufe[0];
    expect(k.gedeckt).toBe(true);
    expect(k.nebenkosten).toBeCloseTo(180_000 * kaufnebenkostenSatz(0.05, 3.57), 6); // 19.026 €
    const erwartet = 79_000 - k.ekBedarf + 3 * (1_250.5 + k.ueberschussMo);
    expect(r.jahre[0].erspartes).toBe(Math.round(erwartet));
    expect(Math.abs(r.jahre[0].erspartes - 27_198)).toBeLessThan(5);
    // Getilgt wird im Startjahr auch nur drei Monate.
    const zins = 0.01 * Number(leereStrategie().zins.replace(",", "."));
    expect(r.jahre[0].schulden).toBe(Math.round(berechneRestschuld(k.darlehen, zins, k.rateMo, 0.25)));
    // Ab dem Folgejahr volle zwölf Monate.
    expect(r.jahre[1].erspartes).toBe(Math.round(erwartet + 12 * (1_250.5 + k.ueberschussMo)));
  });

  it("ohne Startmonat (Januar) bleibt das volle Jahr — der Unterschied sind neun Monate", () => {
    const voll = rechneStrategie(plan(), [], 2026);
    const okt = rechneStrategie(plan(), [], 2026, undefined, 10);
    const k = okt.kaeufe[0];
    expect(voll.jahre[0].erspartes).toBe(Math.round(79_000 - k.ekBedarf + 12 * (1_250.5 + k.ueberschussMo)));
    expect(voll.jahre[0].erspartes).toBeGreaterThan(okt.jahre[0].erspartes + 9_000);
  });

  it("die Seite gibt den Monat des Berliner Stichtags weiter", () => {
    expect(lies("app/(app)/strategie/page.tsx")).toContain("startMonat={Number(heute.slice(5, 7))}");
    const planer = lies("components/strategie/StrategiePlaner.tsx");
    expect(planer).toMatch(/rechneStrategie\(e, bestand, startJahr, SZENARIO_ANNAHMEN, startMonat\)/);
    expect(planer).toMatch(/rechneStrategie\(e, bestand, startJahr, SZENARIO_VORSICHTIG, startMonat\)/);
  });
});

describe("C30 · Strategie: Verkauf nennt, was die Rechnung nicht abbildet", () => {
  it("Bestandsobjekt mit Darlehen: Vorfälligkeitsentschädigung und gleichbleibende Sparrate", () => {
    const e: StrategieEntwurf = {
      ...leereStrategie(),
      erspartes: "10000",
      sparrate: "500",
      kaeufe: [{ id: "k", name: "Neu", jahr: "2028", kaufpreis: "150000", kaltmiete: "600", taktik: "verkauf", ekAnteil: "20", quelle: "alt" }],
    };
    const bestand = [{ id: "alt", name: "Alt", wert: 200_000, kaufJahr: 2010, kredite: [{ restschuld: 80_000, monatsrate: 600, zinsProzent: 2 }] }];
    const h = rechneStrategie(e, bestand, 2026).kaeufe[0].hinweise.join(" ");
    expect(h).toMatch(/Vorfälligkeitsentschädigung/);
    expect(h).toMatch(/Sparrate bleibt in der Rechnung gleich/);
  });

  it("schuldenfreies Objekt: kein Hinweis auf eine Vorfälligkeitsentschädigung", () => {
    const e: StrategieEntwurf = {
      ...leereStrategie(),
      erspartes: "10000",
      kaeufe: [{ id: "k", name: "Neu", jahr: "2028", kaufpreis: "150000", kaltmiete: "600", taktik: "verkauf", ekAnteil: "20", quelle: "alt" }],
    };
    const bestand = [{ id: "alt", name: "Alt", wert: 200_000, kaufJahr: 2010, kredite: [] }];
    expect(rechneStrategie(e, bestand, 2026).kaeufe[0].hinweise.join(" ")).not.toMatch(/Vorfälligkeit/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("B30 · Vergleich: Kaufpreis gegenüber der Schätzung, vorläufig zählt nicht, 0 zählt nicht", () => {
  const A = { id: "A", summary: { kp: 500_000, marktwert: 400_000, marktwertVorlaeufig: 0 } };
  const B = { id: "B", summary: { kp: 100_000, marktwert: 150_000, marktwertVorlaeufig: 0 } };

  it("Audit-Referenz: A (500k/400k) gegen B (100k/150k) → B liegt besser", () => {
    expect(vergleichsWert(A.summary, KP_ZU_SCHAETZUNG)).toBeCloseTo(25, 6);
    expect(vergleichsWert(B.summary, KP_ZU_SCHAETZUNG)).toBeCloseTo(-33.333, 2);
    expect(bestwertDerZeile([A, B], KP_ZU_SCHAETZUNG, "low")).toBeCloseTo(-33.333, 2);
    // Der höhere absolute Marktwert (A) ist kein Bestwert mehr.
    const zeilen = lies("components/kauf/ObjektVergleich.tsx");
    expect(zeilen).toMatch(/key: "marktwert", label: "Marktwert \(geschätzt\)", fmt: eur, better: "none"/);
    expect(objektPunkte([A, B], [{ key: "marktwert", better: "none" }, { key: KP_ZU_SCHAETZUNG, better: "low" }])).toEqual({ A: 0, B: 1 });
  });

  it("vorläufige Schätzung (oder Altbestand ohne Merkmal) zählt nicht für Grün und Krone", () => {
    const Bv = { id: "B", summary: { ...B.summary, marktwertVorlaeufig: 1 } };
    expect(zaehlenderWert(Bv.summary, KP_ZU_SCHAETZUNG)).toBeNull();
    expect(bestwertDerZeile([A, Bv], KP_ZU_SCHAETZUNG, "low")).toBeNull();
    const alt = { id: "B", summary: { kp: 100_000, marktwert: 150_000 } };
    expect(zaehlenderWert(alt.summary, KP_ZU_SCHAETZUNG)).toBeNull();
    expect(vergleichsWert(alt.summary, KP_ZU_SCHAETZUNG)).not.toBeNull(); // angezeigt wird sie trotzdem
  });

  it("die Krone zählt 0-Werte nicht (vorher {A: 5, B: 1}, obwohl die Zelle „–“ zeigt)", () => {
    const x = { id: "x", summary: { kp: 100_000, faktor: 0, preisM2: 0 } };
    const y = { id: "y", summary: { kp: 200_000, faktor: 25, preisM2: 3_000 } };
    const p = objektPunkte([x, y], [{ key: "kp", better: "low" }, { key: "faktor", better: "low" }, { key: "preisM2", better: "low" }]);
    expect(p).toEqual({ x: 1, y: 0 });
  });

  it("Tabelle: „vorläufig“ steht an der Schätzung, Zelle nicht grün", async () => {
    const { default: ObjektVergleich } = await import("@/components/kauf/ObjektVergleich");
    const k = (id: string, s: Record<string, number>) => ({ id, name: id, data: {}, summary: s, created_at: "2026-10-09" }) as unknown as Kalkulation;
    const html = renderToStaticMarkup(
      createElement(ObjektVergleich, {
        liste: [k("A", { kp: 500_000, marktwert: 400_000, marktwertVorlaeufig: 1 }), k("B", { kp: 100_000, marktwert: 150_000, marktwertVorlaeufig: 1 })],
        auswahl: ["A", "B"], setAuswahl: () => {}, bearbeiteId: null, gewaehltId: null,
        onBearbeiten: () => {}, onLoeschen: () => {}, onWaehlen: () => {},
      }),
    );
    expect(html).toContain("Kaufpreis ggü. Schätzung");
    expect(html).toContain("+25,0 %");
    expect(html).toContain("−33,3 %");
    expect((html.match(/ · vorläufig/g) ?? []).length).toBe(4); // Marktwert + Abweichung, je Objekt
    const zeile = html.slice(html.indexOf("Kaufpreis ggü. Schätzung"));
    expect(zeile.slice(0, zeile.indexOf("</tr>"))).not.toContain("vergleich-best");
  });
});

// ---------------------------------------------------------------------------------------------
describe("B31 · Machbarkeit: ohne Darlehenswunsch gegen die Nebenkosten", () => {
  const basis: MachbarkeitInput = {
    darlehen: 265_897, rate: 0, kaufpreis: 245_000, gesamtInvest: 270_897, kaltmieteNeu: 0,
    haushaltsNetto: 0, mieteinnahmenBestehend: 0, ausgabenFix: 0, anzahlPersonen: 1, eigenkapital: 5_000,
  };
  const ek = (i: MachbarkeitInput) => pruefeMachbarkeit(i).checks.find((c) => c.key === "ek")!;

  it("Audit-Referenz: EK 5.000 € < Nebenkosten 25.897 € → rot (vorher grün „5.000 € vorhanden · 5.000 € nötig“)", () => {
    const c = ek(basis);
    expect(c.ampel).toBe("rot");
    expect(c.label).toBe("Eigenkapital deckt die Kaufnebenkosten");
    expect(c.wert).toMatch(/€ 25\.897 Nebenkosten/);
    expect(ek({ ...basis, eigenkapital: 26_000 }).ampel).toBe("gruen");
  });

  it("mit Darlehenswunsch wird die ganze Lücke geprüft; der Assistent gibt das Merkmal mit", () => {
    expect(ek({ ...basis, darlehen: 200_000, darlehenAusWunsch: true, eigenkapital: 30_000 }).ampel).toBe("gelb");
    expect(ek({ ...basis, darlehen: 200_000, darlehenAusWunsch: true, eigenkapital: 80_000 }).ampel).toBe("gruen");
    expect(lies("components/KaufAssistent.tsx")).toContain("darlehenAusWunsch: !!(darlehenWunsch?.darlehen && darlehenWunsch.darlehen > 0)");
  });
});

// ---------------------------------------------------------------------------------------------
describe("B32 + Zusammenführung 11 · eine Bundesland-Auswahl, Wert = Kürzel", () => {
  it("16 Länder mit eindeutigem Kürzel; Satz aus Kürzel oder Altbestand", () => {
    expect(BUNDESLAENDER).toHaveLength(16);
    expect(new Set(BUNDESLAENDER.map((b) => b.k)).size).toBe(16);
    expect(grestSatzAus("NI")).toBe(0.05);
    expect(grestSatzAus("HE")).toBe(0.06);
    expect(grestSatzAus("0.065")).toBe(0.065); // gespeicherter Satz
    expect(grestSatzAus("35")).toBe(0);
    expect(grestSatzAus("XX")).toBe(0);
    expect(landAus("ST")?.l).toMatch(/Sachsen-Anhalt/);
  });

  it("Niedersachsen bleibt Niedersachsen (vorher: Baden-Württemberg, erster gleicher Satz)", () => {
    const html = renderToStaticMarkup(createElement(BundeslandWahl, { wert: "NI", onWahl: () => {} }));
    expect(html).toMatch(/<option value="NI" selected="">Niedersachsen/);
    expect(html).not.toMatch(/<option value="BW" selected="">/);
  });

  it("Altbestand mit Satz: eigene Zeile „Bundesland nicht gespeichert“, kein falsches Land", () => {
    const html = renderToStaticMarkup(createElement(BundeslandWahl, { wert: "0.05", onWahl: () => {} }));
    expect(html).toMatch(/<option value="0.05" selected="">5,0 % \(Bundesland nicht gespeichert\)/);
  });

  it("nur EINE Stelle baut die Auswahl — alle drei Rechner nehmen BundeslandWahl", () => {
    for (const f of ["components/NebenkostenRechner.tsx", "components/kauf/ObjektRechner.tsx", "components/strategie/StrategiePlaner.tsx"]) {
      const s = lies(f);
      expect(s, f).toContain("<BundeslandWahl");
      expect(s, f).not.toContain("BUNDESLAENDER.map");
    }
  });

  it("Kaufprüfung und Strategie rechnen mit dem Kürzel denselben Satz wie früher mit dem Wert", () => {
    const eingabe = (bundesland: string): ObjektEingaben => ({
      kaufpreis: "200000", flaeche: "70", bundesland, makler: "3,57", sanierung: "", nutzung: "vermietung", kaltmiete: "700", bewirt: "20",
      objektTyp: "wohnung", grundFlaeche: "", bodenrichtwert: "", baujahr: "1990", gebTyp: "efh", ausstattung: "3", bpiFaktor: "1,9",
      regionalFaktor: "1,0", lz: "3,5", anzahlWhg: "1", swFaktor: "1,0", bewertungsjahr: "2026",
    });
    expect(objektKennzahlen(eingabe("SN")).nebenkosten).toBeCloseTo(objektKennzahlen(eingabe("0.055")).nebenkosten, 6);
    expect(strategieAus({ ...leereStrategie(), grest: "SN" })!.grest).toBe("SN");
  });
});

// ---------------------------------------------------------------------------------------------
describe("B33 · Ertragswert mit den Bewirtschaftungskosten des Stichtagsjahrs", () => {
  const halle = {
    jahresnettokaltmiete: 560 * 12, wohnflaeche: 66, anzahlWohnungen: 1, istEtw: true,
    bodenrichtwert: 0, grundstuecksflaeche: 0, liegenschaftszins: 3.5, restnutzungsdauer: 24,
  };

  it("Audit-Referenz Halle: 2026 → 83.442 € (mit den Werten von 2021 waren es 87.621 €)", () => {
    expect(Math.round(ertragswert({ ...halle, stichtagJahr: 2026 }).wert)).toBe(83_442);
    expect(Math.round(ertragswert({ ...halle, stichtagJahr: 2021 }).wert)).toBe(87_621);
  });

  it("Tabelle: 2021 = Wortlaut Anlage 3, 2026 = veröffentlichte Fortschreibung (Brandenburg, VPI 123,0 / 77,1)", () => {
    expect(BEWIRTSCHAFTUNG_JE_JAHR[2021]).toEqual({ verwaltungWohnung: 298, verwaltungEtw: 357, verwaltungGarage: 39, instandhaltungProM2: 11.7, instandhaltungGarage: 88 });
    expect(BEWIRTSCHAFTUNG_JE_JAHR[2026]).toEqual({ verwaltungWohnung: 367, verwaltungEtw: 439, verwaltungGarage: 48, instandhaltungProM2: 14.4, instandhaltungGarage: 108 });
    // Probe gegen die Formel aus Anlage 3 Nr. III (Basis 230 €/275 €/9,00 €).
    const faktor = 123.0 / 77.1;
    expect(Math.round(230 * faktor)).toBe(367);
    expect(Math.round(275 * faktor)).toBe(439);
    expect(Math.round(9 * faktor * 10) / 10).toBe(14.4);
    const jahre = Object.keys(BEWIRTSCHAFTUNG_JE_JAHR).map(Number);
    for (let i = 1; i < jahre.length; i++) {
      expect(BEWIRTSCHAFTUNG_JE_JAHR[jahre[i]].verwaltungWohnung).toBeGreaterThan(BEWIRTSCHAFTUNG_JE_JAHR[jahre[i - 1]].verwaltungWohnung);
    }
  });

  it("Jahr hinter der Tabelle: letzte Zeile UND eine Warnung — nie still", () => {
    const b = bewirtschaftungFuer(2030);
    expect(b.veraltet).toBe(true);
    expect(b.jahr).toBe(2026);
    expect(ertragswert({ ...halle, stichtagJahr: 2030 }).warnungen.join(" ")).toMatch(/2030 sind noch nicht eingetragen/);
    expect(ertragswert({ ...halle, stichtagJahr: 2026 }).warnungen.join(" ")).not.toMatch(/noch nicht eingetragen/);
  });

  it("der Bewertungs-Assistent gibt sein Jahr weiter", () => {
    expect(lies("components/BewertungAssistent.tsx")).toContain("restnutzungsdauer: rnd, stichtagJahr: jahr,");
  });
});

describe("C28 · gespeicherte Kaufprüfungen altern nicht mit dem Kalender", () => {
  afterEach(() => vi.useRealTimers());
  const eingabe: ObjektEingaben = {
    kaufpreis: "150000", flaeche: "60", bundesland: "SN", makler: "3,57", sanierung: "", nutzung: "vermietung", kaltmiete: "550", bewirt: "20",
    objektTyp: "wohnung", grundFlaeche: "", bodenrichtwert: "", baujahr: "1995", gebTyp: "efh", ausstattung: "3", bpiFaktor: "1,9",
    regionalFaktor: "1,0", lz: "3,5", anzahlWhg: "1", swFaktor: "1,0",
  };

  it("mit Bewertungsjahr: 2027 rechnet dasselbe wie 2026; ohne: anders (der Test sieht den Unterschied)", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-09T10:00:00Z"));
    const fest2026 = kennzahlenSummary(objektKennzahlen({ ...eingabe, bewertungsjahr: "2026" }));
    const ohne2026 = kennzahlenSummary(objektKennzahlen(eingabe));
    vi.setSystemTime(new Date("2027-03-01T10:00:00Z"));
    expect(kennzahlenSummary(objektKennzahlen({ ...eingabe, bewertungsjahr: "2026" }))).toEqual(fest2026);
    expect(kennzahlenSummary(objektKennzahlen(eingabe)).marktwert).not.toBe(ohne2026.marktwert);
  });

  it("marktwert() nennt das Jahr, mit dem er gerechnet hat", () => {
    const m = marktwert({
      nutzung: "vermietung", objektTyp: "wohnung", wohnflaeche: 60, kaltmieteMonat: 550, anzahlWohnungen: 1, grundFlaeche: 0,
      bodenrichtwert: 0, baujahr: 1995, gebTyp: "efh", ausstattung: 3, bpiFaktor: 1.9, regionalFaktor: 1, liegenschaftszins: 3.5,
      sachwertfaktor: 1, stichtagJahr: 2026,
    });
    expect(m.stichtagJahr).toBe(2026);
  });

  it("der Rechner speichert das Bewertungsjahr mit", () => {
    const s = lies("components/kauf/ObjektRechner.tsx");
    const block = s.slice(s.indexOf("function eingabenSnapshot()"), s.indexOf("function summarySnapshot()"));
    expect(block).toContain("const bewertungsjahr = heuteBerlin().slice(0, 4);");
    expect(block).toMatch(/swFaktor, bewertungsjahr,/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("B34 · keine wertenden Formulierungen im Kaufweg (§ 34i)", () => {
  // Kommentare zählen nicht — dort wird die Regel ja gerade erklärt.
  const ohneKommentare = (s: string) =>
    s
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .split("\n")
      .filter((z) => !/^\s*(\/\/|\*)/.test(z))
      .join("\n");
  const dateien = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  const ORTE = [
    ...dateien("components/kauf"),
    ...dateien("lib/kauf"),
    ...dateien("components/strategie"),
    "components/KaufAssistent.tsx",
    "lib/strategie.ts",
  ];
  const VERBOTEN =
    /starke rendite|solide rendite|ordentlich — genau rechnen|lage & wertsteigerung setzen|asymmetrisch günstig|besser zusätzlich|faustregel|solltest|lohnt sich|jetzt kaufen|schnäppchen|attraktiv|\bsolide\b/i;

  it("durchsucht genug Dateien (sonst prüft der Wächter nichts)", () => {
    expect(ORTE.length).toBeGreaterThan(20);
  });

  it("keine Datei enthält eine Wertung", () => {
    const treffer = ORTE.filter((f) => VERBOTEN.test(ohneKommentare(lies(f)))).map((f) => `${f}: ${ohneKommentare(lies(f)).match(VERBOTEN)![0]}`);
    expect(treffer).toEqual([]);
  });

  it("Probe: die alten Wörter würden gefunden", () => {
    expect(VERBOTEN.test('return { text: "Starke Rendite", farbe: "var(--green)" };')).toBe(true);
    expect(VERBOTEN.test("lange Bindung ist also asymmetrisch günstig.")).toBe(true);
    expect(VERBOTEN.test('titel: "Szenario A · solide",')).toBe(true);
  });

  it("Bruttorendite und Kaufpreisfaktor beschreiben nur (C29)", () => {
    const s = lies("components/kauf/ObjektRechner.tsx");
    expect(s).toContain('note: "Jahreskaltmiete ÷ Kaufpreis"');
    expect(s).toContain('note: "Kaufpreis in Jahreskaltmieten"');
    expect(s).not.toMatch(/Amortisation/);
  });
});

describe("B35 · Anführungszeichen „…“ überall", () => {
  const dateien = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      const p = join(dir, n);
      return statSync(p).isDirectory() ? dateien(p) : /\.(ts|tsx)$/.test(n) ? [p] : [];
    });
  const alle = [...dateien("components"), ...dateien("app"), ...dateien("lib")];

  it("kein „…&quot; mehr (die Lint-Bereinigung vom 03.10. hatte das falsche Zeichen nur maskiert)", () => {
    expect(alle.length).toBeGreaterThan(400);
    const treffer = alle.filter((f) => /„[^“\n]{0,120}&quot;/.test(lies(f)));
    expect(treffer).toEqual([]);
  });

  it("Toast und Kopfzeile beim Bearbeiten, Bildschirmleser-Text im KI-Import", () => {
    const r = lies("components/kauf/ObjektRechner.tsx");
    expect(r).toContain("zum Bearbeiten geladen.`);");
    expect(r).toMatch(/toast\(`„\$\{k\.name\}“ zum Bearbeiten geladen\.`\)/);
    expect(lies("components/kalkulator/KalkImport.tsx")).toContain("`„Aus Anzeige übernehmen“ ");
  });
});

describe("C10 · Vorbelegung mit Komma", () => {
  it("„3.57“ wird „3,57“ — „3.570“ (Tausenderpunkt) bleibt, wie es ist", () => {
    expect(mitKomma("3.57")).toBe("3,57");
    expect(mitKomma("1.9")).toBe("1,9");
    expect(mitKomma("3.570")).toBe("3.570");
    expect(mitKomma("3,5")).toBe("3,5");
    expect(mitKomma("250000")).toBe("250000");
  });

  it("der Rechner belegt Makler, Liegenschaftszins und Faktoren mit Komma vor", () => {
    const s = lies("components/kauf/ObjektRechner.tsx");
    expect(s).toContain("const MAKLER_STANDARD = mitKomma(String(MAKLER_STANDARD_PROZENT));");
    for (const v of ['useState("1,9")', 'useState("1,0")', 'useState("3,5")']) expect(s).toContain(v);
    expect(s).not.toMatch(/useState\("\d+\.\d"\)/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("B36 · KfW 458: die Eigentumswohnung bekommt ihren Anteil am Gebäude-Höchstbetrag", () => {
  const posten = (art: FoerderPosten["art"], betrag: number): FoerderPosten => ({ id: art, bezeichnung: art, betrag, art });
  const ein = (p: FoerderPosten[], teil: Partial<FoerderEingabe> = {}): FoerderEingabe => ({
    posten: p, wohneinheiten: 1, isfp: false, nutzung: "vermieten", gebaeude: "mfh", stichtag: "2026-10-07", ...teil,
  });
  const heizung = (e: FoerderEingabe) => berechneFoerderung(e).toepfe.find((t) => t.programm === "KfW 458");

  it("KfW-Beispiel: 5 WE, 1 betroffen → (28.000 + 4 × 15.000) / 5 = 17.600 €", () => {
    expect(grenzeHeizung(1, "2026-10-07", 5)).toBe(17_600);
    expect(grenzeHeizung(5, "2026-10-07", 5)).toBe(88_000);
    expect(grenzeHeizung(1, "2026-10-07")).toBe(28_000); // ganzes Gebäude betroffen (EFH)
  });

  it("Audit-Referenz: ETW, Wärmepumpe 36.000 €, 5 WE → Zuschuss 5.280 € (vorher 8.400 €)", () => {
    const t = heizung(ein([posten("heizung", 36_000)], { wohneinheitenGebaeude: 5 }))!;
    expect(t.grenze).toBe(17_600);
    expect(t.zuschuss).toBe(5_280);
  });

  it("Zahl der Wohneinheiten fehlt: vorsichtig 8.000 € je Wohnung, mit Hinweis — nie die Grenze des ganzen Hauses", () => {
    const r = berechneFoerderung(ein([posten("heizung", 36_000)]));
    expect(r.toepfe[0].grenze).toBe(8_000);
    expect(r.hinweise.join(" ")).toMatch(/Wohneinheiten im Gebäude ein/);
    // Untergrenze gilt wirklich bei jeder Hausgröße.
    for (let n = 1; n <= 200; n++) expect(grenzeHeizung(1, "2026-10-07", n)).toBeGreaterThan(8_000);
  });

  it("Heizungsoptimierung (Nr. 5.4 a): es zählt das Gebäude, nicht die eine Wohnung", () => {
    const sechs = berechneFoerderung(ein([posten("optimierung", 3_000)], { wohneinheitenGebaeude: 6 }));
    expect(sechs.toepfe).toEqual([]);
    expect(sechs.ausgeschlossen[0].grund).toMatch(/Gebäuden mit höchstens 5/);
    const unbekannt = berechneFoerderung(ein([posten("optimierung", 3_000)]));
    expect(unbekannt.ausgeschlossen[0].grund).toMatch(/Wohneinheiten im Gebäude fehlen/);
    expect(berechneFoerderung(ein([posten("optimierung", 3_000)], { wohneinheitenGebaeude: 4 })).toepfe[0].zuschuss).toBe(450);
  });

  it("Formular: „Wohneinheiten im ganzen Haus“ geht in die Rechnung, leer = unbekannt", () => {
    const e = leererEntwurf("x");
    expect(zuFoerderEingabe({ ...e, foerder: { ...e.foerder, weGebaeude: "8" } }, "2026-10-07").wohneinheitenGebaeude).toBe(8);
    expect(zuFoerderEingabe(e, "2026-10-07").wohneinheitenGebaeude).toBeUndefined();
    expect(lies("components/sanierung/GuideSeiten.tsx")).toContain('id="foerder-we-gebaeude"');
  });
});

describe("C33 · Datum der Richtlinie BEG EM — beide Fassungen benannt", () => {
  it("Code und Doku nennen Bundesanzeiger-Fassung und BMWE-Vorabfassung", () => {
    const code = lies("lib/sanierung/foerderung.ts");
    expect(code).toContain("„vom 17. August 2026“");
    expect(code).toContain("„vom 17. Juli 2026“");
    const doku = lies("docs/kauf/KfW-Foerderung-2026.md");
    expect(doku).toMatch(/„vom 17\. Juli 2026“/);
    expect(doku).toMatch(/BAnz AT 27\.08\.2026 B1/);
  });
});

// ---------------------------------------------------------------------------------------------
const raum = (teil: Partial<RaumFeld>): RaumFeld => ({ ...neuerRaum(teil.id ?? "r", 1), massnahmenBestaetigt: true, ...teil });
function fertig(): Entwurf {
  const e = leererEntwurf("t");
  e.projekt = {
    ...e.projekt, name: "Muster", etw: "nein", baujahr: "2005", wohnflaeche: "60", nutzung: "vermieten",
    wer: { maler: "selbst", boden: "selbst", fliesen: "selbst" }, puffer: "10", entsorgung: "keine",
  };
  e.raeume = [];
  for (const g of ZUSTAND_GEWERKE) e.gewerke[g.gewerk] = { zustand: "gut", arbeiten: [] };
  return e;
}

describe("B37 · Wohnfläche „1.050“ ist 1.050 m² — wie in der Kaufprüfung", () => {
  it("Lesart: Tausenderpunkt, Komma, Punkt mit einer Nachkommastelle", () => {
    expect(wohnflaecheAus("1.050")).toBe(1050);
    expect(wohnflaecheAus("72,5")).toBe(72.5);
    expect(wohnflaecheAus("72.5")).toBe(72.5);
    expect(wohnflaecheAus("")).toBeNull();
  });

  it("Elektrik nach Wohnfläche: 1.050 m² (vorher 1,05 m²)", () => {
    const e = fertig();
    e.projekt.wohnflaeche = "1.050";
    e.gewerke.elektrik = { zustand: "schlecht", arbeiten: ["elektrik_komplett"] };
    const z = auswerten(e, KATALOG).zeilen.find((x) => x.arbeit === "elektrik_komplett")!;
    expect(z.menge).toBe(1050);
  });

  it("unter 10 m² sagt die Auswertung, dass das kaum stimmen kann", () => {
    const e = fertig();
    e.projekt.wohnflaeche = "1,05";
    expect(auswerten(e, KATALOG).hinweise.map((h) => h.id)).toContain("wohnflaeche-klein");
    expect(auswerten(fertig(), KATALOG).hinweise.map((h) => h.id)).not.toContain("wohnflaeche-klein");
  });
});

describe("C31 · Fliesenleger: Kleber und Fuge stecken im Preis", () => {
  const badRaum = () => raum({ id: "b", typ: "bad", name: "Bad", laenge: "2", breite: "2", hoehe: "2,5", fliesenhoehe: "2", massnahmen: ["boden_fliesen", "wand_fliesen"], altbelag: "keiner", wandfliesenRaus: "nein" });

  it("Handwerker: Fliese ja, Kleber und Fugenmörtel nein", () => {
    const e = fertig();
    e.projekt.wer.fliesen = "handwerker";
    e.raeume = [badRaum()];
    const ids = auswerten(e, KATALOG).material.map((m) => m.material.id);
    expect(ids).toContain("fliese");
    expect(ids).not.toContain("fliesenkleber");
    expect(ids).not.toContain("fugenmoertel");
  });

  it("selbst gefliest: Kleber und Fugenmörtel stehen auf dem Einkaufszettel", () => {
    const e = fertig();
    e.raeume = [badRaum()];
    const ids = auswerten(e, KATALOG).material.map((m) => m.material.id);
    expect(ids).toEqual(expect.arrayContaining(["fliese", "fliesenkleber", "fugenmoertel"]));
  });
});

describe("C32 · Maße: nur Rand-Leerzeichen werden entfernt", () => {
  it("„4 125“ ist ein Tippfehler, keine 4.125 m", () => {
    expect(massDe("4 125")).toBe(0);
    expect(massDe(" 4,125 ")).toBe(4.125);
    expect(mengeAus("4 125")).toBeNull();
    expect(mengeAus(" 12 ")).toBe(12);
  });
});
