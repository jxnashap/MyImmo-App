// Kennzahlen einer Kaufprüfung (Kaufweg Schritt 1, `components/kauf/ObjektRechner.tsx`) als reine
// Funktion. Herausgezogen am 06.10.2026, damit die Beispiel-Kandidaten der Demo dieselbe Rechnung
// haben wie ein echter Nutzer (tests/demoKandidaten.test.ts) — vorher stand sie nur in der Komponente.
//
// Eingabe = die gespeicherten Felder (`kalkulationen.data`), Ausgabe = `kalkulationen.summary` plus
// die Zwischenwerte, die der Rechner anzeigt.

import { zahlDe0 } from "@/lib/zahl";
import { kaufnebenkostenSatz } from "@/lib/kalk";
import { marktwert as rechneMarktwert } from "@/lib/kauf/marktwert";

const num = zahlDe0;

export type ObjektEingaben = {
  kaufpreis: string;
  flaeche: string;
  /** Maschinenwert der Bundesland-Auswahl („0.05“ = 5 % Grunderwerbsteuer) — kein deutscher Zahlentext. */
  bundesland: string;
  makler: string;
  sanierung: string;
  nutzung: "vermietung" | "eigennutzung";
  kaltmiete: string;
  bewirt: string;
  objektTyp: "wohnung" | "haus";
  grundFlaeche: string;
  bodenrichtwert: string;
  baujahr: string;
  gebTyp: string;
  ausstattung: string;
  bpiFaktor: string;
  regionalFaktor: string;
  lz: string;
  anzahlWhg: string;
  swFaktor: string;
};

export function objektKennzahlen(e: ObjektEingaben) {
  const kp = num(e.kaufpreis), fl = num(e.flaeche);
  // `bundesland` NICHT durch den deutschen Zahlenparser: der hielt den Punkt für ein
  // Tausendertrennzeichen und machte aus 0,035 die Zahl 35 (3500 % Grunderwerbsteuer).
  const grestSatz = Number(e.bundesland) || 0;
  const nkSatz = kaufnebenkostenSatz(grestSatz, num(e.makler)); // + Notar/Grundbuch (lib/kalk.ts)
  const nebenkosten = kp * nkSatz;
  // Sanierung gehört zur Investition (Nettorendite, Darlehensbedarf).
  const sanierung = Math.max(0, num(e.sanierung));
  const gesamtInvest = kp + nebenkosten + sanierung;
  const preisM2 = kp > 0 && fl > 0 ? kp / fl : 0;

  const vermietung = e.nutzung === "vermietung";
  const kaltmiete = num(e.kaltmiete);
  const jahresmiete = vermietung ? kaltmiete * 12 : 0;
  const brutto = vermietung && kp > 0 && jahresmiete > 0 ? (jahresmiete / kp) * 100 : 0;
  const faktor = vermietung && jahresmiete > 0 ? kp / jahresmiete : 0;
  const bewirtJahr = jahresmiete * (num(e.bewirt) / 100);
  const nettomiet = vermietung && gesamtInvest > 0 && jahresmiete > 0 ? ((jahresmiete - bewirtJahr) / gesamtInvest) * 100 : 0;

  // Marktwert — Verfahren nach Nutzung (Vermietung → Ertragswert, Eigennutzung → Sachwert).
  const mw = rechneMarktwert({
    nutzung: e.nutzung, objektTyp: e.objektTyp, wohnflaeche: fl, kaltmieteMonat: kaltmiete,
    anzahlWohnungen: Math.round(num(e.anzahlWhg)) || 1,
    grundFlaeche: num(e.grundFlaeche), bodenrichtwert: num(e.bodenrichtwert),
    baujahr: Math.round(num(e.baujahr)), gebTyp: e.gebTyp, ausstattung: Math.round(num(e.ausstattung)),
    bpiFaktor: num(e.bpiFaktor) || 1.9, regionalFaktor: num(e.regionalFaktor) || 1,
    liegenschaftszins: num(e.lz) || 3.5, sachwertfaktor: num(e.swFaktor) || 1,
  });
  const marktwert = mw.ergebnis?.wert ?? 0;

  return { kp, fl, nebenkosten, sanierung, gesamtInvest, preisM2, vermietung, kaltmiete, jahresmiete, brutto, faktor, nettomiet, mw, marktwert };
}

export type ObjektKennzahlen = ReturnType<typeof objektKennzahlen>;

/** Was als `kalkulationen.summary` gespeichert wird — die Vergleichstabelle liest genau diese Schlüssel. */
export function kennzahlenSummary(k: ObjektKennzahlen): Record<string, number> {
  return {
    kp: k.kp, gesamtInvest: k.gesamtInvest, sanierung: k.sanierung, preisM2: k.preisM2, brutto: k.brutto,
    nettomiet: k.nettomiet, faktor: k.faktor, kaltmiete: k.kaltmiete, nutzung: k.vermietung ? 1 : 0, marktwert: k.marktwert,
  };
}
