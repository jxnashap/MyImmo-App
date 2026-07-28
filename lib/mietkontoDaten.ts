import "server-only";
import { createClient } from "@/lib/supabase/server";
import { sollFuerMonat, zuJahrMonat } from "@/lib/mietkonto";
import type { MietkontoZeile, NacherfassungMieter } from "@/components/MietkontoBestaetigung";
import type { Tenant, MietZeitraum, Property } from "@/lib/types";

// Datenbeschaffung für das Mietkonto — von /mietkonto UND von der Karte in
// „Ein- & Ausgaben" genutzt, damit beide Ansichten garantiert dieselben
// Soll-Beträge und denselben Bestätigt-Stand zeigen.

export type MietkontoDaten = {
  zeilen: MietkontoZeile[];
  nacherfassung: NacherfassungMieter[];
};

export async function ladeMietkonto(monat: string): Promise<MietkontoDaten> {
  const supabase = createClient();
  const [{ data: mieterRows }, { data: zrRows }, { data: einnRows }, { data: propRows }] =
    await Promise.all([
      supabase.from("mieter").select("*").order("nachname"),
      supabase.from("miet_zeitraeume").select("*"),
      supabase
        .from("einnahmen")
        .select("mieter_id,buchungsdatum,kategorie,soll_monat")
        .eq("kategorie", "Miete"),
      supabase.from("properties").select("id,bezeichnung"),
    ]);

  const mieter = (mieterRows ?? []) as Tenant[];
  const zeitraeume = (zrRows ?? []) as MietZeitraum[];
  const einnahmen = einnRows ?? [];
  const propName = new Map(
    ((propRows ?? []) as Pick<Property, "id" | "bezeichnung">[]).map((p) => [p.id, p.bezeichnung]),
  );

  // Gebuchte Monate je Mieter (YYYY-MM) — eine Quelle für beide Modi.
  const gebuchtProMieter = new Map<string, Set<string>>();
  for (const e of einnahmen) {
    const ym = e.soll_monat ?? zuJahrMonat(e.buchungsdatum);
    if (!ym || !e.mieter_id) continue;
    if (!gebuchtProMieter.has(e.mieter_id)) gebuchtProMieter.set(e.mieter_id, new Set());
    gebuchtProMieter.get(e.mieter_id)!.add(ym);
  }

  const zeilen: MietkontoZeile[] = [];
  const nacherfassung: NacherfassungMieter[] = [];

  for (const m of mieter) {
    const zr = zeitraeume.filter((z) => z.mieter_id === m.id);
    const name = [m.vorname, m.nachname].filter(Boolean).join(" ") || "Mieter";
    const objekt =
      [m.prop_id ? propName.get(m.prop_id) : null, m.einheit].filter(Boolean).join(" · ") || "—";

    const soll = sollFuerMonat(m, zr, monat);
    if (soll && soll.gesamt > 0) {
      zeilen.push({
        mieterId: m.id,
        propId: m.prop_id,
        name,
        objekt,
        kaltmiete: soll.kaltmiete,
        nk: soll.nk,
        stellplatz: soll.stellplatz,
        gesamt: soll.gesamt,
        schonGebucht: gebuchtProMieter.get(m.id)?.has(monat) ?? false,
      });
    }

    if (m.mietbeginn && ((m.kaltmiete ?? 0) + (m.nk_vorauszahlung ?? 0) > 0 || zr.length > 0)) {
      nacherfassung.push({
        mieterId: m.id,
        propId: m.prop_id,
        name,
        objekt,
        mieter: {
          kaltmiete: m.kaltmiete,
          nk_vorauszahlung: m.nk_vorauszahlung,
          stellplatz_miete: m.stellplatz_miete ?? null,
          mietbeginn: m.mietbeginn,
          mietende: m.mietende,
        },
        zeitraeume: zr.map((z) => ({
          von: z.von,
          bis: z.bis,
          kaltmiete: z.kaltmiete,
          nk_vorauszahlung: z.nk_vorauszahlung,
          stellplatz_miete: z.stellplatz_miete,
        })),
        gebuchteMonate: Array.from(gebuchtProMieter.get(m.id) ?? []),
      });
    }
  }

  return { zeilen, nacherfassung };
}
