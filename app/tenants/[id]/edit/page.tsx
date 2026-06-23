import Link from "next/link";
import { notFound } from "next/navigation";
import TenantForm from "@/components/TenantForm";
import PositionsManager, { type Position } from "@/components/PositionsManager";
import { createClient } from "@/lib/supabase/server";
import { updateTenant, deleteTenant } from "@/lib/actions/tenants";
import type { Tenant } from "@/lib/types";

export default async function EditTenantPage({ params }: { params: { id: string } }) {
  const supabase = createClient();
  const [{ data }, { data: props }, { data: positions }] = await Promise.all([
    supabase.from("mieter").select("*").eq("id", params.id).single(),
    supabase.from("properties").select("id,bezeichnung").order("bezeichnung"),
    supabase
      .from("mieter_positionen")
      .select("id,bezeichnung,betrag,umlageschluessel,umlagefaehig,jahr")
      .eq("mieter_id", params.id)
      .order("created_at"),
  ]);
  if (!data) notFound();
  const tenant = data as Tenant;

  const update = updateTenant.bind(null, tenant.id);
  const remove = deleteTenant.bind(null, tenant.id);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl">
          {[tenant.vorname, tenant.nachname].filter(Boolean).join(" ") || "Mieter"}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href={`/tenants/${tenant.id}/nk`}
            className="rounded-lg border border-[var(--gold)]/40 px-3 py-1.5 text-sm text-[var(--gold)] hover:bg-[var(--gold)]/10"
          >
            NK-Abrechnung
          </Link>
          <form action={remove}>
            <button className="rounded-lg border border-red-500/40 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10">
              Löschen
            </button>
          </form>
        </div>
      </div>

      <TenantForm action={update} tenant={tenant} properties={props ?? []} submitLabel="Speichern" />

      <hr className="my-8 border-white/10" />

      <PositionsManager mieterId={tenant.id} positions={(positions ?? []) as Position[]} />
    </div>
  );
}
