// Gemeinsames Rechenmodul für Kauf-Radar (/kauf) und Szenario-Rechner
// (/kredite) — Formeln exakt aus dem Design-Handoff ("Kern-Logik"):
//   Gesamtkosten = Kaufpreis × 1,105 (10,5 % Nebenkosten)
//   Rate         = Darlehen × (Zins + Tilgung) / 1200
//   Cashflow     = Kaltmiete − Rate − 90 € Bewirtschaftung
//   Restschuld   = D·qⁿ − Rate·(qⁿ−1)/(q−1)  mit q = 1 + Zins/1200
//   Stresstest   = Anschlusszins +1,5 pp auf die Restschuld, Miete × 11/12
// Rechenweg offen — keine Prognose-Magie, keine versteckten Annahmen.

export const NEBENKOSTEN_SATZ = 0.105;
export const BEWIRTSCHAFTUNG = 90; // €/Monat, Pauschale
export const STRESS_AUFSCHLAG = 1.5; // Prozentpunkte Anschlusszins
export const ZINSBINDUNG_MONATE = 120; // 10 Jahre

export type SzenarioEingabe = {
  kaufpreis: number;
  ekQuote: number; // % der Gesamtkosten
  zins: number; // % p. a.
  tilgung: number; // % p. a.
  miete: number; // Kaltmiete €/Monat
};

export function annuitaetMonat(darlehen: number, zins: number, tilgung: number): number {
  return (darlehen * (zins + tilgung)) / 1200;
}

export function restschuldNach(darlehen: number, zins: number, rate: number, monate = ZINSBINDUNG_MONATE): number {
  const q = 1 + zins / 1200;
  const qn = Math.pow(q, monate);
  return Math.max(0, darlehen * qn - (rate * (qn - 1)) / (q - 1));
}

export type SzenarioErgebnis = {
  gesamt: number;
  nebenkosten: number;
  eigenkapital: number;
  darlehen: number;
  rate: number;
  cashflow: number;
  rendite: number; // Brutto, % p. a.
  rest10: number;
  getilgt10: number;
  stress: { zins: number; rate: number; cashflow: number };
};

export function szenario(e: SzenarioEingabe): SzenarioErgebnis {
  const gesamt = e.kaufpreis * (1 + NEBENKOSTEN_SATZ);
  const nebenkosten = e.kaufpreis * NEBENKOSTEN_SATZ;
  const eigenkapital = (gesamt * e.ekQuote) / 100;
  const darlehen = gesamt - eigenkapital;
  const rate = annuitaetMonat(darlehen, e.zins, e.tilgung);
  const cashflow = e.miete - rate - BEWIRTSCHAFTUNG;
  const rendite = e.kaufpreis > 0 ? ((e.miete * 12) / e.kaufpreis) * 100 : 0;
  const rest10 = restschuldNach(darlehen, e.zins, rate);
  const getilgt10 = darlehen - rest10;
  const stressZins = e.zins + STRESS_AUFSCHLAG;
  const stressRate = annuitaetMonat(rest10, stressZins, e.tilgung);
  const stressCf = (e.miete * 11) / 12 - stressRate - BEWIRTSCHAFTUNG;
  return {
    gesamt, nebenkosten, eigenkapital, darlehen, rate, cashflow, rendite, rest10, getilgt10,
    stress: { zins: stressZins, rate: stressRate, cashflow: stressCf },
  };
}

/** CF ≥ 100 → „Trägt sich" (grün) · ≥ 0 → „Knapp" (amber) · sonst „Trägt nicht" (rot) */
export function urteilCf(cf: number): { label: string; badge: "green" | "amber" | "red" } {
  if (cf >= 100) return { label: "Trägt sich", badge: "green" };
  if (cf >= 0) return { label: "Knapp", badge: "amber" };
  return { label: "Trägt nicht", badge: "red" };
}

// ---- Deal-Score (Kauf-Radar) -----------------------------------------------
// 4 Teilwerte à 0–25, Summe 0–100. Rendite und Cashflow werden offen aus den
// Zahlen skaliert, Lage und Zustand schätzt der Nutzer selbst ein (0–25):
//   Rendite:  0 % → 0 P · 8 % und mehr → 25 P (linear)
//   Cashflow: −300 € → 0 P · +300 € und mehr → 25 P (linear, im Nutzer-Szenario)

const clamp25 = (v: number) => Math.max(0, Math.min(25, Math.round(v)));

export function renditeTeilwert(renditeProzent: number): number {
  return clamp25((renditeProzent / 8) * 25);
}

export function cashflowTeilwert(cf: number): number {
  return clamp25(((cf + 300) / 600) * 25);
}

export type DealScore = { teilwerte: [number, number, number, number]; score: number };

export function dealScore(renditeProzent: number, cf: number, lage: number, zustand: number): DealScore {
  const tw: [number, number, number, number] = [
    renditeTeilwert(renditeProzent),
    cashflowTeilwert(cf),
    clamp25(lage),
    clamp25(zustand),
  ];
  return { teilwerte: tw, score: tw[0] + tw[1] + tw[2] + tw[3] };
}

/** ≥ 80 „Prüfen lohnt sich" (gold) · ≥ 72 „Solide" (teal) · sonst „Genau hinsehen" (amber) */
export function scoreUrteil(score: number): { label: string; badge: "gold" | "teal" | "amber" } {
  if (score >= 80) return { label: "Prüfen lohnt sich", badge: "gold" };
  if (score >= 72) return { label: "Solide", badge: "teal" };
  return { label: "Genau hinsehen", badge: "amber" };
}
