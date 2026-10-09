// Auswertung des Sanierungs-Guides (Stufe B, docs/zukunft/SANIERUNGS-GUIDE.md): aus EINEM Entwurf
// Kostenaufstellung, Annahmen, Hinweise, Einkaufszettel und Reihenfolge — für Guide UND Übersicht.
//
// Keine zweite Rechenregel: Material über `berechneSanierung()`, jede Arbeit über `kostenzeile()`
// (Einheitspreise mit Quelle), der Zustand über `vorauswahl()`. Neu ist hier nur, WAS gerechnet
// wird — welche Flächen, welche Arbeiten, welche Annahmen.
//
// „Immer detaillierter“ als Rechenprinzip (Abschnitt 5 im Plan): Es wird immer gerechnet. Was fehlt,
// wird angenommen und steht in `annahmen` — bis der Nutzer es ersetzt. Die Annahmen gehen in die
// VORSICHTIGE Richtung (lieber zu viel eingeplant): unbekannter Zustand = mittel, noch nicht
// gewählt = Handwerker, unbekannte Tapete = muss runter, unbekanntes Baujahr = vor 1993.
//
// Was keinen belegten Preis hat, kommt NICHT mit einer erfundenen Zahl in die Summe, sondern als
// offener Posten daneben (Asbest-Prüfung, PAK-Kleber) bzw. ohne Preis auf den Einkaufszettel
// (Rauchwarnmelder).

import { ARBEITEN, type ArbeitId } from "@/lib/sanierung/arbeiten";
import { kostenzeile, type Kostenzeile } from "@/lib/sanierung/kostenzeilen";
import {
  berechneSanierung,
  wirksameFlaechen,
  type Flaechen,
  type Katalog,
  type MassnahmeId,
  type MaterialId,
  type MaterialZeile,
  type Raum,
  type Spanne,
} from "@/lib/sanierung/rechner";
import {
  WOHNFLAECHE_PLAUSIBEL_AB,
  betragAus,
  massDe,
  mengeAus,
  wohnflaecheAus,
  zuEingabe,
  type Entwurf,
  type RaumTyp,
  type Wer,
  type WerGewerk,
} from "@/lib/sanierung/eingabe";
import { ZUSTAND_GEWERKE, gemeinschaftsPruefpunkte, vorauswahl } from "@/lib/sanierung/zustand";
import type { FoerderArt } from "@/lib/sanierung/foerderung";

/** Asbestverbot seit 31.10.1993 (Umweltbundesamt) — ein Baujahr bis einschließlich 1993 kann betroffen sein. */
export const ASBEST_BIS_BAUJAHR = 1993;
/** PAK-haltiger Parkettkleber „ca. bis in die 1960er Jahre“ (Verbraucherzentrale NRW) → Baujahr vor 1970. */
export const PAK_VOR_BAUJAHR = 1970;
/** Übliche Raumhöhe im Bestand — wie der Vorschlag im Formular (`STANDARD_HOEHE`). */
const HOEHE_ANNAHME = 2.5;

const MALER: MassnahmeId[] = ["spachteln", "grundieren", "tapezieren", "wand_streichen", "decke_streichen"];
const WAND: MassnahmeId[] = ["spachteln", "tapezieren", "wand_streichen"];
const NEUER_BODEN: MassnahmeId[] = ["laminat", "vinyl", "boden_fliesen"];
const FLIESEN: MassnahmeId[] = ["boden_fliesen", "wand_fliesen"];

/**
 * Arbeiten, die in einer anderen stecken — sonst zählten sie doppelt. „Elektrik komplett“: laut
 * Quelle „Neuer Sicherungskasten, neue Leitungen in allen Räumen, neue Steckdosen und Schalter“;
 * eine neue Anlage bekommt ihren FI-Schutzschalter mit. „Bad komplett“ ersetzt die Ausstattung.
 */
export const ENTHALTEN_IN: Partial<Record<ArbeitId, ArbeitId>> = {
  schalter_steckdose_tauschen: "elektrik_komplett",
  steckdose_neu: "elektrik_komplett",
  fi_nachruesten: "elektrik_komplett",
  unterverteilung_erneuern: "elektrik_komplett",
  wc_tauschen: "bad_komplett",
  wc_vorwand: "bad_komplett",
  waschtisch_tauschen: "bad_komplett",
  badewanne_tauschen: "bad_komplett",
};

/** Förderfähige Arbeiten → Förderart der Zuschuss-Schätzung (BAFA Gebäudehülle, KfW 458). */
export const FOERDER_ZUORDNUNG: Partial<Record<ArbeitId, FoerderArt>> = { fenster_tauschen: "huelle", waermepumpe: "heizung" };

export type ZeilenArt = "zustand" | "handwerker" | "rueckbau" | "entsorgung";

export type GuideZeile = Kostenzeile & {
  art: ZeilenArt;
  /** Woher die Menge kommt, wenn der Nutzer sie nicht selbst eingetragen hat. */
  mengeAnnahme: string | null;
  /** Keine Menge und kein eigener Betrag — die Zeile zählt mit 0, bis eins von beiden da ist. */
  mengeFehlt: boolean;
};

export type RaumAuswertung = {
  id: string;
  name: string;
  typ: "" | RaumTyp;
  laenge: number;
  breite: number;
  hoehe: number;
  /** Flächen, auf die die Maßnahmen wirken (Wand ohne den gefliesten Teil). */
  flaechen: Flaechen;
  /** Maße aus der verteilten Wohnfläche (Annahme). */
  geschaetzt: boolean;
  /** Weder gemessen noch schätzbar — zählt mit 0. */
  ohneMasse: boolean;
  /** Maßnahmen, die gerechnet werden (nach Ausschlüssen wie „Bad komplett“). */
  massnahmen: MassnahmeId[];
};

export type OffenerPosten = { titel: string; grund: string };
export type Hinweis = { id: string; text: string };
export type EinkaufZeile = { key: string; name: string; menge: string; kosten: Spanne | null; hinweis?: string };
export type EinkaufGruppe = { id: string; titel: string; zeilen: EinkaufZeile[] };

export type Auswertung = {
  raeume: RaumAuswertung[];
  material: MaterialZeile[];
  materialKosten: Spanne;
  zeilen: GuideZeile[];
  zeilenKosten: Spanne;
  /** Lohnzeilen mit Geld (ohne Eigenleistung). */
  lohnGeld: number;
  /** Wert der eigenen Arbeit — kostet kein Geld, geht nicht in den Kauf-Assistenten. */
  eigenleistung: number;
  eigene: number;
  /** Was Geld kostet, vor dem Puffer. */
  geld: Spanne;
  pufferProzent: number;
  puffer: Spanne;
  /** Geld + Puffer — das geht in den Kauf-Assistenten (obere Spanne). */
  gesamt: Spanne;
  /** Anteil der Summe (Mitte), der allein auf Portalpreisen beruht — 0 bis 1. */
  portalAnteil: number;
  annahmen: string[];
  offen: OffenerPosten[];
  hinweise: Hinweis[];
  pruefpunkte: { titel: string; hinweis: string }[];
  rauchmelder: number;
  einkauf: EinkaufGruppe[];
  reihenfolge: string[];
  budget: { betrag: number; lage: "darunter" | "innerhalb" | "darueber" } | null;
};

const rund = (n: number) => Math.round(n * 100) / 100;
const de = (n: number, stellen = 1) => n.toLocaleString("de-DE", { maximumFractionDigits: stellen });
const gemessen = (laenge: string, breite: string) => massDe(laenge) > 0 && massDe(breite) > 0;

/** Baujahr als Zahl, wenn es ein plausibles vierstelliges Jahr ist. */
export function baujahrZahl(e: Entwurf): number | null {
  const t = e.projekt.baujahr.trim();
  if (!/^\d{4}$/.test(t)) return null;
  const j = Number(t);
  return j >= 1500 && j <= 2100 ? j : null;
}

/** Vor dem Asbestverbot gebaut — oder unbekannt (dann wie vor 1993 behandelt). */
export function altbauRisiko(e: Entwurf): boolean {
  const j = baujahrZahl(e);
  return j == null || j <= ASBEST_BIS_BAUJAHR;
}

/** Wer macht es — noch nicht gewählt: Handwerker (die vorsichtige Annahme). */
export function werFuer(e: Entwurf, g: WerGewerk): Wer {
  return e.projekt.wer[g] || "handwerker";
}

export const istEtw = (e: Entwurf) => e.projekt.etw === "ja";

/**
 * Räume mit den Maßen, mit denen gerechnet wird. Nicht gemessene Räume teilen sich die Restfläche
 * (Wohnfläche minus gemessene Räume) zu gleichen Teilen, quadratisch, Höhe 2,50 m — eine Annahme,
 * die das Ergebnis nennt. Kleine Räume (Bad) werden so eher überschätzt: die vorsichtige Richtung.
 */
export function raeumeMitMassen(e: Entwurf): { raeume: Omit<RaumAuswertung, "flaechen" | "massnahmen">[]; annahme: string | null } {
  const wohnflaeche = wohnflaecheAus(e.projekt.wohnflaeche) ?? 0;
  const offen = e.raeume.filter((r) => !gemessen(r.laenge, r.breite));
  const gemesseneFlaeche = e.raeume
    .filter((r) => gemessen(r.laenge, r.breite))
    .reduce((s, r) => s + massDe(r.laenge) * massDe(r.breite), 0);
  const rest = Math.max(0, wohnflaeche - gemesseneFlaeche);
  const jeRaum = offen.length > 0 ? rest / offen.length : 0;
  const seite = Math.sqrt(jeRaum);
  const raeume = e.raeume.map((r) => {
    const hoehe = massDe(r.hoehe) || HOEHE_ANNAHME;
    if (gemessen(r.laenge, r.breite)) {
      return { id: r.id, name: r.name, typ: r.typ, laenge: massDe(r.laenge), breite: massDe(r.breite), hoehe, geschaetzt: false, ohneMasse: false };
    }
    return { id: r.id, name: r.name, typ: r.typ, laenge: seite, breite: seite, hoehe, geschaetzt: jeRaum > 0, ohneMasse: !(jeRaum > 0) };
  });
  let annahme: string | null = null;
  if (offen.length > 0) {
    const namen = offen.map((r) => r.name || "Raum").join(", ");
    annahme =
      jeRaum > 0
        ? `Nicht gemessen: ${namen} — die Restfläche von ${de(rest)} m² ist gleichmäßig verteilt (je ${de(jeRaum)} m², quadratisch, Höhe ${de(HOEHE_ANNAHME, 2)} m wo nichts eingetragen ist). Kleine Räume wie das Bad werden so eher zu groß gerechnet.`
        : `Ohne Maße${wohnflaeche > 0 ? " (Wohnfläche schon durch die gemessenen Räume belegt)" : " und ohne Wohnfläche"}: ${namen} — zählt mit 0 m².`;
  }
  return { raeume, annahme };
}

/** Menge, die sich aus den Angaben ergibt — oder `null`, wenn der Nutzer sie eintragen muss. */
export function mengeVorschlag(
  id: ArbeitId,
  e: Entwurf,
  raeume: Pick<RaumAuswertung, "typ" | "laenge" | "breite" | "geschaetzt">[],
): { menge: number; annahme: string | null } | null {
  const a = ARBEITEN[id];
  const anzahl = (typen: RaumTyp[]) => raeume.filter((r) => r.typ !== "" && typen.includes(r.typ)).length;
  switch (a.mengenbasis) {
    case "pauschal":
      return { menge: 1, annahme: null };
    case "wohnflaeche": {
      const w = wohnflaecheAus(e.projekt.wohnflaeche) ?? 0;
      if (w > 0) return { menge: w, annahme: null };
      const summe = rund(raeume.reduce((s, r) => s + r.laenge * r.breite, 0));
      return summe > 0 ? { menge: summe, annahme: "Wohnfläche fehlt — Summe der Räume" } : null;
    }
    case "badflaeche": {
      const baeder = raeume.filter((r) => r.typ === "bad");
      const flaeche = rund(baeder.reduce((s, r) => s + r.laenge * r.breite, 0));
      if (!(flaeche > 0)) return null;
      return { menge: flaeche, annahme: baeder.some((r) => r.geschaetzt) ? "Badfläche aus geschätzten Maßen — nachmessen" : null };
    }
    case "laufmeter": {
      const kueche = raeume.find((r) => r.typ === "kueche" && r.laenge > 0);
      if (!kueche) return null;
      return { menge: rund(Math.max(kueche.laenge, kueche.breite)), annahme: "Küchenzeile so lang wie die längste Wand der Küche" };
    }
    case "stueck": {
      if (id === "fi_nachruesten") return { menge: 1, annahme: "mindestens einer" };
      if (id === "badewanne_tauschen") {
        const n = anzahl(["bad"]);
        return n > 0 ? { menge: n, annahme: "eine je Bad" } : null;
      }
      if (id === "wc_tauschen" || id === "wc_vorwand" || id === "waschtisch_tauschen") {
        const n = anzahl(["bad", "wc"]);
        return n > 0 ? { menge: n, annahme: "eins je Bad und WC" } : null;
      }
      return null; // Fenster, Türen, Heizkörper, Steckdosen: zählen, nicht schätzen
    }
    default:
      return null;
  }
}

/** Welche Arbeiten aus dem Zustand-Baukasten gerechnet werden (nach ETW und Ausschlüssen). */
function zustandsArbeiten(e: Entwurf, annahmen: string[]): { gewerk: string; id: ArbeitId }[] {
  const etw = istEtw(e);
  const liste: { gewerk: string; id: ArbeitId }[] = [];
  for (const g of ZUSTAND_GEWERKE) {
    if (etw && g.gemeinschaftBeiEtw) continue; // Prüfpunkt der Gemeinschaft, keine eigenen Kosten
    const feld = e.gewerke[g.gewerk];
    let ids: readonly ArbeitId[];
    if (feld.zustand === "") {
      // Grobschätzung erst ab den Räumen (Abschnitt 5 im Plan): Ohne jede Angabe zur Wohnung
      // ergäbe „mittel“ eine Summe aus dem Nichts.
      if (e.raeume.length === 0) continue;
      ids = vorauswahl(g.gewerk, null, etw);
      if (ids.length > 0) annahmen.push(`${g.titel}: Zustand noch nicht gewählt — „mittel“ angenommen`);
    } else {
      ids = feld.arbeiten;
      if (feld.zustand === "unbekannt") annahmen.push(`${g.titel}: Zustand unbekannt — „mittel“ angenommen`);
    }
    for (const id of ids) liste.push({ gewerk: g.gewerk, id });
  }
  return liste;
}

export function auswerten(e: Entwurf, katalog: Katalog): Auswertung {
  const annahmen: string[] = [];
  const offen: OffenerPosten[] = [];
  const hinweise: Hinweis[] = [];
  const hinweis = (id: string, text: string) => {
    if (!hinweise.some((h) => h.id === id)) hinweise.push({ id, text });
  };

  // --- Grundlagen ---------------------------------------------------------------------------
  if (e.projekt.baujahrUnbekannt) annahmen.push("Baujahr unbekannt — behandelt wie vor 1993 (Asbest möglich)");
  else if (baujahrZahl(e) == null) annahmen.push("Baujahr fehlt — behandelt wie vor 1993 (Asbest möglich)");
  const altbau = altbauRisiko(e);
  const j = baujahrZahl(e);
  const pakMoeglich = j == null || j < PAK_VOR_BAUJAHR;
  for (const g of ["maler", "boden", "fliesen"] as const) {
    if (e.projekt.wer[g] === "") annahmen.push(`Noch offen, wer ${g === "maler" ? "streicht" : g === "boden" ? "den Boden verlegt" : "fliest"} — gerechnet mit Handwerker`);
  }

  const flaecheProjekt = wohnflaecheAus(e.projekt.wohnflaeche);
  if (flaecheProjekt != null && flaecheProjekt > 0 && flaecheProjekt < WOHNFLAECHE_PLAUSIBEL_AB) {
    hinweis(
      "wohnflaeche-klein",
      `Wohnfläche ${flaecheProjekt.toLocaleString("de-DE")} m² ist ungewöhnlich klein — Tippfehler? Alles, was nach Wohnfläche gerechnet wird (z. B. Elektrik), fällt sonst viel zu niedrig aus.`,
    );
  }

  const { raeume: grund, annahme: masseAnnahme } = raeumeMitMassen(e);
  if (masseAnnahme) annahmen.push(masseAnnahme);

  const zustand = zustandsArbeiten(e, annahmen);
  const gewaehlt = new Set(zustand.map((z) => z.id));
  const badKomplett = gewaehlt.has("bad_komplett");

  // --- Räume: wirksame Maßnahmen und Flächen --------------------------------------------------
  let badFliesenWeg = false;
  const raeume: RaumAuswertung[] = grund.map((g, i) => {
    const feld = e.raeume[i];
    let massnahmen = [...new Set(feld.massnahmen)];
    if (badKomplett && feld.typ === "bad" && massnahmen.some((m) => FLIESEN.includes(m))) {
      massnahmen = massnahmen.filter((m) => !FLIESEN.includes(m));
      badFliesenWeg = true;
    }
    const raum: Raum = {
      id: g.id, name: g.name, laenge: g.laenge, breite: g.breite, hoehe: g.hoehe,
      oeffnungen: massDe(feld.oeffnungen), fliesenhoehe: massDe(feld.fliesenhoehe), massnahmen,
    };
    return { ...g, flaechen: wirksameFlaechen(raum), massnahmen };
  });

  // --- Material: nur, was nicht im Handwerkerpreis steckt -----------------------------------
  // Malerpreise enthalten das Material; Verlegepreise (Boden, Fliesen) sind Lohn — beim Fliesenleger aber
  // „inklusive Fliesenkleber und Verfugung“ (Daibau, Quelle in lib/sanierung/arbeiten.ts). Die Fliese
  // selbst kauft der Nutzer, Kleber und Fugenmörtel nicht (C31).
  const malerHandwerker = werFuer(e, "maler") === "handwerker";
  const fliesenHandwerker = werFuer(e, "fliesen") === "handwerker";
  const basis = zuEingabe({ ...e, raeume: [] });
  const materialErgebnis = berechneSanierung(
    {
      ...basis,
      ohneMaterial: fliesenHandwerker ? ["fliesenkleber", "fugenmoertel"] : [],
      raeume: raeume.map((r, i) => ({
        id: r.id, name: r.name, laenge: r.laenge, breite: r.breite, hoehe: r.hoehe,
        oeffnungen: massDe(e.raeume[i].oeffnungen), fliesenhoehe: massDe(e.raeume[i].fliesenhoehe),
        massnahmen: malerHandwerker ? r.massnahmen.filter((m) => !MALER.includes(m)) : r.massnahmen,
      })),
    },
    katalog,
  );

  // --- Handwerker und Rückbau aus den Räumen --------------------------------------------------
  const mengen = new Map<ArbeitId, number>();
  const plus = (id: ArbeitId, m: number) => mengen.set(id, (mengen.get(id) ?? 0) + (m > 0 ? m : 0));
  const selbstRueckbau = { bauschutt: false, mischabfall: false, tapete: false };
  let grundierenImPreis = false;
  let tapeteAnnahme = false;
  let wandfliesenAnnahme = false;
  let belagAnnahme = false;

  raeume.forEach((r, i) => {
    const feld = e.raeume[i];
    const name = r.name || "Raum";
    const hat = (m: MassnahmeId) => r.massnahmen.includes(m);
    const f = r.flaechen;

    if (malerHandwerker) {
      if (hat("spachteln")) plus("maler_spachteln", f.wand);
      if (hat("tapezieren")) plus("maler_raufaser_streichen", f.wand);
      else if (hat("wand_streichen")) plus("maler_streichen", f.wand);
      if (hat("decke_streichen")) plus("maler_streichen", f.decke);
      if (hat("grundieren")) grundierenImPreis = true;
    }
    if (WAND.some(hat) && feld.tapeteRunter !== "nein") {
      if (feld.tapeteRunter !== "ja") tapeteAnnahme = true;
      if (malerHandwerker) plus("tapete_entfernen", f.wand);
      else selbstRueckbau.tapete = true;
    }

    const neu = NEUER_BODEN.find(hat);
    if (neu) {
      const gewerk: WerGewerk = neu === "boden_fliesen" ? "fliesen" : "boden";
      const handwerker = werFuer(e, gewerk) === "handwerker";
      if (handwerker) plus(neu === "boden_fliesen" ? "fliesen_verlegen" : "klickboden_verlegen", f.boden);
      const belag = feld.altbelag || "unbekannt";
      // Bei „kein Belag“ fragt der Guide nicht nach „raus“ — dann fehlt auch nichts.
      if (feld.altbelag === "" || (feld.altbelag !== "keiner" && feld.belagRaus === "")) belagAnnahme = true;
      const raus = feld.belagRaus !== "nein"; // noch nicht gewählt: raus (die vorsichtige Annahme)
      if (belag !== "keiner") {
        if (altbau && (belag === "pvc" || belag === "unbekannt")) {
          offen.push({
            titel: `${name}: alten Boden auf Asbest prüfen lassen`,
            grund: raus
              ? "Nicht selbst entfernen — Rückbau durch eine Fachfirma, Angebot einholen."
              : "Nicht überdecken, solange er nicht geprüft ist — asbesthaltige Bodenbeläge fest zu überdecken ist verboten (§ 11 GefStoffV).",
          });
        } else if (raus && belag === "parkett" && pakMoeglich) {
          offen.push({
            titel: `${name}: Parkettkleber auf PAK prüfen lassen`,
            grund: "Bis etwa in die 1960er Jahre wurde teerhaltiger Kleber verwendet — Entfernen durch eine Fachfirma, Angebot einholen.",
          });
        } else if (raus) {
          if (belag === "fliesen") {
            if (handwerker) plus("altfliesen_entfernen", f.boden);
            else selbstRueckbau.bauschutt = true;
          } else if (handwerker) plus("bodenbelag_entfernen", f.boden);
          else selbstRueckbau.mischabfall = true;
        }
      }
    }

    if (hat("wand_fliesen")) {
      const handwerker = werFuer(e, "fliesen") === "handwerker";
      if (handwerker) plus("fliesen_verlegen", f.fliesenwand);
      if (feld.wandfliesenRaus !== "nein") {
        if (feld.wandfliesenRaus !== "ja") wandfliesenAnnahme = true;
        if (handwerker) plus("altfliesen_entfernen", f.fliesenwand);
        else selbstRueckbau.bauschutt = true;
      }
    }
    if (r.typ === "bad" && FLIESEN.some(hat)) {
      hinweis("abdichtung", "Dusche und Wand über der Wanne werden vor dem Fliesen abgedichtet (DIN 18534). Dichtschlämme und Dichtband stehen nicht auf dem Einkaufszettel — dafür gibt es noch keinen belegten Preis.");
    }
  });
  if (tapeteAnnahme) annahmen.push("Alte Tapete: nicht beantwortet oder unbekannt — gerechnet mit „muss runter“");
  if (wandfliesenAnnahme) annahmen.push("Alte Wandfliesen: nicht beantwortet oder unbekannt — gerechnet mit „müssen runter“");
  if (belagAnnahme) annahmen.push("Alter Boden: nicht vollständig beantwortet — gerechnet mit „unbekannter Belag, muss raus“");

  // --- Entsorgung -----------------------------------------------------------------------------
  const vorschlag = selbstRueckbau.bauschutt && selbstRueckbau.mischabfall ? "beide" : selbstRueckbau.bauschutt ? "bauschutt" : selbstRueckbau.mischabfall ? "mischabfall" : "keine";
  let entsorgung = e.projekt.entsorgung;
  if (entsorgung === "" || entsorgung === "unbekannt") {
    if (vorschlag !== "keine") annahmen.push(`Entsorgung ${entsorgung === "" ? "noch nicht gewählt" : "unbekannt"} — Vorschlag aus deinem Rückbau: ${vorschlag === "beide" ? "Container für Bauschutt und für Mischabfall" : vorschlag === "bauschutt" ? "Container für Bauschutt" : "Container für Mischabfall"}`);
    entsorgung = vorschlag;
  }
  const container: ArbeitId[] = entsorgung === "beide" ? ["container_bauschutt", "container_mischabfall"] : entsorgung === "bauschutt" ? ["container_bauschutt"] : entsorgung === "mischabfall" ? ["container_mischabfall"] : [];

  // --- Kostenzeilen ---------------------------------------------------------------------------
  const zeilen: GuideZeile[] = [];
  const zeile = (id: ArbeitId, art: ZeilenArt, vorschlagMenge: { menge: number; annahme: string | null } | null) => {
    const eigeneMenge = mengeAus(e.arbeitMengen[id]);
    const eigenerBetrag = betragAus(e.arbeitPreise[id]);
    const menge = eigeneMenge ?? vorschlagMenge?.menge ?? 0;
    const k = kostenzeile(id, menge, eigenerBetrag);
    zeilen.push({
      ...k,
      menge: rund(k.menge),
      art,
      mengeAnnahme: eigeneMenge == null ? vorschlagMenge?.annahme ?? null : null,
      mengeFehlt: eigeneMenge == null && vorschlagMenge == null && eigenerBetrag == null,
    });
  };

  const enthalten = new Set<ArbeitId>();
  for (const { id } of zustand) {
    const in_ = ENTHALTEN_IN[id];
    if (in_ && gewaehlt.has(in_)) {
      enthalten.add(id);
      continue;
    }
    zeile(id, "zustand", mengeVorschlag(id, e, raeume));
  }
  if ([...enthalten].some((id) => ENTHALTEN_IN[id] === "elektrik_komplett")) {
    hinweis("elektrik_komplett", "„Elektrik komplett“ enthält Sicherungskasten, Leitungen, Steckdosen und Schalter — einzeln Angekreuztes aus der Elektrik zählt nicht zusätzlich.");
  }
  if (badFliesenWeg || [...enthalten].some((id) => ENTHALTEN_IN[id] === "bad_komplett")) {
    hinweis("bad_komplett", "„Bad komplett“ ersetzt Fliesen und Ausstattung — Fliesen im Bad, WC, Waschtisch und Wanne zählen nicht zusätzlich.");
  }
  for (const [id, m] of mengen) {
    // Nur Räume mit 0 m² (ohne Maße) — die Zeile hätte 0 €; die Annahmen nennen den Raum schon.
    if (!(m > 0) && mengeAus(e.arbeitMengen[id]) == null && betragAus(e.arbeitPreise[id]) == null) continue;
    const art: ZeilenArt = id === "tapete_entfernen" || id === "bodenbelag_entfernen" || id === "altfliesen_entfernen" ? "rueckbau" : "handwerker";
    zeile(id, art, { menge: rund(m), annahme: raeume.some((r) => r.geschaetzt) ? "Flächen teils aus geschätzten Maßen" : null });
  }
  for (const id of container) zeile(id, "entsorgung", { menge: 1, annahme: "ein Container (7 m³) angenommen" });

  if (grundierenImPreis) hinweis("grundieren", "Grundieren nennen die Preisquellen der Maler nicht gesondert — im Angebot nachsehen, ob es enthalten ist.");
  if (zeilen.some((z) => z.angebotEinholen)) {
    hinweis("fachbetrieb", "Strom-, Gas- und Trinkwasseranlagen darf nur ein eingetragener Fachbetrieb errichten oder wesentlich ändern. Die Spannen sind Richtwerte aus Preisportalen — verbindlich ist erst ein Angebot.");
  }
  for (const z of zeilen.filter((x) => x.mengeFehlt)) annahmen.push(`${z.label}: Anzahl fehlt — zählt mit 0, bis du sie einträgst`);

  // --- Summen ---------------------------------------------------------------------------------
  const zeilenKosten = { min: rund(zeilen.reduce((s, z) => s + z.von, 0)), max: rund(zeilen.reduce((s, z) => s + z.bis, 0)) };
  const lohnGeld = rund(materialErgebnis.lohn - materialErgebnis.lohnEigen);
  const geld = {
    min: rund(materialErgebnis.materialKosten.min + zeilenKosten.min + lohnGeld + materialErgebnis.eigene),
    max: rund(materialErgebnis.materialKosten.max + zeilenKosten.max + lohnGeld + materialErgebnis.eigene),
  };
  const p = mengeAus(e.projekt.puffer);
  const pufferProzent = p != null && p <= 100 ? p : 0;
  if (p == null || p > 100) annahmen.push("Kein Puffer gewählt — 0 % gerechnet");
  const puffer = { min: rund((geld.min * pufferProzent) / 100), max: rund((geld.max * pufferProzent) / 100) };
  const gesamt = { min: rund(geld.min + puffer.min), max: rund(geld.max + puffer.max) };
  const mitte = (geld.min + geld.max) / 2;
  const portalMitte = zeilen.filter((z) => z.herkunft === "portal").reduce((s, z) => s + (z.von + z.bis) / 2, 0);
  const portalAnteil = mitte > 0 ? Math.round((portalMitte / mitte) * 1000) / 1000 : 0;

  // --- Hinweise, die am Objekt hängen --------------------------------------------------------
  const etwasZuTun = raeume.some((r) => r.massnahmen.length > 0) || zeilen.length > 0;
  if (altbau && etwasZuTun) {
    hinweis("asbest", "Gebaut vor dem Asbestverbot (31.10.1993) oder Baujahr unbekannt: Asbest kann in Bodenplatten, Klebern, Fliesenkleber, Putz und Spachtel stecken. Vor Arbeiten musst du Handwerkern das Baujahr mitteilen (§ 5a GefStoffV). Beim Rückbau im Zweifel vorher prüfen lassen.");
  }
  const rauchmelder = e.raeume.filter((r) => r.typ === "schlafen" || r.typ === "kind" || r.typ === "flur").length;
  if (rauchmelder > 0) {
    hinweis("rauchmelder", "Rauchwarnmelder sind in allen Ländern Pflicht — mindestens in Schlafräumen, Kinderzimmern und Fluren, über die ein Rettungsweg führt; in Berlin und Brandenburg auch in den übrigen Aufenthaltsräumen außer der Küche. Die Regeln je Land unterscheiden sich leicht (Stand 2023).");
  }
  const etw = istEtw(e);
  if (etw) {
    for (const g of ZUSTAND_GEWERKE) {
      if (!g.gemeinschaftBeiEtw && g.etwHinweis && zeilen.some((z) => ARBEITEN[z.arbeit].gewerk === g.gewerk)) hinweis(`etw-${g.gewerk}`, `${g.titel}: ${g.etwHinweis}`);
    }
  }

  // --- Budget ---------------------------------------------------------------------------------
  const b = betragAus(e.projekt.budget);
  const budget = b != null && b > 0 ? { betrag: b, lage: gesamt.max <= b ? ("darunter" as const) : gesamt.min > b ? ("darueber" as const) : ("innerhalb" as const) } : null;

  return {
    raeume,
    material: materialErgebnis.material,
    materialKosten: materialErgebnis.materialKosten,
    zeilen,
    zeilenKosten,
    lohnGeld,
    eigenleistung: materialErgebnis.lohnEigen,
    eigene: materialErgebnis.eigene,
    geld,
    pufferProzent,
    puffer,
    gesamt,
    portalAnteil,
    annahmen,
    offen,
    hinweise,
    pruefpunkte: gemeinschaftsPruefpunkte(etw).map((p) => ({ titel: p.titel, hinweis: p.hinweis })),
    rauchmelder,
    einkauf: einkaufszettel(materialErgebnis.material, rauchmelder),
    reihenfolge: reihenfolge(raeume, zeilen, rauchmelder, selbstRueckbau.tapete),
    budget,
  };
}

// ---- Einkaufszettel ----------------------------------------------------------------------------

const ABTEILUNG: Record<MaterialId, "farbe" | "tapete" | "boden" | "fliesen"> = {
  spachtel: "farbe",
  tiefengrund: "farbe",
  wandfarbe: "farbe",
  raufaser: "tapete",
  kleister: "tapete",
  laminat: "boden",
  vinyl: "boden",
  trittschall: "boden",
  sockelleiste: "boden",
  fliese: "fliesen",
  fliesenkleber: "fliesen",
  fugenmoertel: "fliesen",
  silikon: "fliesen",
};
const ABTEILUNGEN: { id: string; titel: string }[] = [
  { id: "farbe", titel: "Farbe & Spachtel" },
  { id: "tapete", titel: "Tapete" },
  { id: "boden", titel: "Boden" },
  { id: "fliesen", titel: "Fliesen" },
  { id: "sicherheit", titel: "Sicherheit" },
];

/** Einkaufszettel nach Baumarkt-Abteilung — ganze Gebinde; ohne belegten Preis steht dort keiner. */
export function einkaufszettel(material: MaterialZeile[], rauchmelder: number): EinkaufGruppe[] {
  const gruppen = new Map<string, EinkaufZeile[]>();
  for (const z of material) {
    const a = ABTEILUNG[z.material.id];
    const gebinde = z.gebinde.min === z.gebinde.max ? `${z.gebinde.max}` : `${z.gebinde.min}–${z.gebinde.max}`;
    const liste = gruppen.get(a) ?? [];
    liste.push({ key: z.material.id, name: z.material.name, menge: `${gebinde} × ${z.material.gebindeName}`, kosten: z.kosten, hinweis: z.material.produkt });
    gruppen.set(a, liste);
  }
  if (rauchmelder > 0) {
    gruppen.set("sicherheit", [
      { key: "rauchmelder", name: "Rauchwarnmelder (DIN EN 14604)", menge: `${rauchmelder} Stück`, kosten: null, hinweis: "Preis noch ohne belegte Quelle" },
    ]);
  }
  return ABTEILUNGEN.filter((a) => gruppen.has(a.id)).map((a) => ({ id: a.id, titel: a.titel, zeilen: gruppen.get(a.id)! }));
}

// ---- Reihenfolge -------------------------------------------------------------------------------

/** Abfolge auf der Baustelle (Abschnitt 8 im Plan) — nur die Schritte, die in diesem Projekt vorkommen. */
export function reihenfolge(raeume: Pick<RaumAuswertung, "massnahmen">[], zeilen: Pick<GuideZeile, "arbeit" | "art">[], rauchmelder: number, tapeteSelbst: boolean): string[] {
  const m = new Set(raeume.flatMap((r) => r.massnahmen));
  const a = new Set(zeilen.map((z) => z.arbeit));
  const gewerk = (g: string) => zeilen.some((z) => z.art === "zustand" && ARBEITEN[z.arbeit].gewerk === g);
  const schritte: [boolean, string][] = [
    [m.size > 0 || zeilen.length > 0, "Abdecken und abkleben"],
    [tapeteSelbst || zeilen.some((z) => z.art === "rueckbau" || z.art === "entsorgung"), "Rückbau: alte Tapeten, Beläge und Fliesen raus, Entsorgung bestellen"],
    [gewerk("elektrik") || gewerk("bad") || gewerk("heizung") || gewerk("fenster"), "Fachbetrieb: Leitungen und Rohinstallation (Elektrik, Bad, Heizung), Fenster"],
    [m.has("spachteln") || a.has("maler_spachteln"), "Spachteln"],
    [m.has("boden_fliesen") || m.has("wand_fliesen"), "Abdichten und fliesen"],
    [m.has("grundieren") || m.has("tapezieren") || m.has("wand_streichen") || m.has("decke_streichen"), "Grundieren, tapezieren, streichen"],
    [m.has("laminat") || m.has("vinyl"), "Boden verlegen"],
    [a.has("innentuer_komplett"), "Türen einbauen"],
    [gewerk("bad") || gewerk("elektrik") || gewerk("kueche"), "Endmontage: Sanitärobjekte, Schalter und Steckdosen, Küche"],
    [rauchmelder > 0, "Rauchwarnmelder anbringen"],
    [m.size > 0 || zeilen.length > 0, "Grundreinigung"],
  ];
  return schritte.filter(([ja]) => ja).map(([, text]) => text);
}

/** Förderfähige Kostenzeilen als Posten für die Zuschuss-Schätzung — je untere oder obere Spanne. */
export function foerderPosten(a: Pick<Auswertung, "zeilen">, seite: "von" | "bis"): { id: string; bezeichnung: string; betrag: number; art: FoerderArt }[] {
  return a.zeilen.flatMap((z) => {
    const art = FOERDER_ZUORDNUNG[z.arbeit];
    return art ? [{ id: `guide-${z.arbeit}`, bezeichnung: z.label, betrag: z[seite], art }] : [];
  });
}
