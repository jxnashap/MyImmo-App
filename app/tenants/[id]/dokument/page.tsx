import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DocGenerator from "@/components/DocGenerator";
import type { Tenant, Property, VermieterProfil, Iban } from "@/lib/types";

export default async function DokumentPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from("mieter").select("*").eq("id", params.id).single();
  if (!m) notFound();
  const tenant = m as Tenant;

  const [{ data: prop }, { data: vp }, { data: ibanRows }, { data: vorlagenRows }] = await Promise.all([
    tenant.prop_id ? supabase.from("properties").select("*").eq("id", tenant.prop_id).single() : Promise.resolve({ data: null }),
    user ? supabase.from("vermieter_profil").select("*").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
    supabase.from("ibans").select("*").order("created_at", { ascending: true }),
    user ? supabase.from("dokument_vorlagen").select("art,text").eq("user_id", user.id) : Promise.resolve({ data: [] }),
  ]);

  const vorlagen = Object.fromEntries(
    ((vorlagenRows as { art: string; text: string }[]) ?? []).map((r) => [r.art, r.text]),
  );

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/tenants/${tenant.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Dokument erstellen</div><div className="topbar-sub">{[tenant.vorname, tenant.nachname].filter(Boolean).join(" ")}</div></div>
        </div>
      </div>
      <DocGenerator tenant={tenant} property={(prop as Property) ?? null} vermieter={(vp as VermieterProfil) ?? null} ibans={(ibanRows as Iban[]) ?? []} vorlagen={vorlagen} />
    </div>
  );
}
