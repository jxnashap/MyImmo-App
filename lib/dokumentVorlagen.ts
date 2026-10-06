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
  | "nk-anschreiben"
  | "wohnungsgeber"
  | "mietbescheinigung"
  | "mietquittung";

export const ARTEN: { v: DocArt; label: string }[] = [
  { v: "allgemein", label: "Allgemeines Schreiben" },
  { v: "mieterhoehung", label: "Mieterhöhung (§ 558 BGB)" },
  { v: "zahlungserinnerung", label: "Zahlungserinnerung" },
  { v: "mahnung", label: "Mahnung" },
  { v: "kuendigung", label: "Kündigung" },
  { v: "reparatur", label: "Reparatur-Ankündigung" },
  { v: "nk-anschreiben", label: "NK-Abrechnung — Anschreiben" },
  { v: "wohnungsgeber", label: "Wohnungsgeberbestätigung (§ 19 BMG)" },
  { v: "mietbescheinigung", label: "Mietbescheinigung" },
  { v: "mietquittung", label: "Mietquittung (§ 368 BGB)" },
];

export const TITEL: Record<DocArt, string> = {
  allgemein: "Schreiben",
  mieterhoehung: "Mieterhöhungsverlangen",
  zahlungserinnerung: "Zahlungserinnerung",
  mahnung: "Mahnung",
  kuendigung: "Kündigung des Mietverhältnisses",
  reparatur: "Ankündigung von Instandhaltungsarbeiten",
  "nk-anschreiben": "Nebenkostenabrechnung — Anschreiben",
  wohnungsgeber: "Wohnungsgeberbestätigung (§ 19 BMG)",
  mietbescheinigung: "Mietbescheinigung",
  mietquittung: "Mietquittung (§ 368 BGB)",
};

// Bescheinigungen: sachlicher Aufbau ohne Anrede/Grußformel,
// stattdessen Unterschriftszeile des Vermieters/Wohnungsgebers.
export const ART_BESCHEINIGUNG: DocArt[] = ["wohnungsgeber", "mietbescheinigung", "mietquittung"];

// Dokumentarten mit Betragsfeld.
export const ART_ZEIGT_BETRAG: DocArt[] = ["mieterhoehung", "zahlungserinnerung", "mahnung", "mietquittung"];

// Dokumentarten, die zur ZAHLUNG auffordern — nur dort gehört der Kasten „Bitte überweisen Sie
// auf folgendes Konto“ hin. Eine Quittung bestätigt eine erhaltene Zahlung, ein
// Mieterhöhungsverlangen bittet um Zustimmung; beide fordern nichts an (Design-Scan 06.10.2026).
export const ART_ZEIGT_KONTO: DocArt[] = ["zahlungserinnerung", "mahnung"];

// Beschriftung des Betragsfelds je Art.
export const BETRAG_LABEL: Partial<Record<DocArt, string>> = {
  mieterhoehung: "Neue Kaltmiete (€)",
  zahlungserinnerung: "Offener Betrag (€)",
  mahnung: "Offener Betrag (€)",
  mietquittung: "Erhaltener Betrag (€)",
};

// Bedeutung von {{datum}} je Art — sonst schlicht „Datum“ (eigene Vorlagen).
export const DATUM_LABEL: Partial<Record<DocArt, string>> = {
  mieterhoehung: "Wirksam ab",
  zahlungserinnerung: "Zahlbar bis",
  mahnung: "Zahlbar bis",
  kuendigung: "Kündigung zum",
  reparatur: "Termin der Arbeiten",
  mietquittung: "Zahlung erhalten am",
};

// Arten, bei denen ohne eingegebenen Betrag die Warmmiete laut Vertrag eingesetzt wird.
// Geschuldet ist die Warmmiete (kalt + NK + Stellplatz), nicht die Kaltmiete.
export const ART_BETRAG_RUECKFALL: DocArt[] = ["zahlungserinnerung", "mahnung", "mietquittung"];

const MONATE_LANG = [
  "Januar", "Februar", "März", "April", "Mai", "Juni",
  "Juli", "August", "September", "Oktober", "November", "Dezember",
];

/** „2026-10-06“ → „6. Oktober 2026“ (DIN 5008, ohne führende Null) aus den Zahlen des ISO-Textes
 *  — kein Date-Objekt, damit Vorschau (Browser) und PDF (Server) denselben Tag zeigen. */
export function briefDatum(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  if (!m) return "";
  return `${Number(m[3])}. ${MONATE_LANG[Number(m[2]) - 1] ?? m[2]} ${m[1]}`;
}

/** Ersten Buchstaben großschreiben — Bescheinigungen haben keine Anrede, ihr Text beginnt einen Satz
 *  (auch bei schon gespeicherten eigenen Vorlagen, die noch mit „hiermit …“ anfangen). */
export function satzanfangGross(absaetze: string[]): string[] {
  if (!absaetze.length) return absaetze;
  const [erster, ...rest] = absaetze;
  return [erster.charAt(0).toLocaleUpperCase("de-DE") + erster.slice(1), ...rest];
}

/** Platzhalter, die die Vorlage benutzt, für die aber kein Wert vorliegt. {{grund}} ist optional. */
export function fehlendePlatzhalter(text: string, werte: Record<string, string>): string[] {
  const fehlend = new Set<string>();
  for (const [, k] of (text ?? "").matchAll(/\{\{(\w+)\}\}/g)) {
    if (k === "grund") continue;
    const w = (werte[k] ?? "").trim();
    if (!w || w === "–") fehlend.add(k);
  }
  return [...fehlend];
}

// Verfügbare Platzhalter (für die Hilfe-Anzeige im Editor).
export const PLATZHALTER: { key: string; label: string }[] = [
  { key: "mieter", label: "Mietername" },
  { key: "objekt", label: "Mietobjekt" },
  { key: "betrag", label: "Betrag" },
  { key: "miete", label: "akt. Kaltmiete" },
  { key: "datum", label: "Datum" },
  { key: "grund", label: "Begründung / Zusatztext" },
  { key: "mieterkonto", label: "Konto des Mieters (IBAN)" },
  { key: "mietbeginn", label: "Mietbeginn" },
  { key: "warmmiete", label: "Warmmiete (kalt + NK)" },
  { key: "nkvz", label: "NK-Vorauszahlung" },
  { key: "vermieter", label: "Vermietername" },
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

  wohnungsgeber: `Hiermit bestätige ich gemäß § 19 Bundesmeldegesetz (BMG) als Wohnungsgeber den Einzug in die unten genannte Wohnung.

Einziehende Person(en): {{mieter}}

Wohnung: {{objekt}}

Einzugsdatum: {{mietbeginn}}

Wohnungsgeber: {{vermieter}}

{{grund}}

Diese Bestätigung dient ausschließlich der Vorlage bei der Meldebehörde (Anmeldung nach § 17 BMG). Hinweis: Das Ausstellen einer solchen Bestätigung ohne tatsächlichen Einzug ist verboten (§ 19 Abs. 6 BMG).`,

  mietbescheinigung: `Hiermit wird bescheinigt, dass {{mieter}} seit dem {{mietbeginn}} Mieter/in der folgenden Wohnung ist:

{{objekt}}

Die monatliche Kaltmiete beträgt {{miete}}, die Nebenkosten-Vorauszahlung {{nkvz}} (Gesamtmiete: {{warmmiete}}).

{{grund}}

Diese Bescheinigung wird auf Wunsch des Mieters zur Vorlage bei Behörden, Banken oder Vermietern ausgestellt.`,

  mietquittung: `Hiermit wird bestätigt, dass {{mieter}} für das Mietobjekt {{objekt}} die Mietzahlung in Höhe von {{betrag}} geleistet hat (Zahlung erhalten am {{datum}}).

{{grund}}

Diese Quittung wird gemäß § 368 BGB auf Verlangen des Mieters ausgestellt.`,
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
