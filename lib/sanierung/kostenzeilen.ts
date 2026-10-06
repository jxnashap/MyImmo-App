// Kostenzeilen des Sanierungs-Guides: Menge × Einheitspreis-Spanne, überschreibbar, mit Herkunft.
//
// Jede Zeile weiß, woher ihr Preis kommt (Abschnitt 2a in docs/zukunft/SANIERUNGS-GUIDE.md). Das
// Ergebnis nennt, wie viel der Summe allein auf Portalpreisen beruht — so sieht man, wie fest die
// Zahl steht. Überschreibt der Nutzer eine Zeile (z. B. mit einem Angebot), gilt sein Wert fest.

import { ARBEITEN, herkunft, preisSpanne, type ArbeitId, type QuellenArt } from "@/lib/sanierung/arbeiten";

export type ZeilenHerkunft = QuellenArt | "nutzer";

export type Kostenzeile = {
  arbeit: ArbeitId;
  label: string;
  menge: number;
  einheit: string;
  von: number;
  bis: number;
  herkunft: ZeilenHerkunft;
  /** „Angebot einholen“ — Fachbetrieb-Arbeit ohne eigenen Wert des Nutzers. */
  angebotEinholen: boolean;
};

const rund = (n: number) => Math.round(n * 100) / 100;

/**
 * Eine Kostenzeile. `ueberschrieben` (Euro für die ganze Zeile, z. B. aus einem Angebot) ersetzt
 * die Spanne; leer, negativ oder keine Zahl → Katalogspanne. Menge ≤ 0 → Zeile mit 0 €.
 */
export function kostenzeile(id: ArbeitId, menge: number, ueberschrieben?: number | null): Kostenzeile {
  const a = ARBEITEN[id];
  const m = Number.isFinite(menge) && menge > 0 ? menge : 0;
  const eigen = ueberschrieben != null && Number.isFinite(ueberschrieben) && ueberschrieben >= 0 ? ueberschrieben : null;
  if (eigen != null) {
    return { arbeit: id, label: a.label, menge: m, einheit: a.einheit, von: rund(eigen), bis: rund(eigen), herkunft: "nutzer", angebotEinholen: false };
  }
  const p = preisSpanne(a);
  return {
    arbeit: id, label: a.label, menge: m, einheit: a.einheit,
    von: rund(m * p.min), bis: rund(m * p.max),
    herkunft: herkunft(a), angebotEinholen: a.nurFachbetrieb,
  };
}

export type KostenSumme = {
  von: number;
  bis: number;
  /** Anteil der Summe (Mitte der Spannen), der allein auf Portalpreisen beruht — 0 bis 1. */
  portalAnteil: number;
};

export function summeKosten(zeilen: Kostenzeile[]): KostenSumme {
  let von = 0, bis = 0, mitte = 0, portal = 0;
  for (const z of zeilen) {
    von += z.von;
    bis += z.bis;
    const m = (z.von + z.bis) / 2;
    mitte += m;
    if (z.herkunft === "portal") portal += m;
  }
  return { von: rund(von), bis: rund(bis), portalAnteil: mitte > 0 ? Math.round((portal / mitte) * 1000) / 1000 : 0 };
}
