// Projekte und Vorlagen des Sanierungs-Guides (Stufe C, docs/zukunft/SANIERUNGS-GUIDE.md, Abschnitt 7).
//
// Ein PROJEKT ist der ganze Entwurf (lib/sanierung/eingabe.ts) — gespeichert in der Tabelle
// `sanierungsprojekte`, damit die Besichtigung am Handy und die Auswertung am Rechner zusammenfinden.
//
// Eine VORLAGE trägt nur Entscheidungen, nie das, was eine Wohnung ausmacht: Was in welchem Raumtyp
// gemacht wird, welche Technik-Arbeiten feststehen, wer arbeitet, Entsorgung, Puffer, Nutzung und
// eigene Materialpreise. NICHT: Name, Adresse, Baujahr, ETW, Wohnfläche, Räume und Maße, Ist-Zustand,
// Mengen, Angebote, eigene Posten, Arbeitsstunden, Förderangaben. Ein neues Projekt aus einer Vorlage
// fragt deshalb genau das ab — „nur noch Maße und Ist-Zustand“ (Plan, Abschnitt 7).
//
// Technik (Zustand-Baukasten): Übernommen wird ein Gewerk nur, wenn darin etwas ANGEKREUZT ist — das
// ist eine Entscheidung („Bad komplett neu“). „Gut, nichts zu tun“ ist dagegen eine Aussage über die
// alte Wohnung; aus der Vorlage übernommen, stünde bei der nächsten Wohnung „Automaten und FI
// vorhanden“, ohne dass jemand nachgesehen hat. Solche Gewerke fragt der Guide neu.
//
// Hier steht nichts, was die Datenbank anfasst — die Actions (lib/actions/sanierungsprojekte.ts)
// prüfen mit diesen Funktionen, was hinein- und herauskommt.

import { KATALOG } from "@/lib/sanierung/katalog";
import type { MassnahmeId, MaterialId } from "@/lib/sanierung/rechner";
import { ZUSTAND_GEWERKE, vorauswahl } from "@/lib/sanierung/zustand";
import { ARBEITEN, type ArbeitId } from "@/lib/sanierung/arbeiten";
import {
  leererEntwurf,
  leereGewerke,
  massnahmenJeTypAus,
  type Entsorgung,
  type Entwurf,
  type GewerkFeld,
  type RaumTyp,
  type Wer,
  type WerGewerk,
  type ZustandGewerkId,
} from "@/lib/sanierung/eingabe";
import type { Nutzung } from "@/lib/sanierung/foerderung";

export type ProjektArt = "projekt" | "vorlage";

/** Größe von `daten` als JSON (Bytes). Die Datenbank lässt 256 KB zu; die App bremst früher. */
export const DATEN_GRENZE = 200_000;
export const NAME_MAX = 80;

/** Eine Zeile der Liste „Projekte & Vorlagen“ (ohne `daten`). */
export type ProjektZeile = { id: string; art: ProjektArt; name: string; aktualisiert: string };

export type Vorlage = {
  /** Kennung des Formats — ein gespeicherter Entwurf ist keine Vorlage und umgekehrt. */
  vorlage: 1;
  massnahmenJeTyp: Partial<Record<RaumTyp, MassnahmeId[]>>;
  /** Nur Gewerke mit angekreuzten Arbeiten (siehe Kopf). */
  gewerke: Partial<Record<ZustandGewerkId, GewerkFeld>>;
  wer: Record<WerGewerk, "" | Wer>;
  entsorgung: "" | Entsorgung;
  puffer: string;
  nutzung: "" | Nutzung;
  preise: Partial<Record<MaterialId, string>>;
};

export type MitgelieferteVorlage = { id: string; name: string; beschreibung: string; vorlage: Vorlage };

const ohneEntscheidung = (): Pick<Vorlage, "wer" | "entsorgung" | "puffer" | "nutzung" | "preise"> => ({
  wer: { maler: "", boden: "", fliesen: "" },
  entsorgung: "",
  // Kein Puffer vorgegeben: Für eine Faustregel fand sich keine Primärquelle (Plan, Abschnitt 8).
  puffer: "",
  nutzung: "",
  preise: {},
});

/** Ein Gewerk mit dem Zustand „schlecht“ und dessen Vorauswahl (ohne ETW-Gewerke). */
const schlecht = (gewerk: ZustandGewerkId): GewerkFeld => ({ zustand: "schlecht", arbeiten: vorauswahl(gewerk, "schlecht", false) });

const STREICHEN: MassnahmeId[] = ["wand_streichen", "decke_streichen"];

/**
 * Mitgelieferte Vorlagen (Plan, Abschnitt 7.3) — Vorschläge, keine Empfehlung: Die Maßnahmen jedes
 * Raums muss der Nutzer im Guide ansehen (Seite „Maßnahmen“ bleibt offen, bis er es getan hat).
 */
export const MITGELIEFERTE_VORLAGEN: MitgelieferteVorlage[] = [
  {
    id: "mieterwechsel",
    name: "Mieterwechsel",
    beschreibung: "Wände und Decken streichen, in Wohnräumen und Flur neuer Vinylboden. Technik fragt der Guide ab.",
    vorlage: {
      vorlage: 1,
      massnahmenJeTyp: {
        wohnen: [...STREICHEN, "vinyl"],
        schlafen: [...STREICHEN, "vinyl"],
        kind: [...STREICHEN, "vinyl"],
        flur: [...STREICHEN, "vinyl"],
        kueche: [...STREICHEN],
        bad: ["decke_streichen"],
        wc: ["decke_streichen"],
        abstell: [...STREICHEN],
      },
      gewerke: {},
      ...ohneEntscheidung(),
    },
  },
  {
    id: "bad-neu",
    name: "Bad neu",
    beschreibung: "Nur das Bad: komplett erneuern (Fliesen, Objekte, Leitungen) und die Decke streichen. Andere Räume bekommen keinen Vorschlag.",
    vorlage: {
      vorlage: 1,
      massnahmenJeTyp: { wohnen: [], schlafen: [], kind: [], flur: [], kueche: [], bad: ["decke_streichen"], wc: [], abstell: [] },
      gewerke: { bad: schlecht("bad") },
      ...ohneEntscheidung(),
    },
  },
  {
    id: "altbau-komplett",
    name: "Altbau-Wohnung komplett",
    beschreibung: "Wände spachteln und streichen, neuer Boden, Elektrik und Bad komplett, Innentüren neu. Heizung, Fenster und Küche fragt der Guide ab.",
    vorlage: {
      vorlage: 1,
      massnahmenJeTyp: {
        wohnen: ["spachteln", ...STREICHEN, "vinyl"],
        schlafen: ["spachteln", ...STREICHEN, "vinyl"],
        kind: ["spachteln", ...STREICHEN, "vinyl"],
        flur: ["spachteln", ...STREICHEN, "vinyl"],
        kueche: ["spachteln", ...STREICHEN, "vinyl"],
        bad: ["decke_streichen"],
        wc: [...STREICHEN],
        abstell: [...STREICHEN],
      },
      gewerke: { elektrik: schlecht("elektrik"), bad: schlecht("bad"), tueren: schlecht("tueren") },
      ...ohneEntscheidung(),
    },
  },
];

/**
 * Vorlage aus einem Projekt: je Raumtyp die Maßnahmen des ERSTEN Raums dieses Typs (die Räume
 * gleichen sich meist; eine Vereinigung aller Räume schlüge in jedem Raum alles vor). Räume ohne Typ
 * zählen nicht.
 */
export function vorlageAusEntwurf(e: Entwurf): Vorlage {
  const massnahmenJeTyp: Partial<Record<RaumTyp, MassnahmeId[]>> = {};
  for (const r of e.raeume) {
    if (r.typ === "" || massnahmenJeTyp[r.typ]) continue;
    massnahmenJeTyp[r.typ] = [...r.massnahmen];
  }
  const gewerke: Partial<Record<ZustandGewerkId, GewerkFeld>> = {};
  for (const g of ZUSTAND_GEWERKE) {
    const feld = e.gewerke[g.gewerk];
    if (feld.zustand !== "" && feld.arbeiten.length > 0) gewerke[g.gewerk] = { zustand: feld.zustand, arbeiten: [...feld.arbeiten] };
  }
  return {
    vorlage: 1,
    massnahmenJeTyp,
    gewerke,
    wer: { ...e.projekt.wer },
    entsorgung: e.projekt.entsorgung,
    puffer: e.projekt.puffer,
    nutzung: e.projekt.nutzung,
    preise: { ...e.preise },
  };
}

/** Neues Projekt aus einer Vorlage — leer bis auf die Entscheidungen der Vorlage. */
export function entwurfAusVorlage(v: Vorlage, id: string): Entwurf {
  const e = leererEntwurf(id);
  const gewerke = leereGewerke();
  for (const [g, feld] of Object.entries(v.gewerke) as [ZustandGewerkId, GewerkFeld][]) gewerke[g] = { zustand: feld.zustand, arbeiten: [...feld.arbeiten] };
  return {
    ...e,
    projekt: { ...e.projekt, wer: { ...v.wer }, entsorgung: v.entsorgung, puffer: v.puffer, nutzung: v.nutzung },
    gewerke,
    preise: { ...v.preise },
    vorschlagJeTyp: Object.fromEntries(Object.entries(v.massnahmenJeTyp).map(([t, m]) => [t, [...m]])),
  };
}

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.slice(0, max) : "");
const istArbeit = (v: unknown): v is ArbeitId => typeof v === "string" && Object.prototype.hasOwnProperty.call(ARBEITEN, v);
const istMaterial = (v: string): v is MaterialId => Object.prototype.hasOwnProperty.call(KATALOG, v);
const ENTSORGUNG = new Set<string>(["keine", "bauschutt", "mischabfall", "beide", "unbekannt"]);

/**
 * Gespeicherte Vorlage prüfen — wie `entwurfAus()`: `null`, wenn es keine Vorlage ist; sonst nur
 * bekannte Typen, Maßnahmen, Arbeiten und Materialien. Ein Gewerk ohne Zustand oder ohne Arbeiten
 * fällt weg (es wäre keine Entscheidung, siehe Kopf).
 */
export function vorlageAus(roh: unknown): Vorlage | null {
  const o = obj(roh);
  if (o.vorlage !== 1) return null;
  const gewerke: Partial<Record<ZustandGewerkId, GewerkFeld>> = {};
  const g = obj(o.gewerke);
  for (const zg of ZUSTAND_GEWERKE) {
    const x = obj(g[zg.gewerk]);
    const z = x.zustand;
    if (z !== "gut" && z !== "mittel" && z !== "schlecht" && z !== "unbekannt") continue;
    const arbeiten = (Array.isArray(x.arbeiten) ? x.arbeiten.slice(0, 50) : []).filter(
      (a): a is ArbeitId => istArbeit(a) && ARBEITEN[a].gewerk === zg.gewerk,
    );
    if (arbeiten.length > 0) gewerke[zg.gewerk] = { zustand: z, arbeiten: [...new Set(arbeiten)] };
  }
  const w = obj(o.wer);
  const wer = (v: unknown): "" | Wer => (v === "selbst" || v === "handwerker" ? v : "");
  const preise: Partial<Record<MaterialId, string>> = {};
  for (const [k, v] of Object.entries(obj(o.preise))) if (istMaterial(k) && typeof v === "string") preise[k] = v.slice(0, 20);
  return {
    vorlage: 1,
    massnahmenJeTyp: massnahmenJeTypAus(o.massnahmenJeTyp),
    gewerke,
    wer: { maler: wer(w.maler), boden: wer(w.boden), fliesen: wer(w.fliesen) },
    entsorgung: typeof o.entsorgung === "string" && ENTSORGUNG.has(o.entsorgung) ? (o.entsorgung as Entsorgung) : "",
    puffer: text(o.puffer, 6),
    nutzung: o.nutzung === "vermieten" || o.nutzung === "eigennutzen" ? o.nutzung : "",
    preise,
  };
}

/** Name prüfen: getrimmt, 1–80 Zeichen — sonst `null`. */
export function projektName(roh: unknown): string | null {
  if (typeof roh !== "string") return null;
  const name = roh.trim().replace(/\s+/g, " ");
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

/** Bytes des JSON — die Grenze gilt für das, was gespeichert wird, nicht für Zeichen. */
export const datenGroesse = (daten: unknown): number => new TextEncoder().encode(JSON.stringify(daten)).length;

/** Name, unter dem ein Projekt gespeichert wird: der Projektname aus dem Guide, sonst ein Ersatz. */
export function speicherName(e: Entwurf): string {
  return projektName(e.projekt.name) ?? "Sanierungsprojekt";
}
