// Gemeinsame Kalkulations-Helfer für Roter Faden / Cockpit / Bankgespräch.

export const fmt = (n: number, dec = 0) =>
  (Number.isFinite(n) ? n : 0).toLocaleString("de-DE", { minimumFractionDigits: dec, maximumFractionDigits: dec });
export const fmtE = (n: number) => "€\u00A0" + fmt(Math.round(Number.isFinite(n) ? n : 0));
export const pct = (n: number, dec = 2) => fmt(n, dec) + " %";

// Grenzsteuersatz nach § 32a EStG — Tarif 2026 (marginaler Satz, exakt aus den Tarifformeln).
// Quelle: BMF Lohn-/Einkommensteuer-Handbuch 2026, § 32a EStG.
export function calcGrenzsteuer(zvE: number, splitting: boolean): number {
  const z = splitting ? zvE / 2 : zvE;          // Ehegattensplitting: Grenzsatz beim halben zvE
  if (z <= 12348) return 0;                      // Grundfreibetrag 2026
  if (z <= 17799) {                              // Progressionszone 1  (14 % … 23,97 %)
    const y = (z - 12348) / 10000;
    return (2 * 914.51 * y + 1400) / 10000;
  }
  if (z <= 69878) {                              // Progressionszone 2  (23,97 % … 42 %)
    const w = (z - 17799) / 10000;
    return (2 * 173.10 * w + 2397) / 10000;
  }
  if (z <= 277825) return 0.42;                  // Spitzensteuersatz
  return 0.45;                                   // Reichensteuersatz
}

// Restschuld nach n Jahren bei konstanter Annuität.
//
// Rechnet MONATLICH, so wie ein Annuitätendarlehen tatsächlich läuft: Jede Rate
// mindert sofort die Restschuld, die nächste Zinsberechnung setzt auf dem
// niedrigeren Stand auf. Vorher wurde ein volles Jahr Zinsen auf den
// Jahresanfangsstand gerechnet, obwohl unterjährig 12 Raten fließen — die
// Restschuld fiel dadurch systematisch zu hoch aus (bei 250.000 € / 4 % / 2 %
// nach 20 Jahren rund 3.900 € bzw. ~4 %).
const MONATE_MAX = 60 * 12; // Sicherheitsgrenze gegen Endlosschleifen

export function berechneRestschuld(darlehen: number, zinsPa: number, rateMo: number, jahre: number): number {
  if (darlehen <= 0) return 0;
  const zinsMo = zinsPa / 12;
  let rs = darlehen;
  for (let m = 0; m < jahre * 12; m++) {
    const zinsen = rs * zinsMo;
    const tilgung = rateMo - zinsen;
    // Rate deckt nicht einmal die Zinsen → das Darlehen tilgt sich nie.
    if (tilgung <= 0) return rs;
    rs -= tilgung;
    if (rs <= 0) return 0;
  }
  return rs;
}

// Jahr der Volltilgung — 0, wenn das Darlehen in 60 Jahren nicht getilgt ist
// (so dokumentiert in lib/kauf/darlehen.ts und von der Oberfläche als
// „> 60 J." erwartet; vorher gab die Funktion stattdessen startJahr + 60
// zurück, wodurch dieser Zweig nie griff).
export function berechneVolltilgungJahr(darlehen: number, zinsPa: number, rateMo: number, startJahr: number): number {
  if (darlehen <= 0 || rateMo <= 0) return 0;
  const zinsMo = zinsPa / 12;
  let rs = darlehen;
  for (let m = 1; m <= MONATE_MAX; m++) {
    const zinsen = rs * zinsMo;
    const tilgung = rateMo - zinsen;
    if (tilgung <= 0) return 0; // Rate deckt die Zinsen nicht
    rs -= tilgung;
    if (rs <= 0) return startJahr + Math.ceil(m / 12);
  }
  return 0;
}

// Grunderwerbsteuer je Bundesland, Stand 2026 (offizielle Landesquellen / finanz-tools.de).
export const BUNDESLAENDER = [
  { v: 0.05,  l: "Baden-Württemberg (5,0 %)" },
  { v: 0.035, l: "Bayern (3,5 %)" },
  { v: 0.06,  l: "Berlin (6,0 %)" },
  { v: 0.065, l: "Brandenburg (6,5 %)" },
  { v: 0.055, l: "Bremen (5,5 %)" },
  { v: 0.055, l: "Hamburg (5,5 %)" },
  { v: 0.06,  l: "Hessen (6,0 %)" },
  { v: 0.06,  l: "Mecklenburg-Vorpommern (6,0 %)" },
  { v: 0.05,  l: "Niedersachsen (5,0 %)" },
  { v: 0.065, l: "Nordrhein-Westfalen (6,5 %)" },
  { v: 0.05,  l: "Rheinland-Pfalz (5,0 %)" },
  { v: 0.065, l: "Saarland (6,5 %)" },
  { v: 0.055, l: "Sachsen (5,5 %)" },
  { v: 0.05,  l: "Sachsen-Anhalt (5,0 %)" },
  { v: 0.065, l: "Schleswig-Holstein (6,5 %)" },
  { v: 0.05,  l: "Thüringen (5,0 %)" },
];

export const num = (s: string) => parseFloat(s) || 0;

// Kaufnebenkosten — EINE Regel für den Kauf-Rechner und den BuyImmo-Fahrplan (05.10.2026).
// Notar + Grundbuch als Pauschale, Makler-Käuferanteil als Vorschlag; beide altern →
// docs/app-entwicklung/07 Volatile Kennzahlen und Pruefzyklus.md.
/** Notar und Grundbuch zusammen, Anteil am Kaufpreis (Pauschale, keine Gebührenrechnung). */
export const NOTAR_GRUNDBUCH_SATZ = 0.02;
/** Käuferanteil der Maklerprovision bei hälftiger Teilung, in Prozent (Vorschlag im Rechner). */
export const MAKLER_STANDARD_PROZENT = 3.57;

/** Nebenkosten-Satz: Grunderwerbsteuer (Anteil, z. B. 0.05) + Makler (Prozent) + Notar/Grundbuch. */
export function kaufnebenkostenSatz(grestSatz: number, maklerProzent: number): number {
  return grestSatz + maklerProzent / 100 + NOTAR_GRUNDBUCH_SATZ;
}

export type Kaufnebenkosten = { grunderwerbsteuer: number; notarGrundbuch: number; makler: number; summe: number; satz: number };

/** Kaufnebenkosten in Euro, aufgeteilt. Negative oder fehlende Eingaben zählen als 0. */
export function kaufnebenkosten(kaufpreis: number, grestSatz: number, maklerProzent: number): Kaufnebenkosten {
  const kp = Number.isFinite(kaufpreis) && kaufpreis > 0 ? kaufpreis : 0;
  const g = Number.isFinite(grestSatz) && grestSatz > 0 ? grestSatz : 0;
  const m = Number.isFinite(maklerProzent) && maklerProzent > 0 ? maklerProzent : 0;
  const grunderwerbsteuer = kp * g;
  const notarGrundbuch = kp * NOTAR_GRUNDBUCH_SATZ;
  const makler = kp * (m / 100);
  return {
    grunderwerbsteuer,
    notarGrundbuch,
    makler,
    summe: grunderwerbsteuer + notarGrundbuch + makler,
    satz: kaufnebenkostenSatz(g, m),
  };
}
