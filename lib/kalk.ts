// Gemeinsame Kalkulations-Helfer für Roter Faden / Cockpit / Bankgespräch.

export const fmt = (n: number, dec = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtE = (n: number) => "€ " + fmt(Math.round(Number.isFinite(n) ? n : 0));
export const pct = (n: number, dec = 2) => fmt(n, dec) + " %";

// Grenzsteuersatz 2024 (vereinfacht, immocation-Formel)
export function calcGrenzsteuer(zvE: number, splitting: boolean): number {
  const z = splitting ? zvE / 2 : zvE;
  if (z <= 11604) return 0;
  if (z <= 17005) return 0.14 + ((z - 11604) / 10000) * 0.1;
  if (z <= 66760) return 0.24 + ((z - 17005) / 49755) * 0.18;
  if (z <= 277825) return 0.42;
  return 0.45;
}

// Restschuld nach n Jahren bei konstanter Annuität.
export function berechneRestschuld(darlehen: number, zinsPa: number, rateMo: number, jahre: number): number {
  let rs = darlehen;
  for (let j = 0; j < jahre; j++) {
    const zinsen = rs * zinsPa;
    const tilgung = rateMo * 12 - zinsen;
    rs = Math.max(0, rs - tilgung);
    if (rs <= 0) break;
  }
  return rs;
}

// Jahr der Volltilgung.
export function berechneVolltilgungJahr(darlehen: number, zinsPa: number, rateMo: number, startJahr: number): number {
  if (darlehen <= 0 || rateMo <= 0) return 0;
  let rs = darlehen, j = 0;
  while (rs > 0 && j < 60) {
    const zinsen = rs * zinsPa;
    rs = Math.max(0, rs - (rateMo * 12 - zinsen));
    j++;
  }
  return startJahr + j;
}

export const BUNDESLAENDER = [
  { v: 0.035, l: "Bayern (3,5%)" },
  { v: 0.06, l: "Berlin (6,0%)" },
  { v: 0.055, l: "Hamburg (5,5%)" },
  { v: 0.05, l: "Baden-Württemberg (5,0%)" },
  { v: 0.065, l: "Brandenburg (6,5%)" },
  { v: 0.05, l: "Bremen (5,0%)" },
  { v: 0.06, l: "Hessen (6,0%)" },
  { v: 0.065, l: "NRW (6,5%)" },
  { v: 0.05, l: "Niedersachsen (5,0%)" },
  { v: 0.05, l: "Sachsen (3,5%)" },
  { v: 0.065, l: "Thüringen (6,5%)" },
];

export const num = (s: string) => parseFloat(s) || 0;

// Datentyp, den das Cockpit für das Bankgespräch in localStorage ablegt.
export type CpData = {
  kp: number; qm: number; flaeche: number; nk: number; gesamtInvest: number;
  d1Summe: number; d2Summe: number; eigenkapital: number; kaltmiete: number;
  brutto: number; faktor: number; cfOp: number; cfNetto: number; gesRate: number;
  adresse: string;
};
export const CP_STORAGE_KEY = "myimmo_cockpit";
