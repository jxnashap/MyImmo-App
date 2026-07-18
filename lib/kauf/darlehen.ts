// Darlehens-Wunsch-Wizard: übersetzt die Wünsche des Nutzers (planbare vs.
// niedrige Rate, Zinsbindung, schnell schuldenfrei) in eine konkrete
// Darlehenskonfiguration + Kennzahlen. Reine Berechnung, KEINE Empfehlung
// eines konkreten Bankprodukts (§ 34i GewO) — nur allgemeine Rechenhilfe.

import { berechneRestschuld, berechneVolltilgungJahr } from "@/lib/kalk";

export const KAUF_DARLEHEN_KEY = "myimmo_kauf_darlehen";

export type Prioritaet = "gleiche_rate" | "niedrige_rate" | "schnell_schuldenfrei" | "zinssicherheit";

export type DarlehenWunsch = {
  darlehen: number;
  prioritaet: Prioritaet;
  zinsbindung: number;   // Jahre (10 / 15 / 20)
  sollzins: number;      // % p.a. (Beispiel/annahme, real von der Bank)
  sondertilgung: boolean;
};

// Für den Kreditantrag (E) gemerkter Finanzierungswunsch (localStorage).
export type DarlehenAuswahl = DarlehenWunsch & {
  anfangstilgung: number;
  monatsrate: number;
  gewaehltAm: string;
};

export type DarlehenKonfig = {
  anfangstilgung: number;        // % p.a.
  zinsbindung: number;
  sollzins: number;
  sondertilgung: boolean;
  ratentyp: string;
  monatsrate: number;
  restschuldNachBindung: number;
  volltilgungJahr: number;       // absolutes Jahr (oder 0, wenn > 60 J.)
  laufzeitJahre: number;
  zinskostenBindung: number;     // Summe Zinsen während der Zinsbindung
  empfehlung: string;
};

// Beispiel-Sollzins nach Zinsbindung (Richtwert 2026 — real von der Bank).
export function beispielZins(zinsbindung: number): number {
  if (zinsbindung >= 20) return 4.0;
  if (zinsbindung >= 15) return 3.8;
  return 3.6; // 10 Jahre
}

// Anfangstilgung aus der Priorität.
function tilgungAusPrioritaet(p: Prioritaet): number {
  switch (p) {
    case "niedrige_rate": return 1.5;
    case "gleiche_rate": return 2;
    case "zinssicherheit": return 2.5;
    case "schnell_schuldenfrei": return 4;
  }
}

function empfehlungstext(p: Prioritaet, sonder: boolean): string {
  const s = sonder ? " Sondertilgungsrecht (meist kostenlos) für zusätzliche Flexibilität mitnehmen." : "";
  switch (p) {
    case "niedrige_rate":
      return "Niedrige Rate über geringe Anfangstilgung — Achtung: lange Laufzeit, hohe Zinskosten und hohe Restschuld am Ende der Zinsbindung." + s;
    case "gleiche_rate":
      return "Annuitätendarlehen mit planbarer, konstanter Rate und einer langen Zinsbindung für Sicherheit." + s;
    case "zinssicherheit":
      return "Möglichst lange Zinsbindung (15–20 J.) — nach 10 Jahren ist jederzeit mit 6 Monaten Frist kündbar (§ 489 BGB), lange Bindung ist also asymmetrisch günstig." + s;
    case "schnell_schuldenfrei":
      return "Hohe Anfangstilgung verkürzt die Laufzeit deutlich und spart Zinsen — dafür höhere Monatsrate. Prüfe, ob der Haushaltsüberschuss das trägt." + s;
  }
}

export function konfiguriereDarlehen(w: DarlehenWunsch, startJahr: number): DarlehenKonfig {
  const darlehen = Math.max(0, w.darlehen);
  const anfangstilgung = tilgungAusPrioritaet(w.prioritaet);
  const zins = Math.max(0, w.sollzins) / 100;
  const tilg = anfangstilgung / 100;
  const monatsrate = (darlehen * (zins + tilg)) / 12;

  const restschuldNachBindung = berechneRestschuld(darlehen, zins, monatsrate, w.zinsbindung);
  const volltilgungJahr = darlehen > 0 ? berechneVolltilgungJahr(darlehen, zins, monatsrate, startJahr) : 0;
  const laufzeitJahre = volltilgungJahr > 0 ? volltilgungJahr - startJahr : 0;
  // Zinsen während der Bindung = gezahlte Raten − getilgter Anteil.
  const getilgt = darlehen - restschuldNachBindung;
  const zinskostenBindung = Math.max(0, monatsrate * 12 * w.zinsbindung - getilgt);

  return {
    anfangstilgung,
    zinsbindung: w.zinsbindung,
    sollzins: w.sollzins,
    sondertilgung: w.sondertilgung,
    ratentyp: "Annuitätendarlehen (konstante Rate)",
    monatsrate,
    restschuldNachBindung,
    volltilgungJahr,
    laufzeitJahre,
    zinskostenBindung,
    empfehlung: empfehlungstext(w.prioritaet, w.sondertilgung),
  };
}
