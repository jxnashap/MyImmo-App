// Eingabe des Sanierungsrechners: was im Formular steht (Text, wie getippt) → was gerechnet wird.
//
// Die Felder bleiben Text, damit „3,45“ beim Tippen nicht zu „3“ zusammenschnurrt; gelesen wird
// mit `zahlDe0()` wie in den anderen Rechnern (Komma oder Punkt, deutscher Tausenderpunkt).
// Der Entwurf liegt nur im Browser (localStorage) — `entwurfAus()` prüft ihn beim Laden, weil
// dort alles stehen kann: ein alter Stand, ein halber, oder Fremdes.

import { zahlDe0 } from "@/lib/zahl";
import { MASSNAHMEN, type MassnahmeId, type MaterialId, type SanierungEingabe } from "@/lib/sanierung/rechner";

export type RaumFeld = {
  id: string;
  name: string;
  laenge: string;
  breite: string;
  hoehe: string;
  oeffnungen: string;
  massnahmen: MassnahmeId[];
};
export type LohnFeld = { id: string; bezeichnung: string; stunden: string; satz: string };
export type PostenFeld = { id: string; bezeichnung: string; betrag: string };

export type Entwurf = {
  raeume: RaumFeld[];
  lohn: LohnFeld[];
  eigene: PostenFeld[];
  /** Eigene Preise je Gebinde; leer = Katalogpreis. */
  preise: Partial<Record<MaterialId, string>>;
};

/** Übliche Raumhöhe im Bestand als Vorschlag — der Nutzer überschreibt sie mit dem Maßband. */
export const STANDARD_HOEHE = "2,50";

export function neuerRaum(id: string, nummer: number): RaumFeld {
  return { id, name: `Raum ${nummer}`, laenge: "", breite: "", hoehe: STANDARD_HOEHE, oeffnungen: "", massnahmen: [] };
}

/** Start: ein Raum und eine leere Zeile Arbeitszeit — der Lohnrechner soll sofort zu sehen sein. */
export function leererEntwurf(id: string): Entwurf {
  return {
    raeume: [neuerRaum(id, 1)],
    lohn: [{ id: `${id}-lohn`, bezeichnung: "Eigene Arbeit", stunden: "", satz: "" }],
    eigene: [],
    preise: {},
  };
}

/** Formular → Rechnung. Leere oder unsinnige Felder zählen als 0. */
export function zuEingabe(e: Entwurf): SanierungEingabe {
  const preise: Partial<Record<MaterialId, number>> = {};
  for (const [id, wert] of Object.entries(e.preise) as [MaterialId, string | undefined][]) {
    // Leeres Feld = Katalogpreis. „0“ ist ein echter Preis (Material ist schon da).
    if (wert != null && wert.trim() !== "") preise[id] = zahlDe0(wert);
  }
  return {
    raeume: e.raeume.map((r) => ({
      id: r.id,
      name: r.name,
      laenge: zahlDe0(r.laenge),
      breite: zahlDe0(r.breite),
      hoehe: zahlDe0(r.hoehe),
      oeffnungen: zahlDe0(r.oeffnungen),
      massnahmen: r.massnahmen,
    })),
    preise,
    lohn: e.lohn.map((l) => ({ bezeichnung: l.bezeichnung, stunden: zahlDe0(l.stunden), satz: zahlDe0(l.satz) })),
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
      massnahmen: liste(r.massnahmen).filter((m): m is MassnahmeId => typeof m === "string" && MASSNAHME_IDS.has(m)),
    };
  });
  const lohn = liste(o.lohn).map((x, i): LohnFeld => {
    const l = obj(x);
    return { id: id(l.id, `l${i}`), bezeichnung: text(l.bezeichnung, 80), stunden: text(l.stunden, 20), satz: text(l.satz, 20) };
  });
  const eigene = liste(o.eigene).map((x, i): PostenFeld => {
    const p = obj(x);
    return { id: id(p.id, `p${i}`), bezeichnung: text(p.bezeichnung, 80), betrag: text(p.betrag, 20) };
  });
  const preise: Partial<Record<MaterialId, string>> = {};
  for (const [k, v] of Object.entries(obj(o.preise))) {
    if (typeof v === "string") preise[k as MaterialId] = v.slice(0, 20);
  }
  return { raeume, lohn, eigene, preise };
}
