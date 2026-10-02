// Daten des Mieterportals — EIN Lader für zwei Blickwinkel (01.10.2026):
//
//   (1) der Mieter selbst unter /portal (Quelle `mieter`: Sichten
//       `mieter_portal`/`properties_portal`, RLS filtert die Mieter-Tabellen),
//   (2) der Vermieter in der Vorschau unter /anliegen?tab=vorschau
//       (Quelle `vermieter`: die eigenen Tabellen, gefiltert auf einen Mieter).
//
// WARUM ein Lader: Die Vorschau soll zeigen, was der Mieter sieht — nicht
// etwas Ähnliches. Zwei getrennte Abfragesätze liefen nach dem nächsten
// Umbau auseinander, und niemand würde es merken. Deshalb stehen die
// Filter, die beim Mieter die RLS übernimmt (nur Miete/Nebenkosten, nur
// freigegebene Belege und Dokumente), hier AUSDRÜCKLICH in der Abfrage —
// für beide Blickwinkel. Beim Mieter sind sie redundant, beim Vermieter
// sind sie die einzige Schranke; `tests/portalVorschau.test.ts` prüft sie.
//
// Spaltensatz: Die Vorschau liest aus `mieter` GENAU die Spalten der Sicht
// `mieter_portal` (Migration 20261001120000). Würde sie mehr lesen, zeigte
// sie dem Vermieter etwas, das der Mieter nie bekommt — und die Vorschau
// wäre eine Lüge.
import type { AnliegenRow, DateiRef } from "@/components/AnliegenPortal";
import type { ZaehlerMeldungRow } from "@/components/ZaehlerPortal";
import type { PortalAnfrageRow } from "@/components/AnfragenVomVermieter";
import { heuteBerlin } from "@/lib/zeitraum";

/** Spalten der Sicht `mieter_portal` — identisch mit der Migration. */
export const MIETER_PORTAL_SPALTEN =
  "id,prop_id,vorname,nachname,einheit,flaeche,mietbeginn,mietende,kuendigung,kaltmiete,nk_vorauszahlung,stellplatz,stellplatz_miete,kaution,kaution_status,mietart";
/** Spalten, die das Portal vom Objekt zeigt (Teilmenge von `properties_portal`). */
export const OBJEKT_PORTAL_SPALTEN = "id,bezeichnung,adresse";
/** Was die RLS einem Mieter aus `einnahmen` gibt (Policy `einnahmen_select_mieter_zugang`). */
export const PORTAL_ZAHLUNG_KATEGORIEN = ["Miete", "Nebenkosten"] as const;

export type PortalMieter = {
  id: string;
  prop_id: string | null;
  vorname: string | null;
  nachname: string | null;
  einheit: string | null;
  flaeche: number | null;
  mietbeginn: string | null;
  mietende: string | null;
  kuendigung: number | null;
  kaltmiete: number | null;
  nk_vorauszahlung: number | null;
  stellplatz: string | null;
  stellplatz_miete: number | null;
  kaution: number | null;
  kaution_status: string | null;
  mietart: string | null;
};
export type PortalObjekt = { id: string; bezeichnung: string | null; adresse: string | null };
export type PortalDokument = { id: string; titel: string | null; kategorie: string | null; datei_name: string | null; created_at: string | null };
export type PortalZahlung = { id: string; buchungsdatum: string | null; kategorie: string | null; betrag: number | null; beschreibung: string | null };
export type PortalBeleg = PortalZahlung & { rechnung_name: string | null };

export type PortalDaten = {
  wohnungen: { m: PortalMieter; p: PortalObjekt | null }[];
  anliegen: AnliegenRow[];
  dokumentAnfragen: AnliegenRow[];
  dateien: DateiRef[];
  freigegebeneDocs: PortalDokument[];
  vermieterAnfragen: PortalAnfrageRow[];
  zaehlerMeldungen: ZaehlerMeldungRow[];
  zahlungen: PortalZahlung[];
  jahr: number;
  summeJahr: number;
  belege: PortalBeleg[];
  /** Nur in der Vorschau: hat der Mieter schon ein verknüpftes Konto? */
  mieterKontoVerknuepft: boolean;
};

/** Eintrag der Mieter-Auswahl in der Vorschau. */
export type VorschauMieter = { id: string; name: string; objekt: string; verknuepft: boolean };

/** Adresse der Vorschau — die EINE Stelle, damit Auswahl und Reiter nicht auseinanderlaufen. */
export function vorschauUrl(mieterId: string, portal: string): string {
  return `/anliegen?tab=vorschau&mieter=${encodeURIComponent(mieterId)}&portal=${encodeURIComponent(portal)}`;
}

export type PortalQuelle =
  | { art: "mieter"; mieterUserId: string }
  | { art: "vermieter"; vermieterId: string; mieterId: string };

// Der Lader braucht nur `from()`; so läuft er mit dem Server-Client UND mit
// der Attrappe aus tests/stubs/actionHarness.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = { from: (tabelle: string) => any };

/** Liegt ein Beleg in der Mietzeit dieses Mietverhältnisses (ganze Kalenderjahre)? */
export function belegInMietzeit(datum: string | null, m: Pick<PortalMieter, "mietbeginn" | "mietende">): boolean {
  if (!datum) return true;
  const d = datum.slice(0, 10);
  if (m.mietbeginn && d < `${m.mietbeginn.slice(0, 4)}-01-01`) return false;
  if (m.mietende && d > `${m.mietende.slice(0, 4)}-12-31`) return false;
  return true;
}

export async function ladePortalDaten(supabase: Db, quelle: PortalQuelle): Promise<PortalDaten> {
  let mieterRows: PortalMieter[] = [];
  let propRows: PortalObjekt[] = [];
  let mieterUserId: string | null = null;

  if (quelle.art === "mieter") {
    mieterUserId = quelle.mieterUserId;
    const { data: zugaenge } = await supabase
      .from("mieter_zugaenge")
      .select("mieter_id,prop_id")
      .eq("user_id", quelle.mieterUserId);
    const mieterIds = ((zugaenge ?? []) as { mieter_id: string; prop_id: string | null }[]).map((z) => z.mieter_id);
    const propIds = Array.from(new Set(((zugaenge ?? []) as { prop_id: string | null }[]).map((z) => z.prop_id).filter(Boolean))) as string[];
    if (mieterIds.length) {
      // Sicht statt Tabelle (Audit 01.10.2026, A4): Ein Mieter sieht nur die
      // Spalten seines Mietverhältnisses — nicht notiz, miethistorie, iban.
      const { data } = await supabase.from("mieter_portal").select(MIETER_PORTAL_SPALTEN).in("id", mieterIds);
      mieterRows = (data ?? []) as PortalMieter[];
    }
    if (propIds.length) {
      const { data } = await supabase.from("properties_portal").select(OBJEKT_PORTAL_SPALTEN).in("id", propIds);
      propRows = (data ?? []) as PortalObjekt[];
    }
  } else {
    // Vorschau: die eigene Mieter-Zeile, aber nur die Spalten der Sicht.
    const { data: m } = await supabase
      .from("mieter")
      .select(MIETER_PORTAL_SPALTEN)
      .eq("user_id", quelle.vermieterId)
      .eq("id", quelle.mieterId)
      .maybeSingle();
    mieterRows = m ? [m as PortalMieter] : [];
    const propId = (m as PortalMieter | null)?.prop_id ?? null;
    if (propId) {
      const { data } = await supabase
        .from("properties")
        .select(OBJEKT_PORTAL_SPALTEN)
        .eq("user_id", quelle.vermieterId)
        .eq("id", propId)
        .maybeSingle();
      propRows = data ? [data as PortalObjekt] : [];
    }
    // Anliegen und Zählermeldungen hängen am KONTO des Mieters, nicht an der
    // Mieter-Zeile. Ohne verknüpftes Konto sieht der Mieter dort nichts — und
    // die Vorschau zeigt genau das.
    const { data: zugang } = await supabase
      .from("mieter_zugaenge")
      .select("user_id")
      .eq("vermieter_id", quelle.vermieterId)
      .eq("mieter_id", quelle.mieterId)
      .limit(1)
      .maybeSingle();
    mieterUserId = (zugang as { user_id: string } | null)?.user_id ?? null;
  }

  const mieterIds = mieterRows.map((m) => m.id);
  const propIds = Array.from(new Set(mieterRows.map((m) => m.prop_id).filter(Boolean))) as string[];
  const propVon = (id: string | null) => propRows.find((p) => p.id === id) ?? null;
  const wohnungen = mieterRows.map((m) => ({ m, p: propVon(m.prop_id) }));

  // Zusätzliche Vermieter-Filter: RLS gäbe dem Vermieter ALLE eigenen Zeilen;
  // hier zählt nur, was dieser eine Mieter sieht.
  const alsV = quelle.art === "vermieter" ? quelle.vermieterId : null;

  let anliegen: AnliegenRow[] = [];
  if (mieterUserId) {
    let q = supabase
      .from("anliegen")
      .select("id,typ,titel,beschreibung,status,antwort,created_at,termin_vorschlaege,termin_bestaetigt")
      .eq("mieter_user_id", mieterUserId);
    if (alsV) q = q.eq("vermieter_id", alsV);
    const { data } = await q.order("created_at", { ascending: false });
    anliegen = (data ?? []) as AnliegenRow[];
  }
  const dokumentAnfragen = anliegen.filter((a) => a.typ === "dokument");

  let dateien: DateiRef[] = [];
  if (anliegen.length) {
    const { data } = await supabase
      .from("anliegen_dateien")
      .select("id,name,anliegen_id")
      .in("anliegen_id", anliegen.map((a) => a.id));
    dateien = (data ?? []) as DateiRef[];
  }

  // Vom Vermieter freigegebene Archiv-Dokumente (RLS beim Mieter: nur mieter_freigabe)
  let freigegebeneDocs: PortalDokument[] = [];
  if (mieterIds.length) {
    let q = supabase
      .from("notizen")
      .select("id,titel,kategorie,datei_name,created_at")
      .in("mieter_id", mieterIds)
      .eq("mieter_freigabe", true);
    if (alsV) q = q.eq("user_id", alsV);
    const { data } = await q.order("created_at", { ascending: false });
    freigegebeneDocs = (data ?? []) as PortalDokument[];
  }

  let vermieterAnfragen: PortalAnfrageRow[] = [];
  if (mieterIds.length) {
    let q = supabase
      .from("vermieter_anfragen")
      .select("id,typ,titel,beschreibung,termin,faellig_bis,status,antwort,created_at")
      .in("mieter_id", mieterIds);
    if (alsV) q = q.eq("vermieter_id", alsV);
    const { data } = await q.order("created_at", { ascending: false }).limit(50);
    vermieterAnfragen = (data ?? []) as PortalAnfrageRow[];
  }

  let zaehlerMeldungen: ZaehlerMeldungRow[] = [];
  if (mieterUserId) {
    let q = supabase
      .from("zaehlerstand_meldungen")
      .select("id,art,zaehlernummer,stand,einheit,ablesedatum,notiz,foto_name,uebernommen_am,created_at")
      .eq("mieter_user_id", mieterUserId);
    if (alsV) q = q.eq("vermieter_id", alsV);
    const { data } = await q.order("ablesedatum", { ascending: false }).limit(50);
    zaehlerMeldungen = (data ?? []) as ZaehlerMeldungRow[];
  }

  // Vom Vermieter im Mietkonto bestätigte Zahlungen (§ 368 BGB). Die RLS gibt
  // dem Mieter nur Miete/Nebenkosten — der Filter steht hier ausdrücklich,
  // damit die Vorschau dasselbe zeigt.
  let zahlungen: PortalZahlung[] = [];
  if (mieterIds.length) {
    let q = supabase
      .from("einnahmen")
      .select("id,buchungsdatum,kategorie,betrag,beschreibung")
      .in("mieter_id", mieterIds)
      .in("kategorie", [...PORTAL_ZAHLUNG_KATEGORIEN]);
    if (alsV) q = q.eq("user_id", alsV);
    const { data } = await q.order("buchungsdatum", { ascending: false }).limit(200);
    zahlungen = (data ?? []) as PortalZahlung[];
  }
  // Jahr in deutscher Zeitzone bestimmen (Server läuft in UTC).
  const jahr = Number(heuteBerlin().slice(0, 4));
  const summeJahr = zahlungen
    .filter((z) => (z.buchungsdatum ?? "").startsWith(String(jahr)))
    .reduce((s, z) => s + (z.betrag ?? 0), 0);

  // Vom Vermieter freigegebene Kosten-Belege (§ 556 Abs. 4 BGB Belegeinsicht)
  let belege: PortalBeleg[] = [];
  if (propIds.length) {
    let q = supabase
      .from("kosten")
      .select("id,buchungsdatum,kategorie,betrag,beschreibung,rechnung_name")
      .in("prop_id", propIds)
      .eq("mieter_freigabe", true);
    if (alsV) q = q.eq("user_id", alsV);
    const { data } = await q.order("buchungsdatum", { ascending: false }).limit(200);
    belege = (data ?? []) as PortalBeleg[];
    // Nur Belege aus der eigenen Mietzeit (1.1. des Einzugsjahres bis 31.12. des
    // Auszugsjahres) — beim Mieter erzwingt das die Datenbank (`mieter_beleg_sichtbar`,
    // Migration 20261002120000), in der Vorschau steht es hier, sonst zeigte sie mehr.
    belege = belege.filter((b) => wohnungen.some(({ m }) => belegInMietzeit(b.buchungsdatum, m)));
  }

  return {
    wohnungen, anliegen, dokumentAnfragen, dateien, freigegebeneDocs, vermieterAnfragen,
    zaehlerMeldungen, zahlungen, jahr, summeJahr, belege,
    mieterKontoVerknuepft: mieterUserId !== null,
  };
}
