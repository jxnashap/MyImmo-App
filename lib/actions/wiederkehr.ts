"use server";

import { createClient } from "@/lib/supabase/server";
import {
  termine, betragFuerDatum, heuteIso, istZyklus, type Zyklus, type Periode,
} from "@/lib/wiederkehr";

// Erzeugt alle fälligen, noch fehlenden wiederkehrenden Buchungen (Mieten +
// Kosten) vom Startdatum bis heute (max. 10 Jahre zurück). Idempotent: pro
// Reihe (reihe_id) und Datum existiert dank Unique-Index höchstens eine Zeile;
// es werden nur fehlende Termine eingefügt. Wird beim Öffnen der Listen/Dashboard
// aufgerufen.
export async function generiereBuchungen(): Promise<void> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const heute = heuteIso();

  // ---------- MIETEN (Einnahmen) ----------
  const [{ data: mieterRows }, { data: verlaufRows }, { data: vorhandenEinn }] = await Promise.all([
    supabase.from("mieter").select("id,prop_id,mietbeginn,mietende,kaltmiete,nk_vorauszahlung,zyklus"),
    supabase.from("mietverlauf").select("mieter_id,von,bis,betrag"),
    supabase.from("einnahmen").select("mieter_id,buchungsdatum,kategorie").eq("kategorie", "Miete").not("mieter_id", "is", null),
  ]);

  const verlaufNach = new Map<string, Periode[]>();
  for (const r of verlaufRows ?? []) {
    const arr = verlaufNach.get(r.mieter_id) ?? [];
    arr.push({ von: r.von as string, bis: (r.bis as string | null) ?? null, betrag: Number(r.betrag) });
    verlaufNach.set(r.mieter_id, arr);
  }
  // Pro Mieter: Monate (YYYY-MM), die bereits eine „Miete"-Einnahme haben.
  // Verhindert Doppelbuchung — auch gegen bereits manuell erfasste Mieten.
  const monatVorhanden = new Map<string, Set<string>>();
  for (const e of vorhandenEinn ?? []) {
    const mid = e.mieter_id as string;
    const set = monatVorhanden.get(mid) ?? new Set<string>();
    set.add((e.buchungsdatum as string).slice(0, 7));
    monatVorhanden.set(mid, set);
  }

  const neueEinnahmen: Record<string, unknown>[] = [];
  for (const m of mieterRows ?? []) {
    const start = m.mietbeginn as string | null;
    if (!start) continue;
    const zyklus: Zyklus = istZyklus(m.zyklus) ? m.zyklus : "monatlich";
    const ende = (m.mietende as string | null) ?? null;

    let perioden = (verlaufNach.get(m.id as string) ?? []).sort((a, b) => a.von.localeCompare(b.von));
    if (perioden.length === 0) {
      const warm = (Number(m.kaltmiete) || 0) + (Number(m.nk_vorauszahlung) || 0);
      if (warm <= 0) continue;
      perioden = [{ von: start, bis: null, betrag: warm }];
    }

    const vorhandeneMonate = monatVorhanden.get(m.id as string) ?? new Set<string>();
    for (const t of termine(start, zyklus, heute, ende, 10)) {
      if (vorhandeneMonate.has(t.slice(0, 7))) continue;
      const betrag = betragFuerDatum(perioden, t);
      if (betrag == null || betrag <= 0) continue;
      neueEinnahmen.push({
        user_id: user.id,
        prop_id: m.prop_id ?? null,
        mieter_id: m.id,
        reihe_id: m.id,
        buchungsdatum: t,
        kategorie: "Miete",
        betrag,
        beschreibung: "Miete (automatisch)",
        zyklus,
        start_datum: start,
        end_datum: ende,
        aktiv: true,
      });
    }
  }
  if (neueEinnahmen.length) {
    await supabase.from("einnahmen").insert(neueEinnahmen);
  }

  // ---------- KOSTEN (manuelle Wiederkehr) ----------
  const { data: kostenReihen } = await supabase
    .from("kosten")
    .select("reihe_id,prop_id,mieter_id,kategorie,beschreibung,betrag,zyklus,start_datum,end_datum,aktiv,buchungsdatum")
    .not("reihe_id", "is", null);

  // Pro Reihe: Vorlage (frühester Termin) + vorhandene Daten sammeln.
  type Vorlage = { reihe_id: string; prop_id: string | null; mieter_id: string | null; kategorie: string | null; beschreibung: string | null; betrag: number; zyklus: string | null; start_datum: string | null; end_datum: string | null; aktiv: boolean };
  const vorlagen = new Map<string, Vorlage>();
  const vorhandenKosten = new Map<string, Set<string>>();
  for (const k of kostenReihen ?? []) {
    const rid = k.reihe_id as string;
    const set = vorhandenKosten.get(rid) ?? new Set<string>();
    set.add(k.buchungsdatum as string);
    vorhandenKosten.set(rid, set);
    const vor = vorlagen.get(rid);
    if (!vor || (k.buchungsdatum as string) < (vor.start_datum ?? "9999")) {
      vorlagen.set(rid, {
        reihe_id: rid,
        prop_id: (k.prop_id as string | null) ?? null,
        mieter_id: (k.mieter_id as string | null) ?? null,
        kategorie: (k.kategorie as string | null) ?? null,
        beschreibung: (k.beschreibung as string | null) ?? null,
        betrag: Number(k.betrag) || 0,
        zyklus: (k.zyklus as string | null) ?? null,
        start_datum: (k.start_datum as string | null) ?? (k.buchungsdatum as string | null),
        end_datum: (k.end_datum as string | null) ?? null,
        aktiv: (k.aktiv as boolean) ?? true,
      });
    }
  }

  const neueKosten: Record<string, unknown>[] = [];
  for (const v of vorlagen.values()) {
    if (!v.aktiv || !istZyklus(v.zyklus) || !v.start_datum || v.betrag <= 0) continue;
    const vorhanden = vorhandenKosten.get(v.reihe_id) ?? new Set<string>();
    for (const t of termine(v.start_datum, v.zyklus, heute, v.end_datum, 10)) {
      if (vorhanden.has(t)) continue;
      neueKosten.push({
        user_id: user.id,
        prop_id: v.prop_id,
        mieter_id: v.mieter_id,
        reihe_id: v.reihe_id,
        buchungsdatum: t,
        kategorie: v.kategorie,
        beschreibung: v.beschreibung,
        betrag: v.betrag,
        zyklus: v.zyklus,
        start_datum: v.start_datum,
        end_datum: v.end_datum,
        aktiv: true,
      });
    }
  }
  if (neueKosten.length) {
    await supabase.from("kosten").insert(neueKosten);
  }
}
