// Selbstauskunft ↔ Bestand in MyImmo (Gesamtprüfung 07.10.2026, B21).
//
// Die Selbstauskunft für die Bank war reine Handeingabe. In der Demo stand darin „laufende
// Kreditraten 180 €, Verbindlichkeiten 6.400 €, Mieteinnahmen 0“ — im selben Konto liefen
// 4.490 € Raten, 937.000 € Restschuld und 5.930 € Kaltmiete. Ein Bankdokument, das dem eigenen
// Bestand widerspricht, ist schlimmer als keins.
//
// Regel: MyImmo SCHREIBT nichts still in die Selbstauskunft. Es rechnet den Bestand aus (dieselben
// Regeln wie Dashboard und /kredite) und zeigt Abweichungen; übernommen wird per Klick, gespeichert
// erst mit „Selbstauskunft speichern“. Kredite für Privates (Auto, Konsum) kennt MyImmo nicht —
// deshalb gilt der Bestand als UNTERGRENZE: weniger eingetragen = Abweichung, mehr = in Ordnung.

import { summeRaten, summeRestschuld, type KreditFelder } from "@/lib/kredit";
import { sollKaltmiete, type SollMieter, type SollObjekt } from "@/lib/sollMiete";
import type { SelbstauskunftDaten } from "@/lib/kauf/selbstauskunft";

export type Bestand = {
  /** Heutige Raten aller Darlehen in MyImmo (getilgte ohne Rate). */
  raten: number;
  /** Summe der Restschulden. */
  restschuld: number;
  /** Soll-Kaltmiete aller Objekte (laufende Verträge). */
  kaltmiete: number;
  darlehen: number;
};

export function bestandAusMyImmo(
  kredite: KreditFelder[],
  objekte: SollObjekt[],
  mieter: SollMieter[],
  heuteIso: string,
): Bestand {
  return {
    raten: Math.round(summeRaten(kredite)),
    restschuld: Math.round(summeRestschuld(kredite)),
    kaltmiete: Math.round(objekte.reduce((s, o) => s + sollKaltmiete(o, mieter, heuteIso).betrag, 0)),
    darlehen: kredite.length,
  };
}

export type BestandFeld = "ratenKredite" | "summeVerbindlichkeiten" | "mieteinnahmen";

export type Abweichung = { feld: BestandFeld; label: string; eingetragen: number; bestand: number };

const FELDER: { feld: BestandFeld; label: string; wert: (b: Bestand) => number }[] = [
  { feld: "ratenKredite", label: "Laufende Kreditraten (€/Mo)", wert: (b) => b.raten },
  { feld: "summeVerbindlichkeiten", label: "Summe offener Kredite (€)", wert: (b) => b.restschuld },
  { feld: "mieteinnahmen", label: "Bestehende Mieteinnahmen (€/Mo, kalt)", wert: (b) => b.kaltmiete },
];

/**
 * Felder, in denen weniger steht als der Bestand (Toleranz 1 €). Mieteinnahmen: auch MEHR ist eine
 * Abweichung — höhere Mieten als in MyImmo verbessern die Machbarkeit, das muss die Bank sehen können.
 */
export function selbstauskunftAbweichungen(
  sa: Pick<SelbstauskunftDaten, BestandFeld>,
  b: Bestand,
): Abweichung[] {
  const out: Abweichung[] = [];
  for (const f of FELDER) {
    const soll = f.wert(b);
    const ist = Number(sa[f.feld]) || 0;
    const zuWenig = soll - ist > 1;
    const zuViel = f.feld === "mieteinnahmen" && ist - soll > 1;
    if (zuWenig || zuViel) out.push({ feld: f.feld, label: f.label, eingetragen: ist, bestand: soll });
  }
  return out;
}

/** Selbstauskunft mit den Bestandswerten (für „übernehmen“ und die Demo). */
export function mitBestand<T extends Pick<SelbstauskunftDaten, BestandFeld>>(sa: T, b: Bestand): T {
  return { ...sa, ratenKredite: b.raten, summeVerbindlichkeiten: b.restschuld, mieteinnahmen: b.kaltmiete };
}
