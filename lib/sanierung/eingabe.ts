// Eingabe des Sanierungsrechners: was im Formular steht (Text, wie getippt) → was gerechnet wird.
//
// Die Felder bleiben Text, damit „3,45“ beim Tippen nicht zu „3“ zusammenschnurrt; gelesen wird
// mit `zahlDe0()` wie in den anderen Rechnern (Komma oder Punkt, deutscher Tausenderpunkt).
// Der Entwurf liegt nur im Browser (localStorage) — `entwurfAus()` prüft ihn beim Laden, weil
// dort alles stehen kann: ein alter Stand, ein halber, oder Fremdes.

import { zahlDe, zahlDe0 } from "@/lib/zahl";
import { MASSNAHMEN, type MassnahmeId, type MaterialId, type SanierungEingabe } from "@/lib/sanierung/rechner";
import { istFoerderArt, type FoerderArt, type FoerderEingabe, type Gebaeude, type Nutzung } from "@/lib/sanierung/foerderung";

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
};
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
};

/** BuyImmo richtet sich an Leute, die vermieten — und an eine Eigentumswohnung (1 Einheit). */
export const STANDARD_FOERDER: FoerderFelder = { wohneinheiten: "1", isfp: false, nutzung: "vermieten", gebaeude: "mfh" };
export const neuerPosten = (id: string): PostenFeld => ({ id, bezeichnung: "", betrag: "", foerderung: "keine" });

/** Übliche Raumhöhe im Bestand als Vorschlag — der Nutzer überschreibt sie mit dem Maßband. */
export const STANDARD_HOEHE = "2,50";

export function neuerRaum(id: string, nummer: number): RaumFeld {
  return { id, name: `Raum ${nummer}`, laenge: "", breite: "", hoehe: STANDARD_HOEHE, oeffnungen: "", fliesenhoehe: "", massnahmen: [] };
}

/**
 * Raum kopieren (Besichtigung: Zimmer gleichen sich oft) — alle Maße und Maßnahmen, neuer Name,
 * neue Kennung; die Kopie steht direkt hinter dem Original.
 */
export function mitKopie(raeume: RaumFeld[], id: string, neueId: string): RaumFeld[] {
  const i = raeume.findIndex((r) => r.id === id);
  if (i < 0) return raeume;
  const original = raeume[i];
  const kopie: RaumFeld = { ...original, id: neueId, name: `${original.name || "Raum"} (Kopie)`, massnahmen: [...original.massnahmen] };
  return [...raeume.slice(0, i + 1), kopie, ...raeume.slice(i + 1)];
}

/** Start: ein Raum und eine leere Zeile Arbeitszeit — der Lohnrechner soll sofort zu sehen sein. */
export function leererEntwurf(id: string): Entwurf {
  return {
    raeume: [neuerRaum(id, 1)],
    lohn: [{ id: `${id}-lohn`, bezeichnung: "Eigene Arbeit", stunden: "", satz: "", eigenleistung: true }],
    eigene: [],
    preise: {},
    foerder: { ...STANDARD_FOERDER },
  };
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

/** Formular → Zuschuss-Schätzung. Nur Posten mit einer Förderart zählen dort. */
export function zuFoerderEingabe(e: Entwurf, stichtag: string): FoerderEingabe {
  const we = Math.floor(zahlDe0(e.foerder.wohneinheiten));
  return {
    posten: e.eigene.map((p) => ({ id: p.id, bezeichnung: p.bezeichnung, betrag: zahlDe0(p.betrag), art: p.foerderung })),
    wohneinheiten: we >= 1 ? we : 1,
    isfp: e.foerder.isfp,
    nutzung: e.foerder.nutzung,
    gebaeude: e.foerder.gebaeude,
    stichtag,
  };
}

/** Formular → Rechnung. Leere oder unsinnige Felder zählen als 0. */
export function zuEingabe(e: Entwurf): SanierungEingabe {
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
    return {
      id: id(r.id, `r${i}`),
      name: text(r.name, 60),
      laenge: text(r.laenge, 20),
      breite: text(r.breite, 20),
      hoehe: text(r.hoehe, 20),
      oeffnungen: text(r.oeffnungen, 20),
      // Ältere Entwürfe kennen das Feld nicht → leer = bis zur Decke.
      fliesenhoehe: text(r.fliesenhoehe, 20),
      massnahmen: liste(r.massnahmen).filter((m): m is MassnahmeId => typeof m === "string" && MASSNAHME_IDS.has(m)),
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
    if (typeof v === "string") preise[k as MaterialId] = v.slice(0, 20);
  }
  const f = obj(o.foerder);
  const foerder: FoerderFelder = {
    wohneinheiten: typeof f.wohneinheiten === "string" ? f.wohneinheiten.slice(0, 4) : STANDARD_FOERDER.wohneinheiten,
    isfp: f.isfp === true,
    nutzung: f.nutzung === "eigennutzen" ? "eigennutzen" : "vermieten",
    gebaeude: f.gebaeude === "haus" ? "haus" : "mfh",
  };
  return { raeume, lohn, eigene, preise, foerder };
}
