"use server";

// Nebenkosten je Objekt und Jahr (Stufe 1, 07.10.2026) — Schreibwege. Rechnung: lib/nkObjekt.ts,
// Lesen: lib/nkPositionen.ts. Tabellen aus Migration 20261007090000 (im SQL-Editor).

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  pruefeKostenEingabe,
  mengeDe,
  vorschlaegeAusVorjahr,
  vorschlaegeAusBuchungen,
  standardSchluessel,
  type NkKostenRoh,
} from "@/lib/nkObjekt";
import { fehltNkTabelle, nkKostenAus, NK_OBJEKT_KOSTEN_SPALTEN } from "@/lib/nkPositionen";
import { nkAusBuchungen } from "@/lib/nkAusBuchungen";
import { zahlDe } from "@/lib/zahl";

type Antwort = { ok: true; anzahl?: number } | { error: string };

const FEHLT = "Die Nebenkosten am Objekt werden gerade eingerichtet — bitte später noch einmal.";
const pfad = (propId: string) => `/properties/${propId}/nebenkosten`;
const jahrOk = (j: number) => Number.isInteger(j) && j >= 2000 && j <= 2100;

type Zugang =
  | { error: string }
  | { supabase: Awaited<ReturnType<typeof createClient>>; user: { id: string }; mieterIds: Set<string> };

/** Angemeldet + Objekt gehört dem Konto. Liefert die Mieter-IDs des Objekts mit. */
async function zugang(propId: string): Promise<Zugang> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Nicht angemeldet." };
  const { data: prop, error } = await supabase
    .from("properties").select("id").eq("id", propId).eq("user_id", user.id).maybeSingle();
  if (error) return { error: "Objekt konnte nicht geladen werden." };
  if (!prop) return { error: "Objekt nicht gefunden." };
  const { data: mieter, error: e2 } = await supabase.from("mieter").select("id").eq("prop_id", propId).eq("user_id", user.id);
  if (e2) return { error: "Mieter konnten nicht geladen werden." };
  return { supabase, user, mieterIds: new Set((mieter ?? []).map((m) => m.id as string)) };
}

const dbFehler = (e: { code?: string; message?: string } | null, standard: string) =>
  fehltNkTabelle(e) ? FEHLT : e?.message?.includes("In der Demo") ? e.message : standard;

/** Grundlagen des Hauses: Gesamtfläche, Einheiten, MEA gesamt, Personen/MEA je Mieter. */
export async function speichereNkGrundlagen(
  propId: string,
  jahr: number,
  eingabe: {
    flaecheGesamt: string; einheiten: string; meaGesamt: string; mieter: Record<string, { personen: string; mea: string }>;
    /** CO₂ laut Brennstoff-/Wärmerechnung für das ganze Gebäude (kg; Kosten in €; Gewerbe = 50/50). */
    co2Kg?: string; co2Kosten?: string; co2Gewerbe?: boolean;
  },
): Promise<Antwort> {
  if (!jahrOk(jahr)) return { error: "Ungültiges Jahr." };
  const z = await zugang(propId);
  if ("error" in z) return z;
  const flaeche = mengeDe(eingabe.flaecheGesamt);
  const einheiten = mengeDe(eingabe.einheiten);
  const mea = mengeDe(eingabe.meaGesamt);
  if (eingabe.flaecheGesamt.trim() && !flaeche) return { error: "Gesamtwohnfläche ist keine gültige Zahl." };
  if (eingabe.einheiten.trim() && (!einheiten || !Number.isInteger(einheiten) || einheiten > 999))
    return { error: "Wohneinheiten bitte als ganze Zahl." };
  if (eingabe.meaGesamt.trim() && !mea) return { error: "MEA gesamt ist keine gültige Zahl." };
  // CO₂: kg ist eine Menge (mengeDe), die Kosten sind Geld (zahlDe).
  const co2Kg = mengeDe(eingabe.co2Kg ?? "");
  const co2Kosten = (eingabe.co2Kosten ?? "").trim() ? zahlDe(eingabe.co2Kosten ?? "") : null;
  if ((eingabe.co2Kg ?? "").trim() && co2Kg == null) return { error: "CO₂-Menge ist keine gültige Zahl." };
  if ((eingabe.co2Kosten ?? "").trim() && (co2Kosten == null || co2Kosten < 0)) return { error: "CO₂-Kosten sind kein gültiger Betrag." };
  const mieter: Record<string, { personen?: number; mea?: number }> = {};
  for (const [id, w] of Object.entries(eingabe.mieter ?? {})) {
    if (!z.mieterIds.has(id)) continue;
    const p = mengeDe(w.personen);
    const m = mengeDe(w.mea);
    if (w.personen?.trim() && (p == null || !Number.isInteger(p) || p > 50)) return { error: "Personen bitte als ganze Zahl." };
    if (w.mea?.trim() && m == null) return { error: "Ein MEA-Wert ist keine gültige Zahl." };
    mieter[id] = { ...(p != null ? { personen: p } : {}), ...(m != null ? { mea: m } : {}) };
  }
  const { data, error } = await z.supabase
    .from("nk_objekt_jahr")
    .upsert(
      {
        user_id: z.user.id, prop_id: propId, jahr, flaeche_gesamt: flaeche || null, einheiten: einheiten || null, mea_gesamt: mea || null, mieter,
        co2_kg: co2Kg || null, co2_kosten: co2Kosten, co2_gewerbe: !!eingabe.co2Gewerbe,
      },
      { onConflict: "prop_id,jahr" },
    )
    .select("id")
    .maybeSingle();
  if (error || !data) return { error: dbFehler(error, "Grundlagen konnten nicht gespeichert werden.") };
  revalidatePath(pfad(propId));
  return { ok: true };
}

/** Eine Kostenart anlegen (ohne id) oder ändern. */
export async function speichereNkKosten(propId: string, jahr: number, roh: NkKostenRoh): Promise<Antwort> {
  if (!jahrOk(jahr)) return { error: "Ungültiges Jahr." };
  const z = await zugang(propId);
  if ("error" in z) return z;
  const p = pruefeKostenEingabe(roh, z.mieterIds);
  if ("error" in p) return p;
  if (roh.id) {
    const { data, error } = await z.supabase
      .from("nk_objekt_kosten")
      .update(p.zeile)
      .eq("id", roh.id).eq("prop_id", propId).eq("user_id", z.user.id)
      .select("id").maybeSingle();
    if (error || !data) return { error: dbFehler(error, "Kostenart konnte nicht gespeichert werden.") };
  } else {
    const { data, error } = await z.supabase
      .from("nk_objekt_kosten")
      .insert({ ...p.zeile, user_id: z.user.id, prop_id: propId, jahr, quelle: "manuell", sort: Date.now() % 2_000_000_000 })
      .select("id").maybeSingle();
    if (error || !data) return { error: dbFehler(error, "Kostenart konnte nicht angelegt werden.") };
  }
  revalidatePath(pfad(propId));
  return { ok: true };
}

export async function loescheNkKosten(propId: string, id: string): Promise<Antwort> {
  const z = await zugang(propId);
  if ("error" in z) return z;
  const { data, error } = await z.supabase
    .from("nk_objekt_kosten").delete().eq("id", id).eq("prop_id", propId).eq("user_id", z.user.id)
    .select("id").maybeSingle();
  if (error || !data) return { error: dbFehler(error, "Kostenart konnte nicht gelöscht werden.") };
  revalidatePath(pfad(propId));
  return { ok: true };
}

/**
 * Vorschläge übernehmen — der Server rechnet sie selbst (kein Betrag vom Browser): aus den
 * gebuchten umlagefähigen Kosten des Jahres oder aus den Kostenarten des Vorjahres. Bereits
 * vorhandene Bezeichnungen bleiben unberührt.
 */
export async function uebernehmeNkVorschlaege(propId: string, jahr: number, art: "buchungen" | "vorjahr"): Promise<Antwort> {
  if (!jahrOk(jahr)) return { error: "Ungültiges Jahr." };
  const z = await zugang(propId);
  if ("error" in z) return z;
  const { data: da, error: e0 } = await z.supabase
    .from("nk_objekt_kosten").select("bezeichnung").eq("prop_id", propId).eq("jahr", jahr).eq("user_id", z.user.id);
  if (e0) return { error: dbFehler(e0, "Vorhandene Kosten konnten nicht geladen werden.") };
  const vorhanden = (da ?? []).map((d) => d.bezeichnung as string);

  let neue: { bezeichnung: string; betrag: number; schluessel: string; umlagefaehig: boolean; art_35a: string | null; quelle: "vorjahr" | "buchungen" }[];
  if (art === "vorjahr") {
    const { data, error } = await z.supabase
      .from("nk_objekt_kosten").select(NK_OBJEKT_KOSTEN_SPALTEN).eq("prop_id", propId).eq("jahr", jahr - 1).eq("user_id", z.user.id)
      .order("sort");
    if (error) return { error: dbFehler(error, "Vorjahr konnte nicht geladen werden.") };
    neue = vorschlaegeAusVorjahr(nkKostenAus((data ?? []) as Record<string, unknown>[]), vorhanden);
  } else {
    const { data, error } = await z.supabase
      .from("kosten").select("prop_id,buchungsdatum,kategorie,betrag").eq("prop_id", propId).eq("user_id", z.user.id)
      .gte("buchungsdatum", `${jahr}-01-01`).lt("buchungsdatum", `${jahr + 1}-01-01`);
    if (error) return { error: "Buchungen konnten nicht geladen werden." };
    neue = vorschlaegeAusBuchungen(nkAusBuchungen(data ?? [], propId, jahr).vorschlaege, vorhanden);
  }
  if (neue.length === 0) return { ok: true, anzahl: 0 };
  const basis = Date.now() % 2_000_000_000;
  const { data: ein, error } = await z.supabase
    .from("nk_objekt_kosten")
    .insert(neue.map((n, i) => ({ ...n, user_id: z.user.id, prop_id: propId, jahr, sort: basis + i })))
    .select("id");
  if (error || !ein) return { error: dbFehler(error, "Vorschläge konnten nicht übernommen werden.") };

  // Personen und MEA je Mieter gelten meist weiter — beim Vorjahr mit übernehmen, wenn das Jahr
  // noch keine eigenen Grundlagen hat.
  if (art === "vorjahr") {
    const { data: gj } = await z.supabase.from("nk_objekt_jahr").select("id").eq("prop_id", propId).eq("jahr", jahr).maybeSingle();
    const { data: vj } = await z.supabase.from("nk_objekt_jahr").select("flaeche_gesamt,einheiten,mea_gesamt,mieter").eq("prop_id", propId).eq("jahr", jahr - 1).maybeSingle();
    if (!gj && vj) {
      const { error: e3 } = await z.supabase.from("nk_objekt_jahr").insert({ ...vj, user_id: z.user.id, prop_id: propId, jahr }).select("id").maybeSingle();
      if (e3) {
        revalidatePath(pfad(propId));
        return { error: "Kosten übernommen, die Grundlagen des Vorjahres aber nicht — bitte prüfen." };
      }
    }
  }
  revalidatePath(pfad(propId));
  return { ok: true, anzahl: ein.length };
}

/** Ergebnis des KI-Imports (/api/nk-ocr) übernehmen — nur Positionen mit Gesamtbetrag des Hauses. */
export async function uebernehmeNkKi(propId: string, jahr: number, json: string): Promise<Antwort> {
  if (!jahrOk(jahr)) return { error: "Ungültiges Jahr." };
  const z = await zugang(propId);
  if ("error" in z) return z;
  let liste: { name?: unknown; gesamt?: unknown }[];
  try {
    const roh = JSON.parse(json);
    liste = Array.isArray(roh) ? roh.slice(0, 60) : [];
  } catch {
    return { error: "Ungültige Daten." };
  }
  const { data: da, error: e0 } = await z.supabase
    .from("nk_objekt_kosten").select("bezeichnung").eq("prop_id", propId).eq("jahr", jahr).eq("user_id", z.user.id);
  if (e0) return { error: dbFehler(e0, "Vorhandene Kosten konnten nicht geladen werden.") };
  const vorhanden = new Set((da ?? []).map((d) => String(d.bezeichnung).trim().toLowerCase()));
  const basis = Date.now() % 2_000_000_000;
  const neue = liste
    .map((p) => ({ name: typeof p.name === "string" ? p.name.trim().slice(0, 120) : "", gesamt: typeof p.gesamt === "number" ? p.gesamt : NaN }))
    .filter((p) => p.name && Number.isFinite(p.gesamt) && p.gesamt >= 0 && p.gesamt < 10_000_000 && !vorhanden.has(p.name.toLowerCase()))
    .map((p, i) => ({
      user_id: z.user.id, prop_id: propId, jahr, bezeichnung: p.name, betrag: Math.round(p.gesamt * 100) / 100,
      schluessel: standardSchluessel(p.name), umlagefaehig: true, quelle: "ki", sort: basis + i,
    }));
  if (neue.length === 0) return { ok: true, anzahl: 0 };
  const { data: ein, error } = await z.supabase.from("nk_objekt_kosten").insert(neue).select("id");
  if (error || !ein) return { error: dbFehler(error, "Positionen konnten nicht übernommen werden.") };
  revalidatePath(pfad(propId));
  return { ok: true, anzahl: ein.length };
}
