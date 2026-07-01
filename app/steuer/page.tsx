import { createClient } from "@/lib/supabase/server";
import AnlageVExport from "@/components/AnlageVExport";
import type { Einnahme, Kosten, Kredit, Property } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function SteuerPage() {
  const supabase = createClient();
  const [{ data: props }, { data: ein }, { data: kos }, { data: kre }] = await Promise.all([
    supabase.from("properties").select("*").order("bezeichnung"),
    supabase.from("einnahmen").select("id,prop_id,buchungsdatum,kategorie,betrag,nk_anteil"),
    supabase.from("kosten").select("id,prop_id,buchungsdatum,kategorie,betrag"),
    supabase.from("kredite").select("id,prop_id,restschuld,zinssatz"),
  ]);

  return (
    <AnlageVExport
      properties={(props ?? []) as Property[]}
      einnahmen={(ein ?? []) as Einnahme[]}
      kosten={(kos ?? []) as Kosten[]}
      kredite={(kre ?? []) as Kredit[]}
    />
  );
}
