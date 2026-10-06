import { describe, it, expect } from "vitest";
import { entwurfAus, leererEntwurf, neuerRaum, type Entwurf, type RaumFeld } from "@/lib/sanierung/eingabe";
import { mitTyp, offeneSeiten, setzeAnzahl, vorschlagFuer, vorschlagMassnahmen } from "@/lib/sanierung/guide";
import { auswerten } from "@/lib/sanierung/auswertung";
import { KATALOG } from "@/lib/sanierung/katalog";
import {
  DATEN_GRENZE,
  MITGELIEFERTE_VORLAGEN,
  datenGroesse,
  entwurfAusVorlage,
  projektName,
  speicherName,
  vorlageAus,
  vorlageAusEntwurf,
} from "@/lib/sanierung/projekte";

// Stufe C (docs/zukunft/SANIERUNGS-GUIDE.md, Abschnitt 7): Eine Vorlage trägt Entscheidungen, nie die
// Wohnung. Die Tests prüfen vor allem, was NICHT mitkommt — sonst stünde bei der nächsten Wohnung die
// Adresse, das Baujahr oder der Zustand der alten.

let n = 0;
const neueId = () => `id-${++n}`;

function raum(teil: Partial<RaumFeld>): RaumFeld {
  return { ...neuerRaum(neueId(), 1), ...teil };
}

/** Ein ausgefülltes Projekt mit allem, was eine Vorlage NICHT übernehmen darf. */
function volles(): Entwurf {
  const e = leererEntwurf("p");
  return {
    ...e,
    projekt: {
      ...e.projekt,
      name: "Musterstraße 3, 2. OG",
      adresse: "Musterstraße 3, 23611 Bad Schwartau",
      etw: "ja",
      baujahr: "1962",
      wohnflaeche: "71",
      nutzung: "vermieten",
      budget: "30000",
      wer: { maler: "selbst", boden: "handwerker", fliesen: "handwerker" },
      puffer: "15",
      entsorgung: "beide",
    },
    raeume: [
      raum({ name: "Wohnzimmer", typ: "wohnen", laenge: "5", breite: "4", massnahmen: ["wand_streichen", "vinyl"], massnahmenBestaetigt: true, tapeteRunter: "ja", altbelag: "teppich", belagRaus: "ja" }),
      raum({ name: "Wohnzimmer 2", typ: "wohnen", laenge: "3", breite: "3", massnahmen: ["laminat"], massnahmenBestaetigt: true }),
      raum({ name: "Bad", typ: "bad", laenge: "2", breite: "2", massnahmen: ["decke_streichen"], massnahmenBestaetigt: true }),
      raum({ name: "Ohne Typ", typ: "", massnahmen: ["tapezieren"] }),
    ],
    gewerke: {
      ...e.gewerke,
      elektrik: { zustand: "schlecht", arbeiten: ["elektrik_komplett"] },
      bad: { zustand: "gut", arbeiten: [] },
      tueren: { zustand: "mittel", arbeiten: [] },
    },
    lohn: [{ id: "l", bezeichnung: "Streichen", stunden: "12", satz: "25", eigenleistung: true }],
    eigene: [{ id: "e", bezeichnung: "Gutachter", betrag: "600", foerderung: "keine" }],
    preise: { wandfarbe: "39,90" },
    arbeitMengen: { fenster_tauschen: "4" },
    arbeitPreise: { elektrik_komplett: "12000" },
    abgehakt: ["wandfarbe"],
    foerder: { ...e.foerder, wohneinheiten: "6", isfp: true },
  };
}

describe("Vorlage aus einem Projekt", () => {
  const v = vorlageAusEntwurf(volles());

  it("übernimmt die Entscheidungen: Maßnahmen je Raumart, wer, Entsorgung, Puffer, Ziel, Materialpreise", () => {
    expect(v.wer).toEqual({ maler: "selbst", boden: "handwerker", fliesen: "handwerker" });
    expect(v).toMatchObject({ entsorgung: "beide", puffer: "15", nutzung: "vermieten", preise: { wandfarbe: "39,90" } });
  });

  it("je Raumart die Maßnahmen des ERSTEN Raums — keine Vereinigung, Räume ohne Art zählen nicht", () => {
    expect(v.massnahmenJeTyp).toEqual({ wohnen: ["wand_streichen", "vinyl"], bad: ["decke_streichen"] });
  });

  it("Technik nur, wo etwas angekreuzt ist — „gut, nichts zu tun“ ist eine Aussage über die alte Wohnung", () => {
    expect(v.gewerke).toEqual({ elektrik: { zustand: "schlecht", arbeiten: ["elektrik_komplett"] } });
  });

  it("nimmt nichts mit, was die Wohnung ausmacht", () => {
    const text = JSON.stringify(v);
    for (const verboten of ["Musterstraße", "1962", "71", "30000", "Gutachter", "Streichen", "12000", "teppich", "Wohnzimmer"]) {
      expect(text, verboten).not.toContain(verboten);
    }
    expect(Object.keys(v).sort()).toEqual(["entsorgung", "gewerke", "massnahmenJeTyp", "nutzung", "preise", "puffer", "vorlage", "wer"]);
  });

  it("übersteht Speichern und Laden unverändert", () => {
    expect(vorlageAus(JSON.parse(JSON.stringify(v)))).toEqual(v);
  });
});

describe("Neues Projekt aus einer Vorlage", () => {
  const v = vorlageAusEntwurf(volles());
  const e = entwurfAusVorlage(v, "neu");

  it("ist leer bis auf die Entscheidungen", () => {
    expect(e.raeume).toEqual([]);
    expect(e.projekt).toMatchObject({ name: "", adresse: "", etw: "", baujahr: "", wohnflaeche: "", budget: "" });
    expect(e.projekt).toMatchObject({ wer: v.wer, entsorgung: "beide", puffer: "15", nutzung: "vermieten" });
    expect(e.eigene).toEqual([]);
    expect(e.arbeitMengen).toEqual({});
    expect(e.arbeitPreise).toEqual({});
    expect(e.preise).toEqual({ wandfarbe: "39,90" });
    expect(e.gewerke.elektrik).toEqual({ zustand: "schlecht", arbeiten: ["elektrik_komplett"] });
    expect(e.gewerke.bad).toEqual({ zustand: "", arbeiten: [] });
  });

  it("der Guide fragt nur noch, was fehlt — nicht „wer arbeitet“ und nicht Entsorgung/Puffer", () => {
    const offen = offeneSeiten(e).map((o) => o.seite);
    expect(offen).toContain("projekt");
    expect(offen).toContain("eckdaten");
    expect(offen).toContain("raeume");
    expect(offen).not.toContain("arbeit");
    expect(offen).not.toContain("abschluss");
    expect(offen).not.toContain("ziel");
  });

  it("neue Räume bekommen den Vorschlag der Vorlage — und müssen ihn trotzdem ansehen", () => {
    const r = setzeAnzahl(e.raeume, "wohnen", 2, neueId, vorschlagFuer(e, "wohnen")).raeume;
    expect(r.map((x) => x.massnahmen)).toEqual([["wand_streichen", "vinyl"], ["wand_streichen", "vinyl"]]);
    expect(r.every((x) => !x.massnahmenBestaetigt)).toBe(true);
    // Getrennte Listen — ein Abwählen in einem Raum ändert den anderen nicht.
    expect(r[0].massnahmen).not.toBe(r[1].massnahmen);
  });

  it("die Vorlage selbst ändert sich nicht, wenn das Projekt weiterläuft", () => {
    const vorher = JSON.stringify(v);
    e.vorschlagJeTyp.wohnen!.push("laminat");
    e.gewerke.elektrik.arbeiten.push("e_check");
    expect(JSON.stringify(v)).toBe(vorher);
  });
});

describe("Vorschlag je Raumart", () => {
  const leer = leererEntwurf("x");

  it("ohne Vorlage der eingebaute Vorschlag", () => {
    expect(vorschlagFuer(leer, "schlafen")).toEqual(vorschlagMassnahmen("schlafen"));
    expect(setzeAnzahl([], "bad", 1, neueId).raeume[0].massnahmen).toEqual(vorschlagMassnahmen("bad"));
  });

  it("eine leere Liste heißt „nichts vorschlagen“, nicht „eingebauter Vorschlag“", () => {
    const e = { ...leer, vorschlagJeTyp: { kueche: [] } };
    expect(vorschlagFuer(e, "kueche")).toEqual([]);
    expect(vorschlagFuer(e, "wohnen")).toEqual(vorschlagMassnahmen("wohnen"));
  });

  it("Art nachträglich wählen: unbestätigte Maßnahmen folgen dem Vorschlag, bestätigte bleiben", () => {
    const offen = raum({ typ: "", massnahmen: [] });
    const fest = raum({ typ: "", massnahmen: ["laminat"], massnahmenBestaetigt: true });
    expect(mitTyp([offen], offen.id, "kueche", ["vinyl"])[0].massnahmen).toEqual(["vinyl"]);
    expect(mitTyp([fest], fest.id, "kueche", ["vinyl"])[0].massnahmen).toEqual(["laminat"]);
  });

  it("der Entwurf liest den Vorschlag aus dem Speicher — Unbekanntes fällt weg", () => {
    const roh = { ...leer, vorschlagJeTyp: { wohnen: ["vinyl", "vinyl", "zauberputz"], garage: ["vinyl"], bad: "decke_streichen" } };
    expect(entwurfAus(JSON.parse(JSON.stringify(roh)))!.vorschlagJeTyp).toEqual({ wohnen: ["vinyl"] });
  });

  it("ältere Entwürfe ohne das Feld: kein Vorschlag aus einer Vorlage", () => {
    const { vorschlagJeTyp: _weg, ...alt } = leer;
    expect(entwurfAus(alt)!.vorschlagJeTyp).toEqual({});
  });
});

describe("Vorlage prüfen (vorlageAus)", () => {
  it("ein Projekt ist keine Vorlage und eine Vorlage kein Projekt", () => {
    expect(vorlageAus(leererEntwurf("x"))).toBeNull();
    expect(vorlageAus(null)).toBeNull();
    expect(vorlageAus({ vorlage: 2 })).toBeNull();
    expect(entwurfAus(MITGELIEFERTE_VORLAGEN[0].vorlage)).toBeNull();
  });

  it("nur bekannte Raumarten, Maßnahmen, Arbeiten und Materialien", () => {
    const v = vorlageAus({
      vorlage: 1,
      massnahmenJeTyp: { wohnen: ["vinyl", "unbekannt"], keller: ["vinyl"] },
      gewerke: {
        elektrik: { zustand: "schlecht", arbeiten: ["elektrik_komplett", "bad_komplett", "fantasie"] },
        bad: { zustand: "gut", arbeiten: [] },
        heizung: { zustand: "", arbeiten: ["heizkoerper_tauschen"] },
        fenster: { zustand: "schlecht", arbeiten: ["fenster_tauschen", "fenster_tauschen"] },
      },
      wer: { maler: "selbst", boden: "nachbar" },
      entsorgung: "deponie",
      puffer: "10",
      nutzung: "spekulieren",
      preise: { wandfarbe: "30", gold: "1" },
    })!;
    expect(v.massnahmenJeTyp).toEqual({ wohnen: ["vinyl"] });
    // Bad-Arbeit im Gewerk Elektrik fällt weg; Gewerk ohne Arbeit oder ohne Zustand ebenso; doppelte einmal.
    expect(v.gewerke).toEqual({ elektrik: { zustand: "schlecht", arbeiten: ["elektrik_komplett"] }, fenster: { zustand: "schlecht", arbeiten: ["fenster_tauschen"] } });
    expect(v.wer).toEqual({ maler: "selbst", boden: "", fliesen: "" });
    expect(v).toMatchObject({ entsorgung: "", puffer: "10", nutzung: "" });
    // toEqual, nicht toMatchObject — sonst fiele ein unbekanntes Material nicht auf (Mutation P11).
    expect(v.preise).toEqual({ wandfarbe: "30" });
  });
});

describe("Mitgelieferte Vorlagen", () => {
  it("drei Stück, je mit Name und Beschreibung", () => {
    expect(MITGELIEFERTE_VORLAGEN.map((m) => m.name)).toEqual(["Mieterwechsel", "Bad neu", "Altbau-Wohnung komplett"]);
    for (const m of MITGELIEFERTE_VORLAGEN) expect(m.beschreibung.length).toBeGreaterThan(20);
  });

  it("überstehen die eigene Prüfung unverändert (nichts Unbekanntes darin)", () => {
    for (const m of MITGELIEFERTE_VORLAGEN) expect(vorlageAus(JSON.parse(JSON.stringify(m.vorlage))), m.id).toEqual(m.vorlage);
  });

  it("geben keinen Puffer, kein „wer“ und keine Preise vor — dafür gibt es keine Quelle", () => {
    for (const m of MITGELIEFERTE_VORLAGEN) {
      expect(m.vorlage).toMatchObject({ puffer: "", entsorgung: "", nutzung: "", preise: {}, wer: { maler: "", boden: "", fliesen: "" } });
    }
  });

  it("„Bad neu“: das Bad komplett; andere Räume ohne Vorschlag", () => {
    const m = MITGELIEFERTE_VORLAGEN.find((x) => x.id === "bad-neu")!;
    const e = entwurfAusVorlage(m.vorlage, "b");
    expect(e.gewerke.bad).toEqual({ zustand: "schlecht", arbeiten: ["bad_komplett"] });
    expect(vorschlagFuer(e, "wohnen")).toEqual([]);
    expect(vorschlagFuer(e, "bad")).toEqual(["decke_streichen"]);
  });

  it("„Altbau komplett“: Elektrik komplett (ohne Unterverteilung extra), Bad komplett, Türen neu", () => {
    const m = MITGELIEFERTE_VORLAGEN.find((x) => x.id === "altbau-komplett")!;
    expect(m.vorlage.gewerke).toEqual({
      elektrik: { zustand: "schlecht", arbeiten: ["elektrik_komplett"] },
      bad: { zustand: "schlecht", arbeiten: ["bad_komplett"] },
      tueren: { zustand: "schlecht", arbeiten: ["innentuer_komplett"] },
    });
  });

  it("jedes Projekt daraus lässt sich rechnen — mit Räumen auch mit einer Summe", () => {
    for (const m of MITGELIEFERTE_VORLAGEN) {
      let e = entwurfAusVorlage(m.vorlage, m.id);
      e = { ...e, projekt: { ...e.projekt, wohnflaeche: "60" }, raeume: setzeAnzahl([], "wohnen", 1, neueId, vorschlagFuer(e, "wohnen")).raeume };
      e = { ...e, raeume: setzeAnzahl(e.raeume, "bad", 1, neueId, vorschlagFuer(e, "bad")).raeume };
      const a = auswerten(e, KATALOG);
      expect(a.gesamt.max, m.id).toBeGreaterThan(0);
    }
  });
});

describe("Name und Größe", () => {
  it("Name: getrimmt, Leerräume zusammengefasst, 1 bis 80 Zeichen", () => {
    expect(projektName("  Haus   am  See ")).toBe("Haus am See");
    expect(projektName("   ")).toBeNull();
    expect(projektName("x".repeat(80))).toHaveLength(80);
    expect(projektName("x".repeat(81))).toBeNull();
    expect(projektName(42)).toBeNull();
  });

  it("Speichername: der Projektname, sonst ein Ersatz", () => {
    const e = leererEntwurf("x");
    expect(speicherName(e)).toBe("Sanierungsprojekt");
    expect(speicherName({ ...e, projekt: { ...e.projekt, name: " Altbau " } })).toBe("Altbau");
  });

  it("Größe in Bytes, nicht in Zeichen (Umlaute zählen doppelt)", () => {
    expect(datenGroesse({ a: "ä" })).toBe(JSON.stringify({ a: "ä" }).length + 1);
  });

  it("ein großes, gültiges Projekt bleibt weit unter der Grenze", () => {
    const e = leererEntwurf("gross");
    const raeume = Array.from({ length: 50 }, (_, i) => raum({ name: `Zimmer mit langem Namen ${i}`.padEnd(60, "x"), typ: "wohnen", massnahmen: ["spachteln", "tapezieren", "wand_streichen", "decke_streichen", "vinyl"] }));
    const gross = entwurfAus({ ...e, raeume, eigene: Array.from({ length: 50 }, (_, i) => ({ id: `e${i}`, bezeichnung: "y".repeat(80), betrag: "1000", foerderung: "keine" })) })!;
    expect(datenGroesse(gross)).toBeLessThan(DATEN_GRENZE / 2);
  });

  it("Materialpreise nur für Materialien aus dem Katalog — sonst wüchse der Entwurf beliebig", () => {
    const preise = Object.fromEntries(Array.from({ length: 5000 }, (_, i) => [`x${i}`, "1"]));
    const e = entwurfAus({ ...leererEntwurf("x"), preise: { ...preise, wandfarbe: "30" } })!;
    expect(e.preise).toEqual({ wandfarbe: "30" });
  });
});
