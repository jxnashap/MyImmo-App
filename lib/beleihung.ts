// Beleihungsordner: Master-Checkliste aller Bank-Unterlagen für eine
// Immobilien-Finanzierung (Kauf oder Beleihung im Bestand). Welche Items
// sichtbar sind, hängt vom Objekt (ETW? vermietet?), vom Modus (Kauf?)
// und vom Beschäftigungsstatus (selbstständig?) ab.

export type BelGruppe = "objekt" | "bonitaet" | "vermietung" | "etw";

export type BelItem = {
  key: string;
  gruppe: BelGruppe;
  label: string;
  hinweis?: string;
  // immer = jede Finanzierung · situativ = optional, aber sichtbar ·
  // kauf/selbststaendig/vermietet/etw = nur in der jeweiligen Situation
  pflicht: "immer" | "situativ" | "kauf" | "selbststaendig" | "vermietet" | "etw";
  // Dokument kann aus MyImmo-Daten erzeugt werden
  auto?: "kennblatt" | "mietaufstellung" | "nk";
};

export const BELEIHUNG_CHECKLISTE: BelItem[] = [
  { key: "grundbuch", gruppe: "objekt", label: "Grundbuchauszug", hinweis: "max. 3 Monate alt · Grundbuchamt/Notar", pflicht: "immer" },
  { key: "flurkarte", gruppe: "objekt", label: "Flurkarte / amtlicher Lageplan", hinweis: "Katasteramt", pflicht: "immer" },
  { key: "grundrisse", gruppe: "objekt", label: "Bauzeichnungen / Grundrisse", hinweis: "bemaßt, je Etage", pflicht: "immer" },
  { key: "wohnflaeche", gruppe: "objekt", label: "Wohn-/Nutzflächenberechnung", hinweis: "WoFlV / DIN 277", pflicht: "immer" },
  { key: "baubeschreibung", gruppe: "objekt", label: "Baubeschreibung", hinweis: "Pflicht bei Neubau", pflicht: "situativ" },
  { key: "fotos", gruppe: "objekt", label: "Fotos innen & außen", hinweis: "Zustand", pflicht: "immer" },
  { key: "energieausweis", gruppe: "objekt", label: "Energieausweis", hinweis: "gültig", pflicht: "immer" },
  { key: "versicherung", gruppe: "objekt", label: "Nachweis Wohngebäudeversicherung", pflicht: "immer" },
  { key: "kaufvertrag", gruppe: "objekt", label: "Kaufvertrag / -entwurf", hinweis: "entfällt bei reiner Beleihung", pflicht: "kauf" },
  { key: "expose", gruppe: "objekt", label: "Objekt-Exposé / Kennblatt", pflicht: "situativ", auto: "kennblatt" },
  { key: "gehalt", gruppe: "bonitaet", label: "Gehaltsabrechnungen (letzte 3 Monate)", pflicht: "immer" },
  { key: "steuerbescheid", gruppe: "bonitaet", label: "Einkommensteuerbescheid(e)", hinweis: "1–3 Jahre", pflicht: "immer" },
  { key: "arbeitsvertrag", gruppe: "bonitaet", label: "Arbeitsvertrag", pflicht: "situativ" },
  { key: "bwa", gruppe: "bonitaet", label: "BWA (bei Selbstständigen)", pflicht: "selbststaendig" },
  { key: "bilanz", gruppe: "bonitaet", label: "Bilanz / EÜR (2 Jahre, Selbstständige)", pflicht: "selbststaendig" },
  { key: "eigenkapital", gruppe: "bonitaet", label: "Eigenkapitalnachweis / Kontoauszüge", pflicht: "immer" },
  { key: "schufa", gruppe: "bonitaet", label: "SCHUFA-Klausel / Selbstauskunft", pflicht: "immer" },
  { key: "ausweis", gruppe: "bonitaet", label: "Personalausweis / Reisepass", pflicht: "immer" },
  { key: "vermoegen", gruppe: "bonitaet", label: "Vermögens- & Verbindlichkeitsaufstellung", pflicht: "immer" },
  { key: "selbstauskunft", gruppe: "bonitaet", label: "Selbstauskunftsbogen der Bank (ausgefüllt)", pflicht: "immer" },
  { key: "mietvertraege", gruppe: "vermietung", label: "Mietverträge", pflicht: "vermietet" },
  { key: "mietaufstellung", gruppe: "vermietung", label: "Mietaufstellung / Mietnachweis", pflicht: "vermietet", auto: "mietaufstellung" },
  { key: "nk", gruppe: "vermietung", label: "Nebenkostenabrechnungen", pflicht: "vermietet", auto: "nk" },
  { key: "teilungserklaerung", gruppe: "etw", label: "Teilungserklärung + Aufteilungsplan", pflicht: "etw" },
  { key: "weg_protokolle", gruppe: "etw", label: "WEG-Protokolle (letzte 3)", pflicht: "etw" },
  { key: "wirtschaftsplan", gruppe: "etw", label: "Wirtschaftsplan der WEG", pflicht: "etw" },
  { key: "hausgeld", gruppe: "etw", label: "Hausgeld- / Jahresabrechnung", pflicht: "etw" },
  { key: "ruecklage", gruppe: "etw", label: "Nachweis Instandhaltungsrücklage", pflicht: "etw" },
];

export const BEL_GRUPPEN: { id: BelGruppe; label: string }[] = [
  { id: "objekt", label: "Objektunterlagen" },
  { id: "bonitaet", label: "Bonität" },
  { id: "vermietung", label: "Vermietung" },
  { id: "etw", label: "Eigentumswohnung (WEG)" },
];

export type BelKontext = {
  istEtw: boolean;
  hatMieter: boolean;
  modusKauf: boolean;
  selbststaendig: boolean;
};

export function itemSichtbar(item: BelItem, ctx: BelKontext): boolean {
  switch (item.pflicht) {
    case "immer":
    case "situativ":
      return true;
    case "kauf":
      return ctx.modusKauf;
    case "selbststaendig":
      return ctx.selbststaendig;
    case "vermietet":
      return ctx.hatMieter;
    case "etw":
      return ctx.istEtw;
  }
}

export function sichtbareItems(ctx: BelKontext): BelItem[] {
  return BELEIHUNG_CHECKLISTE.filter((i) => itemSichtbar(i, ctx));
}

// Persistierter Zustand eines Checklisten-Items (ohne datei_data — die
// Datei selbst wird nur über die Datei-Route ausgeliefert).
export type BelDok = {
  item_key: string;
  status: "offen" | "hochgeladen" | "erledigt";
  notiz: string | null;
  datum: string | null;
  datei_name: string | null;
  datei_type: string | null;
  datei_size: number | null;
};
