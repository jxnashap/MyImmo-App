// EINE Stelle, die entscheidet, mit welchen Positionen die NK-Abrechnung eines Mieters rechnet
// (Stufe 1, 07.10.2026). Benutzt von der NK-Seite, dem PDF und der Beleihungs-Mappe.
//
// Regel: Gibt es für Objekt + Jahr Kosten am OBJEKT (nk_objekt_kosten), gelten nur diese —
// verteilt über lib/nkObjekt.ts. Sonst die alten Positionen beim Mieter (mieter_positionen,
// Altbestand). Beides zu mischen hieße, dieselbe Kostenart doppelt abzurechnen.
//
// Fehlt die Tabelle (Migration noch nicht im SQL-Editor ausgeführt), gilt der Altbestand.

import type { SupabaseClient } from "@supabase/supabase-js";
import { NK_POSITION_SPALTEN, type NkRawPosition } from "@/lib/nk";
import { zeigeVerteiler } from "@/lib/umlage";
import type { NkCo2, NkCo2Input } from "@/lib/nk";
import {
  verteileObjektKosten,
  positionenFuerMieter,
  co2FuerMieter,
  istSchluessel,
  type NkObjektBasis,
  type NkObjektKosten,
  type NkObjektMieter,
  type NkObjektErgebnis,
} from "@/lib/nkObjekt";

type DbFehler = { code?: string } | null;
/** Tabelle fehlt: Postgres 42P01, PostgREST PGRST205. */
export const fehltNkTabelle = (e: DbFehler) => e?.code === "42P01" || e?.code === "PGRST205";

export const NK_OBJEKT_KOSTEN_SPALTEN = "id,bezeichnung,betrag,schluessel,umlagefaehig,lohnanteil,art_35a,nenner,werte,quelle,sort";

export type NkObjektDaten = {
  /** false = Tabelle fehlt (Migration offen). */
  bereit: boolean;
  basis: NkObjektBasis;
  kosten: (NkObjektKosten & { quelle: string | null })[];
  mieter: NkObjektMieter[];
};

export const nkKostenAus = (rows: Record<string, unknown>[]): NkObjektDaten["kosten"] =>
  rows.map((r) => ({
    id: String(r.id),
    bezeichnung: String(r.bezeichnung ?? ""),
    betrag: Number(r.betrag) || 0,
    schluessel: istSchluessel(r.schluessel) ? r.schluessel : "flaeche",
    umlagefaehig: r.umlagefaehig !== false,
    lohnanteil: r.lohnanteil == null ? null : Number(r.lohnanteil),
    art_35a: (r.art_35a as string | null) ?? null,
    nenner: r.nenner == null ? null : Number(r.nenner),
    werte: (r.werte as Record<string, number> | null) ?? {},
    quelle: (r.quelle as string | null) ?? null,
  }));

/** Kosten, Grundlagen und Mieter eines Objekts für ein Jahr. */
export async function ladeNkObjekt(supabase: SupabaseClient, propId: string, jahr: number): Promise<NkObjektDaten> {
  const [{ data: kosten, error: e1 }, { data: basis, error: e2 }, { data: mieter }] = await Promise.all([
    supabase.from("nk_objekt_kosten").select(NK_OBJEKT_KOSTEN_SPALTEN).eq("prop_id", propId).eq("jahr", jahr)
      .order("sort").order("created_at"),
    supabase.from("nk_objekt_jahr").select("flaeche_gesamt,einheiten,mea_gesamt,mieter,co2_kg,co2_kosten,co2_gewerbe").eq("prop_id", propId).eq("jahr", jahr).maybeSingle(),
    supabase.from("mieter").select("id,vorname,nachname,einheit,flaeche,mietbeginn,mietende").eq("prop_id", propId).order("mietbeginn"),
  ]);
  if (fehltNkTabelle(e1) || fehltNkTabelle(e2)) return { bereit: false, basis: leereBasis(), kosten: [], mieter: [] };
  if (e1 || e2) throw new Error("Nebenkosten des Objekts konnten nicht geladen werden.");
  return {
    bereit: true,
    basis: basis
      ? {
          flaeche_gesamt: basis.flaeche_gesamt == null ? null : Number(basis.flaeche_gesamt),
          einheiten: basis.einheiten == null ? null : Number(basis.einheiten),
          mea_gesamt: basis.mea_gesamt == null ? null : Number(basis.mea_gesamt),
          mieter: (basis.mieter as NkObjektBasis["mieter"]) ?? {},
          co2_kg: basis.co2_kg == null ? null : Number(basis.co2_kg),
          co2_kosten: basis.co2_kosten == null ? null : Number(basis.co2_kosten),
          co2_gewerbe: !!basis.co2_gewerbe,
        }
      : leereBasis(),
    kosten: nkKostenAus((kosten ?? []) as Record<string, unknown>[]),
    mieter: (mieter ?? []).map((m) => ({
      id: m.id as string,
      name: ([m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter") + (m.einheit ? ` (${m.einheit})` : ""),
      flaeche: m.flaeche == null ? null : Number(m.flaeche),
      mietbeginn: m.mietbeginn as string | null,
      mietende: m.mietende as string | null,
    })),
  };
}

const leereBasis = (): NkObjektBasis => ({ flaeche_gesamt: null, einheiten: null, mea_gesamt: null, mieter: {} });

/**
 * Grundlagen mit Rückfall auf die Stammdaten des Objekts — ein neues Jahr soll nicht mit leeren
 * Feldern beginnen, wenn Fläche und Einheiten am Objekt längst stehen.
 */
export function basisMitStammdaten(
  b: NkObjektBasis,
  prop: { flaeche?: number | null; einheiten_anzahl?: number | null },
): NkObjektBasis {
  return {
    ...b,
    flaeche_gesamt: b.flaeche_gesamt ?? (prop.flaeche ? Number(prop.flaeche) : null),
    einheiten: b.einheiten ?? (prop.einheiten_anzahl ? Number(prop.einheiten_anzahl) : null),
  };
}

export type NkPositionenFuerMieter = {
  positionen: NkRawPosition[];
  /** "objekt" = Kosten am Objekt gelten · "mieter" = Altbestand beim Mieter. */
  quelle: "objekt" | "mieter";
  /** Alle Positionen beim Mieter (für Vorjahr-Hilfe und den Hinweis auf Altbestand). */
  mieterPositionen: (NkRawPosition & { id: string })[];
  /** Positionen beim Mieter für das Jahr, die wegen der Objekt-Kosten NICHT zählen. */
  uebergangen: number;
  /** Die Tabellen für Kosten am Objekt existieren (Migration ausgeführt). */
  objektBereit: boolean;
  /**
   * Mehrfamilienhaus mit Nebenkosten am Objekt: CO₂ kommt NUR vom Objekt (`co2`, ggf. null) — die
   * Werte im Mieter-Block (nk_co2) sind dort Gebäudewerte je Mieter und ergäben eine mehrfache
   * Gutschrift (Audit 07.10.2026, A4). false = Einzelobjekt, der Mieter-Block gilt.
   */
  co2AmObjekt: boolean;
  co2: NkCo2 | null;
  /** Hinweise für die Abrechnung (z. B. CO₂). */
  hinweise: string[];
};

/** Positionen, mit denen die Abrechnung eines Mieters rechnet. */
export async function ladeNkPositionen(
  supabase: SupabaseClient,
  mieter: { id: string; prop_id: string | null },
  jahr: number,
  prop?: { flaeche?: number | null; einheiten_anzahl?: number | null; typ?: string | null } | null,
): Promise<NkPositionenFuerMieter> {
  const { data: alt } = await supabase
    .from("mieter_positionen")
    .select(NK_POSITION_SPALTEN)
    .eq("mieter_id", mieter.id)
    .order("created_at");
  const mieterPositionen = (alt ?? []) as unknown as (NkRawPosition & { id: string })[];
  const altbestand = (objektBereit: boolean) =>
    ({ positionen: mieterPositionen as NkRawPosition[], quelle: "mieter" as const, mieterPositionen, uebergangen: 0, objektBereit, co2AmObjekt: false, co2: null, hinweise: [] });
  if (!mieter.prop_id) return altbestand(false);

  const daten = await ladeNkObjekt(supabase, mieter.prop_id, jahr);
  if (!daten.bereit) return altbestand(false);

  let stamm = prop;
  if (!stamm || stamm.typ === undefined) {
    const { data } = await supabase.from("properties").select("flaeche,einheiten_anzahl,typ").eq("id", mieter.prop_id).maybeSingle();
    stamm = data ?? {};
  }
  const mfh = zeigeVerteiler({ typ: stamm.typ ?? null, einheiten_anzahl: stamm.einheiten_anzahl ?? null, mieterAnzahl: daten.mieter.length });
  const e = verteileObjektKosten(jahr, basisMitStammdaten(daten.basis, stamm), daten.kosten, daten.mieter);
  // CO₂ im Mehrfamilienhaus nur vom Objekt — auch wenn die Positionen noch beim Mieter stehen.
  const co2 = mfh ? co2FuerMieter(e, mieter.id) : null;
  const hinweise = mfh ? e.warnungen.filter((w) => w.startsWith("CO₂")) : [];
  if (daten.kosten.length === 0) {
    return { ...altbestand(true), co2AmObjekt: mfh, co2, hinweise };
  }
  return {
    positionen: positionenFuerMieter(e, mieter.id),
    quelle: "objekt",
    mieterPositionen,
    uebergangen: mieterPositionen.filter((p) => p.jahr === jahr || p.jahr == null).length,
    objektBereit: true,
    co2AmObjekt: mfh,
    co2,
    hinweise: mfh ? e.warnungen : [],
  };
}

export type { NkObjektErgebnis };

/**
 * Werden die Nebenkosten dieses Objekts am OBJEKT erfasst? Ja, wenn es mehrere Mietparteien hat
 * (zeigeVerteiler) und die Tabellen existieren. Eine Regel für Objektseite, Verteiler,
 * „Mieter bearbeiten“ und NK-Seite.
 */
export async function nkAmObjekt(supabase: SupabaseClient, propId: string | null | undefined): Promise<boolean> {
  if (!propId) return false;
  const [{ data: prop }, { count }, { error }] = await Promise.all([
    supabase.from("properties").select("typ,einheiten_anzahl").eq("id", propId).maybeSingle(),
    supabase.from("mieter").select("id", { count: "exact", head: true }).eq("prop_id", propId),
    supabase.from("nk_objekt_kosten").select("id", { count: "exact", head: true }).eq("prop_id", propId),
  ]);
  if (!prop || error) return false;
  return zeigeVerteiler({ typ: prop.typ as string | null, einheiten_anzahl: prop.einheiten_anzahl as number | null, mieterAnzahl: count ?? 0 });
}

/**
 * CO₂-Argumente für `berechneNk` — EINE Regel für NK-Seite, PDF, Beleihungs-Mappe und Objektseite.
 * Einzelobjekt: der CO₂-Block beim Mieter. Mehrfamilienhaus: nur die Aufteilung am Objekt; ein
 * Block beim Mieter zählt dort nicht mehr (Gebäudewerte je Mieter = mehrfache Gutschrift).
 */
export function nkCo2Argumente(
  nkPos: Pick<NkPositionenFuerMieter, "co2AmObjekt" | "co2" | "hinweise">,
  co2Row: NkCo2Input | null | undefined,
): { co2Input: NkCo2Input | null; opts: { co2?: NkCo2 | null; hinweise: string[] } } {
  if (!nkPos.co2AmObjekt) return { co2Input: co2Row ?? null, opts: { hinweise: nkPos.hinweise } };
  const hinweise = [...nkPos.hinweise];
  if (!nkPos.co2 && co2Row && (co2Row.co2_kg ?? 0) > 0) {
    hinweise.push(
      "Im Mehrfamilienhaus wird CO₂ einmal für das ganze Gebäude erfasst (Nebenkosten am Objekt → Grundlagen). Die CO₂-Werte beim Mieter zählen nicht mehr — bis sie am Objekt stehen, fehlt die Gutschrift nach CO2KostAufG.",
    );
  }
  return { co2Input: null, opts: { co2: nkPos.co2, hinweise } };
}
