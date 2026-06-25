import { createClient } from "@/lib/supabase/server";
import SettingsView from "@/components/SettingsView";
import type { VermieterProfil, Iban } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const supabase = createClient();
  const [{ data }, { data: ibanRows }, { data: { user } }] = await Promise.all([
    supabase.from("vermieter_profil").select("*").limit(1).maybeSingle(),
    supabase.from("ibans").select("*").order("created_at", { ascending: true }),
    supabase.auth.getUser(),
  ]);

  return (
    <SettingsView
      profil={(data ?? null) as VermieterProfil | null}
      ibans={(ibanRows ?? []) as Iban[]}
      email={user?.email}
      provider={user?.app_metadata?.provider}
    />
  );
}
