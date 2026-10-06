// BuyImmo-Kommandozentrale (05.10.2026): Was hat der Vermieter für das nächste Objekt in der Hand?
//
// KEINE neuen Regeln — jede Zahl kommt aus einer Rechnung, die es in MyImmo schon gibt, damit
// dieselbe Größe nicht an zwei Stellen verschieden dasteht:
//   • Portfolio-Wert   = Σ gepflegter Objektwert — wie die Kachel auf dem Dashboard
//                        (`totalWert` in app/(app)/page.tsx), ohne Schätzung für fehlende Werte.
//   • Restschuld       = `schuldenStand().offen` — wie die Schulden-Uhr auf /kredite.
//   • Freie Grundschuld = Σ `beleihungsauslauf().freieGrundschuld` — wie die Tabelle auf /kredite.
//   • Eigenkapital im Bestand = Portfolio-Wert − Restschuld. Damit lässt sich die Leiste
//     nachrechnen (Review 30.09.2026: Kacheln, die man nicht nachrechnen kann, verlieren Vertrauen).
//
// GRENZE, die an der Zahl stehen muss: Der Wert ist eine Schätzung, keine Bankbewertung, und
// fehlt er bei einem Objekt, zählen dessen Schulden trotzdem mit — das Eigenkapital ist dann zu
// NIEDRIG. `ohneWert` sagt, wie oft das zutrifft. Reine Funktionen, keine Empfehlung.

import { beleihungsauslauf } from "@/lib/beleihungsauslauf";
import { schuldenStand } from "@/lib/schuldenStand";

export type AufbauObjekt = { id: string; bezeichnung: string; wert: number | null; kaufpreis: number | null };
export type AufbauKredit = {
  prop_id: string | null;
  betrag: number | null;
  restschuld: number | null;
  monatsrate: number | null;
  zinssatz: number | null;
  grundschuld: number | null;
};

export type BestandLage = {
  objekte: number;
  /** Objekte ohne gepflegten Wert — ihr Wert fehlt im Portfolio-Wert, ihre Schulden nicht. */
  ohneWert: number;
  wert: number;
  restschuld: number;
  /**
   * Restschuld in % vom Portfolio-Wert (eine Nachkommastelle). null ohne Wert UND wenn ein Objekt
   * keinen Wert hat — dessen Schulden zählen, sein Wert nicht; der Prozentsatz wäre zu hoch.
   */
  restschuldProzent: number | null;
  eigenkapital: number;
  /** Σ Grundschuld über der Restschuld je Objekt; null, wenn nirgends eine eingetragen ist. */
  freieGrundschuld: number | null;
};

const zahl = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : 0);

export function bestandLage(objekte: AufbauObjekt[], kredite: AufbauKredit[]): BestandLage {
  const wert = objekte.reduce((s, p) => s + zahl(p.wert), 0);
  const ohneWert = objekte.filter((p) => !(zahl(p.wert) > 0)).length;
  const restschuld = schuldenStand(kredite).offen;

  // Für die freie Grundschuld zählt nur Grundschuld − Restschuld je Objekt; der Wert spielt
  // dafür keine Rolle, deshalb ohne Häuserpreisindex (spart den Abruf).
  const frei = beleihungsauslauf(objekte, kredite)
    .map((z) => z.freieGrundschuld)
    .filter((v): v is number => v != null);

  return {
    objekte: objekte.length,
    ohneWert,
    wert,
    restschuld,
    restschuldProzent: wert > 0 && ohneWert === 0 ? Math.round((restschuld / wert) * 1000) / 10 : null,
    eigenkapital: wert - restschuld,
    freieGrundschuld: frei.length ? frei.reduce((s, v) => s + v, 0) : null,
  };
}
