// Dokument-Vorlagen: Standardtexte (mit Platzhaltern), Titel und die
// Platzhalter-Fülllogik. Wird sowohl vom DocGenerator (Vorschau) als auch
// von der PDF-Route geteilt, damit Vorschau und PDF identisch sind.
//
// Platzhalter im Text werden als {{key}} geschrieben und über fuelleVorlage()
// durch die konkreten Werte ersetzt. Leere Absätze (z.B. wenn {{grund}} leer
// bleibt) werden automatisch entfernt.

export type DocArt =
  | "allgemein"
  | "mieterhoehung"
  | "zahlungserinnerung"
  | "mahnung"
  | "kuendigung"
  | "reparatur"
  | "nk-anschreiben";

export const ARTEN: { v: DocArt; label: string }[] = [
  { v: "allgemein", label: "Allgemeines Schreiben" },
  { v: "mieterhoehung", label: "Mieterhöhung (§ 558 BGB)" },
  { v: "zahlungserinnerung", label: "Zahlungserinnerung" },
  { v: "mahnung", label: "Mahnung" },
  { v: "kuendigung", label: "Kündigung" },
  { v: "reparatur", label: "Reparatur-Ankündigung" },
  { v: "nk-anschreiben", label: "NK-Abrechnung — Anschreiben" },
];

export const TITEL: Record<DocArt, string> = {
  allgemein: "Schreiben",
  mieterhoehung: "Mieterhöhungsverlangen",
  zahlungserinnerung: "Zahlungserinnerung",
  mahnung: "Mahnung",
  kuendigung: "Kündigung des Mietverhältnisses",
  reparatur: "Ankündigung von Instandhaltungsarbeiten",
  "nk-anschreiben": "Nebenkostenabrechnung — Anschreiben",
};

// Dokumentarten, bei denen ein Betrag + Zahlungskonto sinnvoll ist.
export const ART_ZEIGT_BETRAG: DocArt[] = ["mieterhoehung", "zahlungserinnerung", "mahnung"];

// Verfügbare Platzhalter (für die Hilfe-Anzeige im Editor).
export const PLATZHALTER: { key: string; label: string }[] = [
  { key: "mieter", label: "Mietername" },
  { key: "objekt", label: "Mietobjekt" },
  { key: "betrag", label: "Betrag" },
  { key: "miete", label: "akt. Kaltmiete" },
  { key: "datum", label: "Datum" },
  { key: "grund", label: "Begründung / Zusatztext" },
];

// Standardtexte (Briefkörper zwischen Anrede und Grußformel).
// Absätze sind durch Leerzeilen getrennt.
export const DEFAULT_VORLAGEN: Record<DocArt, string> = {
  allgemein: `{{grund}}`,

  mieterhoehung: `hiermit mache ich von meinem Recht auf Mieterhöhung gemäß § 558 BGB Gebrauch.

Die aktuelle Kaltmiete für die o. g. Wohnung beträgt {{miete}}. Ich bitte Sie um Zustimmung zur Erhöhung der monatlichen Kaltmiete auf {{betrag}}, wirksam ab dem {{datum}}.

{{grund}}

Gemäß § 558b BGB haben Sie bis zum Ablauf des zweiten Kalendermonats nach Zugang dieses Schreibens Zeit, der Erhöhung zuzustimmen.`,

  zahlungserinnerung: `bei der Durchsicht meiner Unterlagen habe ich festgestellt, dass die Mietzahlung in Höhe von {{betrag}} noch nicht eingegangen ist.

Sicherlich handelt es sich um ein Versehen. Ich bitte Sie, den offenen Betrag bis zum {{datum}} zu überweisen.

{{grund}}

Sollte sich Ihre Zahlung mit diesem Schreiben überschnitten haben, betrachten Sie es bitte als gegenstandslos.`,

  mahnung: `trotz vorheriger Erinnerung ist die Mietzahlung in Höhe von {{betrag}} bislang nicht eingegangen. Hiermit mahne ich die offene Forderung an.

Ich fordere Sie auf, den offenen Betrag bis spätestens {{datum}} zu begleichen.

{{grund}}

Sollte die Zahlung nicht fristgerecht eingehen, behalte ich mir weitere rechtliche Schritte vor.`,

  kuendigung: `hiermit kündige ich das Mietverhältnis über die o. g. Wohnung ordentlich und fristgerecht zum {{datum}}.

{{grund}}

Ich bitte Sie, mir einen Termin zur Wohnungsübergabe vorzuschlagen. Die Wohnung ist besenrein und mit sämtlichen Schlüsseln zu übergeben.

Hinweis: Sie haben das Recht, der Kündigung gemäß § 574 BGB zu widersprechen.`,

  reparatur: `hiermit kündige ich Instandhaltungs- bzw. Reparaturarbeiten in der o. g. Wohnung an, geplant für den {{datum}}.

{{grund}}

Gemäß § 555a BGB sind Sie verpflichtet, Erhaltungsmaßnahmen zu dulden. Ich bemühe mich, die Beeinträchtigungen so gering wie möglich zu halten, und bitte Sie, den Zugang zur Wohnung zum genannten Termin zu ermöglichen.`,

  "nk-anschreiben": `anbei erhalten Sie die Nebenkostenabrechnung für die o. g. Wohnung.

{{grund}}

Die Einzelheiten entnehmen Sie bitte der beigefügten Abrechnung. Bei Fragen stehe ich Ihnen gerne zur Verfügung.`,
};

/** Liefert die gespeicherte Vorlage für eine Art, sonst den Standardtext. */
export function vorlageFuer(art: string, gespeichert?: Record<string, string>): string {
  const eigen = gespeichert?.[art];
  if (eigen != null) return eigen;
  return DEFAULT_VORLAGEN[art as DocArt] ?? "";
}

/**
 * Ersetzt {{platzhalter}} durch Werte und gibt die einzelnen Absätze zurück.
 * Leere Absätze (durch unbesetzte Platzhalter) werden entfernt.
 */
export function fuelleVorlage(text: string, werte: Record<string, string>): string[] {
  const ersetzt = (text ?? "").replace(/\{\{(\w+)\}\}/g, (_, k: string) =>
    werte[k] != null ? werte[k] : "",
  );
  return ersetzt
    .split(/\n\s*\n/) // Absätze an Leerzeilen trennen
    .map((p) => p.replace(/[ \t]+/g, " ").replace(/\s*\n\s*/g, " ").trim())
    .filter((p) => p.length > 0);
}
