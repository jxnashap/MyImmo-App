// Beleihungsauslauf je Objekt (02.10.2026, Ausbau-Paket Punkt 5).
//
// Restschuld aller Darlehen eines Objekts ÷ Objektwert, dazu die eingetragenen Grundschulden und
// was davon über der Restschuld liegt („freie Grundschuld“ — die Spanne, die eine Bank bei einer
// Nachfinanzierung ohne neue Eintragung nutzen KÖNNTE). Bisher wurden `grundschuld` und
// `restschuld` nur angezeigt, nie ins Verhältnis gesetzt.
//
// WICHTIG: Der Objektwert ist eine SCHÄTZUNG (gepflegter Wert, sonst Kaufpreis mit Häuserpreisindex
// fortgeschrieben, sonst Kaufpreis). Banken rechnen mit dem Beleihungswert, der meist deutlich
// darunter liegt. Die Ampel ist deshalb ein Richtwert, keine Bankbewertung. Reine Funktion.

import { restschuldVon } from "@/lib/kredit";

export type AuslaufStufe = "niedrig" | "mittel" | "hoch" | "unbekannt";

export type AuslaufZeile = {
  propId: string;
  name: string;
  wert: number | null;
  wertQuelle: "gepflegt" | "index" | "kaufpreis" | null;
  restschuld: number;
  grundschuld: number;
  /** Restschuld ÷ Wert in % (eine Nachkommastelle), null ohne Wert. */
  auslaufProzent: number | null;
  /** Grundschuld über der Restschuld (nie negativ); null, wenn keine Grundschuld eingetragen ist. */
  freieGrundschuld: number | null;
  stufe: AuslaufStufe;
  kredite: number;
};

/**
 * Restschuld ÷ Wert in % mit einer Nachkommastelle; null ohne Wert. EINE Formel für /kredite,
 * Kennblatt-PDF und Bank-Link (Audit 07.10.2026, Zusammenführung 7).
 */
export const auslaufVon = (restschuld: number, wert: number | null | undefined): number | null =>
  wert && wert > 0 ? Math.round((restschuld / wert) * 1000) / 10 : null;

/** Schwellen in % vom Marktwert — grob: bis 60 % gilt bei vielen Banken als erstrangig. */
export const AUSLAUF_NIEDRIG = 60;
export const AUSLAUF_HOCH = 80;

export function beleihungsauslauf(
  objekte: { id: string; bezeichnung: string; wert: number | null; kaufpreis: number | null; indexwert?: number | null }[],
  kredite: { prop_id: string | null; restschuld: number | null; betrag?: number | null; grundschuld: number | null }[],
): AuslaufZeile[] {
  const zeilen: AuslaufZeile[] = [];
  for (const p of objekte) {
    const eigene = kredite.filter((k) => k.prop_id === p.id);
    if (eigene.length === 0) continue; // ohne Darlehen gibt es nichts auszulaufen
    const restschuld = eigene.reduce((s, k) => s + restschuldVon(k), 0);
    const mitGrundschuld = eigene.filter((k) => (Number(k.grundschuld) || 0) > 0);
    const grundschuld = mitGrundschuld.reduce((s, k) => s + Number(k.grundschuld), 0);

    const [wert, wertQuelle]: [number | null, AuslaufZeile["wertQuelle"]] =
      p.wert && p.wert > 0 ? [p.wert, "gepflegt"]
      : p.indexwert && p.indexwert > 0 ? [p.indexwert, "index"]
      : p.kaufpreis && p.kaufpreis > 0 ? [p.kaufpreis, "kaufpreis"]
      : [null, null];

    const auslaufProzent = auslaufVon(restschuld, wert);
    const stufe: AuslaufStufe = auslaufProzent == null ? "unbekannt"
      : auslaufProzent <= AUSLAUF_NIEDRIG ? "niedrig"
      : auslaufProzent <= AUSLAUF_HOCH ? "mittel" : "hoch";

    zeilen.push({
      propId: p.id, name: p.bezeichnung, wert, wertQuelle, restschuld, grundschuld,
      auslaufProzent,
      freieGrundschuld: mitGrundschuld.length ? Math.max(0, grundschuld - restschuld) : null,
      stufe, kredite: eigene.length,
    });
  }
  return zeilen;
}
