// Verkaufs-Rechner: Spekulationssteuer (§ 23 EStG) auf den Veräußerungsgewinn
// und Netto-Erlös nach Tilgung/Kosten/Steuer. Reine Rechenfunktionen, keine
// Steuerberatung.

import { berechneSpekulation } from "@/lib/steuer/spekulation";

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Freigrenze § 23 Abs. 3 S. 5 EStG: Bleibt der Gesamtgewinn aus privaten
 * Veräußerungsgeschäften des Jahres unter 1.000 €, fällt keine Steuer an.
 * Freigrenze, nicht Freibetrag: Ab 1.000 € ist der volle Gewinn steuerpflichtig.
 * (1.000 € gilt ab dem Veranlagungszeitraum 2024; davor 600 €.)
 */
export const SPEK_FREIGRENZE = 1000;

export type VerkaufInput = {
  verkaufspreis: number;
  kaufdatum: string | null; // YYYY-MM-DD (für § 23-Frist)
  /**
   * Selbstgenutztes Wohneigentum (§ 23 Abs. 1 Nr. 1 S. 3 EStG): im Jahr des
   * Verkaufs und in den beiden Vorjahren selbst bewohnt → steuerfrei,
   * unabhängig von der 10-Jahres-Frist.
   */
  eigennutzung?: boolean;
  kaufpreis: number; // ursprüngliche Anschaffungskosten (inkl. Nebenkosten, sofern erfasst)
  kaufnebenkosten?: number; // zusätzliche Anschaffungsnebenkosten, falls separat
  afaKumuliert?: number; // in Anspruch genommene AfA (erhöht den Gewinn)
  verkaufskosten?: number; // Makler, Notar, Energieausweis, Vorfälligkeit …
  restschuld?: number; // offenes Darlehen
  vorfaelligkeit?: number; // Vorfälligkeitsentschädigung (falls nicht in Verkaufskosten)
  steuersatz?: number; // persönlicher Grenzsteuersatz in % (Default 42)
  /**
   * Ergebnisse ANDERER privater Veräußerungsgeschäfte desselben Jahres
   * (Krypto, Gold, weitere Immobilien …). Die Freigrenze des § 23 Abs. 3 S. 5
   * EStG gilt für die SUMME aller Geschäfte eines Jahres, nicht je Verkauf.
   * Ohne diese Angabe wurde jeder Verkauf einzeln gegen 1.000 € geprüft — wer
   * zwei Objekte mit je 900 € Gewinn verkauft, war damit angeblich steuerfrei,
   * obwohl 1.800 € voll steuerpflichtig sind.
   */
  weitereGewinneImJahr?: number;
  heute?: Date;
};

export type VerkaufErgebnis = {
  spekulationsfrei: boolean;
  steuerfreiAb: string | null;
  veraeusserungsgewinn: number; // steuerpflichtiger Gewinn (0, wenn steuerfrei)
  /** Rechnerisches Ergebnis inkl. Vorzeichen — negativ = Veräußerungsverlust. */
  ergebnisRoh: number;
  /** true = Verlustgeschäft (ergebnisRoh < 0). */
  verlust: boolean;
  /** Grund der Steuerfreiheit, wenn keine Steuer anfällt. */
  steuerfreiGrund: "frist" | "eigennutzung" | "freigrenze" | "verlust" | null;
  spekulationssteuer: number;
  nettoErloes: number; // was nach allem übrig bleibt
  /**
   * Ergebnis dieses Verkaufs PLUS `weitereGewinneImJahr` — der Betrag, gegen
   * den die Freigrenze tatsächlich geprüft wird.
   */
  jahresSumme: number;
  /** Fehlende Angaben, ohne die das Ergebnis nicht belastbar ist. */
  fehlend: string[];
  details: Record<string, number>;
};

export function berechneVerkauf(i: VerkaufInput): VerkaufErgebnis {
  const heute = i.heute ?? new Date();
  const spek = berechneSpekulation(i.kaufdatum, heute);
  const fristAbgelaufen = spek.aktiv ? spek.steuerfrei : false;
  const eigennutzung = !!i.eigennutzung;
  const spekulationsfrei = fristAbgelaufen || eigennutzung;

  const anschaffung = Math.max(0, i.kaufpreis) + Math.max(0, i.kaufnebenkosten ?? 0);
  const verkaufskosten = Math.max(0, i.verkaufskosten ?? 0);
  const afa = Math.max(0, i.afaKumuliert ?? 0);
  const vfe = Math.max(0, i.vorfaelligkeit ?? 0);

  // § 23-Veräußerungsgewinn = Verkaufspreis − Veräußerungskosten
  //   − (Anschaffungskosten − in Anspruch genommene AfA)
  //
  // Die Vorfälligkeitsentschädigung zählt zu den VERÄUSSERUNGSKOSTEN: Sie fällt
  // nur an, weil verkauft wird, und ist bei den Einkünften aus V+V gerade NICHT
  // als Werbungskosten abziehbar (BFH IX R 42/13). Sie minderte bisher nur den
  // Netto-Erlös, nicht den Gewinn — die ausgewiesene Steuer war dadurch zu hoch.
  const veraeusserungskosten = r2(verkaufskosten + vfe);
  const ergebnisRoh = r2(i.verkaufspreis - veraeusserungskosten - (anschaffung - afa));
  const verlust = ergebnisRoh < 0;

  // Reihenfolge der Befreiungsgründe: Frist → Eigennutzung → Verlust → Freigrenze.
  //
  // Die Freigrenze (§ 23 Abs. 3 S. 5 EStG) fehlte früher komplett: Bei 900 €
  // Gewinn wies der Rechner 378 € Steuer aus, obwohl keine anfällt. Sie gilt
  // für die Summe ALLER privaten Veräußerungsgeschäfte des Jahres — hier wird
  // nur dieser eine Verkauf betrachtet; darauf weist der Rechner hin.
  // Die Freigrenze bezieht sich auf die SUMME aller privaten Veräußerungs-
  // geschäfte des Jahres — weitere Gewinne (Krypto, Gold, zweites Objekt)
  // zählen mit und können sie kippen.
  const weitere = i.weitereGewinneImJahr ?? 0;
  const jahresSumme = r2(ergebnisRoh + weitere);

  let steuerfreiGrund: VerkaufErgebnis["steuerfreiGrund"] = null;
  if (fristAbgelaufen) steuerfreiGrund = "frist";
  else if (eigennutzung) steuerfreiGrund = "eigennutzung";
  else if (verlust) steuerfreiGrund = "verlust";
  else if (jahresSumme < SPEK_FREIGRENZE) steuerfreiGrund = "freigrenze";

  const veraeusserungsgewinn = steuerfreiGrund ? 0 : Math.max(0, ergebnisRoh);

  const satz = Math.max(0, Math.min(100, i.steuersatz ?? 42)) / 100;
  const spekulationssteuer = r2(veraeusserungsgewinn * satz);

  const restschuld = Math.max(0, i.restschuld ?? 0);
  const nettoErloes = r2(i.verkaufspreis - restschuld - vfe - verkaufskosten - spekulationssteuer);

  // Ohne Kaufdatum ist die 10-Jahres-Frist nicht prüfbar. Früher wurde dann
  // still die volle Steuer gerechnet — der Nutzer sah eine konkrete Zahl, ohne
  // zu wissen, dass ihr die wichtigste Angabe fehlt.
  const fehlend: string[] = [];
  if (!spek.aktiv) fehlend.push("Kaufdatum (für die 10-Jahres-Frist des § 23 EStG)");
  if (!(i.kaufpreis > 0)) fehlend.push("Kaufpreis");

  return {
    spekulationsfrei,
    steuerfreiAb: spek.steuerfreiAb,
    veraeusserungsgewinn,
    ergebnisRoh,
    verlust,
    steuerfreiGrund,
    jahresSumme,
    spekulationssteuer,
    nettoErloes,
    fehlend,
    details: {
      verkaufspreis: r2(i.verkaufspreis),
      anschaffungskosten: r2(anschaffung),
      abzglAfa: r2(afa),
      verkaufskosten: r2(verkaufskosten),
      veraeusserungskosten,
      restschuld: r2(restschuld),
      vorfaelligkeit: r2(vfe),
    },
  };
}
