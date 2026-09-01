import Link from "next/link";
import TenantForm from "@/components/TenantForm";
import { createTenant } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

export default async function NewTenantPage(props0: { searchParams: Promise<{ prop?: string; back?: string }> }) {
  const searchParams = await props0.searchParams;
  const supabase = await createClient();
  const { data: props } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");
  const back = searchParams.back || "/tenants";

  return (
    <div className="fade-up">
      <div className="topbar">
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href={back} className="btn btn-ghost" style={{ fontSize: 12, padding: "6px 12px" }}>← Zurück</Link>
          <div><div className="topbar-title">Neuer Mieter</div></div>
        </div>
      </div>
      <TenantForm action={createTenant} properties={props ?? []} submitLabel="Anlegen" propInitial={searchParams.prop ?? ""} back={back} />
    </div>
  );
}
