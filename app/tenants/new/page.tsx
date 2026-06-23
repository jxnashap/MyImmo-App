import TenantForm from "@/components/TenantForm";
import { createTenant } from "@/lib/actions/tenants";
import { createClient } from "@/lib/supabase/server";

export default async function NewTenantPage() {
  const supabase = createClient();
  const { data: props } = await supabase.from("properties").select("id,bezeichnung").order("bezeichnung");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-semibold">Neuer Mieter</h1>
      <TenantForm action={createTenant} properties={props ?? []} submitLabel="Anlegen" />
    </div>
  );
}
