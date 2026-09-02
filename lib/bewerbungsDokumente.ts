// Katalog der Bewerbungs-Unterlagen (Dokument-Slots) + Steckbrief-Felder des
// Bewerbungs-Links. Wird von der Vermieter-Verwaltung UND der öffentlichen
// Bewerbungsseite genutzt — die Slugs müssen zur Whitelist in der RPC
// `bewerbung_datei_anhaengen` passen (Migration 20260827120000).
//
// Rechtlicher Rahmen (DSK-Orientierungshilfe Mieterselbstauskunft): Nachweise
// sind für Bewerber IMMER freiwillig — der Vermieter wählt nur, welche Slots
// auf der Seite ANGEBOTEN werden. Eine Ausweiskopie ist bewusst KEIN Slot
// (Identität wird durch Vorzeigen geprüft, Kopie erst zum Vertragsschluss).

export type DokumentSlot = {
  slug: string;
  label: string;
  hinweis?: string;
  /** empfohlene Zahl der Dateien (nur UI-Richtwert, kein hartes Limit) */
  max: number;
};

export const DOKUMENT_SLOTS: DokumentSlot[] = [
  { slug: "gehalt", label: "Letzte 3 Gehaltsabrechnungen", hinweis: "bei Angestellten", max: 3 },
  { slug: "schufa", label: "SCHUFA-/Bonitätsauskunft", max: 1 },
  { slug: "mietschuldenfrei", label: "Mietschuldenfreiheitsbescheinigung", hinweis: "vom bisherigen Vermieter", max: 1 },
  { slug: "arbeitsvertrag", label: "Arbeitsvertrag / Beschäftigungsnachweis", max: 1 },
  { slug: "einkommen_selbst", label: "Steuerbescheid oder BWA", hinweis: "bei Selbstständigen", max: 2 },
  { slug: "buergschaft", label: "Bürgschaftserklärung", hinweis: "z. B. der Eltern bei Studierenden", max: 1 },
  { slug: "einkommen_sonstig", label: "Sonstiger Einkommensnachweis", hinweis: "Rente, Elterngeld, BAföG …", max: 2 },
  { slug: "wbs", label: "Wohnberechtigungsschein", hinweis: "nur bei geförderten Wohnungen", max: 1 },
];

/** Slot für frei hochgeladene Unterlagen ohne Kategorie. */
export const SLOT_SONSTIGES = "sonstiges";

export function slotLabel(slug: string | null): string {
  if (!slug || slug === SLOT_SONSTIGES) return "Weitere Unterlagen";
  return DOKUMENT_SLOTS.find((s) => s.slug === slug)?.label ?? slug;
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
