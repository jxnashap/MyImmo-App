// Eingabe des Sanierungsrechners: was im Formular steht (Text, wie getippt) → was gerechnet wird.
//
// Die Felder bleiben Text, damit „3,45“ beim Tippen nicht zu „3“ zusammenschnurrt; gelesen wird
// mit `zahlDe0()` wie in den anderen Rechnern (Komma oder Punkt, deutscher Tausenderpunkt).
// Der Entwurf liegt nur im Browser (localStorage) — `entwurfAus()` prüft ihn beim Laden, weil
// dort alles stehen kann: ein alter Stand, ein halber, oder Fremdes.
//
// Sanierungs-Guide (Stufe B, docs/zukunft/SANIERUNGS-GUIDE.md): EIN Entwurf für Guide UND Übersicht
// — Projekt, Raumtyp, Ist-Zustand je Raum, Zustand je Gewerk. Welche Seite offen ist, steht in
// lib/sanierung/guide.ts, was daraus folgt in lib/sanierung/auswertung.ts.

import { zahlDe, zahlDe0 } from "@/lib/zahl";
import { MASSNAHMEN, type MassnahmeId, type MaterialId, type SanierungEingabe } from "@/lib/sanierung/rechner";
import { istFoerderArt, type FoerderArt, type FoerderEingabe, type Gebaeude, type Nutzung } from "@/lib/sanierung/foerderung";
import { ARBEITEN, type ArbeitId } from "@/lib/sanierung/arbeiten";
import { ZUSTAND_GEWERKE, type Zustand, type ZustandGewerk } from "@/lib/sanierung/zustand";
import { KATALOG } from "@/lib/sanierung/katalog";

export type RaumTyp = "wohnen" | "schlafen" | "kind" | "kueche" | "bad" | "wc" | "flur" | "abstell";
export const RAUM_TYPEN: { id: RaumTyp; label: string }[] = [
  { id: "wohnen", label: "Wohnzimmer" },
  { id: "schlafen", label: "Schlafzimmer" },
  { id: "kind", label: "Kinderzimmer" },
  { id: "kueche", label: "Küche" },
  { id: "bad", label: "Bad" },
  { id: "wc", label: "WC" },
  { id: "flur", label: "Flur" },
  { id: "abstell", label: "Abstellraum" },
];
const RAUM_TYP_IDS = new Set<string>(RAUM_TYPEN.map((t) => t.id));

/** Drei Antworten auf eine Frage zum Ist-Zustand; „unbekannt“ wird zur Annahme. */
export type Wissen = "ja" | "nein" | "unbekannt";
/** Was heute auf dem Boden liegt. „keiner“ = Estrich/Rohboden. */
export type Altbelag = "keiner" | "teppich" | "laminat_vinyl" | "pvc" | "fliesen" | "parkett" | "unbekannt";
export const ALTBELAEGE: { id: Altbelag; label: string }[] = [
  { id: "teppich", label: "Teppich" },
  { id: "laminat_vinyl", label: "Laminat oder Klick-Vinyl" },
  { id: "pvc", label: "PVC, Vinyl geklebt, Bodenplatten" },
  { id: "fliesen", label: "Fliesen" },
  { id: "parkett", label: "Parkett oder Dielen" },
  { id: "keiner", label: "Kein Belag (Estrich)" },
  { id: "unbekannt", label: "Weiß ich nicht" },
];
const ALTBELAG_IDS = new Set<string>(ALTBELAEGE.map((a) => a.id));

/** Wer die Maler-, Boden- und Fliesenarbeiten macht (Entscheidung 4: Handwerker → Preis je m²). */
export type Wer = "selbst" | "handwerker";
export type WerGewerk = "maler" | "boden" | "fliesen";
export const WER_GEWERKE: { id: WerGewerk; label: string }[] = [
  { id: "maler", label: "Wände und Decken (Maler)" },
  { id: "boden", label: "Boden (Laminat, Vinyl)" },
  { id: "fliesen", label: "Fliesen" },
];

export type Entsorgung = "keine" | "bauschutt" | "mischabfall" | "beide" | "unbekannt";

export type ProjektFelder = {
  name: string;
  adresse: string;
  /** Eigentumswohnung: Fenster & Co. sind Sache der Gemeinschaft (Risiko 9 im Plan). */
  etw: "" | "ja" | "nein";
  baujahr: string;
  baujahrUnbekannt: boolean;
  wohnflaeche: string;
  nutzung: "" | Nutzung;
  /** Optional — nur zum Vergleich im Ergebnis. */
  budget: string;
  wer: Record<WerGewerk, "" | Wer>;
  /** Puffer für Unvorhergesehenes in Prozent — entscheidet der Nutzer (keine belegte Faustregel). */
  puffer: string;
  entsorgung: "" | Entsorgung;
};

export type ZustandGewerkId = ZustandGewerk["gewerk"];
export type GewerkFeld = { zustand: "" | Zustand | "unbekannt"; arbeiten: ArbeitId[] };

export type RaumFeld = {
  id: string;
  name: string;
  laenge: string;
  breite: string;
  hoehe: string;
  oeffnungen: string;
  /** Nur bei „Wände fliesen“: bis zu welcher Höhe (leer = bis zur Decke). */
  fliesenhoehe: string;
  massnahmen: MassnahmeId[];
  typ: "" | RaumTyp;
  /** „Noch nicht gemessen“ — die Auswertung verteilt dann die Wohnfläche (Annahme). */
  masseGeschaetzt: boolean;
  /** Die vorgeschlagenen Maßnahmen hat der Nutzer gesehen — sonst bleibt die Seite offen. */
  massnahmenBestaetigt: boolean;
  /** Ist-Zustand: alte Tapete, die runter muss? */
  tapeteRunter: "" | Wissen;
  altbelag: "" | Altbelag;
  /** Muss der alte Bodenbelag raus? (nur bei neuem Boden gefragt) */
  belagRaus: "" | "ja" | "nein";
  /** Alte Wandfliesen, die runter müssen? (nur bei „Wände fliesen“) */
  wandfliesenRaus: "" | Wissen;
};
/** Was die Rechnung von einem Raum braucht — Maße und Maßnahmen (ohne Typ und Ist-Zustand). */
export type RaumMasse = Pick<RaumFeld, "id" | "name" | "laenge" | "breite" | "hoehe" | "oeffnungen" | "fliesenhoehe" | "massnahmen">;

export type LohnFeld = { id: string; bezeichnung: string; stunden: string; satz: string; eigenleistung: boolean };
export type PostenFeld = { id: string; bezeichnung: string; betrag: string; foerderung: FoerderArt };
/** Angaben für die Zuschuss-Schätzung (lib/sanierung/foerderung.ts). */
export type FoerderFelder = { wohneinheiten: string; isfp: boolean; nutzung: Nutzung; gebaeude: Gebaeude };

export type Entwurf = {
  raeume: RaumFeld[];
  lohn: LohnFeld[];
  eigene: PostenFeld[];
  /** Eigene Preise je Gebinde; leer = Katalogpreis. */
  preise: Partial<Record<MaterialId, string>>;
  foerder: FoerderFelder;
  projekt: ProjektFelder;
  gewerke: Record<ZustandGewerkId, GewerkFeld>;
  /** Eigene Menge je Arbeit (überschreibt den Vorschlag aus Räumen und Wohnfläche). */
  arbeitMengen: Partial<Record<ArbeitId, string>>;
  /** Eigener Betrag je Arbeit (z. B. Angebot) — ersetzt die Spanne der ganzen Zeile. */
  arbeitPreise: Partial<Record<ArbeitId, string>>;
  /** Abgehakte Zeilen des Einkaufszettels. */
  abgehakt: string[];
  /**
   * Maßnahmen, die ein neuer Raum je Typ vorgeschlagen bekommt — aus einer Vorlage (Stufe C).
   * Fehlt ein Typ, gilt der eingebaute Vorschlag (`vorschlagMassnahmen`); `[]` heißt „nichts“.
   */
  vorschlagJeTyp: Partial<Record<RaumTyp, MassnahmeId[]>>;
};

export const leeresProjekt = (): ProjektFelder => ({
  name: "",
  adresse: "",
  etw: "",
  baujahr: "",
  baujahrUnbekannt: false,
  wohnflaeche: "",
  nutzung: "",
  budget: "",
  wer: { maler: "", boden: "", fliesen: "" },
  puffer: "",
  entsorgung: "",
});

export const leereGewerke = (): Record<ZustandGewerkId, GewerkFeld> =>
  Object.fromEntries(ZUSTAND_GEWERKE.map((g) => [g.gewerk, { zustand: "", arbeiten: [] }])) as unknown as Record<ZustandGewerkId, GewerkFeld>;

/** BuyImmo richtet sich an Leute, die vermieten — und an eine Eigentumswohnung (1 Einheit). */
export const STANDARD_FOERDER: FoerderFelder = { wohneinheiten: "1", isfp: false, nutzung: "vermieten", gebaeude: "mfh" };
export const neuerPosten = (id: string): PostenFeld => ({ id, bezeichnung: "", betrag: "", foerderung: "keine" });

/** Übliche Raumhöhe im Bestand als Vorschlag — der Nutzer überschreibt sie mit dem Maßband. */
export const STANDARD_HOEHE = "2,50";

export function neuerRaum(id: string, nummer: number): RaumFeld {
  return {
    id, name: `Raum ${nummer}`, laenge: "", breite: "", hoehe: STANDARD_HOEHE, oeffnungen: "", fliesenhoehe: "", massnahmen: [],
    typ: "", masseGeschaetzt: false, massnahmenBestaetigt: false, tapeteRunter: "", altbelag: "", belagRaus: "", wandfliesenRaus: "",
  };
}

/**
 * Raum kopieren (Besichtigung: Zimmer gleichen sich oft) — alle Maße und Maßnahmen, neuer Name,
 * neue Kennung; die Kopie steht direkt hinter dem Original.
 */
export function mitKopie<R extends RaumMasse>(raeume: R[], id: string, neueId: string): R[] {
  const i = raeume.findIndex((r) => r.id === id);
  if (i < 0) return raeume;
  const original = raeume[i];
  const kopie: R = { ...original, id: neueId, name: `${original.name || "Raum"} (Kopie)`, massnahmen: [...original.massnahmen] };
  return [...raeume.slice(0, i + 1), kopie, ...raeume.slice(i + 1)];
}

/**
 * Start: noch kein Raum (die Räume entstehen im Guide aus Typ + Anzahl) und eine leere Zeile
 * Arbeitszeit als Eigenleistung — der Lohnrechner soll in der Übersicht sofort zu sehen sein.
 */
export function leererEntwurf(id: string): Entwurf {
  return {
    raeume: [],
    lohn: [{ id: `${id}-lohn`, bezeichnung: "Eigene Arbeit", stunden: "", satz: "", eigenleistung: true }],
    eigene: [],
    preise: {},
    foerder: { ...STANDARD_FOERDER },
    projekt: leeresProjekt(),
    gewerke: leereGewerke(),
    arbeitMengen: {},
    arbeitPreise: {},
    abgehakt: [],
    vorschlagJeTyp: {},
  };
}

/**
 * Menge oder Prozent aus einem Textfeld: leer oder unlesbar → `null` (fehlt), sonst die Zahl ≥ 0.
 * Wie `massDe()` ohne Tausenderpunkt — Mengen hier sind Stück, Meter, m² oder Prozent.
 */
export function mengeAus(eingabe: string | null | undefined): number | null {
  const roh = (eingabe ?? "").trim().replace(/\s/g, "");
  if (roh === "" || !/^\d*[.,]?\d*$/.test(roh) || !/\d/.test(roh)) return null;
  const n = Number(roh.replace(",", "."));
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Geldbetrag aus einem Textfeld (deutscher Tausenderpunkt erlaubt): leer oder unlesbar → `null`. */
export function betragAus(eingabe: string | null | undefined): number | null {
  if (eingabe == null || eingabe.trim() === "") return null;
  const n = zahlDe(eingabe);
  return n != null && n >= 0 ? n : null;
}

/**
 * Raummaße in Metern lesen. NICHT `zahlDe0()`: Das liest einen Punkt vor drei Ziffern als
 * Tausenderpunkt — „4.125“ vom Lasermessgerät würde zu 4.125 m (Review 05.10.2026; dieselbe Regel
 * wie bei Zählerständen in CLAUDE.md). Meter haben keine Tausender: Komma oder Punkt ist immer die
 * Dezimalstelle; alles andere (zwei Trennzeichen, Buchstaben) zählt als 0.
 */
export function massDe(eingabe: string | null | undefined): number {
  const roh = (eingabe ?? "").trim().replace(/\s/g, "");
  if (!/^\d*[.,]?\d*$/.test(roh)) return 0;
  const n = Number(roh.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * Formular → Zuschuss-Schätzung. Nur Posten mit einer Förderart zählen dort. `zusatz`: förderfähige
 * Kostenzeilen aus dem Guide (Fenster, Wärmepumpe) — so muss sie niemand doppelt eintragen.
 * Die Nutzung kommt aus dem Projekt, wenn sie dort gewählt ist (eine Frage, nicht zwei).
 */
export function zuFoerderEingabe(
  e: Entwurf,
  stichtag: string,
  zusatz: { id: string; bezeichnung: string; betrag: number; art: FoerderArt }[] = [],
): FoerderEingabe {
  const we = Math.floor(zahlDe0(e.foerder.wohneinheiten));
  return {
    posten: [...e.eigene.map((p) => ({ id: p.id, bezeichnung: p.bezeichnung, betrag: zahlDe0(p.betrag), art: p.foerderung })), ...zusatz],
    wohneinheiten: we >= 1 ? we : 1,
    isfp: e.foerder.isfp,
    nutzung: e.projekt.nutzung || e.foerder.nutzung,
    gebaeude: e.foerder.gebaeude,
    stichtag,
  };
}

/** Formular → Rechnung. Leere oder unsinnige Felder zählen als 0. */
export function zuEingabe(e: Pick<Entwurf, "lohn" | "eigene" | "preise"> & { raeume: RaumMasse[] }): SanierungEingabe {
  const preise: Partial<Record<MaterialId, number>> = {};
  for (const [id, wert] of Object.entries(e.preise) as [MaterialId, string | undefined][]) {
    // Leeres Feld = Katalogpreis. „0“ ist ein echter Preis (Material ist schon da). Was sich nicht
    // lesen lässt („54,-“, „ca. 20“), bleibt beim Katalogpreis — sonst wäre das Material gratis.
    const n = wert != null && wert.trim() !== "" ? zahlDe(wert) : null;
    if (n != null && n >= 0) preise[id] = n;
  }
  return {
    raeume: e.raeume.map((r) => ({
      id: r.id,
      name: r.name,
      laenge: massDe(r.laenge),
      breite: massDe(r.breite),
      hoehe: massDe(r.hoehe),
      oeffnungen: massDe(r.oeffnungen),
      fliesenhoehe: massDe(r.fliesenhoehe),
      massnahmen: r.massnahmen,
    })),
    preise,
    lohn: e.lohn.map((l) => ({ bezeichnung: l.bezeichnung, stunden: zahlDe0(l.stunden), satz: zahlDe0(l.satz), eigenleistung: l.eigenleistung })),
    eigene: e.eigene.map((p) => ({ bezeichnung: p.bezeichnung, betrag: zahlDe0(p.betrag) })),
  };
}

const MASSNAHME_IDS = new Set<string>(MASSNAHMEN.map((m) => m.id));
const text = (v: unknown, max = 200): string => (typeof v === "string" ? v.slice(0, max) : "");
const id = (v: unknown, ersatz: string): string => (typeof v === "string" && v.length > 0 && v.length <= 64 ? v : ersatz);
const liste = (v: unknown): unknown[] => (Array.isArray(v) ? v.slice(0, 50) : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

/**
 * Gespeicherten Entwurf prüfen. Liefert `null`, wenn es kein Entwurf ist; übernimmt sonst nur
 * bekannte Felder und Maßnahmen (eine umbenannte Maßnahme aus einem alten Stand fällt weg,
 * statt die Rechnung zu stören).
 */
export function entwurfAus(roh: unknown): Entwurf | null {
  const o = obj(roh);
  if (!Array.isArray(o.raeume)) return null;
  const raeume = liste(o.raeume).map((x, i): RaumFeld => {
    const r = obj(x);
    const massnahmen = liste(r.massnahmen).filter((m): m is MassnahmeId => typeof m === "string" && MASSNAHME_IDS.has(m));
    return {
      id: id(r.id, `r${i}`),
      name: text(r.name, 60),
      laenge: text(r.laenge, 20),
      breite: text(r.breite, 20),
      hoehe: text(r.hoehe, 20),
      oeffnungen: text(r.oeffnungen, 20),
      // Ältere Entwürfe kennen das Feld nicht → leer = bis zur Decke.
      fliesenhoehe: text(r.fliesenhoehe, 20),
      massnahmen,
      typ: typeof r.typ === "string" && RAUM_TYP_IDS.has(r.typ) ? (r.typ as RaumTyp) : "",
      masseGeschaetzt: r.masseGeschaetzt === true,
      // Entwürfe aus dem Rechner vor dem Guide: Wer dort Maßnahmen angehakt hat, hat sie gewählt.
      massnahmenBestaetigt: r.massnahmenBestaetigt === true || (r.massnahmenBestaetigt === undefined && massnahmen.length > 0),
      tapeteRunter: wissen(r.tapeteRunter),
      altbelag: typeof r.altbelag === "string" && ALTBELAG_IDS.has(r.altbelag) ? (r.altbelag as Altbelag) : "",
      belagRaus: r.belagRaus === "ja" || r.belagRaus === "nein" ? r.belagRaus : "",
      wandfliesenRaus: wissen(r.wandfliesenRaus),
    };
  });
  const lohn = liste(o.lohn).map((x, i): LohnFeld => {
    const l = obj(x);
    return { id: id(l.id, `l${i}`), bezeichnung: text(l.bezeichnung, 80), stunden: text(l.stunden, 20), satz: text(l.satz, 20), eigenleistung: l.eigenleistung === true };
  });
  const eigene = liste(o.eigene).map((x, i): PostenFeld => {
    const p = obj(x);
    // Ältere Entwürfe kennen die Förderart nicht → „keine“; Unbekanntes ebenso.
    return { id: id(p.id, `p${i}`), bezeichnung: text(p.bezeichnung, 80), betrag: text(p.betrag, 20), foerderung: istFoerderArt(p.foerderung) ? p.foerderung : "keine" };
  });
  const preise: Partial<Record<MaterialId, string>> = {};
  for (const [k, v] of Object.entries(obj(o.preise))) {
    // Nur Materialien aus dem Katalog — sonst wüchse ein gespeicherter Entwurf mit beliebigen Schlüsseln.
    if (typeof v === "string" && Object.prototype.hasOwnProperty.call(KATALOG, k)) preise[k as MaterialId] = v.slice(0, 20);
  }
  const f = obj(o.foerder);
  const foerder: FoerderFelder = {
    wohneinheiten: typeof f.wohneinheiten === "string" ? f.wohneinheiten.slice(0, 4) : STANDARD_FOERDER.wohneinheiten,
    isfp: f.isfp === true,
    nutzung: f.nutzung === "eigennutzen" ? "eigennutzen" : "vermieten",
    gebaeude: f.gebaeude === "haus" ? "haus" : "mfh",
  };
  const pr = obj(o.projekt);
  const w = obj(pr.wer);
  const wer = (v: unknown): "" | Wer => (v === "selbst" || v === "handwerker" ? v : "");
  const projekt: ProjektFelder = {
    name: text(pr.name, 80),
    adresse: text(pr.adresse, 160),
    etw: pr.etw === "ja" || pr.etw === "nein" ? pr.etw : "",
    baujahr: text(pr.baujahr, 4),
    baujahrUnbekannt: pr.baujahrUnbekannt === true,
    wohnflaeche: text(pr.wohnflaeche, 10),
    nutzung: pr.nutzung === "vermieten" || pr.nutzung === "eigennutzen" ? pr.nutzung : "",
    budget: text(pr.budget, 20),
    wer: { maler: wer(w.maler), boden: wer(w.boden), fliesen: wer(w.fliesen) },
    puffer: text(pr.puffer, 6),
    entsorgung: typeof pr.entsorgung === "string" && ENTSORGUNG_IDS.has(pr.entsorgung) ? (pr.entsorgung as Entsorgung) : "",
  };
  const g = obj(o.gewerke);
  const gewerke = leereGewerke();
  for (const zg of ZUSTAND_GEWERKE) {
    const x = obj(g[zg.gewerk]);
    const z = x.zustand;
    gewerke[zg.gewerk] = {
      zustand: z === "gut" || z === "mittel" || z === "schlecht" || z === "unbekannt" ? z : "",
      // Nur Arbeiten, die es gibt und die zu diesem Gewerk gehören.
      arbeiten: liste(x.arbeiten).filter((a): a is ArbeitId => istArbeit(a) && ARBEITEN[a].gewerk === zg.gewerk),
    };
  }
  return {
    raeume, lohn, eigene, preise, foerder, projekt, gewerke,
    arbeitMengen: arbeitTexte(o.arbeitMengen),
    arbeitPreise: arbeitTexte(o.arbeitPreise),
    abgehakt: liste(o.abgehakt).filter((a): a is string => typeof a === "string" && a.length <= 64).slice(0, 50),
    vorschlagJeTyp: massnahmenJeTypAus(o.vorschlagJeTyp),
  };
}

/** Maßnahmen je Raumtyp prüfen (Entwurf und Vorlage): nur bekannte Typen und Maßnahmen, keine doppelten. */
export function massnahmenJeTypAus(v: unknown): Partial<Record<RaumTyp, MassnahmeId[]>> {
  const aus: Partial<Record<RaumTyp, MassnahmeId[]>> = {};
  for (const [k, x] of Object.entries(obj(v))) {
    if (!RAUM_TYP_IDS.has(k) || !Array.isArray(x)) continue;
    aus[k as RaumTyp] = [...new Set(liste(x).filter((m): m is MassnahmeId => typeof m === "string" && MASSNAHME_IDS.has(m)))];
  }
  return aus;
}

const ENTSORGUNG_IDS = new Set<string>(["keine", "bauschutt", "mischabfall", "beide", "unbekannt"]);
const istArbeit = (v: unknown): v is ArbeitId => typeof v === "string" && Object.prototype.hasOwnProperty.call(ARBEITEN, v);
const wissen = (v: unknown): "" | Wissen => (v === "ja" || v === "nein" || v === "unbekannt" ? v : "");
function arbeitTexte(v: unknown): Partial<Record<ArbeitId, string>> {
  const aus: Partial<Record<ArbeitId, string>> = {};
  for (const [k, x] of Object.entries(obj(v))) if (istArbeit(k) && typeof x === "string") aus[k] = x.slice(0, 20);
  return aus;
}
