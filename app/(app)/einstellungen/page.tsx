import { createClient } from "@/lib/supabase/server";
import { aktuellerNutzer } from "@/lib/supabase/nutzer";
import SettingsView from "@/components/SettingsView";
import { decryptIbanRow } from "@/lib/ibanData";
import { ohnePasswort } from "@/lib/passwort";
import { billingAktiv, getAbo, zaehleEinheiten, PLAN_NAMEN, effektiverPlan } from "@/lib/plan";
import type { VermieterProfil, Iban } from "@/lib/types";
import { VERTRETER_SPALTEN, type Vertreter } from "@/lib/vertreter";
import { heuteBerlin } from "@/lib/zeitraum";

export const dynamic = "force-dynamic";

export default async function EinstellungenPage() {
  const supabase = await createClient();
  const [{ data }, { data: ibanRows }, user, { data: signatur }, abo, einheiten, passwortAntwort, { data: vertreterRows }] = await Promise.all([
    supabase.from("vermieter_profil").select("*").limit(1).maybeSingle(),
    supabase.from("ibans").select("*").order("created_at", { ascending: true }),
    aktuellerNutzer(),
    supabase.from("unterschriften").select("data").maybeSingle(),
    getAbo(supabase),
    zaehleEinheiten(supabase),
    supabase.rpc("konto_hat_passwort"),
    // Ohne datei_data (Base64) — der Scan kommt einzeln über /einstellungen/vertreter/[id].
    supabase.from("vertreter").select(VERTRETER_SPALTEN).order("created_at", { ascending: true }),
  ]);

  return (
    <SettingsView
      profil={(data ?? null) as VermieterProfil | null}
      ibans={((ibanRows ?? []) as Iban[]).map(decryptIbanRow)}
      email={user?.email}
      provider={user?.app_metadata?.provider}
      ohnePasswort={ohnePasswort(passwortAntwort, user?.app_metadata?.provider)}
      lastSignIn={user?.last_sign_in_at ?? null}
      benachrichtigungenAus={user?.user_metadata?.benachrichtigungen_aus === true}
      unterschrift={signatur?.data ?? null}
      abo={abo ? {
        plan: effektiverPlan(abo),
        planName: PLAN_NAMEN[effektiverPlan(abo)],
        status: abo.status,
        zyklus: abo.zyklus,
        gueltigBis: abo.gueltig_bis,
        storniertZum: abo.storniert_zum,
        hatPortal: !!abo.provider_customer_id,
      } : null}
      einheiten={einheiten}
      billingEnforced={billingAktiv()}
      vertreter={(vertreterRows ?? []) as unknown as Vertreter[]}
      heute={heuteBerlin()}
    />
  );
}
