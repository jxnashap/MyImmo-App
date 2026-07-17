// Verkaufs-Rechner: Spekulationssteuer (§ 23 EStG) auf den Veräußerungsgewinn
// und Netto-Erlös nach Tilgung/Kosten/Steuer. Reine Rechenfunktionen, keine
// Steuerberatung.

import { berechneSpekulation } from "@/lib/steuer/spekulation";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type VerkaufInput = {
  verkaufspreis: number;
  kaufdatum: string | null; // YYYY-MM-DD (für § 23-Frist)
  kaufpreis: number; // ursprüngliche Anschaffungskosten (inkl. Nebenkosten, sofern erfasst)
  kaufnebenkosten?: number; // zusätzliche Anschaffungsnebenkosten, falls separat
  afaKumuliert?: number; // in Anspruch genommene AfA (erhöht den Gewinn)
  verkaufskosten?: number; // Makler, Notar, Energieausweis, Vorfälligkeit …
  restschuld?: number; // offenes Darlehen
  vorfaelligkeit?: number; // Vorfälligkeitsentschädigung (falls nicht in Verkaufskosten)
  steuersatz?: number; // persönlicher Grenzsteuersatz in % (Default 42)
  heute?: Date;
};

export type VerkaufErgebnis = {
  spekulationsfrei: boolean;
  steuerfreiAb: string | null;
  veraeusserungsgewinn: number; // steuerpflichtiger Gewinn (0, wenn spekulationsfrei)
  spekulationssteuer: number;
  nettoErloes: number; // was nach allem übrig bleibt
  details: Record<string, number>;
};

export function berechneVerkauf(i: VerkaufInput): VerkaufErgebnis {
  const heute = i.heute ?? new Date();
  const spek = berechneSpekulation(i.kaufdatum, heute);
  const spekulationsfrei = spek.aktiv ? spek.steuerfrei : false;

  const anschaffung = Math.max(0, i.kaufpreis) + Math.max(0, i.kaufnebenkosten ?? 0);
  const verkaufskosten = Math.max(0, i.verkaufskosten ?? 0);
  const afa = Math.max(0, i.afaKumuliert ?? 0);

  // § 23-Veräußerungsgewinn = Verkaufspreis − Veräußerungskosten
  //   − (Anschaffungskosten − in Anspruch genommene AfA)
  const gewinnRoh = i.verkaufspreis - verkaufskosten - (anschaffung - afa);
  const veraeusserungsgewinn = spekulationsfrei ? 0 : Math.max(0, r2(gewinnRoh));

  const satz = Math.max(0, Math.min(100, i.steuersatz ?? 42)) / 100;
  const spekulationssteuer = r2(veraeusserungsgewinn * satz);

  const restschuld = Math.max(0, i.restschuld ?? 0);
  const vfe = Math.max(0, i.vorfaelligkeit ?? 0);
  const nettoErloes = r2(i.verkaufspreis - restschuld - vfe - verkaufskosten - spekulationssteuer);

  return {
    spekulationsfrei,
    steuerfreiAb: spek.steuerfreiAb,
    veraeusserungsgewinn,
    spekulationssteuer,
    nettoErloes,
    details: {
      verkaufspreis: r2(i.verkaufspreis),
      anschaffungskosten: r2(anschaffung),
      abzglAfa: r2(afa),
      verkaufskosten: r2(verkaufskosten),
      restschuld: r2(restschuld),
      vorfaelligkeit: r2(vfe),
    },
  };
}
