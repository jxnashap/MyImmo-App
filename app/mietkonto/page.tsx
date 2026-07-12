import { createClient } from "@/lib/supabase/server";
import RueckstandWaechter from "@/components/RueckstandWaechter";
import { sollFuerMonat, zuJahrMonat } from "@/lib/mietkonto";
import MietkontoBestaetigung, {
  type MietkontoZeile,
  type NacherfassungMieter,
} from "@/components/MietkontoBestaetigung";
import type { Tenant, MietZeitraum, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

// Mietkonto: je Monat die erwarteten Mieteingänge sehen und per Klick
// bestätigen — plus Nacherfassen-Modus für offene Vormonate (bis 10 Jahre).
// Soll-Beträge kommen aus lib/mietkonto.ts (Miet-Zeiträume + Fallback).

export default async function MietkontoPage({
  searchParams,
}: {
  searchParams: { monat?: string };
}) {
  const supabase = createClient();

  const jetzt = new Date();
  const aktuellerMonat = `${jetzt.getFullYear()}-${String(jetzt.getMonth() + 1).padStart(2, "0")}`;
  const monat = /^\d{4}-\d{2}$/.test(searchParams.monat ?? "") ? searchParams.monat! : aktuellerMonat;

  const [{ data: mieterRows }, { data: zrRows }, { data: einnRows }, { data: propRows }] =
    await Promise.all([
      supabase.from("mieter").select("*").order("nachname"),
      supabase.from("miet_zeitraeume").select("*"),
      // Alle Miet-Einnahmen (für Monats-Dedup UND Nacherfassung bis 10 Jahre)
      supabase
        .from("einnahmen")
        .select("mieter_id,buchungsdatum,kategorie")
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
    const ym = zuJahrMonat(e.buchungsdatum);
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

    // Monats-Modus
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

    // Nacherfassen-Modus: Engine läuft clientseitig (Startmonat wählbar),
    // hier nur die Rohdaten mitgeben.
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

  return (
    <>
      <RueckstandWaechter />
      <MietkontoBestaetigung
        monat={monat}
        aktuellerMonat={aktuellerMonat}
        zeilen={zeilen}
        nacherfassung={nacherfassung}
      />
    </>
  );
}
