// Katalog der Bewerbungs-Unterlagen (Dokument-Slots) + Steckbrief-Felder des
// Bewerbungs-Links. Wird von der Vermieter-Verwaltung UND der öffentlichen
// Bewerbungsseite genutzt — die Slugs müssen zur Whitelist in der RPC
// `bewerbung_datei_anhaengen` passen (Migration 20260827120000).
//
// Rechtlicher Rahmen (DSK-Orientierungshilfe Selbstauskünfte V2.0, Januar 2026 — Gesamtprüfung B45):
// - Nachweise sind für Bewerber IMMER freiwillig — der Vermieter wählt nur, welche Slots angeboten werden.
// - Einkommensnachweise erst „quasi unmittelbar vor Unterzeichnung des Vertrags“, nicht mit der Bewerbung
//   (Phase „vertrag“ — sie stehen NICHT am Bewerbungslink, sondern werden bei Favoriten per Mail angefordert).
// - Keine Mietschuldenfreiheitsbescheinigung: Der Vormieter muss sie nicht ausstellen (BGH VIII ZR 238/08),
//   also darf sie auch nicht verlangt werden. Der Slot ist gestrichen; Altdateien behalten ihren Namen.
// - Bonität nur als Auskunft FÜR VERMIETER, nie die Datenkopie nach Art. 15 DSGVO (enthält zu viel).
// - Eine Ausweiskopie ist bewusst KEIN Slot (Identität wird durch Vorzeigen geprüft).

export type DokumentSlot = {
  slug: string;
  label: string;
  hinweis?: string;
  /** empfohlene Zahl der Dateien (nur UI-Richtwert, kein hartes Limit) */
  max: number;
  /** „bewerbung“ = darf am Bewerbungslink angeboten werden; „vertrag“ = erst kurz vor Vertragsschluss. */
  phase: "bewerbung" | "vertrag";
};

export const DOKUMENT_SLOTS: DokumentSlot[] = [
  { slug: "schufa", label: "Bonitätsauskunft für Vermieter", hinweis: "z. B. SCHUFA-BonitätsCheck — nicht die kostenlose Datenkopie nach Art. 15 DSGVO", max: 1, phase: "bewerbung" },
  { slug: "wbs", label: "Wohnberechtigungsschein", hinweis: "nur bei geförderten Wohnungen", max: 1, phase: "bewerbung" },
  { slug: "gehalt", label: "Letzte 3 Gehaltsabrechnungen", hinweis: "bei Angestellten", max: 3, phase: "vertrag" },
  { slug: "arbeitsvertrag", label: "Arbeitsvertrag / Beschäftigungsnachweis", max: 1, phase: "vertrag" },
  { slug: "einkommen_selbst", label: "Steuerbescheid oder BWA", hinweis: "bei Selbstständigen", max: 2, phase: "vertrag" },
  { slug: "einkommen_sonstig", label: "Sonstiger Einkommensnachweis", hinweis: "Rente, Elterngeld, BAföG …", max: 2, phase: "vertrag" },
  { slug: "buergschaft", label: "Bürgschaftserklärung", hinweis: "z. B. der Eltern bei Studierenden", max: 1, phase: "vertrag" },
];

/** Am Bewerbungslink anbietbar (Vermieter-Auswahl, öffentliche Seite, Server-Prüfung). */
export const BEWERBUNG_SLOTS = DOKUMENT_SLOTS.filter((s) => s.phase === "bewerbung");
/** Erst vor Vertragsschluss — Inhalt der Mail „Nachweise anfordern“. */
export const VERTRAG_SLOTS = DOKUMENT_SLOTS.filter((s) => s.phase === "vertrag");

/** Slot für frei hochgeladene Unterlagen ohne Kategorie. */
export const SLOT_SONSTIGES = "sonstiges";

/** Gestrichene Slots — nur, damit ältere Dateien noch einen Namen haben. Nie wieder anbieten. */
const ALTE_SLOTS: Record<string, string> = {
  mietschuldenfrei: "Mietschuldenfreiheitsbescheinigung (wird nicht mehr angefragt)",
};

export function slotLabel(slug: string | null): string {
  if (!slug || slug === SLOT_SONSTIGES) return "Weitere Unterlagen";
  return DOKUMENT_SLOTS.find((s) => s.slug === slug)?.label ?? ALTE_SLOTS[slug] ?? slug;
}

/**
 * Löschfrist für Bewerbungen (DSK, Abschnitt D): Daten von Interessenten ohne Mietvertrag sind zu löschen,
 * sobald sie nicht mehr gebraucht werden — wegen möglicher AGG-Ansprüche spätestens nach 6 Monaten.
 * Gilt für JEDEN Status: Vorher erinnerte die App nur bei „abgelehnt“, offene und Favoriten blieben ewig.
 */
export const BEWERBUNG_LOESCHFRIST_MONATE = 6;

/** Stichtag als ISO-Datum: Bewerbungen, die VOR ihm eingingen, sind fällig. Rechnet auf den Zahlen des Datums. */
export function loeschGrenze(heuteIso: string): string {
  const [j, m, t] = heuteIso.slice(0, 10).split("-").map(Number);
  const mi = j * 12 + (m - 1) - BEWERBUNG_LOESCHFRIST_MONATE;
  const jahr = Math.floor(mi / 12);
  const monat = (mi % 12) + 1;
  const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(Math.min(t, letzter)).padStart(2, "0")}`;
}

export function faelligeBewerbungen<T extends { created_at: string }>(liste: T[], heuteIso: string): T[] {
  const grenze = loeschGrenze(heuteIso);
  return liste.filter((b) => b.created_at.slice(0, 10) < grenze);
}

/** Mail „Nachweise anfordern“ an einen Favoriten — erst jetzt, kurz vor dem Vertrag (DSK C. 2). */
export function nachweiseMail(b: { name: string; objektName?: string | null }): { betreff: string; text: string } {
  const wohnung = b.objektName ? ` „${b.objektName}“` : "";
  return {
    betreff: `Ihre Bewerbung${wohnung} — Nachweise vor dem Mietvertrag`,
    text:
      `Guten Tag ${b.name},\n\n` +
      `Sie sind in der engeren Auswahl für die Wohnung${wohnung}. Bevor wir den Mietvertrag unterschreiben, ` +
      `bitte ich Sie um einen Nachweis Ihres Einkommens, je nachdem, was auf Sie zutrifft:\n\n` +
      VERTRAG_SLOTS.map((s) => `- ${s.label}${s.hinweis ? ` (${s.hinweis})` : ""}`).join("\n") +
      `\n\nBitte schwärzen Sie alle Angaben, die dafür nicht nötig sind — zum Beispiel Steuer-ID, ` +
      `Sozialversicherungsnummer, Bankverbindung und Angaben zu Religion oder Familie.\n\nViele Grüße`,
  };
}

/** Objekt-Steckbrief am Bewerbungs-Link — die Eckdaten der Anzeige. */
export type LinkAnzeige = {
  kaltmiete?: number | null;
  nebenkosten?: number | null;
  heizkosten_enthalten?: boolean | null;
  warmmiete?: number | null;
  kaution?: number | null;
  bezugsfrei_ab?: string | null; // ISO-Datum
  etage?: string | null;         // z. B. "1 von 3"
  zimmer?: number | null;
  schlafzimmer?: number | null;
  badezimmer?: number | null;
  flaeche?: number | null;
  ausstattung?: string[] | null;
  heizungsart?: string | null;
  energieausweis?: string | null; // z. B. "liegt zur Besichtigung vor"
  beschreibung?: string | null;
  lage?: string | null;
};

export const AUSSTATTUNG_OPTIONEN = [
  "Balkon/Terrasse",
  "Keller",
  "Einbauküche",
  "Garten/-mitbenutzung",
  "Stellplatz/Garage",
  "Aufzug",
  "WG-geeignet",
  "Haustiere erlaubt",
  "Barrierefrei",
] as const;
