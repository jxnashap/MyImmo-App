import Link from "next/link";
import TenantForm from "@/components/TenantForm";
import { createTenant } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";
import { zeigeVerteiler } from "@/lib/umlage";
import { vorgewaehltesObjekt } from "@/lib/objektWahl";

export default async function NewTenantPage(props0: { searchParams: Promise<{ prop?: string; back?: string }> }) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const { data: props } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");
  // Nur ein MITGEGEBENER Rückweg geht ans Formular — ohne ihn landet man nach dem Anlegen auf der
  // Seite des neuen Mieters (dort sitzt die Einladung), nicht in der Liste.
  const back = searchParams.back || "/tenants";
  const propId = vorgewaehltesObjekt(props ?? [], searchParams.prop);

  // Paket D (06.10.2026): Bei einem Objekt mit EINER Wohneinheit (ETW, EFH) stehen Wohnfläche und
  // Miete schon am Objekt — vorbelegen statt neu tippen. Bei Mehrparteienhäusern nicht: Dort sind
  // Objektfläche und -miete Summen über alle Wohnungen und als Mieterwert falsch.
  let vorbelegung: { flaeche: number | null; kaltmiete: number | null } | undefined;
  if (propId) {
    const { data: o } = await supabase.from("properties").select("flaeche,miete,typ,einheiten_anzahl").eq("id", propId).maybeSingle();
    if (o && !zeigeVerteiler({ typ: o.typ, einheiten_anzahl: o.einheiten_anzahl ?? null, mieter: [] })) {
      vorbelegung = { flaeche: o.flaeche ?? null, kaltmiete: o.miete ?? null };
    }
  }

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px", whiteSpace: "nowrap", flexShrink: 0 }}>← Zurück</Link>
          <div><div className="topbar-title">Neuer Mieter</div></div>
        </div>
      </div>
      <TenantForm action={createTenant} properties={props ?? []} submitLabel="Anlegen" propInitial={propId} back={searchParams.back ? back : undefined} vorbelegung={vorbelegung} />
    </div>
  );
}
