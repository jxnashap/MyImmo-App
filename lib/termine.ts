// Gemeinsame Termin-Konstanten & Helfer (Kategorien, Wiederkehrung, Vorlagen).

export const TERMIN_KATEGORIEN = [
  "Miete", "Finanzierung", "Steuer", "Wartung", "WEG", "Versicherung", "Sonstiges",
] as const;
export type TerminKategorie = (typeof TERMIN_KATEGORIEN)[number];

// Wiederkehrungs-Intervalle (inkl. 2/3 Jahre für gesetzliche Prüfzyklen).
export const WIEDERKEHRUNGEN = [
  "monatlich", "quartalsweise", "halbjaehrlich", "jaehrlich", "alle_2_jahre", "alle_3_jahre",
] as const;

export const WIEDERKEHRUNG_LABEL: Record<string, string> = {
  monatlich: "monatlich",
  quartalsweise: "quartalsweise",
  halbjaehrlich: "halbjährlich",
  jaehrlich: "jährlich",
  alle_2_jahre: "alle 2 Jahre",
  alle_3_jahre: "alle 3 Jahre",
};

const WIEDERKEHRUNG_MONATE: Record<string, number> = {
  monatlich: 1,
  quartalsweise: 3,
  halbjaehrlich: 6,
  jaehrlich: 12,
  alle_2_jahre: 24,
  alle_3_jahre: 36,
};

// Nächste Fälligkeit — ohne Tag-Rollover (31.01. +1 Mon. → 28./29.02.).
export function naechsteFaelligkeit(datum: string, wiederkehrung: string): string | null {
  const monate = WIEDERKEHRUNG_MONATE[wiederkehrung] ?? 0;
  if (!monate) return null;
  const d = new Date(datum);
  if (Number.isNaN(d.getTime())) return null;
  const tag = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + monate);
  const letzterTag = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(tag, letzterTag));
  return d.toISOString().split("T")[0];
}

// Kategorie-Chips: Farbe (Badge-Klasse bzw. Punkt-Farbe) + Icon.
export const KATEGORIE_STIL: Record<string, { badge: string; punkt: string; icon: string }> = {
  Miete: { badge: "badge-teal", punkt: "var(--teal)", icon: "🏠" },
  Betriebskosten: { badge: "badge-teal", punkt: "var(--teal)", icon: "🧾" },
  Finanzierung: { badge: "badge-gold", punkt: "var(--gold)", icon: "🏦" },
  Steuer: { badge: "badge-blue", punkt: "var(--blue)", icon: "📋" },
  Wartung: { badge: "badge-amber", punkt: "var(--amber)", icon: "🔧" },
  WEG: { badge: "badge-green", punkt: "var(--green)", icon: "🏢" },
  Versicherung: { badge: "badge-muted", punkt: "var(--muted)", icon: "🛡️" },
  Sonstiges: { badge: "badge-neutral", punkt: "var(--faint)", icon: "📌" },
};

// Wartungs-Vorlagen: Ein Klick → Termin mit Kategorie + Intervall.
export const WARTUNGS_VORLAGEN: {
  titel: string;
  wiederkehrung: (typeof WIEDERKEHRUNGEN)[number];
  kategorie: TerminKategorie;
  notiz: string;
}[] = [
  { titel: "Heizungswartung", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Jährliche Wartung (Herstellervorgabe/Gewährleistung)" },
  { titel: "Rauchwarnmelder-Prüfung", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Jährliche Funktionsprüfung — DIN 14676" },
  { titel: "Feuerstättenschau / Schornsteinfeger", wiederkehrung: "jaehrlich", kategorie: "Wartung", notiz: "Termin mit Bezirksschornsteinfeger abstimmen" },
  { titel: "Legionellenprüfung", wiederkehrung: "alle_3_jahre", kategorie: "Wartung", notiz: "Alle 3 Jahre bei vermieteten Objekten mit zentraler Warmwasserbereitung — § 31 TrinkwV" },
  { titel: "Aufzugsprüfung (ZÜS)", wiederkehrung: "alle_2_jahre", kategorie: "Wartung", notiz: "Hauptprüfung alle 2 Jahre — § 16 BetrSichV" },
  { titel: "Eigentümerversammlung", wiederkehrung: "jaehrlich", kategorie: "WEG", notiz: "Jährliche Versammlung — § 24 WEG" },
];
