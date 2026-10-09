// Wert und Bruttorendite — EINE Regel für Dashboard, Objektliste, Objektseite und Sortierung
// (Gesamtprüfung P8, 09.10.2026, B24 + B26).
//
// WARUM: Dasselbe Objekt hatte drei Renditen (Leipzig Süd: Liste 3,65 % auf den Wert, Objektseite
// 4,31 % auf den Kaufpreis, Dashboard 3,9 % auf die Summe der Werte). Und der Portfolio-Wert auf dem
// Dashboard zählte Objekte ohne gepflegten Wert mit 0 €, die Objektliste und die Wertkurve mit dem
// Kaufpreis — die Kachel passte nicht zum Ende der Kurve darunter.
//
// Die Regeln:
//   Wert      = gepflegter Wert, sonst Kaufpreis (wie Liste und Objektseite schon immer).
//   Rendite   = Jahreskaltmiete / KAUFPREIS (Marktkonvention, Entscheidung B20 im Audit vom
//               01.10.2026 — passt zum Kaufpreisfaktor daneben); nur ohne Kaufpreis auf den Wert.
//               Die Basis steht an jeder Zahl.
//   Portfolio = Σ Jahreskaltmiete / Σ Basis über die vermieteten Objekte — „Selbst bewohnt“ zählt
//               nicht mit (bringt keine Miete, würde die Rendite des vermieteten Bestands nur
//               verdünnen; dieselbe Regel wie in der Anlage V, lib/steuer/selbstBewohnt.ts).
import { istSelbstBewohnt } from "@/lib/steuer/selbstBewohnt";

const positiv = (n: number | null | undefined): n is number => n != null && Number.isFinite(n) && n > 0;

export type WertObjekt = { wert?: number | null; kaufpreis?: number | null };

/** Aktueller Wert eines Objekts: gepflegter Wert, sonst Kaufpreis, sonst null. */
export function aktuellerWert(p: WertObjekt): number | null {
  if (positiv(p.wert)) return p.wert;
  if (positiv(p.kaufpreis)) return p.kaufpreis;
  return null;
}

export type RenditeBasis = "kaufpreis" | "wert";
export type Rendite = { prozent: number; basis: RenditeBasis };

/** Bruttomietrendite: Kaltmiete/Monat × 12 / Kaufpreis (ohne Kaufpreis: / Wert). */
export function bruttoRendite(p: WertObjekt, kaltmieteMonat: number | null | undefined): Rendite | null {
  if (!positiv(kaltmieteMonat)) return null;
  const basis: RenditeBasis | null = positiv(p.kaufpreis) ? "kaufpreis" : positiv(p.wert) ? "wert" : null;
  if (!basis) return null;
  const nenner = basis === "kaufpreis" ? (p.kaufpreis as number) : (p.wert as number);
  return { prozent: ((kaltmieteMonat * 12) / nenner) * 100, basis };
}

export type PortfolioRendite = { prozent: number; basis: RenditeBasis | "gemischt" };

/** Rendite des Bestands: Σ Jahreskaltmiete / Σ Basis der vermietbaren Objekte. */
export function bruttoRenditePortfolio(
  objekte: (WertObjekt & { obj_status?: string | null; kaltmieteMonat: number })[],
): PortfolioRendite | null {
  let miete = 0;
  let nenner = 0;
  const basen = new Set<RenditeBasis>();
  for (const o of objekte) {
    if (istSelbstBewohnt(o.obj_status)) continue;
    const basis: RenditeBasis | null = positiv(o.kaufpreis) ? "kaufpreis" : positiv(o.wert) ? "wert" : null;
    if (!basis) continue; // ohne Kaufpreis und Wert lässt sich die Miete auf nichts beziehen
    basen.add(basis);
    nenner += basis === "kaufpreis" ? (o.kaufpreis as number) : (o.wert as number);
    miete += positiv(o.kaltmieteMonat) ? o.kaltmieteMonat : 0;
  }
  if (nenner <= 0 || miete <= 0) return null;
  return { prozent: ((miete * 12) / nenner) * 100, basis: basen.size > 1 ? "gemischt" : [...basen][0] };
}

/** Kurzer Zusatz zur Zahl: worauf sich die Rendite bezieht. */
export function renditeBasisText(basis: RenditeBasis | "gemischt"): string {
  if (basis === "kaufpreis") return "auf Kaufpreis";
  if (basis === "wert") return "auf Wert";
  return "auf Kaufpreis (teils Wert)";
}
