import { createClient } from "@/lib/supabase/server";
import SettingsView from "@/components/SettingsView";
import { decryptIbanRow } from "@/lib/ibanData";
import { billingAktiv, getAbo, zaehleEinheiten, PLAN_NAMEN, effektiverPlan } from "@/lib/plan";
import type { VermieterProfil, Iban } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const supabase = createClient();
  const [{ data }, { data: ibanRows }, { data: { user } }, { data: signatur }, abo, einheiten] = await Promise.all([
    supabase.from("vermieter_profil").select("*").limit(1).maybeSingle(),
    supabase.from("ibans").select("*").order("created_at", { ascending: true }),
    supabase.auth.getUser(),
    supabase.from("unterschriften").select("data").maybeSingle(),
    getAbo(supabase),
    zaehleEinheiten(supabase),
  ]);

  return (
    <SettingsView
      profil={(data ?? null) as VermieterProfil | null}
      ibans={((ibanRows ?? []) as Iban[]).map(decryptIbanRow)}
      email={user?.email}
      provider={user?.app_metadata?.provider}
      unterschrift={signatur?.data ?? null}
      abo={abo ? {
        plan: effektiverPlan(abo),
        planName: PLAN_NAMEN[effektiverPlan(abo)],
        status: abo.status,
        zyklus: abo.zyklus,
        bankingAddon: abo.banking_addon,
        gueltigBis: abo.gueltig_bis,
        storniertZum: abo.storniert_zum,
        hatPortal: !!abo.provider_customer_id,
      } : null}
      einheiten={einheiten}
      billingEnforced={billingAktiv()}
    />
  );
}
