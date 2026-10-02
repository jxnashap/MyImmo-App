import { createClient } from "@/lib/supabase/server";
import AnlageVExport from "@/components/AnlageVExport";
import type { Einnahme, Kosten, Kredit, Property } from "@/lib/types";
import type { MieterNkVertrag } from "@/lib/anlageV";
import SteuerWaechter from "@/components/SteuerWaechter";
import { steuerWaechter } from "@/lib/steuer/waechter";
import { heuteBerlin } from "@/lib/zeitraum";

export const dynamic = "force-dynamic";

export default async function SteuerPage() {
  const supabase = await createClient();
  const [{ data: props }, { data: ein }, { data: kos }, { data: kre }, { data: mie }] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("einnahmen").select("id,prop_id,buchungsdatum,kategorie,betrag,nk_anteil"),
    supabase.from("kosten").select("id,prop_id,buchungsdatum,kategorie,betrag"),
    supabase.from("kredite").select("id,prop_id,restschuld,zinssatz"),
    // Nur für die Plausibilitätsprüfung der Umlagen (lib/anlageV.ts).
    supabase.from("mieter").select("prop_id,nk_vorauszahlung,mietbeginn,mietende"),
  ]);

  const properties = (props ?? []) as Property[];
  const kosten = (kos ?? []) as Kosten[];
  const waechter = steuerWaechter(
    properties.map((p) => ({ id: p.id, bezeichnung: p.bezeichnung, typ: p.typ, kaufpreis: p.kaufpreis, kaufdatum: p.kaufdatum, afa_gebaeudeanteil: p.afa_gebaeudeanteil })),
    kosten.map((k) => ({ prop_id: k.prop_id ?? null, buchungsdatum: k.buchungsdatum, kategorie: k.kategorie, betrag: k.betrag })),
    new Date(`${heuteBerlin()}T00:00:00Z`),
  );

  return (
    <AnlageVExport
      waechter={<SteuerWaechter zeilen={waechter} />}
      properties={(props ?? []) as Property[]}
      einnahmen={(ein ?? []) as Einnahme[]}
      kosten={(kos ?? []) as Kosten[]}
      kredite={(kre ?? []) as Kredit[]}
      mieter={(mie ?? []) as MieterNkVertrag[]}
    />
  );
}
