// Beleihungsordner eines Objekts: Checkliste aller Bank-Unterlagen mit
// Upload/Abhaken/Fortschritt + „Aus MyImmo erzeugen" + Deckblatt-PDF +
// Freigabe-Links für die Bank (Phase 2) inkl. Rückmeldungen.
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BeleihungsOrdner from "@/components/BeleihungsOrdner";
import type { BelDok } from "@/lib/beleihung";
import type { Freigabe } from "@/lib/actions/beleihung";

export const dynamic = "force-dynamic";

export default async function BeleihungPage({ params }: { params: { id: string } }) {
  const supabase = createClient();

  const [{ data: prop }, { data: mieter }, { data: kredite }, { data: docs }, { data: freigaben }] =
    await Promise.all([
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
      supabase
        .from("beleihung_freigaben")
        .select("token,item_keys,ablauf,aktiv,created_at")
        .eq("prop_id", params.id)
        .order("created_at", { ascending: false }),
    ]);
  if (!prop) notFound();

  // Rückmeldungen der Bank zu den Freigaben dieses Objekts (RLS: nur eigene).
  const tokens = (freigaben ?? []).map((f) => f.token);
  const { data: rueckmeldungen } = tokens.length
    ? await supabase
        .from("beleihung_rueckmeldungen")
        .select("id,token,name,bank,kontakt,nachricht,fehlend,created_at")
        .in("token", tokens)
        .order("created_at", { ascending: false })
    : { data: [] };

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
      initialFreigaben={(freigaben ?? []) as Freigabe[]}
      rueckmeldungen={(rueckmeldungen ?? []) as never[]}
      defaults={{
        darlehen: restschuld > 0 ? String(Math.round(restschuld)) : prop.kaufpreis ? String(Math.round(prop.kaufpreis)) : "",
        wunschrate: rate > 0 ? String(Math.round(rate)) : "",
        eigenkapital: "",
      }}
    />
  );
}
