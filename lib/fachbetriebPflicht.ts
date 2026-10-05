// Arbeiten, die ein Hausmeister NICHT selbst erledigen darf (05.10.2026).
//
// Gas, Elektroinstallation, Trinkwasser, Schornstein/Abgas: nur eingetragene Fachbetriebe
// (Installateurverzeichnis des Netzbetreibers, DVGW-/VDE-Regeln, Schornsteinfeger-Handwerk).
// Siehe docs/zukunft/MIETERPORTAL-AUSBAU.md, Abschnitt 9 („Hausmeister — Risiken“).
//
// EHRLICH ZUR GRENZE: Die Erkennung liest Titel und Beschreibung des Auftrags. Sie ist eine
// Stichwortliste, kein Verständnis — „Wasserhahn tropft“ fällt NICHT darunter (Dichtung tauschen
// ist keine Arbeit an der Trinkwasserinstallation), „Leitungswasser rostig“ schon. Fehlt ein
// Stichwort im Text, greift die Sperre nicht; deshalb steht der Hinweis zusätzlich im Portal.
// Lieber einmal zu oft „Fachbetrieb nötig“ als eine selbst reparierte Gasleitung.

export type FachbetriebPflicht = { bereich: string; grund: string };

const REGELN: { bereich: string; muster: RegExp; grund: string }[] = [
  {
    bereich: "Gas",
    muster: /\bgas(?!se)|gastherme|therme|gasgeruch|gasleitung|gasherd|gaszähler/i,
    grund: "Arbeiten an Gasanlagen nur durch einen beim Netzbetreiber eingetragenen Fachbetrieb.",
  },
  {
    bereich: "Strom",
    muster: /elektr|steckdose|stromleitung|stromkabel|verteiler|sicherungskasten|\bfi[- ]?schalter|unterverteilung|kabel verlegen|leitung verlegen/i,
    grund: "Arbeiten an der Elektroinstallation nur durch eine Elektrofachkraft (VDE).",
  },
  {
    bereich: "Trinkwasser",
    muster: /trinkwasser|hauswasser|wasserleitung|legionell|leitungswasser|hausanschluss|wasserzähler tauschen/i,
    grund: "Arbeiten an der Trinkwasserinstallation nur durch einen eingetragenen Installateur.",
  },
  {
    bereich: "Schornstein",
    muster: /schornstein|kamin|abgas|rauchabzug|ofenrohr/i,
    grund: "Schornstein und Abgasanlage: Schornsteinfeger bzw. Fachbetrieb.",
  },
];

/** Liefert den ersten passenden Bereich — oder null, wenn der Hausmeister selbst ran darf. */
export function fachbetriebPflicht(...texte: (string | null | undefined)[]): FachbetriebPflicht | null {
  const text = texte.filter(Boolean).join(" ");
  if (!text.trim()) return null;
  for (const r of REGELN) if (r.muster.test(text)) return { bereich: r.bereich, grund: r.grund };
  return null;
}
