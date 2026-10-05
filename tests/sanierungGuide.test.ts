import { describe, it, expect } from "vitest";
import { leererEntwurf, neuerRaum, entwurfAus, mengeAus, betragAus, zuFoerderEingabe, type Entwurf, type RaumFeld } from "@/lib/sanierung/eingabe";
import { offeneSeiten, guideFolge, setzeAnzahl, mitTyp, bestaetigeMassnahmen, vorschlagMassnahmen, fehlendeAngaben } from "@/lib/sanierung/guide";
import { auswerten, raeumeMitMassen, mengeVorschlag, foerderPosten, reihenfolge, einkaufszettel } from "@/lib/sanierung/auswertung";
import { ZUSTAND_GEWERKE } from "@/lib/sanierung/zustand";
import { flaechen } from "@/lib/sanierung/rechner";
import { kostenzeile } from "@/lib/sanierung/kostenzeilen";
import { KATALOG } from "@/lib/sanierung/katalog";

let zaehler = 0;
const neueId = () => `n${++zaehler}`;

function raum(teil: Partial<RaumFeld>): RaumFeld {
  return { ...neuerRaum(teil.id ?? neueId(), 1), massnahmenBestaetigt: true, ...teil };
}

/** Alles beantwortet, nichts angenommen — der Normalfall, den das Ergebnis nicht verfälschen darf. */
function fertig(): Entwurf {
  const e = leererEntwurf("t");
  e.projekt = {
    ...e.projekt,
    name: "Musterwohnung",
    etw: "nein",
    baujahr: "2005",
    wohnflaeche: "60",
    nutzung: "vermieten",
    wer: { maler: "selbst", boden: "selbst", fliesen: "selbst" },
    puffer: "10",
    entsorgung: "keine",
  };
  e.raeume = [raum({ id: "a", typ: "schlafen", name: "Schlafzimmer", laenge: "4", breite: "3", massnahmen: ["wand_streichen", "decke_streichen"], tapeteRunter: "nein" })];
  for (const g of ZUSTAND_GEWERKE) e.gewerke[g.gewerk] = { zustand: "gut", arbeiten: [] };
  return e;
}

describe("offeneSeiten — der Guide zeigt beim Wiedereinstieg nur, was fehlt", () => {
  it("neues Projekt: alle Pflichtseiten offen; Maße, Maßnahmen und Ist-Zustand erst mit Räumen", () => {
    expect(offeneSeiten(leererEntwurf("x")).map((o) => o.seite)).toEqual(["projekt", "eckdaten", "ziel", "arbeit", "raeume", "zustand", "abschluss"]);
    expect(guideFolge(leererEntwurf("x"), false)).not.toContain("masse");
  });

  it("alles beantwortet: nichts offen, keine Annahme im Ergebnis", () => {
    const e = fertig();
    expect(offeneSeiten(e)).toEqual([]);
    expect(guideFolge(e, true)).toEqual([]);
    expect(auswerten(e, KATALOG).annahmen).toEqual([]);
  });

  it("„auch wenn nur eine Zahl fehlt“: genau diese Seite, mit Namen", () => {
    const e = fertig();
    e.raeume[0].breite = "";
    expect(offeneSeiten(e)).toEqual([{ seite: "masse", fehlt: ["Länge und Breite: Schlafzimmer (oder „noch nicht gemessen“)"] }]);
    e.raeume[0].breite = "3";
    e.raeume[0].hoehe = "";
    expect(offeneSeiten(e)).toEqual([{ seite: "masse", fehlt: ["Raumhöhe: Schlafzimmer"] }]);
  });

  it("„weiß ich nicht“ macht eine Seite fertig — die Annahme steht im Ergebnis", () => {
    const e = fertig();
    e.projekt.baujahr = "";
    expect(fehlendeAngaben("eckdaten", e)).toEqual(["Baujahr (oder „weiß ich nicht“)"]);
    e.projekt.baujahrUnbekannt = true;
    expect(fehlendeAngaben("eckdaten", e)).toEqual([]);
    expect(auswerten(e, KATALOG).annahmen.join(" ")).toMatch(/Baujahr unbekannt/);

    e.raeume[0].laenge = "";
    e.raeume[0].masseGeschaetzt = true;
    expect(fehlendeAngaben("masse", e)).toEqual([]);
    expect(auswerten(e, KATALOG).annahmen.join(" ")).toMatch(/Nicht gemessen: Schlafzimmer/);
  });

  it("vorgeschlagene Maßnahmen sind erst fertig, wenn der Nutzer sie gesehen hat", () => {
    const e = fertig();
    e.raeume[0].massnahmenBestaetigt = false;
    expect(offeneSeiten(e).map((o) => o.seite)).toEqual(["massnahmen"]);
    e.raeume = bestaetigeMassnahmen(e.raeume);
    expect(offeneSeiten(e)).toEqual([]);
  });

  it("Ist-Zustand: nur gefragt, was zu den Maßnahmen gehört", () => {
    const e = fertig();
    e.raeume[0].massnahmen = ["decke_streichen"];
    expect(guideFolge(e, false)).not.toContain("ist"); // nichts an Wand oder Boden → keine Frage
    e.raeume[0].massnahmen = ["laminat", "wand_fliesen"];
    expect(fehlendeAngaben("ist", e)).toEqual(["Alter Boden: Schlafzimmer", "Alte Wandfliesen: Schlafzimmer"]);
    e.raeume[0].altbelag = "teppich";
    expect(fehlendeAngaben("ist", e)).toEqual(["Muss der alte Boden raus: Schlafzimmer", "Alte Wandfliesen: Schlafzimmer"]);
    e.raeume[0].altbelag = "keiner"; // nichts drauf → keine Frage nach „raus“
    e.raeume[0].wandfliesenRaus = "unbekannt";
    expect(fehlendeAngaben("ist", e)).toEqual([]);
  });

  it("Technik: Zustand je Gewerk, dazu die Anzahl, die sich nicht ableiten lässt", () => {
    const e = fertig();
    e.gewerke.elektrik = { zustand: "mittel", arbeiten: ["fi_nachruesten", "schalter_steckdose_tauschen", "e_check"] };
    // FI: „mindestens einer“, E-Check: je Wohnung — Steckdosen muss man zählen.
    expect(fehlendeAngaben("zustand", e)).toEqual(["Anzahl: Schalter oder Steckdose tauschen"]);
    e.arbeitMengen.schalter_steckdose_tauschen = "14";
    expect(fehlendeAngaben("zustand", e)).toEqual([]);
    // Ein eigener Betrag (Angebot) ersetzt die Menge.
    delete e.arbeitMengen.schalter_steckdose_tauschen;
    e.arbeitPreise.schalter_steckdose_tauschen = "900";
    expect(fehlendeAngaben("zustand", e)).toEqual([]);
    // Steckt die Arbeit in „Elektrik komplett“, braucht sie keine Anzahl.
    delete e.arbeitPreise.schalter_steckdose_tauschen;
    e.gewerke.elektrik.arbeiten = ["elektrik_komplett", "schalter_steckdose_tauschen"];
    expect(fehlendeAngaben("zustand", e)).toEqual([]);
  });

  it("Eigentumswohnung: Fenster fragt der Guide nicht — Sache der Gemeinschaft", () => {
    const e = fertig();
    e.gewerke.fenster = { zustand: "", arbeiten: [] };
    expect(fehlendeAngaben("zustand", e)).toEqual(["Zustand: Fenster"]);
    e.projekt.etw = "ja";
    expect(fehlendeAngaben("zustand", e)).toEqual([]);
  });

  it("Puffer: Pflicht, 0 bis 100 %", () => {
    const e = fertig();
    for (const p of ["", "abc", "150"]) {
      e.projekt.puffer = p;
      expect(fehlendeAngaben("abschluss", e), p).toEqual(["Puffer in Prozent"]);
    }
    e.projekt.puffer = "0";
    expect(fehlendeAngaben("abschluss", e)).toEqual([]);
  });
});

describe("Räume anlegen: Typ + Anzahl", () => {
  it("mehr: neue Räume mit Namen und Vorschlag, hinter den Räumen ihres Typs", () => {
    const start = [raum({ id: "s", typ: "schlafen", name: "Schlafzimmer" }), raum({ id: "b", typ: "bad", name: "Bad" })];
    const { raeume, gesperrt } = setzeAnzahl(start, "schlafen", 3, neueId);
    expect(gesperrt).toBe(0);
    expect(raeume.map((r) => r.name)).toEqual(["Schlafzimmer", "Schlafzimmer 2", "Schlafzimmer 3", "Bad"]);
    expect(raeume[1]).toMatchObject({ typ: "schlafen", massnahmen: vorschlagMassnahmen("schlafen"), massnahmenBestaetigt: false });
  });

  it("weniger: nur Räume ohne Maße fallen weg — eingetragene Maße gehen nie still verloren", () => {
    const start = [
      raum({ id: "1", typ: "kind", name: "Kind", laenge: "3" }),
      raum({ id: "2", typ: "kind", name: "Kind 2" }),
      raum({ id: "3", typ: "kind", name: "Kind 3", breite: "4" }),
    ];
    const { raeume, gesperrt } = setzeAnzahl(start, "kind", 1, neueId);
    expect(raeume.map((r) => r.id)).toEqual(["1", "3"]);
    expect(gesperrt).toBe(1);
  });

  it("Typ setzen: Vorschlag nur, solange nicht bestätigt; eigener Name bleibt", () => {
    const r = [{ ...neuerRaum("x", 3) }, { ...neuerRaum("y", 4), name: "Ankleide", massnahmenBestaetigt: true, massnahmen: ["laminat" as const] }];
    const a = mitTyp(r, "x", "bad");
    expect(a[0]).toMatchObject({ typ: "bad", name: "Bad", massnahmen: ["decke_streichen"] });
    const b = mitTyp(r, "y", "abstell");
    expect(b[1]).toMatchObject({ typ: "abstell", name: "Ankleide", massnahmen: ["laminat"] });
  });
});

describe("Entwurf aus dem Browser", () => {
  it("ein Entwurf aus dem Rechner vor dem Guide bleibt lesbar; gewählte Maßnahmen gelten als bestätigt", () => {
    const e = entwurfAus({ raeume: [{ id: "a", name: "Küche", laenge: "3", breite: "2", hoehe: "2,5", massnahmen: ["spachteln"] }, { id: "b", name: "Flur", massnahmen: [] }] })!;
    expect(e.projekt).toMatchObject({ name: "", etw: "", wer: { maler: "", boden: "", fliesen: "" }, puffer: "" });
    expect(e.raeume[0]).toMatchObject({ typ: "", massnahmenBestaetigt: true, tapeteRunter: "" });
    expect(e.raeume[1].massnahmenBestaetigt).toBe(false);
    expect(e.gewerke.elektrik).toEqual({ zustand: "", arbeiten: [] });
    expect(e.abgehakt).toEqual([]);
  });

  it("Fremdes fällt weg: falsche Arbeit je Gewerk, unbekannte Schlüssel, falsche Werte", () => {
    const e = entwurfAus({
      raeume: [{ id: "a", typ: "schloss", altbelag: "marmor", belagRaus: "vielleicht", tapeteRunter: "ja" }],
      projekt: { etw: "vielleicht", wer: { maler: "handwerker", boden: "nachbar" }, entsorgung: "fluss", nutzung: "eigennutzen" },
      gewerke: { elektrik: { zustand: "mittel", arbeiten: ["fi_nachruesten", "bad_komplett", "gibtsnicht"] }, dach: { zustand: "gut" } },
      arbeitMengen: { fenster_tauschen: "4", gibtsnicht: "9", toString: "1" },
      arbeitPreise: { bad_komplett: 12000 },
    })!;
    expect(e.raeume[0]).toMatchObject({ typ: "", altbelag: "", belagRaus: "", tapeteRunter: "ja" });
    expect(e.projekt).toMatchObject({ etw: "", wer: { maler: "handwerker", boden: "", fliesen: "" }, entsorgung: "", nutzung: "eigennutzen" });
    expect(e.gewerke.elektrik).toEqual({ zustand: "mittel", arbeiten: ["fi_nachruesten"] });
    expect(e.arbeitMengen).toEqual({ fenster_tauschen: "4" });
    expect(e.arbeitPreise).toEqual({});
  });

  it("Mengen und Beträge: leer oder unlesbar heißt „fehlt“, nicht 0", () => {
    expect(mengeAus("")).toBeNull();
    expect(mengeAus("abc")).toBeNull();
    expect(mengeAus(",")).toBeNull();
    expect(mengeAus("0")).toBe(0);
    expect(mengeAus("2,5")).toBe(2.5);
    expect(mengeAus("1.5")).toBe(1.5);
    expect(betragAus("")).toBeNull();
    expect(betragAus("12.500")).toBe(12_500);
    expect(betragAus("54,-")).toBeNull();
  });

  it("Nutzung wird einmal gefragt — die Förderung übernimmt sie aus dem Projekt", () => {
    const e = leererEntwurf("x");
    expect(zuFoerderEingabe(e, "2026-10-05").nutzung).toBe("vermieten");
    e.projekt.nutzung = "eigennutzen";
    expect(zuFoerderEingabe(e, "2026-10-05").nutzung).toBe("eigennutzen");
  });
});

describe("Grobschätzung: nicht gemessene Räume teilen sich die Restfläche", () => {
  it("60 m² Wohnfläche, ein Raum 4 × 5 gemessen, zwei offen → je 20 m², quadratisch", () => {
    const e = fertig();
    e.raeume = [raum({ id: "a", typ: "wohnen", name: "Wohnen", laenge: "4", breite: "5" }), raum({ id: "b", typ: "bad", name: "Bad" }), raum({ id: "c", typ: "flur", name: "Flur", masseGeschaetzt: true })];
    const { raeume, annahme } = raeumeMitMassen(e);
    expect(raeume[0]).toMatchObject({ laenge: 4, breite: 5, geschaetzt: false });
    expect(raeume[1].laenge * raeume[1].breite).toBeCloseTo(20, 6);
    expect(raeume[2]).toMatchObject({ geschaetzt: true, ohneMasse: false, hoehe: 2.5 });
    expect(annahme).toMatch(/Nicht gemessen: Bad, Flur — die Restfläche von 40 m² ist gleichmäßig verteilt \(je 20 m²/);
  });

  it("ohne Wohnfläche lässt sich nichts verteilen: Raum zählt mit 0 und das steht da", () => {
    const e = fertig();
    e.projekt.wohnflaeche = "";
    e.raeume = [raum({ id: "b", typ: "bad", name: "Bad" })];
    const { raeume, annahme } = raeumeMitMassen(e);
    expect(raeume[0]).toMatchObject({ ohneMasse: true, geschaetzt: false, laenge: 0 });
    expect(annahme).toMatch(/Ohne Maße und ohne Wohnfläche: Bad — zählt mit 0 m²/);
  });
});

describe("Auswertung: wer arbeitet, entscheidet über Material oder Handwerkerpreis", () => {
  const malerRaum = () => raum({ id: "a", typ: "wohnen", name: "Wohnen", laenge: "4", breite: "5", hoehe: "2,5", oeffnungen: "3", massnahmen: ["spachteln", "grundieren", "wand_streichen", "decke_streichen"], tapeteRunter: "nein" });

  it("selbst: Material aus dem Baumarkt, keine Malerzeilen", () => {
    const e = fertig();
    e.raeume = [malerRaum()];
    const a = auswerten(e, KATALOG);
    expect(a.material.map((m) => m.material.id)).toEqual(["spachtel", "tiefengrund", "wandfarbe"]);
    expect(a.zeilen).toEqual([]);
  });

  it("Handwerker: Malerpreis je m² inkl. Material — Wand und Decke; das Material fällt weg", () => {
    const e = fertig();
    e.projekt.wer.maler = "handwerker";
    e.raeume = [malerRaum()];
    const a = auswerten(e, KATALOG);
    const f = flaechen({ laenge: 4, breite: 5, hoehe: 2.5, oeffnungen: 3 });
    expect(a.material).toEqual([]);
    expect(a.zeilen.find((z) => z.arbeit === "maler_spachteln")!.menge).toBe(f.wand);
    expect(a.zeilen.find((z) => z.arbeit === "maler_streichen")!.menge).toBe(f.wand + f.decke);
    expect(a.zeilen.every((z) => z.art === "handwerker")).toBe(true);
    expect(a.hinweise.map((h) => h.id)).toContain("grundieren");
  });

  it("Raufaser beim Maler: tapezieren UND streichen in einer Zeile, die Wand nicht noch einmal gestrichen", () => {
    const e = fertig();
    e.projekt.wer.maler = "handwerker";
    e.raeume = [raum({ id: "a", typ: "wohnen", name: "W", laenge: "4", breite: "5", massnahmen: ["tapezieren", "wand_streichen"], tapeteRunter: "ja" })];
    const a = auswerten(e, KATALOG);
    expect(a.zeilen.map((z) => z.arbeit).sort()).toEqual(["maler_raufaser_streichen", "tapete_entfernen"]);
    expect(a.zeilen.find((z) => z.arbeit === "tapete_entfernen")!.art).toBe("rueckbau");
  });

  it("Boden beim Handwerker: Verlegen ist reiner Lohn — das Laminat bleibt auf dem Einkaufszettel", () => {
    const e = fertig();
    e.projekt.wer.boden = "handwerker";
    e.raeume = [raum({ id: "a", typ: "wohnen", name: "W", laenge: "4", breite: "5", massnahmen: ["laminat"], altbelag: "keiner" })];
    const a = auswerten(e, KATALOG);
    expect(a.zeilen.map((z) => [z.arbeit, z.menge])).toEqual([["klickboden_verlegen", 20]]);
    expect(a.material.map((m) => m.material.id)).toContain("laminat");
  });

  it("Wandfliesen beim Handwerker: Verlegen und Abschlagen über die Fliesenwand", () => {
    const e = fertig();
    e.projekt.wer.fliesen = "handwerker";
    e.raeume = [raum({ id: "a", typ: "wc", name: "WC", laenge: "2", breite: "1", hoehe: "2,5", fliesenhoehe: "1,2", massnahmen: ["wand_fliesen"], wandfliesenRaus: "ja" })];
    const a = auswerten(e, KATALOG);
    const wand = a.raeume[0].flaechen.fliesenwand;
    expect(wand).toBeCloseTo(7.2, 6);
    expect(a.zeilen.map((z) => [z.arbeit, z.menge])).toEqual([["fliesen_verlegen", wand], ["altfliesen_entfernen", wand]]);
  });
});

describe("Auswertung: Rückbau, Asbest, PAK", () => {
  const boden = (teil: Partial<RaumFeld>) => raum({ id: "a", typ: "wohnen", name: "Wohnen", laenge: "4", breite: "5", massnahmen: ["laminat"], belagRaus: "ja", ...teil });

  it("Baujahr nach 1993: alter Belag raus beim Handwerker → Entfernen und Entsorgen je m²", () => {
    const e = fertig();
    e.projekt.wer.boden = "handwerker";
    e.raeume = [boden({ altbelag: "pvc" })];
    const a = auswerten(e, KATALOG);
    expect(a.zeilen.find((z) => z.arbeit === "bodenbelag_entfernen")).toMatchObject({ menge: 20, art: "rueckbau" });
    expect(a.offen).toEqual([]);
  });

  it("vor 1993 und PVC/Platten: kein Preis, kein Selbst-Entfernen — offener Posten „prüfen lassen“", () => {
    const e = fertig();
    e.projekt.wer.boden = "handwerker";
    e.projekt.baujahr = "1978";
    e.raeume = [boden({ altbelag: "pvc" })];
    const a = auswerten(e, KATALOG);
    expect(a.zeilen.some((z) => z.arbeit === "bodenbelag_entfernen")).toBe(false);
    expect(a.offen).toEqual([{ titel: "Wohnen: alten Boden auf Asbest prüfen lassen", grund: expect.stringMatching(/Fachfirma/) }]);
    expect(a.hinweise.map((h) => h.id)).toContain("asbest");
    // Drüberlegen statt raus: Überdecken ist verboten, solange nicht geprüft.
    e.raeume = [boden({ altbelag: "unbekannt", belagRaus: "nein" })];
    expect(auswerten(e, KATALOG).offen[0].grund).toMatch(/§ 11 GefStoffV/);
  });

  it("Parkett vor 1970 raus: Kleber auf PAK prüfen — danach kein offener Posten mehr", () => {
    const e = fertig();
    e.projekt.wer.boden = "handwerker";
    e.projekt.baujahr = "1965";
    e.raeume = [boden({ altbelag: "parkett" })];
    expect(auswerten(e, KATALOG).offen.map((o) => o.titel)).toEqual(["Wohnen: Parkettkleber auf PAK prüfen lassen"]);
    e.projekt.baujahr = "1975";
    const a = auswerten(e, KATALOG);
    expect(a.offen).toEqual([]);
    expect(a.zeilen.some((z) => z.arbeit === "bodenbelag_entfernen")).toBe(true);
  });

  it("selbst rausreißen: kein Lohn, aber der Container-Vorschlag — als Annahme, bis gewählt", () => {
    const e = fertig();
    e.projekt.entsorgung = "";
    e.raeume = [boden({ altbelag: "fliesen", massnahmen: ["boden_fliesen"] })];
    const a = auswerten(e, KATALOG);
    expect(a.zeilen.map((z) => [z.arbeit, z.art, z.menge])).toEqual([["container_bauschutt", "entsorgung", 1]]);
    expect(a.annahmen.join(" ")).toMatch(/Entsorgung noch nicht gewählt — Vorschlag aus deinem Rückbau: Container für Bauschutt/);
    e.projekt.entsorgung = "keine";
    expect(auswerten(e, KATALOG).zeilen).toEqual([]);
  });
});

describe("Auswertung: Zustand-Baukasten", () => {
  it("„Bad komplett“: Fliesen im Bad, WC und Waschtisch zählen nicht zusätzlich", () => {
    const e = fertig();
    e.raeume = [raum({ id: "b", typ: "bad", name: "Bad", laenge: "2,5", breite: "2", massnahmen: ["boden_fliesen", "wand_fliesen", "decke_streichen"], altbelag: "keiner", wandfliesenRaus: "nein" })];
    e.gewerke.bad = { zustand: "schlecht", arbeiten: ["bad_komplett", "wc_tauschen", "waschtisch_tauschen"] };
    const a = auswerten(e, KATALOG);
    expect(a.zeilen.map((z) => z.arbeit)).toEqual(["bad_komplett"]);
    expect(a.zeilen[0].menge).toBe(5);
    expect(a.raeume[0].massnahmen).toEqual(["decke_streichen"]);
    expect(a.material.some((m) => m.material.id === "fliese")).toBe(false);
    expect(a.hinweise.map((h) => h.id)).toContain("bad_komplett");
    expect(a.hinweise.map((h) => h.id)).not.toContain("abdichtung");
  });

  it("noch nicht gewählter Zustand: „mittel“ als Annahme — so gibt es früh eine Grobschätzung", () => {
    const e = fertig();
    e.gewerke.heizung = { zustand: "", arbeiten: [] };
    const a = auswerten(e, KATALOG);
    expect(a.annahmen).toContain("Heizung: Zustand noch nicht gewählt — „mittel“ angenommen");
    const hk = a.zeilen.find((z) => z.arbeit === "heizkoerper_tauschen")!;
    expect(hk).toMatchObject({ mengeFehlt: true, von: 0, bis: 0 });
    expect(a.annahmen).toContain("Heizkörper tauschen: Anzahl fehlt — zählt mit 0, bis du sie einträgst");
  });

  it("eigene Menge und eigener Betrag (Angebot) gehen vor", () => {
    const e = fertig();
    e.gewerke.fenster = { zustand: "schlecht", arbeiten: ["fenster_tauschen"] };
    e.arbeitMengen.fenster_tauschen = "4";
    let z = auswerten(e, KATALOG).zeilen[0];
    expect(z).toMatchObject({ menge: 4, von: kostenzeile("fenster_tauschen", 4).von, bis: kostenzeile("fenster_tauschen", 4).bis, mengeAnnahme: null });
    e.arbeitPreise.fenster_tauschen = "7.800";
    z = auswerten(e, KATALOG).zeilen[0];
    expect(z).toMatchObject({ von: 7_800, bis: 7_800, herkunft: "nutzer" });
  });

  it("Eigentumswohnung: Fenster ohne eigene Kosten, dafür der Prüfpunkt der Gemeinschaft", () => {
    const e = fertig();
    e.projekt.etw = "ja";
    e.gewerke.fenster = { zustand: "schlecht", arbeiten: ["fenster_tauschen"] };
    e.arbeitMengen.fenster_tauschen = "4";
    const a = auswerten(e, KATALOG);
    expect(a.zeilen).toEqual([]);
    expect(a.pruefpunkte.map((p) => p.titel)).toEqual(["Fenster"]);
  });

  it("Mengen-Vorschläge: Bad aus den Räumen, Küche aus der längsten Wand; Zählbares nie geschätzt", () => {
    const e = fertig();
    const r = [
      { typ: "bad" as const, laenge: 2.5, breite: 2, geschaetzt: false },
      { typ: "wc" as const, laenge: 1, breite: 1, geschaetzt: false },
      { typ: "kueche" as const, laenge: 2.4, breite: 3.6, geschaetzt: false },
    ];
    expect(mengeVorschlag("bad_komplett", e, r)).toEqual({ menge: 5, annahme: null });
    expect(mengeVorschlag("wc_tauschen", e, r)).toEqual({ menge: 2, annahme: "eins je Bad und WC" });
    expect(mengeVorschlag("kueche_moebel", e, r)).toEqual({ menge: 3.6, annahme: "Küchenzeile so lang wie die längste Wand der Küche" });
    expect(mengeVorschlag("elektrik_komplett", e, r)).toEqual({ menge: 60, annahme: null });
    expect(mengeVorschlag("unterverteilung_erneuern", e, r)).toEqual({ menge: 1, annahme: null });
    for (const id of ["fenster_tauschen", "heizkoerper_tauschen", "innentuer_komplett", "schalter_steckdose_tauschen"] as const) {
      expect(mengeVorschlag(id, e, r), id).toBeNull();
    }
  });
});

describe("Annahmen: was fehlt, wird vorsichtig angenommen — und steht da", () => {
  it("noch nicht gewählt, wer arbeitet: Handwerker (teurer), mit Hinweis", () => {
    const e = fertig();
    e.projekt.wer.maler = "";
    const a = auswerten(e, KATALOG);
    expect(a.zeilen.map((z) => z.arbeit)).toEqual(["maler_streichen"]);
    expect(a.material).toEqual([]);
    expect(a.annahmen).toContain("Noch offen, wer streicht — gerechnet mit Handwerker");
  });

  it("Zustand „weiß ich nicht“: steht als Annahme da", () => {
    const e = fertig();
    e.gewerke.tueren = { zustand: "unbekannt", arbeiten: [] };
    expect(auswerten(e, KATALOG).annahmen).toEqual(["Innentüren: Zustand unbekannt — „mittel“ angenommen"]);
  });

  it("alter Boden nicht beantwortet: gerechnet mit „unbekannt, muss raus“ — und gesagt", () => {
    const e = fertig();
    e.raeume[0].massnahmen = ["decke_streichen", "laminat"];
    const a = auswerten(e, KATALOG);
    expect(a.annahmen).toContain("Alter Boden: nicht vollständig beantwortet — gerechnet mit „unbekannter Belag, muss raus“");
    // Baujahr 2005: kein Asbestverdacht, Rückbau selbst → Container als Vorschlag erst bei Wahl „unbekannt“.
    e.raeume[0].altbelag = "keiner";
    expect(auswerten(e, KATALOG).annahmen).toEqual([]);
  });
});

describe("Summe, Puffer, Herkunft", () => {
  it("Geld = Material + Zeilen + bezahlter Lohn + eigene Posten; Puffer obendrauf; Eigenleistung nie", () => {
    const e = fertig();
    e.gewerke.fenster = { zustand: "schlecht", arbeiten: ["fenster_tauschen"] };
    e.arbeitMengen.fenster_tauschen = "2";
    e.lohn = [
      { id: "l1", bezeichnung: "Ich", stunden: "10", satz: "30", eigenleistung: true },
      { id: "l2", bezeichnung: "Helfer", stunden: "5", satz: "20", eigenleistung: false },
    ];
    e.eigene = [{ id: "p", bezeichnung: "Küche laut Angebot", betrag: "4.000", foerderung: "keine" }];
    const a = auswerten(e, KATALOG);
    const fenster = kostenzeile("fenster_tauschen", 2);
    expect(a.eigenleistung).toBe(300);
    expect(a.lohnGeld).toBe(100);
    expect(a.geld.min).toBeCloseTo(a.materialKosten.min + fenster.von + 100 + 4_000, 6);
    expect(a.geld.max).toBeCloseTo(a.materialKosten.max + fenster.bis + 100 + 4_000, 6);
    expect(a.puffer.max).toBeCloseTo(a.geld.max * 0.1, 2);
    expect(a.gesamt.max).toBeCloseTo(a.geld.max + a.puffer.max, 2);
    // Fenster: neutrale Quelle (co2online) → kein Portal-Anteil.
    expect(a.portalAnteil).toBe(0);
  });

  it("Portal-Anteil: wie viel der Summe allein auf Portalpreisen beruht", () => {
    const e = fertig();
    e.raeume = [];
    e.gewerke.elektrik = { zustand: "mittel", arbeiten: ["fi_nachruesten"] };
    e.projekt.puffer = "0";
    expect(auswerten(e, KATALOG).portalAnteil).toBe(1);
  });

  it("Budget: darunter, innerhalb, darüber", () => {
    const e = fertig();
    e.raeume = [];
    e.eigene = [{ id: "p", bezeichnung: "x", betrag: "10.000", foerderung: "keine" }];
    e.projekt.puffer = "0";
    const lage = (b: string) => {
      e.projekt.budget = b;
      return auswerten(e, KATALOG).budget?.lage ?? null;
    };
    expect(lage("")).toBeNull();
    expect(lage("12.000")).toBe("darunter");
    expect(lage("10.000")).toBe("darunter");
    expect(lage("9.000")).toBe("darueber");
  });

  it("förderfähige Zeilen gehen in die Zuschuss-Schätzung, je untere und obere Spanne", () => {
    const e = fertig();
    e.gewerke.fenster = { zustand: "schlecht", arbeiten: ["fenster_tauschen"] };
    e.arbeitMengen.fenster_tauschen = "4";
    const a = auswerten(e, KATALOG);
    expect(foerderPosten(a, "bis")).toEqual([{ id: "guide-fenster_tauschen", bezeichnung: a.zeilen[0].label, betrag: a.zeilen[0].bis, art: "huelle" }]);
    expect(foerderPosten(a, "von")[0].betrag).toBe(a.zeilen[0].von);
  });
});

describe("Einkaufszettel und Reihenfolge", () => {
  it("nach Abteilung; Rauchwarnmelder je Schlafraum, Kinderzimmer und Flur — ohne erfundenen Preis", () => {
    const e = fertig();
    e.raeume = [
      raum({ id: "s", typ: "schlafen", name: "S", laenge: "4", breite: "3", massnahmen: ["wand_streichen", "laminat"], tapeteRunter: "nein", altbelag: "keiner" }),
      raum({ id: "f", typ: "flur", name: "F", laenge: "3", breite: "1", massnahmen: [] }),
      raum({ id: "k", typ: "kueche", name: "K", laenge: "3", breite: "3", massnahmen: [] }),
    ];
    const a = auswerten(e, KATALOG);
    expect(a.rauchmelder).toBe(2);
    expect(a.einkauf.map((g) => g.id)).toEqual(["farbe", "boden", "sicherheit"]);
    expect(a.einkauf.at(-1)!.zeilen[0]).toMatchObject({ key: "rauchmelder", menge: "2 Stück", kosten: null });
    expect(einkaufszettel([], 0)).toEqual([]);
  });

  it("Reihenfolge der Baustelle — nur, was vorkommt", () => {
    expect(reihenfolge([], [], 0, false)).toEqual([]);
    const r = reihenfolge(
      [{ massnahmen: ["spachteln", "wand_streichen", "laminat", "wand_fliesen"] }],
      [{ arbeit: "elektrik_komplett", art: "zustand" }, { arbeit: "altfliesen_entfernen", art: "rueckbau" }],
      1,
      false,
    );
    expect(r).toEqual([
      "Abdecken und abkleben",
      "Rückbau: alte Tapeten, Beläge und Fliesen raus, Entsorgung bestellen",
      "Fachbetrieb: Leitungen und Rohinstallation (Elektrik, Bad, Heizung), Fenster",
      "Spachteln",
      "Abdichten und fliesen",
      "Grundieren, tapezieren, streichen",
      "Boden verlegen",
      "Endmontage: Sanitärobjekte, Schalter und Steckdosen, Küche",
      "Rauchwarnmelder anbringen",
      "Grundreinigung",
    ]);
  });
});
