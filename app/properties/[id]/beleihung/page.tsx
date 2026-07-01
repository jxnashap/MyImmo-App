// Beleihungsordner eines Objekts: Checkliste aller Bank-Unterlagen mit
// Upload/Abhaken/Fortschritt + „Aus MyImmo erzeugen" + Deckblatt-PDF.
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BeleihungsOrdner from "@/components/BeleihungsOrdner";
import type { BelDok } from "@/lib/beleihung";

export const dynamic = "force-dynamic";

export default async function BeleihungPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: prop }, { data: mieter }, { data: kredite }, { data: docs }] = await Promise.all([
    supabase
      .from("properties")
      .select("id,bezeichnung,adresse,typ,baujahr,flaeche,kaufpreis,wert,miete")
      .eq("id", params.id)
      .single(),
    supabase.from("mieter").select("id,mietende").eq("prop_id", params.id),
    supabase
      .from("kredite")
      .select("betrag,restschuld,zinssatz,tilgungssatz,monatsrate")
      .eq("prop_id", params.id),
    supabase
      .from("beleihung_dokumente")
      .select("item_key,status,notiz,datum,datei_name,datei_type,datei_size")
      .eq("prop_id", params.id),
  ]);
  if (!prop) notFound();

  const hatMieter = (mieter ?? []).some((m) => !m.mietende || new Date(m.mietende) >= new Date());
  const restschuld = (kredite ?? []).reduce((s, k) => s + (k.restschuld ?? k.betrag ?? 0), 0);
  const rate = (kredite ?? []).reduce((s, k) => s + (k.monatsrate ?? 0), 0);

  return (
    <BeleihungsOrdner
      propId={prop.id}
      objektName={prop.bezeichnung}
      istEtw={prop.typ === "Eigentumswohnung"}
      hatMieter={hatMieter}
      initialDocs={(docs ?? []) as BelDok[]}
      defaults={{
        darlehen: restschuld > 0 ? String(Math.round(restschuld)) : prop.kaufpreis ? String(Math.round(prop.kaufpreis)) : "",
        wunschrate: rate > 0 ? String(Math.round(rate)) : "",
        eigenkapital: "",
      }}
    />
  );
}
