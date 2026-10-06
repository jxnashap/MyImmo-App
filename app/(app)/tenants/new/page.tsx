import Link from "next/link";
import TenantForm from "@/components/TenantForm";
import { createTenant } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";
import { zeigeVerteiler } from "@/lib/umlage";

export default async function NewTenantPage(props0: { searchParams: Promise<{ prop?: string; back?: string }> }) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const { data: props } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");
  const back = searchParams.back || "/tenants";

  // Paket D (06.10.2026): Bei einem Objekt mit EINER Wohneinheit (ETW, EFH) stehen Wohnfläche und
  // Miete schon am Objekt — vorbelegen statt neu tippen. Bei Mehrparteienhäusern nicht: Dort sind
  // Objektfläche und -miete Summen über alle Wohnungen und als Mieterwert falsch.
  let vorbelegung: { flaeche: number | null; kaltmiete: number | null } | undefined;
  if (searchParams.prop) {
    const { data: o } = await supabase.from("properties").select("flaeche,miete,typ,einheiten_anzahl").eq("id", searchParams.prop).maybeSingle();
    if (o && !zeigeVerteiler({ typ: o.typ, einheiten_anzahl: o.einheiten_anzahl ?? null, mieterAnzahl: 0 })) {
      vorbelegung = { flaeche: o.flaeche ?? null, kaltmiete: o.miete ?? null };
    }
  }

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Neuer Mieter</div></div>
        </div>
      </div>
      <TenantForm action={createTenant} properties={props ?? []} submitLabel="Anlegen" propInitial={searchParams.prop ?? ""} back={back} vorbelegung={vorbelegung} />
    </div>
  );
}
