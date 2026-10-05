import { describe, it, expect } from "vitest";
import {
  ARBEITEN, ARBEITEN_LISTE, preisSpanne, herkunft, unabhaengigeQuellen, MWST, type ArbeitId,
} from "@/lib/sanierung/arbeiten";
import { kostenzeile, summeKosten } from "@/lib/sanierung/kostenzeilen";
import { ZUSTAND_GEWERKE, vorauswahl, gemeinschaftsPruefpunkte, arbeitenDesGewerks, ZUSTAND_ANNAHME } from "@/lib/sanierung/zustand";
import { NUTZUNGSDAUERN, nutzungsdauer, kostenJeJahr } from "@/lib/sanierung/nutzungsdauer";

const de = (n: number) => n.toLocaleString("de-DE");

describe("Arbeiten-Katalog: jede Zahl hat einen Beleg", () => {
  it("Schlüssel, Quellen und Spannen sind vollständig", () => {
    expect(ARBEITEN_LISTE.length).toBeGreaterThanOrEqual(25);
    for (const [key, a] of Object.entries(ARBEITEN)) {
      expect(a.id, key).toBe(key);
      expect(a.quellen.length, key).toBeGreaterThan(0);
      for (const q of a.quellen) {
        expect(q.url, key).toMatch(/^https:\/\/[^\s]+\.[a-z]{2,}/);
        expect(q.stand.trim(), key).not.toBe("");
        expect(q.von, key).toBeGreaterThan(0);
        expect(q.von, key).toBeLessThanOrEqual(q.bis);
      }
    }
  });

  it("von/bis stehen wörtlich im Zitat — oder die Umrechnung ist benannt", () => {
    for (const a of ARBEITEN_LISTE) {
      for (const q of a.quellen) {
        if (q.umgerechnet) continue;
        expect(q.zitat, `${a.id} · ${q.name}`).toContain(de(q.von));
        expect(q.zitat, `${a.id} · ${q.name}`).toContain(de(q.bis));
      }
    }
  });

  it("mindestens zwei unabhängige Quellen — sonst steht die Begründung dabei (und nur dann)", () => {
    for (const a of ARBEITEN_LISTE) {
      const n = unabhaengigeQuellen(a);
      if (a.einzelquelle) {
        expect(n, a.id).toBe(1);
        expect(a.einzelquelle.length, a.id).toBeGreaterThan(20);
      } else {
        expect(n, a.id).toBeGreaterThanOrEqual(2);
      }
    }
    // Abgeschrieben zählt nicht: Trustlocal wiederholt die Aroundhome-Spanne wortgleich.
    expect(unabhaengigeQuellen(ARBEITEN.maler_spachteln)).toBe(1);
  });

  it("Strom ist Sache des Fachbetriebs (NAV § 13) — keine Eigenleistung anbieten", () => {
    for (const a of ARBEITEN_LISTE.filter((x) => x.gewerk === "elektrik")) expect(a.nurFachbetrieb, a.id).toBe(true);
  });
});

describe("Spanne: brutto, nach außen gerundet", () => {
  it("Netto-Angaben werden mit 19 % hochgerechnet", () => {
    expect(MWST).toBe(0.19);
    // AM 180–320 netto (→ 214,20–380,80), AuftragsGlück 150–350 → 150 bis 380,80 → auf 5 € gerundet 385.
    expect(preisSpanne(ARBEITEN.fi_nachruesten)).toEqual({ min: 150, max: 385 });
    // AuftragsGlück 800–1.800, AM-Rechenbeispiel 1.800 netto = 2.142 → auf 50 € gerundet 2.150.
    expect(preisSpanne(ARBEITEN.unterverteilung_erneuern)).toEqual({ min: 800, max: 2150 });
    // AM Schalter 35 netto = 41,65 → unter 100 € auf ganze Euro abgerundet.
    expect(preisSpanne(ARBEITEN.schalter_steckdose_tauschen)).toEqual({ min: 41, max: 120 });
    // BKI 13 € netto = 15,47 → 16; Aroundhome 8–15.
    expect(preisSpanne(ARBEITEN.maler_streichen)).toEqual({ min: 8, max: 16 });
  });

  it("jede Spanne umfasst alle Quellen", () => {
    for (const a of ARBEITEN_LISTE) {
      const p = preisSpanne(a);
      for (const q of a.quellen) {
        const f = q.mwst === "netto" ? 1 + MWST : 1;
        expect(p.min, a.id).toBeLessThanOrEqual(q.von * f);
        expect(p.max, a.id).toBeGreaterThanOrEqual(q.bis * f);
      }
    }
  });

  it("Herkunft: die stärkste Quelle zählt", () => {
    expect(herkunft(ARBEITEN.fenster_tauschen)).toBe("neutral");
    expect(herkunft(ARBEITEN.maler_streichen)).toBe("bki");
    expect(herkunft(ARBEITEN.schalter_steckdose_tauschen)).toBe("portal");
    // Neutral schlägt BKI, BKI schlägt Portal — auch wenn beide an einer Arbeit stehen.
    const q = (art: "neutral" | "bki" | "portal") => ({ ...ARBEITEN.maler_streichen.quellen[0], art });
    expect(herkunft({ ...ARBEITEN.maler_streichen, quellen: [q("portal"), q("bki"), q("neutral")] })).toBe("neutral");
    expect(herkunft({ ...ARBEITEN.maler_streichen, quellen: [q("portal"), q("bki")] })).toBe("bki");
  });
});

describe("Kostenzeilen", () => {
  it("Menge × Spanne; Fachbetrieb-Arbeit heißt „Angebot einholen“", () => {
    const z = kostenzeile("fi_nachruesten", 2);
    expect(z).toMatchObject({ von: 300, bis: 770, herkunft: "portal", angebotEinholen: true, menge: 2 });
    expect(kostenzeile("wc_tauschen", 1).angebotEinholen).toBe(false);
  });

  it("ein eigener Wert (z. B. Angebot) ersetzt die Spanne; Unsinn → Katalog", () => {
    expect(kostenzeile("bad_komplett", 6, 14_500)).toMatchObject({ von: 14_500, bis: 14_500, herkunft: "nutzer", angebotEinholen: false });
    expect(kostenzeile("bad_komplett", 6, 0)).toMatchObject({ von: 0, bis: 0, herkunft: "nutzer" });
    for (const unsinn of [null, undefined, -5, Number.NaN]) {
      expect(kostenzeile("bad_komplett", 6, unsinn as number | null).herkunft).toBe("portal");
    }
  });

  it("Menge 0, negativ oder keine Zahl → 0 €", () => {
    for (const m of [0, -3, Number.NaN]) expect(kostenzeile("e_check", m)).toMatchObject({ menge: 0, von: 0, bis: 0 });
  });

  it("Summe und Anteil der Portalpreise (Mitte der Spannen)", () => {
    const fenster = kostenzeile("fenster_tauschen", 2); // neutral: 1.000–3.000, Mitte 2.000
    const fi = kostenzeile("fi_nachruesten", 2); // portal: 300–770, Mitte 535
    const s = summeKosten([fenster, fi]);
    expect(s).toEqual({ von: 1300, bis: 3770, portalAnteil: Math.round((535 / 2535) * 1000) / 1000 });
    // Überschreibt der Nutzer die Portal-Zeile mit einem Angebot, fällt der Anteil auf 0.
    expect(summeKosten([fenster, kostenzeile("fi_nachruesten", 2, 400)]).portalAnteil).toBe(0);
    expect(summeKosten([])).toEqual({ von: 0, bis: 0, portalAnteil: 0 });
  });
});

describe("Zustand-Baukasten", () => {
  it("vorgekreuzte Arbeiten gibt es im Katalog und sie gehören zum Gewerk; „gut“ kreuzt nichts an", () => {
    for (const g of ZUSTAND_GEWERKE) {
      expect(g.vorauswahl.gut, g.gewerk).toEqual([]);
      expect(g.anzeichen.length, g.gewerk).toBeGreaterThan(0);
      for (const ids of Object.values(g.vorauswahl)) {
        for (const id of ids) {
          expect(ARBEITEN[id as ArbeitId], `${g.gewerk}: ${id}`).toBeDefined();
          expect(ARBEITEN[id as ArbeitId].gewerk, `${g.gewerk}: ${id}`).toBe(g.gewerk);
        }
      }
    }
  });

  it("„weiß ich nicht“ → mittlerer Zustand als Annahme", () => {
    expect(ZUSTAND_ANNAHME).toBe("mittel");
    expect(vorauswahl("elektrik", null, false)).toEqual(vorauswahl("elektrik", "mittel", false));
    expect(vorauswahl("elektrik", "schlecht", false)).toEqual(["elektrik_komplett", "unterverteilung_erneuern"]);
  });

  it("Eigentumswohnung: Fenster sind Sache der Gemeinschaft — keine eigenen Kosten, aber ein Prüfpunkt", () => {
    expect(vorauswahl("fenster", "schlecht", false)).toEqual(["fenster_tauschen"]);
    expect(vorauswahl("fenster", "schlecht", true)).toEqual([]);
    expect(gemeinschaftsPruefpunkte(true).map((p) => p.gewerk)).toEqual(["fenster"]);
    expect(gemeinschaftsPruefpunkte(true)[0].hinweis).toMatch(/Sonderumlage/);
    expect(gemeinschaftsPruefpunkte(false)).toEqual([]);
    // Elektrik bleibt bei der ETW eigene Sache.
    expect(vorauswahl("elektrik", "schlecht", true)).toEqual(["elektrik_komplett", "unterverteilung_erneuern"]);
  });

  it("Arbeiten zum Ankreuzen je Gewerk", () => {
    expect(arbeitenDesGewerks("elektrik")).toEqual(["schalter_steckdose_tauschen", "steckdose_neu", "fi_nachruesten", "unterverteilung_erneuern", "elektrik_komplett", "e_check"]);
    expect(arbeitenDesGewerks("fenster")).toEqual(["fenster_tauschen"]);
  });
});

describe("Nutzungsdauern (BBSR) — „günstig oder langlebig“ als Rechnung", () => {
  it("Werte wie in der BBSR-Tabelle", () => {
    const j = (id: string) => nutzungsdauer(id)!.jahre;
    expect(j("laminat_nk31")).toBe(15);
    expect(j("laminat_nk32")).toBe(20);
    expect(j("anstrich_k1")).toBe(20);
    expect(j("anstrich_k3")).toBe(10);
    expect(j("cv_belag")).toBe(10);
    expect(j("thermostatventil")).toBe(15);
    expect(nutzungsdauer("gibtsnicht")).toBeNull();
    for (const n of NUTZUNGSDAUERN) {
      expect(n.bbsr, n.id).toMatch(/^\d{3}\.\d{3}\.25$/);
      if (n.mindestens) expect(n.jahre, n.id).toBe(50);
    }
    expect(new Set(NUTZUNGSDAUERN.map((n) => n.id)).size).toBe(NUTZUNGSDAUERN.length);
  });

  it("Kosten je Jahr: Preis ÷ Jahre; bei „≥ 50“ eine Obergrenze", () => {
    expect(kostenJeJahr(30, nutzungsdauer("laminat_nk31")!)).toEqual({ wert: 2, hoechstens: false });
    expect(kostenJeJahr(50, nutzungsdauer("laminat_nk32")!)).toEqual({ wert: 2.5, hoechstens: false });
    expect(kostenJeJahr(100, nutzungsdauer("fliesen")!)).toEqual({ wert: 2, hoechstens: true });
  });
});
