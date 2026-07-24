"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { kuendigeSubscription, paddleKonfiguriert } from "@/lib/billing/paddle";

// DSGVO Art. 17: löscht das eigene Konto samt aller Daten über die
// SECURITY-DEFINER-Funktion delete_own_account() und meldet danach ab.
//
// Security-Review-Fix (24.07.2026): Vor der Löschung wird ein laufendes
// Paddle-Abo SOFORT gekündigt — sonst würde Paddle nach der Kontolöschung
// weiter abbuchen, ohne dass der Kunde in der App noch kündigen könnte.
// Schlägt die Kündigung fehl, wird die Löschung abgebrochen (kein stilles
// Weiterlaufen von Zahlungen).
export async function deleteAccount(): Promise<void> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: abo } = await supabase
    .from("abos")
    .select("provider_subscription_id,status")
    .maybeSingle();
  const sub = (abo as { provider_subscription_id: string | null; status: string } | null);
  const laufend =
    !!sub?.provider_subscription_id &&
    ["aktiv", "testphase", "ueberfaellig", "pausiert"].includes(sub.status);

  if (laufend) {
    const gekuendigt = paddleKonfiguriert() && (await kuendigeSubscription(sub!.provider_subscription_id!));
    if (!gekuendigt) {
      throw new Error(
        "Dein laufendes Abo konnte nicht automatisch gekündigt werden. " +
        "Bitte kündige es zuerst unter Einstellungen → Abo (Zahlung & Kündigung verwalten) " +
        "oder melde dich beim Support — danach kannst du das Konto löschen.",
      );
    }
  }

  const { error } = await supabase.rpc("delete_own_account");
  if (error) {
    throw new Error("Konto konnte nicht gelöscht werden: " + error.message);
  }

  // Session beenden (Cookies löschen) und zur Login-Seite.
  await supabase.auth.signOut();
  redirect("/login?geloescht=1");
}
