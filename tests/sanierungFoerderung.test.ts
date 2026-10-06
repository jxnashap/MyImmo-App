import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { createElement, type ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  berechneFoerderung,
  grenzeBafa,
  grenzeExperte,
  grenzeHeizung,
  heizungErsteWohneinheit,
  type FoerderEingabe,
  type FoerderPosten,
} from "@/lib/sanierung/foerderung";
import { entwurfAus, zuFoerderEingabe, leererEntwurf } from "@/lib/sanierung/eingabe";
import { PROGRAMME } from "@/lib/kauf/foerderung";

// Förderung im Sanierungsrechner (05.10.2026). Erwartungswerte stammen aus den Quellen selbst:
// Richtlinie BEG EM vom 17.08.2026 (Staffel der Heizungsgrenze), BAFA-Merkblatt (iSFP-Beispiel
// 40.000 €) und bafa.de Gebäudehülle (3 Wohneinheiten = 60.000 €).

const posten = (art: FoerderPosten["art"], betrag: number, id = art): FoerderPosten => ({ id, bezeichnung: id, betrag, art });
const ein = (p: FoerderPosten[], teil: Partial<FoerderEingabe> = {}): FoerderEingabe => ({
  posten: p,
  wohneinheiten: 1,
  isfp: false,
  nutzung: "vermieten",
  gebaeude: "mfh",
  stichtag: "2026-10-05",
  ...teil,
});
const topf = (e: FoerderEingabe, programm: string) => berechneFoerderung(e).toepfe.find((t) => t.programm === programm);

describe("Höchstgrenzen nach Wohneinheiten", () => {
  it("BAFA: 30.000 / 15.000 / 8.000 €, mit iSFP 60.000 / 30.000 / 15.000 €", () => {
    expect(grenzeBafa(1, false)).toBe(30_000);
    // bafa.de: „bei einem Wohngebäude mit 3 Wohneinheiten … mindestens 60.000 Euro“
    expect(grenzeBafa(3, false)).toBe(60_000);
    expect(grenzeBafa(10, false)).toBe(137_000); // 30 + 5 × 15 + 4 × 8
    expect(grenzeBafa(10, true)).toBe(270_000); // 60 + 5 × 30 + 4 × 15
    expect(grenzeBafa(0, false)).toBe(30_000); // Unsinn → eine Einheit
  });

  it("KfW 458: erste Wohneinheit sinkt nach dem Plan der Richtlinie (Nr. 8.3.1 a)", () => {
    const plan: [string, number][] = [
      ["2026-07-21", 28_000],
      ["2027-01-31", 28_000],
      ["2027-02-01", 27_250],
      ["2027-07-31", 27_250],
      ["2027-08-01", 26_500],
      ["2028-02-01", 25_750],
      ["2028-08-01", 25_000],
      ["2029-02-01", 24_250],
      ["2029-08-01", 23_500],
      ["2030-02-01", 22_750],
      ["2030-08-01", 22_000],
      ["2035-01-01", 22_000],
    ];
    for (const [tag, betrag] of plan) expect(heizungErsteWohneinheit(tag), tag).toBe(betrag);
    expect(grenzeHeizung(2, "2026-10-05")).toBe(43_000); // kfw.de-Beispiel: 28.000 + 15.000
  });

  it("Experte: Ein-/Zweifamilienhaus 5.000 €, Mehrfamilienhaus 2.000 € je Einheit, höchstens 20.000 €", () => {
    expect(grenzeExperte(1, "haus")).toBe(5_000);
    expect(grenzeExperte(2, "haus")).toBe(5_000);
    // Eigentumswohnung im Mehrfamilienhaus: die GEBÄUDEART zählt, nicht die eine betroffene Einheit.
    expect(grenzeExperte(1, "mfh")).toBe(2_000);
    expect(grenzeExperte(4, "mfh")).toBe(8_000);
    expect(grenzeExperte(12, "mfh")).toBe(20_000);
  });
});

describe("Zuschuss", () => {
  it("BAFA 15 %, gedeckelt — ohne iSFP 50.000 € → 4.500 €", () => {
    expect(topf(ein([posten("huelle", 50_000)]), "BAFA")).toMatchObject({ kosten: 50_000, foerderfaehig: 30_000, zuschuss: 4_500 });
  });

  it("iSFP: Bonus nur auf den Teil über der Grenze ohne iSFP (BAFA-Merkblatt: 40.000 € → Bonus auf 10.000 €)", () => {
    expect(topf(ein([posten("huelle", 40_000)], { isfp: true }), "BAFA")?.zuschuss).toBe(6_500); // 30.000 × 15 % + 10.000 × 20 %
    expect(topf(ein([posten("huelle", 50_000)], { isfp: true }), "BAFA")?.zuschuss).toBe(8_500);
    expect(topf(ein([posten("huelle", 20_000)], { isfp: true }), "BAFA")?.zuschuss).toBe(3_000); // unter der Grenze: kein Bonus
  });

  it("Hülle, Lüftung und Heizungsoptimierung teilen sich EINE Grenze; die Heizung hat ihre eigene", () => {
    const e = ein([posten("huelle", 20_000), posten("anlage", 8_000), posten("optimierung", 5_000), posten("heizung", 35_000)]);
    expect(topf(e, "BAFA")).toMatchObject({ kosten: 33_000, foerderfaehig: 30_000, zuschuss: 4_500 });
    expect(topf(e, "KfW 458")).toMatchObject({ foerderfaehig: 28_000, zuschuss: 8_400 });
    expect(berechneFoerderung(e).zuschuss).toBe(12_900);
  });

  it("Heizung ab Februar 2027: weniger förderfähig, ohne dass jemand eine Zahl ändert", () => {
    expect(topf(ein([posten("heizung", 35_000)], { stichtag: "2027-02-15" }), "KfW 458")?.zuschuss).toBe(8_175); // 27.250 × 30 %
  });

  it("Experte zu 50 %, gedeckelt", () => {
    expect(topf(ein([posten("experte", 8_000)], { gebaeude: "haus" }), "BAFA Experte")).toMatchObject({ foerderfaehig: 5_000, zuschuss: 2_500 });
    expect(topf(ein([posten("experte", 8_000)]), "BAFA Experte")).toMatchObject({ foerderfaehig: 2_000, zuschuss: 1_000 }); // Wohnung im MFH
  });

  it("unter 300 € und Heizungsoptimierung über 5 Einheiten zählen nicht — mit Grund", () => {
    const klein = berechneFoerderung(ein([posten("huelle", 299)]));
    expect(klein.toepfe).toEqual([]);
    expect(klein.ausgeschlossen[0].grund).toMatch(/unter 300 €/);
    expect(topf(ein([posten("huelle", 300)]), "BAFA")?.zuschuss).toBe(45);
    const gross = berechneFoerderung(ein([posten("optimierung", 5_000)], { wohneinheiten: 6 }));
    expect(gross.toepfe).toEqual([]);
    expect(gross.ausgeschlossen[0].grund).toMatch(/bis 5 Wohneinheiten/);
  });

  it("Normalfall ohne energetische Posten: kein Zuschuss, keine Hinweise", () => {
    const r = berechneFoerderung(ein([posten("keine", 12_000)]));
    expect(r).toEqual({ toepfe: [], zuschuss: 0, ausgeschlossen: [], hinweise: [] });
  });
});

describe("Hinweise", () => {
  it("Experte fehlt bei Dämmung → Hinweis; mit Experte oder nur Heizung nicht", () => {
    const fehlt = /Energieeffizienz-Experte Pflicht/;
    expect(berechneFoerderung(ein([posten("huelle", 10_000)])).hinweise.some((h) => fehlt.test(h))).toBe(true);
    expect(berechneFoerderung(ein([posten("huelle", 10_000), posten("experte", 2_000)])).hinweise.some((h) => fehlt.test(h))).toBe(false);
    expect(berechneFoerderung(ein([posten("heizung", 10_000)])).hinweise.some((h) => fehlt.test(h))).toBe(false);
  });

  it("Vermieter: Zuschuss mindert die absetzbaren Kosten; Selbstnutzer: Heizungs-Boni nicht gerechnet", () => {
    const v = berechneFoerderung(ein([posten("heizung", 10_000)])).hinweise;
    expect(v.some((h) => /R 21\.5 EStR/.test(h))).toBe(true);
    expect(v.some((h) => /Boni/.test(h))).toBe(false);
    const s = berechneFoerderung(ein([posten("heizung", 10_000)], { nutzung: "eigennutzen" })).hinweise;
    expect(s.some((h) => /Boni/.test(h))).toBe(true);
    expect(s.some((h) => /R 21\.5/.test(h))).toBe(false);
  });

  it("über der Grenze wird gesagt, dass der Rest nicht gefördert wird", () => {
    expect(berechneFoerderung(ein([posten("huelle", 31_000)])).hinweise.some((h) => /Über der Höchstgrenze von 30\.000 €/.test(h))).toBe(true);
  });
});

describe("Entwurf", () => {
  it("älterer Entwurf ohne Förderfelder lädt mit Vorgaben; Unbekanntes fällt auf „keine“", () => {
    const e = entwurfAus({
      raeume: [{ id: "a", name: "Bad" }],
      eigene: [{ id: "p", bezeichnung: "Fenster", betrag: "9.000", foerderung: "huelle" }, { id: "q", bezeichnung: "X", betrag: "1", foerderung: "erfunden" }, { id: "r", bezeichnung: "Alt", betrag: "5" }],
      foerder: { wohneinheiten: "3", isfp: "true", nutzung: "irgendwas" },
    })!;
    expect(e.eigene.map((p) => p.foerderung)).toEqual(["huelle", "keine", "keine"]);
    expect(e.foerder).toEqual({ wohneinheiten: "3", isfp: false, nutzung: "vermieten", gebaeude: "mfh" }); // „true“ als Text ist kein Haken
    expect(entwurfAus({ raeume: [] })!.foerder).toEqual({ wohneinheiten: "1", isfp: false, nutzung: "vermieten", gebaeude: "mfh" });
    expect(entwurfAus({ raeume: [], foerder: { gebaeude: "haus" } })!.foerder.gebaeude).toBe("haus");
  });

  it("Formular → Schätzung: deutscher Tausenderpunkt, leere Einheiten = 1", () => {
    const e = { ...leererEntwurf("x"), eigene: [{ id: "p", bezeichnung: "Fenster", betrag: "12.500", foerderung: "huelle" as const }] };
    const f = zuFoerderEingabe({ ...e, foerder: { wohneinheiten: "", isfp: false, nutzung: "vermieten", gebaeude: "mfh" } }, "2026-10-05");
    expect(f.posten[0]).toMatchObject({ betrag: 12_500, art: "huelle" });
    expect(f.wohneinheiten).toBe(1);
    expect(zuFoerderEingabe({ ...e, foerder: { wohneinheiten: "4", isfp: true, nutzung: "eigennutzen", gebaeude: "haus" } }, "2026-10-05")).toMatchObject({ wohneinheiten: 4, isfp: true, nutzung: "eigennutzen", gebaeude: "haus" });
  });
});

describe("Eine Wahrheit mit dem Fördercheck im Kauf-Assistenten", () => {
  it("dieselben Sätze und Grenzen; kein veralteter Effizienzbonus", () => {
    const p = (key: string) => PROGRAMME.find((x) => x.key === key)!;
    expect(p("bafa").text).toMatch(/15 %/);
    expect(p("bafa").text).toMatch(/30\.000 €/);
    expect(p("kfw458").hinweis).toMatch(/30 %/);
    expect(p("kfw458").hinweis).toMatch(/28\.000 €/);
    const alles = JSON.stringify(PROGRAMME);
    expect(alles).not.toMatch(/30–35 %|15–20 %/);
  });
});

describe("Fahrplan", () => {
  it("nennt die Förderung bei der Besichtigung — mit der Fristenfalle", async () => {
    const { fahrplan } = await import("@/lib/fahrplan");
    const station = fahrplan({ hatSelbstauskunft: false, makler: [], kaufpruefungen: 0, vertreterGueltig: false, objekte: 0 }).find((x) => x.id === "besichtigen")!;
    expect(station.punkte.join(" ")).toMatch(/gefördert .* nur, wenn der Antrag vor dem Handwerkervertrag steht/);
  });
});

// ── Gerenderter Rechner ─────────────────────────────────────────────────────
vi.mock("next/link", () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children?: ReactNode; prefetch?: boolean }) =>
    createElement("a", { href, ...rest }, children),
}));

describe("Oberfläche", () => {
  it("Fristenfalle steht da; ohne Förderposten der Satz, dass Kosmetik nicht gefördert wird", async () => {
    const { default: SanierungsRechner } = await import("@/components/SanierungsRechner");
    const { KATALOG, KATALOG_STAND } = await import("@/lib/sanierung/katalog");
    // Die Förderung steht in der Übersicht (und im Guide auf ihrer Seite) — die Übersicht zeigt alle Seiten.
    const html = renderToStaticMarkup(createElement(SanierungsRechner, { katalog: KATALOG, stand: KATALOG_STAND, heute: "2026-10-05", ansicht: "uebersicht" }));
    expect(html).toContain("Erst beantragen, dann beauftragen.");
    expect(html).toContain("Spachteln, Streichen, Böden und Fliesen werden nicht gefördert.");
  });

  it("die Kaufprüfung bekommt die Summe VOR Zuschuss — der ist erst mit der Zusage sicher", () => {
    const s = readFileSync("components/SanierungsRechner.tsx", "utf8");
    expect(s).toContain("kaufLinkMitSanierung(fuerKauf, entwurf.kaufObjekt)");
    expect(s).not.toMatch(/kaufLinkMitSanierung\([^)]*zuschuss/);
    expect(s).toContain("(nicht abgezogen)");
  });
});
