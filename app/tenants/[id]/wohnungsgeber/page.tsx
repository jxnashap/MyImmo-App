import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import Wohnungsgeber from "@/components/Wohnungsgeber";
import type { Tenant, Property, VermieterProfil } from "@/lib/types";

export default async function WohnungsgeberPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: m } = await supabase.from("mieter").select("*").eq("id", params.id).single();
  if (!m) notFound();
  const tenant = m as Tenant;

  const [{ data: prop }, { data: vp }] = await Promise.all([
    tenant.prop_id ? supabase.from("properties").select("*").eq("id", tenant.prop_id).single() : Promise.resolve({ data: null }),
    user ? supabase.from("vermieter_profil").select("*").eq("user_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
  ]);

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={`/tenants/${tenant.id}`} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Wohnungsgeberbestätigung</div><div className="topbar-sub">{[tenant.vorname, tenant.nachname].filter(Boolean).join(" ")}</div></div>
        </div>
      </div>
      <Wohnungsgeber tenant={tenant} property={(prop as Property) ?? null} vermieter={(vp as VermieterProfil) ?? null} />
    </div>
  );
}
